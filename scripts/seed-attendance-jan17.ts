/**
 * 2026-01-17 모임 출석 데이터 시드
 * 실행: pnpm dlx tsx --env-file=.env.local scripts/seed-attendance-jan17.ts
 */

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const app = getApps().length > 0 ? getApps()[0] : initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore(app);

const MEETING_ID = "HvI82FlRJ6Ni2xjYvjRj";

interface AttendanceSeed {
  nickname: string;
  contact: string;
  checkedIn: boolean;   // false = 미참석
  isAfterparty: boolean; // 뒤풀이 참석 여부
  note: string;         // 기타 메모
}

const attendees: AttendanceSeed[] = [
  { nickname: "감자",     contact: "1099120971",             checkedIn: true,  isAfterparty: false, note: "당일 상황에 따라 결정" },
  { nickname: "곰",       contact: "1075767801",             checkedIn: true,  isAfterparty: true,  note: "" },
  { nickname: "김진수",   contact: "",                       checkedIn: true,  isAfterparty: false, note: "당일 상황에 따라 결정" },
  { nickname: "도담",     contact: "",                       checkedIn: true,  isAfterparty: true,  note: "" },
  { nickname: "도현",     contact: "1033335164",             checkedIn: true,  isAfterparty: true,  note: "" },
  { nickname: "돌맹",     contact: "kasung91@naver.com",     checkedIn: true,  isAfterparty: false, note: "당일 상황에 따라 결정" },
  { nickname: "라흐",     contact: "jeonghwa1906@gmail.com", checkedIn: true,  isAfterparty: true,  note: "당일 상황에 따라 결정" },
  { nickname: "류준환",   contact: "",                       checkedIn: true,  isAfterparty: false, note: "당일 상황에 따라 결정" },
  { nickname: "마일로",   contact: "010-5098-1582",          checkedIn: true,  isAfterparty: false, note: "당일 상황에 따라 결정" },
  { nickname: "모",       contact: "1074579757",             checkedIn: true,  isAfterparty: true,  note: "" },
  { nickname: "버드",     contact: "010-8253-5381",          checkedIn: false, isAfterparty: false, note: "미참석" },
  { nickname: "벽공",     contact: "",                       checkedIn: true,  isAfterparty: true,  note: "" },
  { nickname: "산",       contact: "1089953938",             checkedIn: true,  isAfterparty: false, note: "당일 상황에 따라 결정" },
  { nickname: "예진",     contact: "1035753109",             checkedIn: true,  isAfterparty: true,  note: "" },
  { nickname: "우주로",   contact: "pitachu@naver.com",      checkedIn: false, isAfterparty: false, note: "미참석" },
  { nickname: "운남",     contact: "",                       checkedIn: true,  isAfterparty: true,  note: "" },
  { nickname: "유니짜장", contact: "",                       checkedIn: true,  isAfterparty: true,  note: "" },
  { nickname: "윤",       contact: "1063532574",             checkedIn: true,  isAfterparty: true,  note: "" },
  { nickname: "윤",       contact: "1082278936",             checkedIn: false, isAfterparty: false, note: "미참석" },
  { nickname: "제이제이", contact: "1045287781",             checkedIn: true,  isAfterparty: true,  note: "" },
  { nickname: "지니",     contact: "1042771798",             checkedIn: true,  isAfterparty: true,  note: "" },
  { nickname: "진",       contact: "1029051829",             checkedIn: true,  isAfterparty: false, note: "당일 상황에 따라 결정" },
  { nickname: "크리스",   contact: "",                       checkedIn: true,  isAfterparty: true,  note: "" },
  { nickname: "호이",     contact: "010-8558-6313",          checkedIn: true,  isAfterparty: false, note: "당일 상황에 따라 결정" },
  { nickname: "BK",       contact: "010-8723-3347",          checkedIn: true,  isAfterparty: true,  note: "" },
  { nickname: "JOHNNY",   contact: "",                       checkedIn: true,  isAfterparty: true,  note: "" },
  // 운영진
  { nickname: "장미",     contact: "운영진",                  checkedIn: true,  isAfterparty: false, note: "운영진·발제자" },
  { nickname: "하이만",   contact: "",                       checkedIn: false, isAfterparty: false, note: "미참" },
  { nickname: "용",       contact: "",                       checkedIn: false, isAfterparty: false, note: "미참" },
  { nickname: "계란빵",   contact: "",                       checkedIn: true,  isAfterparty: false, note: "운영진" },
  { nickname: "james최",  contact: "",                       checkedIn: true,  isAfterparty: false, note: "운영진" },
  { nickname: "빅터",     contact: "",                       checkedIn: true,  isAfterparty: false, note: "운영진" },
  { nickname: "기로",     contact: "",                       checkedIn: true,  isAfterparty: false, note: "운영진" },
  { nickname: "오재",     contact: "",                       checkedIn: true,  isAfterparty: false, note: "중간 참석" },
];

async function main() {
  const col = db.collection("attendances").doc(MEETING_ID).collection("members");

  // 기존 데이터 확인
  const existing = await col.get();
  if (!existing.empty) {
    console.log(`⚠️  이미 ${existing.size}개의 출석 데이터가 있습니다. 중복 추가를 건너뜁니다.`);
    process.exit(0);
  }

  const batch = db.batch();
  for (const a of attendees) {
    const ref = col.doc();
    batch.set(ref, {
      nickname: a.nickname,
      realName: a.nickname,
      contact: a.contact,
      checkedIn: a.checkedIn,
      checkedInAt: a.checkedIn ? "2026-01-17T00:00:00.000Z" : null,
      isAfterparty: a.isAfterparty,
      note: a.note,
    });
    const status = a.checkedIn ? (a.isAfterparty ? "참석+뒤풀이" : "참석") : "미참석";
    console.log(`  ✓ ${a.nickname.padEnd(8)} ${status}`);
  }

  await batch.commit();
  console.log(`\n완료! ${attendees.length}명 저장됨.`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
