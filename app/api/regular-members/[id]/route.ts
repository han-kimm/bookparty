import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// attendance 또는 dues 필드 단위 업데이트
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  // body 예시: { "attendance.MEETING_ID": true } 또는 { "dues.2026-Q1": true }
  await adminDb.collection("regularMembers").doc(id).update(body);
  return NextResponse.json({ ok: true });
}
