import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { auth } from "@/lib/auth";
import { syncRegularMembersToSheet } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [membersSnap, meetingsSnap] = await Promise.all([
    adminDb.collection("regularMembers").orderBy("order").get(),
    adminDb.collection("meetings").get(),
  ]);

  const members = membersSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      nickname: data.nickname as string,
      attendance: (data.attendance ?? {}) as Record<string, boolean>,
      dues: (data.dues ?? {}) as Record<string, boolean | undefined>,
    };
  });

  const meetings = meetingsSnap.docs.map((doc) => ({
    id: doc.id,
    date: doc.data().date as string,
  }));

  try {
    const votingStatus = await syncRegularMembersToSheet(members, meetings);
    return NextResponse.json({
      success: true,
      synced: members.length,
      votingStatus: Object.fromEntries(votingStatus),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[regular-members/sync-sheets]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
