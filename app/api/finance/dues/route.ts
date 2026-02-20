import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 특정 월의 회비 현황 조회
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const month = req.nextUrl.searchParams.get("month"); // 예: "2026-02"
  if (!month) return NextResponse.json({ error: "month 필수 (예: 2026-02)" }, { status: 400 });

  const snapshot = await adminDb.collection("members").get();
  const result = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      realName: data.realName,
      nickname: data.nickname,
      paid: data.duesStatus?.[month] ?? false,
    };
  });

  return NextResponse.json(result);
}

// 회비 납부 상태 토글
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { memberId, month, paid } = body;
  if (!memberId || !month) return NextResponse.json({ error: "memberId, month 필수" }, { status: 400 });

  await adminDb.collection("members").doc(memberId).update({
    [`duesStatus.${month}`]: paid,
  });

  return NextResponse.json({ success: true });
}
