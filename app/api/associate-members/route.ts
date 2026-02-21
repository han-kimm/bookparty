import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [snapshot, meetingsSnap] = await Promise.all([
    adminDb.collection("associateMembers").orderBy("order", "asc").get(),
    adminDb.collection("meetings").get(),
  ]);

  const meetingIds = meetingsSnap.docs.map((doc) => doc.id);

  // Derive attendance from actual attendance check data (single source of truth)
  const attendanceSnaps = await Promise.all(
    meetingIds.map((id) =>
      adminDb.collection("attendances").doc(id).collection("members")
        .where("checkedIn", "==", true).get()
    )
  );

  // nickname -> Set<meetingId> for checked-in members
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

  const members = snapshot.docs.map((doc) => {
    const data = doc.data();
    const nickname = (data.nickname as string)?.trim();
    const attendedMeetings = nicknameAttendance.get(nickname) ?? new Set<string>();
    const attendance: Record<string, boolean> = {};
    meetingIds.forEach((meetingId) => {
      if (attendedMeetings.has(meetingId)) attendance[meetingId] = true;
    });
    return { id: doc.id, ...data, attendance };
  });

  return NextResponse.json(members);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { nickname } = await req.json();
  if (!nickname?.trim()) return NextResponse.json({ error: "nickname 필수" }, { status: 400 });

  // 현재 최대 order 계산
  const snapshot = await adminDb.collection("associateMembers").orderBy("order", "desc").limit(1).get();
  const maxOrder = snapshot.empty ? 0 : (snapshot.docs[0].data().order as number) ?? 0;

  const ref = await adminDb.collection("associateMembers").add({
    nickname: nickname.trim(),
    order: maxOrder + 1,
  });

  return NextResponse.json({ id: ref.id });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id 필수" }, { status: 400 });

  await adminDb.collection("associateMembers").doc(id).delete();
  return NextResponse.json({ ok: true });
}
