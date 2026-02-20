import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { auth } from "@/lib/auth";
import { syncAttendanceToSheet } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [meetingDoc, attendanceSnapshot] = await Promise.all([
    adminDb.collection("meetings").doc(id).get(),
    adminDb.collection("attendances").doc(id).collection("members").get(),
  ]);

  if (!meetingDoc.exists) {
    return NextResponse.json({ error: "모임을 찾을 수 없습니다." }, { status: 404 });
  }

  const meeting = meetingDoc.data() as { date: string; title: string };
  const members = attendanceSnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      nickname: data.nickname as string,
      checkedIn: data.checkedIn as boolean,
      checkedInAt: data.checkedInAt as string | null | undefined,
      isAfterparty: data.isAfterparty as boolean,
    };
  });

  try {
    await syncAttendanceToSheet(meeting.date, meeting.title, members);
    return NextResponse.json({ success: true, synced: members.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sync-sheets]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
