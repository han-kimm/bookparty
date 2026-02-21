import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // Flatten nested objects to dot-notation to avoid overwriting entire maps
  // e.g. { attendance: { meetingId: true } } → { "attendance.meetingId": true }
  const flattened: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      for (const [subKey, subVal] of Object.entries(value as Record<string, unknown>)) {
        flattened[`${key}.${subKey}`] = subVal;
      }
    } else {
      flattened[key] = value;
    }
  }

  await adminDb.collection("associateMembers").doc(id).update(flattened);
  return NextResponse.json({ ok: true });
}
