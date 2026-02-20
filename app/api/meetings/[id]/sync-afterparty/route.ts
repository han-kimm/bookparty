import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { auth } from "@/lib/auth";
import { getFormResponses } from "@/lib/google-forms";

export const dynamic = "force-dynamic";

// 폼 응답 기준으로 출석 명단의 뒤풀이 플래그 재동기화
export async function POST(
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

  // 폼 응답에서 닉네임 → 뒤풀이 여부 맵 생성
  const responses = await getFormResponses(formUrl);
  const afterpartyByNickname: Record<string, boolean> = {};
  for (const r of responses) {
    if (r.nickname) {
      afterpartyByNickname[r.nickname] = r.afterparty === "참석";
    }
  }

  // 출석 명단 조회
  const snapshot = await adminDb
    .collection("attendances")
    .doc(id)
    .collection("members")
    .get();

  let updated = 0;
  await Promise.all(
    snapshot.docs.map(async (memberDoc) => {
      const data = memberDoc.data();
      const trimmedNickname = (data.nickname as string ?? "").trim();
      const formAfterparty = afterpartyByNickname[trimmedNickname];

      const updates: Record<string, unknown> = {};

      // 닉네임 공백 정리
      if (trimmedNickname !== data.nickname) {
        updates.nickname = trimmedNickname;
      }

      // 뒤풀이 플래그 수정 (폼에 응답이 있는 경우만)
      if (formAfterparty !== undefined && data.isAfterparty !== formAfterparty) {
        updates.isAfterparty = formAfterparty;
      }

      if (Object.keys(updates).length > 0) {
        await memberDoc.ref.update(updates);
        updated++;
      }
    })
  );

  return NextResponse.json({ updated, total: snapshot.size });
}
