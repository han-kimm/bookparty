# 책읽당 대시보드 설정 가이드

## 1단계: Firebase 프로젝트 생성

1. [Firebase Console](https://console.firebase.google.com) 접속 → 새 프로젝트 생성
2. **Firestore Database** 활성화 (Production mode → 서울 리전 선택)
3. **Authentication** 활성화 → Sign-in providers → Google 추가

### Service Account 키 생성 (서버용)
- 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성 → JSON 다운로드

---

## 2단계: Google OAuth 앱 설정

1. [Google Cloud Console](https://console.cloud.google.com) → 해당 Firebase 프로젝트 선택
2. API 및 서비스 → 사용자 인증 정보 → OAuth 2.0 클라이언트 ID 생성
   - 유형: 웹 애플리케이션
   - 승인된 리디렉션 URI 추가:
     - `http://localhost:3000/api/auth/callback/google` (개발용)
     - `https://your-domain.vercel.app/api/auth/callback/google` (배포 후)

---

## 3단계: 환경변수 설정

`.env.local` 파일을 생성하고 아래 내용을 채웁니다:

```bash
cp .env.local.example .env.local
```

| 변수명 | 값 위치 |
|--------|---------|
| `NEXT_PUBLIC_FIREBASE_*` | Firebase 콘솔 → 프로젝트 설정 → 앱 추가 → 웹 |
| `FIREBASE_ADMIN_*` | 다운로드한 Service Account JSON 파일 |
| `GOOGLE_CLIENT_ID/SECRET` | Google Cloud Console → OAuth 클라이언트 |
| `NEXTAUTH_SECRET` | 터미널에서 `openssl rand -base64 32` 실행 |
| `ALLOWED_EMAILS` | 운영진 4명의 구글 이메일 (쉼표 구분) |

---

## 4단계: 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 접속

---

## 5단계: Vercel 배포

```bash
# Vercel CLI 설치
npm i -g vercel

# 배포
vercel

# 환경변수는 Vercel 대시보드 → Settings → Environment Variables에 동일하게 추가
```

배포 후 Google Cloud Console의 OAuth 리디렉션 URI에 Vercel 도메인 추가 필수.

---

## Firestore 보안 규칙 설정

Firebase 콘솔 → Firestore → 규칙 탭에 아래 내용 적용:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 서버 사이드 API만 접근 (Admin SDK 사용하므로 클라이언트 직접 접근 차단)
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

> 모든 데이터 접근은 서버 API 라우트(Admin SDK)를 통해서만 이루어집니다.

---

## 주요 기능 사용법

### 출석 체크 (현장)
1. 모바일로 대시보드 접속 → **모임** 탭
2. 해당 모임의 **출석** 버튼 탭
3. 이름을 탭하면 출석 체크 (초록색으로 변함)
4. 실수로 체크했을 경우 화면 하단 **되돌리기** 버튼 탭

### 회비 관리
1. **회비** 탭 → 월 선택
2. 통장 확인 후 납부자 탭 → 자동 저장

### 공지 작성
1. **공지** 탭 → 모임 선택
2. 내부/외부 탭 전환 후 **복사** 버튼
3. 해당 채널에 붙여넣기

### 뒤풀이 정산
1. **회비** 탭 → 뒤풀이 정산 (또는 홈에서 빠른 실행)
2. 모임 선택 → 총 금액 입력 → 참가자 추가
3. 1/n 자동 계산 → 납부 확인 탭
4. **복사** 버튼으로 카톡 공유
