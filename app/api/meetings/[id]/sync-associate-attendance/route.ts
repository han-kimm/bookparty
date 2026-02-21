import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { auth } from "@/lib/auth";
import { syncAssociateMembersToSheet } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

/**
 * 모임 출석체크 결과를 associateMembers.attendance에 반영하고 시트를 동기화합니다.
 * 닉네임 기준으로 매칭합니다.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: meetingId } = await params;

  const [attendanceSnap, assocSnap, meetingsSnap] = await Promise.all([
    adminDb.collection("attendances").doc(meetingId).collection("members").get(),
    adminDb.collection("associateMembers").get(),
    adminDb.collection("meetings").orderBy("date", "asc").get(),
  ]);

  // 출석 체크된 닉네임 Set
  const checkedInNicknames = new Set<string>();
  // 모임에 등록된 모든 닉네임 Set (출석 여부 무관)
  const allAttendanceNicknames = new Set<string>();
  attendanceSnap.docs.forEach((d) => {
    const nick = (d.data().nickname as string)?.trim();
    if (!nick) return;
    allAttendanceNicknames.add(nick);
    if (d.data().checkedIn) checkedInNicknames.add(nick);
  });

  // 준회원 닉네임 Set
  const assocNicknameSet = new Set(
    assocSnap.docs.map((d) => (d.data().nickname as string)?.trim())
  );

  // 이번 모임에 등록된 준회원만 업데이트
  const updates = assocSnap.docs
    .filter((d) => {
      const nick = (d.data().nickname as string)?.trim();
      return nick && allAttendanceNicknames.has(nick);
    })
    .map((d) => {
      const nick = (d.data().nickname as string).trim();
      const attended = checkedInNicknames.has(nick);
      return adminDb
        .collection("associateMembers")
        .doc(d.id)
        .update({ [`attendance.${meetingId}`]: attended });
    });

  await Promise.all(updates);

  // 구글 시트 동기화
  const meetings = meetingsSnap.docs.map((d) => ({ id: d.id, date: (d.data().date as string) ?? "" }));

  // 업데이트된 준회원 데이터 다시 읽기
  const updatedAssocSnap = await adminDb.collection("associateMembers").orderBy("order", "asc").get();
  const members = updatedAssocSnap.docs.map((d) => ({
    nickname: (d.data().nickname as string) ?? "",
    attendance: (d.data().attendance as Record<string, boolean>) ?? {},
  }));

  await syncAssociateMembersToSheet(members, meetings);

  return NextResponse.json({ ok: true, updated: updates.length });
}
