import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { auth } from "@/lib/auth";
import { google } from "googleapis";

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
  if (!formUrl) return NextResponse.json({ error: "formUrl 없음" }, { status: 404 });

  const match = formUrl.match(/\/forms\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return NextResponse.json({ error: "formId 추출 실패", formUrl }, { status: 400 });
  const formId = match[1];

  const authClient = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: [
      "https://www.googleapis.com/auth/forms.body",
      "https://www.googleapis.com/auth/forms.responses.readonly",
    ],
  });
  const forms = google.forms({ version: "v1", auth: authClient });

  const formData = await forms.forms.get({ formId });
  const responsesData = await forms.forms.responses.list({ formId });

  // questionId → title 매핑
  const questionTitleById: Record<string, string> = {};
  for (const item of formData.data.items ?? []) {
    const qid = item.questionItem?.question?.questionId;
    if (qid && item.title) questionTitleById[qid] = item.title;
  }

  // 각 응답의 닉네임 + 뒤풀이 답변 값만 추출
  const responses = (responsesData.data.responses ?? []).map((r) => {
    const result: Record<string, string[]> = {};
    for (const [qid, answer] of Object.entries(r.answers ?? {})) {
      const title = questionTitleById[qid] ?? qid;
      result[title] = answer.textAnswers?.answers?.map((a) => a.value ?? "") ?? [];
    }
    return result;
  });

  return NextResponse.json({
    formId,
    responseCount: responses.length,
    afterpartyCount: responses.filter((r) =>
      Object.entries(r).some(([title, values]) =>
        title.includes("뒤풀이") && values.some((v) => v === "참석")
      )
    ).length,
    responses,
  });
}
