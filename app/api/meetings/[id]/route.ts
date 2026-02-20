import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { auth } from "@/lib/auth";
import { buildFormTitle, buildFormDescription, updateFormTitle, updateFormKakaoUrl } from "@/lib/google-forms";
import { buildInternalAnnouncement, buildExternalAnnouncement } from "@/lib/announcements";
import { syncMeetingToSheet } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

function getPrevWednesday(meetingDate: string): string {
  const d = new Date(meetingDate);
  const day = d.getDay();
  const daysBack = day >= 3 ? day - 3 : day + 4;
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().split("T")[0];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const doc = await adminDb.collection("meetings").doc(id).get();
  if (!doc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ id: doc.id, ...doc.data() });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accessToken = (session as typeof session & { accessToken?: string }).accessToken;

  const { id } = await params;
  const body = await req.json();

  const doc = await adminDb.collection("meetings").doc(id).get();
  const current = doc.data() as { title: string; author?: string; date: string; publisher?: string; year?: string; deadline?: string; formUrl?: string; kakaoUrl?: string; presenter?: string; venue?: string; bookUrl?: string; isAfterparty?: boolean };

  // 마감일이 없거나 빈 값이면 모임 날짜 기준 직전 수요일로 자동 계산
  if (!body.deadline) {
    body.deadline = getPrevWednesday(body.date ?? current.date);
  }

  await adminDb.collection("meetings").doc(id).update(body);

  if (current.formUrl) {
    const updated = { ...current, ...body };
    const newTitle = buildFormTitle(updated.title, updated.date);
    const newDesc = buildFormDescription({
      author: updated.author ?? "",
      title: updated.title,
      publisher: updated.publisher,
      year: updated.year,
      deadline: updated.deadline,
    });
    try {
      await updateFormTitle(current.formUrl, newTitle, newDesc, accessToken);
    } catch (e) {
      console.error("폼 타이틀/설명 업데이트 실패:", e);
    }

    if (body.kakaoUrl) {
      try {
        await updateFormKakaoUrl(current.formUrl, body.kakaoUrl, accessToken);
      } catch (e) {
        console.error("폼 카카오URL 업데이트 실패:", e);
      }
    }
  }

  // 공지문 자동 재생성: 공지에 영향을 주는 필드가 변경된 경우
  const announcementFields = ["title", "author", "date", "deadline", "presenter", "venue", "formUrl", "bookUrl", "isAfterparty"];
  if (announcementFields.some((f) => body[f] !== undefined)) {
    const updated = { ...current, ...body };
    const internalText = buildInternalAnnouncement(updated);
    const externalText = buildExternalAnnouncement(updated);
    try {
      await adminDb.collection("announcements").doc(id).set(
        { internalText, externalText, updatedAt: new Date().toISOString() },
        { merge: true }
      );
    } catch (e) {
      console.error("공지 자동 업데이트 실패:", e);
    }
  }

  // 구글 시트 일정표 동기화 (책제목·저자·출판사·발제자·장소 변경 시)
  const sheetFields = ["title", "author", "publisher", "presenter", "venue", "date"];
  if (sheetFields.some((f) => body[f] !== undefined)) {
    const updated = { ...current, ...body };
    syncMeetingToSheet({
      date: updated.date,
      title: updated.title,
      author: updated.author,
      publisher: updated.publisher,
      presenter: updated.presenter,
      venue: updated.venue,
    }).catch((err) => console.error("구글 시트 동기화 실패:", err));
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await adminDb.collection("meetings").doc(id).delete();
  return NextResponse.json({ success: true });
}
