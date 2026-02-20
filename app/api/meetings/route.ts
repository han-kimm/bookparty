import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { auth } from "@/lib/auth";
import { createMeetingForm } from "@/lib/google-forms";
import { syncMeetingToSheet } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

// 모임 날짜 기준 직전 수요일 계산 (마감일 자동 설정)
function getPrevWednesday(meetingDate: string): string {
  const d = new Date(meetingDate);
  const day = d.getDay(); // 0=일, 3=수, 6=토
  const daysBack = day >= 3 ? day - 3 : day + 4;
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().split("T")[0];
}

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
  const { title, author, publisher, year, date, presenter, venue, formUrl, bookUrl, kakaoUrl, isAfterparty } = body;

  if (!title || !date) {
    return NextResponse.json({ error: "title과 date는 필수입니다" }, { status: 400 });
  }

  // 마감일 미설정 시 모임 전 수요일로 자동 계산
  const deadline: string = body.deadline || getPrevWednesday(date);

  let resolvedFormUrl = formUrl || "";
  if (!resolvedFormUrl) {
    try {
      resolvedFormUrl = await createMeetingForm({
        title,
        author: author || "",
        publisher: publisher || "",
        year: year || "",
        date,
        deadline,
        isAfterparty: isAfterparty ?? false,
        kakaoUrl: kakaoUrl || "",
      });
    } catch (err) {
      console.error("Google Form 생성 실패:", err);
    }
  }

  const docRef = await adminDb.collection("meetings").add({
    title,
    author: author || "",
    publisher: publisher || "",
    year: year || "",
    date,
    deadline,
    presenter: presenter || "",
    venue: venue || "",
    formUrl: resolvedFormUrl,
    kakaoUrl: kakaoUrl || "",
    bookUrl: bookUrl || "",
    isAfterparty: isAfterparty ?? false,
    createdAt: new Date().toISOString(),
  });

  // 구글 시트 일정표에 반영 (실패해도 모임 생성에는 영향 없음)
  syncMeetingToSheet({ date, title, author, publisher: body.publisher, presenter, venue }).catch((err) =>
    console.error("구글 시트 동기화 실패:", err)
  );

  return NextResponse.json({ id: docRef.id, formUrl: resolvedFormUrl });
}
