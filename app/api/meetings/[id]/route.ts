import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { auth } from "@/lib/auth";
import { buildFormTitle, buildFormDescription, updateFormTitle, updateFormKakaoUrl } from "@/lib/google-forms";
import { buildInternalAnnouncement, buildExternalAnnouncement } from "@/lib/announcements";

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

  return NextResponse.json({ id: doc.id, ...doc.data() });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const doc = await adminDb.collection("meetings").doc(id).get();
  const current = doc.data() as { title: string; author?: string; date: string; publisher?: string; year?: string; deadline?: string; formUrl?: string; kakaoUrl?: string; presenter?: string; venue?: string; bookUrl?: string; isAfterparty?: boolean };

  await adminDb.collection("meetings").doc(id).update(body);

  if (current.formUrl) {
    const descFields = ["title", "author", "publisher", "year", "deadline"];
    const titleOrDateChanged = body.title !== undefined || body.date !== undefined;
    const descChanged = descFields.some((f) => body[f] !== undefined);
    const kakaoChanged = body.kakaoUrl !== undefined;

    if (titleOrDateChanged || descChanged) {
      const newTitle = buildFormTitle(body.title ?? current.title, body.date ?? current.date);
      const newDesc = buildFormDescription({
        author: body.author ?? current.author ?? "",
        title: body.title ?? current.title,
        publisher: body.publisher ?? current.publisher,
        year: body.year ?? current.year,
        deadline: body.deadline ?? current.deadline,
      });
      try {
        await updateFormTitle(current.formUrl, newTitle, newDesc);
      } catch (e) {
        console.error("폼 타이틀/설명 업데이트 실패:", e);
      }
    }

    if (kakaoChanged && body.kakaoUrl) {
      try {
        await updateFormKakaoUrl(current.formUrl, body.kakaoUrl);
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
