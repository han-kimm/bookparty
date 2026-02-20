import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { auth } from "@/lib/auth";
import { createMeetingForm } from "@/lib/google-forms";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snapshot = await adminDb
    .collection("meetings")
    .orderBy("date", "asc")
    .get();

  const meetings = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json(meetings);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, author, date, presenter, venue, formUrl, bookUrl, kakaoUrl, isAfterparty } = body;

  if (!title || !date) {
    return NextResponse.json({ error: "title과 date는 필수입니다" }, { status: 400 });
  }

  let resolvedFormUrl = formUrl || "";
  if (!resolvedFormUrl) {
    try {
      resolvedFormUrl = await createMeetingForm({
        title,
        author: author || "",
        date,
        isAfterparty: isAfterparty ?? false,
        kakaoUrl: kakaoUrl || "",
      });
    } catch (err) {
      console.error("Google Form 생성 실패:", err);
      // 폼 생성 실패해도 모임은 저장
    }
  }

  const docRef = await adminDb.collection("meetings").add({
    title,
    author: author || "",
    date,
    presenter: presenter || "",
    venue: venue || "",
    formUrl: resolvedFormUrl,
    kakaoUrl: kakaoUrl || "",
    bookUrl: bookUrl || "",
    isAfterparty: isAfterparty ?? false,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ id: docRef.id, formUrl: resolvedFormUrl });
}
