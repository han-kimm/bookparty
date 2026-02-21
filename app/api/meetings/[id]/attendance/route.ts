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

// 출석 체크 상태 업데이트 (memberId 또는 nickname 기반)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { memberId, nickname, checkedIn, isAfterparty } = body;

  const col = adminDb.collection("attendances").doc(id).collection("members");

  if (memberId) {
    // 기존 방식: memberId로 직접 업데이트
    const update: Record<string, unknown> = {};
    if (checkedIn !== undefined) {
      update.checkedIn = checkedIn;
      update.checkedInAt = checkedIn ? new Date().toISOString() : null;
    }
    if (isAfterparty !== undefined) {
      update.isAfterparty = isAfterparty;
    }
    await col.doc(memberId).update(update);
  } else if (nickname) {
    // 닉네임 기반: 기존 문서 찾아서 업데이트, 없으면 생성
    const snap = await col.where("nickname", "==", nickname).limit(1).get();
    if (!snap.empty) {
      await snap.docs[0].ref.update({
        checkedIn,
        checkedInAt: checkedIn ? new Date().toISOString() : null,
      });
    } else {
      await col.add({
        nickname,
        checkedIn,
        checkedInAt: checkedIn ? new Date().toISOString() : null,
        isAfterparty: false,
      });
    }
  } else {
    return NextResponse.json({ error: "memberId 또는 nickname 필수" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
