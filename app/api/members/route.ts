import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snapshot = await adminDb.collection("members").orderBy("nickname").get();
  const members = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json(members);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { nickname } = body;

  if (!nickname) return NextResponse.json({ error: "nickname 필수" }, { status: 400 });

  const docRef = await adminDb.collection("members").add({
    nickname,
    joinedAt: new Date().toISOString(),
    duesStatus: {},
  });

  return NextResponse.json({ id: docRef.id });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id 필수" }, { status: 400 });

  await adminDb.collection("members").doc(id).update(updates);
  return NextResponse.json({ success: true });
}
