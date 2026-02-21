import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const meetingId = req.nextUrl.searchParams.get("meetingId");
  if (!meetingId) return NextResponse.json({ error: "meetingId 필수" }, { status: 400 });

  const roundParam = req.nextUrl.searchParams.get("round") ?? "1";
  const docId = `round_${roundParam}`;

  const doc = await adminDb
    .collection("finance")
    .doc(meetingId)
    .collection("afterparty")
    .doc(docId)
    .get();

  if (doc.exists) return NextResponse.json(doc.data());

  // round_1 없을 때 기존 'main' 문서로 fallback (마이그레이션)
  if (roundParam === "1") {
    const mainDoc = await adminDb
      .collection("finance")
      .doc(meetingId)
      .collection("afterparty")
      .doc("main")
      .get();
    if (mainDoc.exists) return NextResponse.json(mainDoc.data());
  }

  return NextResponse.json(null);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { meetingId, round = 1, totalAmount, participants, notes } = body;
  if (!meetingId) return NextResponse.json({ error: "meetingId 필수" }, { status: 400 });

  const docId = `round_${round}`;
  const perPerson =
    participants?.length > 0 ? Math.ceil(totalAmount / participants.length) : 0;

  await adminDb
    .collection("finance")
    .doc(meetingId)
    .collection("afterparty")
    .doc(docId)
    .set({
      meetingId,
      round,
      totalAmount: totalAmount || 0,
      participants: participants || [],
      notes: notes || "",
      perPerson,
      updatedAt: new Date().toISOString(),
    });

  return NextResponse.json({ success: true, perPerson });
}
