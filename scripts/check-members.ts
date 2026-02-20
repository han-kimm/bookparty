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
  const snap = await db.collection("members").get();
  console.log(`members 컬렉션: ${snap.size}개`);
  snap.docs.slice(0, 3).forEach(d => console.log(" ", d.id, d.data().realName, d.data().nickname));
  process.exit(0);
}
main().catch(err => { console.error(err); process.exit(1); });
