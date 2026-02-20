import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 50);
  const snapshot = await adminDb
    .collection("changeLogs")
    .orderBy("savedAt", "desc")
    .limit(limit)
    .get();

  return NextResponse.json(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const ref = await adminDb.collection("changeLogs").add({
    ...body,
    savedAt: new Date().toISOString(),
    savedBy: session.user?.name ?? session.user?.email ?? "알 수 없음",
  });

  return NextResponse.json({ id: ref.id });
}
