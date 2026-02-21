import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { auth } from "@/lib/auth";
import { syncMeetingAttendanceToSheet } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [meetingDoc, attendanceSnapshot, regularMembersSnapshot] = await Promise.all([
    adminDb.collection("meetings").doc(id).get(),
    adminDb.collection("attendances").doc(id).collection("members").get(),
    adminDb.collection("regularMembers").get(),
  ]);

  if (!meetingDoc.exists) {
    return NextResponse.json({ error: "모임을 찾을 수 없습니다." }, { status: 404 });
  }

  const meeting = meetingDoc.data() as { date: string; title: string };

  // 정회원 닉네임 Set
  const regularNicknames = new Set(
    regularMembersSnapshot.docs.map((d) => (d.data().nickname as string ?? "").trim())
  );

  // 출석 체크된 정회원 닉네임만 필터
  const attendedRegularNicknames = new Set<string>();
  for (const doc of attendanceSnapshot.docs) {
    const data = doc.data();
    const nickname = (data.nickname as string ?? "").trim();
    if (data.checkedIn && regularNicknames.has(nickname)) {
      attendedRegularNicknames.add(nickname);
    }
  }

  try {
    await syncMeetingAttendanceToSheet(meeting.date, attendedRegularNicknames);
    return NextResponse.json({
      success: true,
      synced: attendedRegularNicknames.size,
      totalAttendees: attendanceSnapshot.size,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sync-sheets]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
