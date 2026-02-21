import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { auth } from "@/lib/auth";
import { syncAssociateMembersToSheet } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [membersSnap, meetingsSnap] = await Promise.all([
    adminDb.collection("associateMembers").orderBy("order", "asc").get(),
    adminDb.collection("meetings").orderBy("date", "asc").get(),
  ]);

  const meetings = meetingsSnap.docs.map((d) => ({
    id: d.id,
    date: (d.data().date as string) ?? "",
  }));

  const meetingIds = meetings.map((m) => m.id);

  // Derive attendance from actual attendance check data (single source of truth)
  const attendanceSnaps = await Promise.all(
    meetingIds.map((id) =>
      adminDb.collection("attendances").doc(id).collection("members")
        .where("checkedIn", "==", true).get()
    )
  );

  const nicknameAttendance = new Map<string, Set<string>>();
  attendanceSnaps.forEach((snap, idx) => {
    const meetingId = meetingIds[idx];
    snap.docs.forEach((doc) => {
      const nickname = (doc.data().nickname as string)?.trim();
      if (nickname) {
        if (!nicknameAttendance.has(nickname)) nicknameAttendance.set(nickname, new Set());
        nicknameAttendance.get(nickname)!.add(meetingId);
      }
    });
  });

  const members = membersSnap.docs.map((d) => {
    const nickname = ((d.data().nickname as string) ?? "").trim();
    const attendedMeetings = nicknameAttendance.get(nickname) ?? new Set<string>();
    const attendance: Record<string, boolean> = {};
    meetingIds.forEach((meetingId) => {
      if (attendedMeetings.has(meetingId)) attendance[meetingId] = true;
    });
    return { nickname, attendance };
  });

  await syncAssociateMembersToSheet(members, meetings);

  return NextResponse.json({ ok: true });
}
