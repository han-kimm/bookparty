import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const doc = await adminDb.collection("announcements").doc(id).get();

  if (!doc.exists) return NextResponse.json(null);
  return NextResponse.json(doc.data());
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { internalText, externalText, coverImageBase64 } = await req.json();

  await adminDb.collection("announcements").doc(id).set(
    {
      internalText: internalText ?? "",
      externalText: externalText ?? "",
      ...(coverImageBase64 !== undefined && { coverImageBase64 }),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true });
}
