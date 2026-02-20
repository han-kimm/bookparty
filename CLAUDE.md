# 책읽당 대시보드 — 개발 가이드

## 프로젝트 개요
매월 1·3번째 토요일에 모이는 책모임 운영진(4명)을 위한 관리 대시보드.
비개발자 운영진도 쉽게 사용할 수 있는 **모바일 우선** 인터페이스가 핵심.

---

## 패키지 매니저
**pnpm만 사용.** npm, yarn 사용 금지.

```bash
pnpm install      # 의존성 설치
pnpm dev          # 개발 서버 (localhost:3000)
pnpm build        # 프로덕션 빌드
pnpm lint         # 린트
```

shadcn/ui 컴포넌트 추가 시:
```bash
pnpm dlx shadcn@latest add <component>
```

---

## 기술 스택

| 레이어 | 기술 | 비고 |
|--------|------|------|
| 프레임워크 | Next.js 16 (App Router, Turbopack) | |
| 인증 | NextAuth.js v5 beta + Google OAuth | `lib/auth.ts` |
| DB | Firebase Firestore | Admin SDK (서버 전용) |
| 스타일 | Tailwind CSS v4 + shadcn/ui | |
| 라우트 보호 | `proxy.ts` | Next.js 16에서는 middleware.ts 아님 |

---

## 프로젝트 구조

```
app/
├── dashboard/              # 메인 홈 (서버 컴포넌트)
├── meetings/               # 모임 목록
│   ├── new/                # 모임 등록
│   └── [id]/
│       ├── attendance/     # 현장 출석 체크 (클라이언트)
│       └── presenter/      # 모임 정보 수정
├── finance/
│   ├── dues/               # 월별 회비 납부 현황
│   └── afterparty/         # 뒤풀이 정산 (1/n 계산)
├── announcements/          # 내부/외부 공지문 자동 생성
├── members/                # 회원 추가·수정 (실명/닉네임)
├── login/                  # Google 로그인 페이지
└── api/                    # API 라우트 (모두 force-dynamic)
    ├── meetings/
    ├── members/
    └── finance/

components/
├── nav.tsx                 # TopBar + BottomNav (모바일 네비게이션)
├── session-provider.tsx    # NextAuth SessionProvider 래퍼
└── ui/                     # shadcn/ui 컴포넌트 (수정 금지)

lib/
├── auth.ts                 # NextAuth 설정, ALLOWED_EMAILS로 접근 제한
├── firebase.ts             # 클라이언트 Firebase 초기화
├── firebase-admin.ts       # 서버 Firebase Admin (Proxy 패턴, 지연 초기화)
├── types.ts                # 공통 타입 정의
└── utils.ts                # shadcn cn() 유틸

proxy.ts                    # 인증 미들웨어 (Next.js 16 규칙)
```

---

## Firestore 데이터 모델

```
meetings/{meetingId}
  date, title, author, presenter, venue
  formUrl, bookUrl, isAfterparty, createdAt

attendances/{meetingId}/members/{memberId}
  nickname, realName, checkedIn, checkedInAt, isAfterparty

members/{memberId}
  realName, nickname, joinedAt
  duesStatus: { "2026-01": true, "2026-02": false }

finance/{meetingId}/afterparty/main
  totalAmount, participants[{name, amount, paid}], notes, perPerson
```

---

## 핵심 개발 규칙

### API 라우트
- 모든 API 라우트 파일 상단에 반드시 추가:
  ```ts
  export const dynamic = "force-dynamic";
  ```
- 모든 API는 `auth()` 세션 확인 후 401 반환이 첫 줄이어야 함.
- Firebase Admin은 `lib/firebase-admin.ts`의 `adminDb`만 사용 (직접 초기화 금지).

### Firebase Admin 초기화
`adminDb`는 Proxy 패턴으로 지연 초기화됨 — 빌드 시점에 환경변수가 없어도 오류 없음.
절대로 모듈 최상단에서 `initializeApp()`을 직접 호출하지 말 것.

### 클라이언트 컴포넌트
- 데이터 페칭은 반드시 `/api/...` 라우트를 통해 fetch.
- Firebase SDK를 클라이언트에서 직접 호출 금지 (보안 규칙상 모든 직접 접근 차단).

### 인증
- `proxy.ts`가 모든 페이지를 보호. `/login`과 `/api/auth/**`만 공개.
- 허용 이메일은 `ALLOWED_EMAILS` 환경변수(쉼표 구분)로 관리.

### UX 원칙 (비개발자 친화)
- 모바일 기준으로 설계 (터치 타겟 최소 44px).
- 버튼은 크게, 텍스트는 명확하게.
- 낙관적 업데이트 + Undo 패턴 사용 (출석 체크 참고).
- 로딩 스켈레톤은 `animate-pulse` Tailwind 클래스 활용.

---

## 환경변수 (.env.local)

```bash
# Firebase 클라이언트 (NEXT_PUBLIC_*)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (서버 전용)
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=   # openssl rand -base64 32

# 운영진 이메일 (쉼표 구분, 이 이메일만 로그인 가능)
ALLOWED_EMAILS=a@gmail.com,b@gmail.com
```

`.env.local.example` 파일에 템플릿 있음.

---

## 새 페이지·기능 추가 체크리스트

1. `app/(섹션)/layout.tsx` — `TopBar` + `BottomNav` + `max-w-lg mx-auto pb-24 px-4` 패턴 유지
2. 서버 데이터가 필요하면 서버 컴포넌트로, 인터랙션이 많으면 `"use client"` 클라이언트 컴포넌트로
3. 새 API 라우트 → `export const dynamic = "force-dynamic"` + 세션 체크 추가
4. 새 Firestore 컬렉션 → `lib/types.ts`에 타입 추가
5. `pnpm build`로 타입 오류 없음 확인 후 PR

---

## 추후 개발 예정 기능 (MVP 이후)
- Google Forms API 연동 — 신청자 명단 자동 불러오기 (`lib/google-forms.ts` 준비됨)
- Google Sheets 출석 결과 내보내기 (`lib/google-sheets.ts` 준비됨)
- Google Calendar 모임 일정 자동 등록
- 3대행사 TF 조직 관리
- 전자문집 관리
- 공지 채널 자동 발송 (친구사이, 이반시티 Playwright 자동화 검토 중)
