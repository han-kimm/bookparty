import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // 준회원 정보 조회
  const assocDoc = await adminDb.collection("associateMembers").doc(id).get();
  if (!assocDoc.exists) {
    return NextResponse.json({ error: "준회원을 찾을 수 없습니다" }, { status: 404 });
  }
  const assocData = assocDoc.data()!;
  const nickname = assocData.nickname as string;

  // 이미 전환된 경우
  if (assocData.promotedAt) {
    return NextResponse.json({ error: "이미 정회원으로 전환된 회원입니다" }, { status: 409 });
  }

  // regularMembers 최대 order 조회
  const regularSnap = await adminDb.collection("regularMembers").orderBy("order", "desc").limit(1).get();
  const maxOrder = regularSnap.empty ? 0 : (regularSnap.docs[0].data().order as number) ?? 0;

  // members 컬렉션에도 중복 확인
  const membersSnap = await adminDb.collection("members").where("nickname", "==", nickname).limit(1).get();

  const today = new Date().toISOString().slice(0, 10);

  // 병렬 처리: regularMembers 추가 + members 추가(없으면) + associateMembers 이력 보존
  await Promise.all([
    // 정회원 출석부에 추가
    adminDb.collection("regularMembers").add({
      nickname,
      role: "",
      order: maxOrder + 1,
      dues: {},
    }),
    // 회원 목록에 추가 (없는 경우만)
    membersSnap.empty
      ? adminDb.collection("members").add({ nickname, joinedAt: today })
      : Promise.resolve(),
    // 준회원 이력 보존 (promotedAt 기록)
    adminDb.collection("associateMembers").doc(id).update({ promotedAt: today }),
  ]);

  return NextResponse.json({ ok: true });
}
