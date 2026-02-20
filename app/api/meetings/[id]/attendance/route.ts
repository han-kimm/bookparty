import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 출석 목록 조회
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const snapshot = await adminDb
    .collection("attendances")
    .doc(id)
    .collection("members")
    .get();

  const members = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json(members);
}

// 출석자 추가 (구글폼 불러오기 또는 수동 추가)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { nickname, isAfterparty } = body;

  if (!nickname) return NextResponse.json({ error: "nickname 필수" }, { status: 400 });

  const docRef = adminDb.collection("attendances").doc(id).collection("members").doc();
  await docRef.set({
    nickname,
    checkedIn: false,
    checkedInAt: null,
    isAfterparty: isAfterparty ?? false,
  });

  return NextResponse.json({ id: docRef.id });
}

// 출석자 제거
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { memberId } = await req.json();

  if (!memberId) return NextResponse.json({ error: "memberId 필수" }, { status: 400 });

  await adminDb
    .collection("attendances")
    .doc(id)
    .collection("members")
    .doc(memberId)
    .delete();

  return NextResponse.json({ success: true });
}

// 출석 체크 상태 일괄 업데이트
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { memberId, checkedIn } = body;

  await adminDb
    .collection("attendances")
    .doc(id)
    .collection("members")
    .doc(memberId)
    .update({
      checkedIn,
      checkedInAt: checkedIn ? new Date().toISOString() : null,
    });

  return NextResponse.json({ success: true });
}
