import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { auth } from "@/lib/auth";
import { getFormResponses } from "@/lib/google-forms";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const doc = await adminDb.collection("meetings").doc(id).get();
  if (!doc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { formUrl } = doc.data() as { formUrl?: string };
  if (!formUrl) {
    return NextResponse.json({ error: "이 모임에 연결된 구글폼이 없습니다." }, { status: 404 });
  }

  try {
    const responses = await getFormResponses(formUrl);
    return NextResponse.json(responses);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[form-responses]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
