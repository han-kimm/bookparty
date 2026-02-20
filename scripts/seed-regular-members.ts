/**
 * 정회원 출석부 초기 데이터 시드
 * 실행: pnpm dlx tsx --env-file=.env.local scripts/seed-regular-members.ts
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

async function getMeetingId(date: string): Promise<string> {
  const snap = await db.collection("meetings").where("date", "==", date).get();
  if (snap.empty) throw new Error(`모임 없음: ${date}`);
  return snap.docs[0].id;
}

interface RegularMember {
  nickname: string;
  role: string;
  order: number;
  attendance: Record<string, boolean>;
  dues: Record<string, boolean>;
}

async function main() {
  // 미팅 ID 조회
  const [m0117, m0207, m0221, m0307, m0321] = await Promise.all([
    getMeetingId("2026-01-17"),
    getMeetingId("2026-02-07"),
    getMeetingId("2026-02-21"),
    getMeetingId("2026-03-07"),
    getMeetingId("2026-03-21"),
  ]);
  console.log("미팅 ID 조회 완료");
  console.log(`1/17: ${m0117}, 2/7: ${m0207}, 2/21: ${m0221}, 3/7: ${m0307}, 3/21: ${m0321}`);

  // 기존 데이터 삭제
  const existing = await db.collection("regularMembers").get();
  if (!existing.empty) {
    const batch = db.batch();
    existing.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    console.log(`기존 ${existing.size}개 삭제`);
  }

  const members: RegularMember[] = [
    {
      nickname: "장미", role: "★(수령)★", order: 1,
      attendance: { [m0117]: true, [m0207]: true },
      dues: { "2026-Q1": true },
    },
    {
      nickname: "플로우", role: "총무", order: 2,
      attendance: {},
      dues: { "2026-Q1": true },
    },
    {
      nickname: "하이만", role: "기획", order: 3,
      attendance: { [m0117]: true },
      dues: { "2026-Q1": true },
    },
    {
      nickname: "용", role: "홍보", order: 4,
      attendance: { [m0117]: true, [m0207]: true },
      dues: { "2026-Q1": true },
    },
    {
      nickname: "모", role: "", order: 5,
      attendance: { [m0117]: true, [m0207]: true },
      dues: { "2026-Q1": true },
    },
    {
      nickname: "BK", role: "", order: 6,
      attendance: { [m0117]: true, [m0207]: true },
      dues: { "2026-Q1": false },
    },
    {
      nickname: "기로", role: "", order: 7,
      attendance: { [m0117]: true, [m0207]: true },
      dues: { "2026-Q1": false },
    },
    {
      nickname: "김진수", role: "", order: 8,
      attendance: { [m0117]: true },
      dues: { "2026-Q1": true },
    },
    {
      nickname: "JOHNNY", role: "", order: 9,
      attendance: { [m0117]: true, [m0207]: true },
      dues: { "2026-Q1": false },
    },
    {
      nickname: "우주로", role: "", order: 10,
      attendance: { [m0117]: true },
      dues: { "2026-Q1": true },
    },
    {
      nickname: "크리스", role: "", order: 11,
      attendance: { [m0117]: true },
      dues: { "2026-Q1": true },
    },
    {
      nickname: "도담", role: "", order: 12,
      attendance: { [m0117]: true },
      dues: { "2026-Q1": true },
    },
    {
      nickname: "계란빵", role: "", order: 13,
      attendance: { [m0117]: true, [m0207]: true },
      dues: { "2026-Q1": true },
    },
    {
      nickname: "류준환", role: "", order: 14,
      attendance: { [m0117]: true, [m0207]: true },
      dues: { "2026-Q1": true },
    },
    {
      nickname: "예진", role: "", order: 15,
      attendance: { [m0117]: true, [m0207]: true },
      dues: { "2026-Q1": false },
    },
    {
      nickname: "빅터", role: "", order: 16,
      attendance: { [m0117]: true },
      dues: { "2026-Q1": false },
    },
    {
      nickname: "벽공", role: "", order: 17,
      attendance: { [m0117]: true },
      dues: { "2026-Q1": true },
    },
    {
      nickname: "운남", role: "", order: 18,
      attendance: { [m0117]: true, [m0207]: true },
      dues: { "2026-Q1": true },
    },
    {
      nickname: "참둘기", role: "", order: 19,
      attendance: { [m0207]: true },
      dues: { "2026-Q1": true },
    },
    {
      nickname: "하이", role: "", order: 20,
      attendance: { [m0207]: true, [m0221]: true },
      dues: { "2026-Q1": false },
    },
    {
      nickname: "준", role: "", order: 21,
      attendance: { [m0207]: true },
      dues: {},
    },
  ];

  const batch = db.batch();
  for (const m of members) {
    const ref = db.collection("regularMembers").doc();
    batch.set(ref, m);
    const duesStatus = m.dues["2026-Q1"] === true ? "O" : m.dues["2026-Q1"] === false ? "X" : "-";
    console.log(`  ✓ ${m.nickname.padEnd(8)} ${m.role.padEnd(10)} 1분기=${duesStatus}`);
  }
  await batch.commit();
  console.log(`\n완료! ${members.length}명 저장됨`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
