/**
 * 모든 모임의 isAfterparty를 true로 업데이트
 * 실행: pnpm dlx tsx --env-file=.env.local scripts/set-all-afterparty.ts
 */

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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

async function main() {
  const snapshot = await db.collection("meetings").get();
  console.log(`총 ${snapshot.size}개 모임 발견`);

  await Promise.all(
    snapshot.docs.map((doc) => doc.ref.update({ isAfterparty: true }))
  );

  console.log(`✅ 모든 모임의 isAfterparty를 true로 업데이트 완료`);
}

main().catch(console.error);
