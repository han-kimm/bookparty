import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const meetingId = req.nextUrl.searchParams.get("meetingId");
  if (!meetingId) return NextResponse.json({ error: "meetingId 필수" }, { status: 400 });

  const doc = await adminDb.collection("finance").doc(meetingId).collection("afterparty").doc("main").get();
  if (!doc.exists) return NextResponse.json(null);

  return NextResponse.json(doc.data());
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { meetingId, totalAmount, participants, notes } = body;
  if (!meetingId) return NextResponse.json({ error: "meetingId 필수" }, { status: 400 });

  const perPerson = participants?.length > 0 ? Math.ceil(totalAmount / participants.length) : 0;

  await adminDb.collection("finance").doc(meetingId).collection("afterparty").doc("main").set({
    meetingId,
    totalAmount: totalAmount || 0,
    participants: participants || [],
    notes: notes || "",
    perPerson,
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, perPerson });
}
