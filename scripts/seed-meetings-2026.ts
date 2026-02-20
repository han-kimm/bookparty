/**
 * 책읽당 2026년 모임 일정 Firestore 시드 스크립트
 * 실행: pnpm dlx tsx --env-file=.env.local scripts/seed-meetings-2026.ts
 */

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Firebase Admin 초기화
const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      });

const db = getFirestore(app);

interface MeetingSeed {
  date: string; // ISO 날짜 (KST 기준 YYYY-MM-DD)
  title: string;
  author: string;
  presenter: string;
  venue: string;
  formUrl: string;
  bookUrl: string;
  isAfterparty: boolean;
}

const meetings2026: MeetingSeed[] = [
  // 1월
  {
    date: "2026-01-17",
    title: "나의 최애를 소개해",
    author: "",
    presenter: "장미",
    venue: "사정전",
    formUrl: "",
    bookUrl: "",
    isAfterparty: false,
  },
  // 2월
  {
    date: "2026-02-07",
    title: "우리는 사랑하기 좋은 팔을 가졌구나",
    author: "민음사",
    presenter: "장미",
    venue: "사정전",
    formUrl: "",
    bookUrl: "",
    isAfterparty: false,
  },
  {
    date: "2026-02-21",
    title: "양면의 조개 껍데기",
    author: "김초엽, 래빗홀",
    presenter: "하이",
    venue: "사정전",
    formUrl: "",
    bookUrl: "",
    isAfterparty: false,
  },
  // 3월
  {
    date: "2026-03-07",
    title: "노르웨이의 숲",
    author: "무라카미 하루키, 민음사",
    presenter: "계란빵",
    venue: "사정전",
    formUrl: "",
    bookUrl: "",
    isAfterparty: false,
  },
  {
    date: "2026-03-21",
    title: "독서 모임",
    author: "",
    presenter: "",
    venue: "사정전",
    formUrl: "",
    bookUrl: "",
    isAfterparty: false,
  },
  // 4월
  {
    date: "2026-04-04",
    title: "독서 모임",
    author: "",
    presenter: "",
    venue: "",
    formUrl: "",
    bookUrl: "",
    isAfterparty: false,
  },
  {
    date: "2026-04-25",
    title: "독서 모임",
    author: "",
    presenter: "",
    venue: "",
    formUrl: "",
    bookUrl: "",
    isAfterparty: false,
  },
  // 5월
  {
    date: "2026-05-02",
    title: "독서 모임",
    author: "",
    presenter: "",
    venue: "",
    formUrl: "",
    bookUrl: "",
    isAfterparty: false,
  },
  {
    date: "2026-05-16",
    title: "소풍/야외 독서모임",
    author: "",
    presenter: "",
    venue: "",
    formUrl: "",
    bookUrl: "",
    isAfterparty: false,
  },
  // 6월
  {
    date: "2026-06-06",
    title: "독서 모임",
    author: "",
    presenter: "",
    venue: "",
    formUrl: "",
    bookUrl: "",
    isAfterparty: false,
  },
  {
    date: "2026-06-20",
    title: "독서 모임",
    author: "",
    presenter: "",
    venue: "",
    formUrl: "",
    bookUrl: "",
    isAfterparty: false,
  },
  // 7월
  {
    date: "2026-07-04",
    title: "독서 모임",
    author: "",
    presenter: "",
    venue: "",
    formUrl: "",
    bookUrl: "",
    isAfterparty: false,
  },
  {
    date: "2026-07-18",
    title: "특별 주간",
    author: "",
    presenter: "",
    venue: "",
    formUrl: "",
    bookUrl: "",
    isAfterparty: false,
  },
  // 8월
  {
    date: "2026-08-01",
    title: "MT (1박 2일)",
    author: "",
    presenter: "",
    venue: "",
    formUrl: "",
    bookUrl: "",
    isAfterparty: false,
  },
  {
    date: "2026-08-15",
    title: "독서 모임",
    author: "",
    presenter: "",
    venue: "",
    formUrl: "",
    bookUrl: "",
    isAfterparty: false,
  },
  // 9월
  {
    date: "2026-09-05",
    title: "독서 모임",
    author: "",
    presenter: "",
    venue: "",
    formUrl: "",
    bookUrl: "",
    isAfterparty: false,
  },
  {
    date: "2026-09-19",
    title: "기획 예정",
    author: "",
    presenter: "",
    venue: "",
    formUrl: "",
    bookUrl: "",
    isAfterparty: false,
  },
  // 10월
  {
    date: "2026-10-03",
    title: "독서 모임",
    author: "",
    presenter: "",
    venue: "",
    formUrl: "",
    bookUrl: "",
    isAfterparty: false,
  },
  {
    date: "2026-10-17",
    title: "독서 모임",
    author: "",
    presenter: "",
    venue: "",
    formUrl: "",
    bookUrl: "",
    isAfterparty: false,
  },
  // 11월
  {
    date: "2026-11-07",
    title: "독서 모임",
    author: "",
    presenter: "",
    venue: "",
    formUrl: "",
    bookUrl: "",
    isAfterparty: false,
  },
  {
    date: "2026-11-21",
    title: "독서 모임",
    author: "",
    presenter: "",
    venue: "",
    formUrl: "",
    bookUrl: "",
    isAfterparty: false,
  },
];

async function seed() {
  console.log(`총 ${meetings2026.length}개 모임을 추가합니다...\n`);

  const batch = db.batch();

  for (const meeting of meetings2026) {
    const ref = db.collection("meetings").doc();
    batch.set(ref, {
      ...meeting,
      createdAt: new Date().toISOString(),
    });
    console.log(`  ✓ ${meeting.date} — ${meeting.title}`);
  }

  await batch.commit();
  console.log("\n완료! 모든 모임이 Firestore에 저장되었습니다.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("오류 발생:", err);
  process.exit(1);
});
