import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { auth } from "@/lib/auth";
import { createMeetingForm } from "@/lib/google-forms";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const doc = await adminDb.collection("meetings").doc(id).get();
  if (!doc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = doc.data() as { title: string; author?: string; date: string; publisher?: string; year?: string; deadline?: string; isAfterparty?: boolean; formUrl?: string; kakaoUrl?: string };

  if (data.formUrl) {
    return NextResponse.json({ formUrl: data.formUrl });
  }

  const accessToken = (session as typeof session & { accessToken?: string }).accessToken;

  let formUrl: string;
  try {
    formUrl = await createMeetingForm({
      title: data.title,
      author: data.author || "",
      date: data.date,
      publisher: data.publisher,
      year: data.year,
      deadline: data.deadline,
      isAfterparty: data.isAfterparty ?? false,
      kakaoUrl: data.kakaoUrl,
      accessToken,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // googleapis 에러는 err.errors 배열에 상세 내용이 있음
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detail = (err as any)?.errors ?? (err as any)?.response?.data ?? null;
    console.error("[create-form] error:", message, JSON.stringify(detail));
    return NextResponse.json({ error: message, detail }, { status: 500 });
  }

  await adminDb.collection("meetings").doc(id).update({ formUrl });

  return NextResponse.json({ formUrl });
}
