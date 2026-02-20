/**
 * members 컬렉션 시드 (regularMembers에서 동기화)
 * 실행: pnpm dlx tsx --env-file=.env.local scripts/seed-members.ts
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

async function main() {
  const snap = await db.collection("regularMembers").orderBy("order").get();

  const batch = db.batch();
  for (const doc of snap.docs) {
    const { nickname, dues } = doc.data();
    const ref = db.collection("members").doc();

    // 분기 회비를 duesStatus로 변환 (2026-Q1 → 그대로 사용)
    const duesStatus: Record<string, boolean> = {};
    if (dues) {
      Object.entries(dues).forEach(([k, v]) => {
        duesStatus[k] = v as boolean;
      });
    }

    batch.set(ref, {
      realName: nickname,
      nickname,
      joinedAt: new Date().toISOString(),
      duesStatus,
    });
    console.log(`  ✓ ${nickname}`);
  }

  await batch.commit();
  console.log(`\n완료! ${snap.size}명 저장됨`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
