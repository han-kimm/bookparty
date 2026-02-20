import { auth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Meeting = { id: string; date: string; title: string; author: string; presenter: string; venue: string; formUrl: string };

async function getTimelineMeetings() {
  const today = new Date().toISOString().slice(0, 10);

  const [pastSnap, upcomingSnap] = await Promise.all([
    adminDb.collection("meetings").where("date", "<", today).orderBy("date", "desc").limit(1).get(),
    adminDb.collection("meetings").where("date", ">=", today).orderBy("date", "asc").limit(2).get(),
  ]);

  const past = pastSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Meeting));
  const upcoming = upcomingSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Meeting));

  return { prev: past[0] ?? null, next: upcoming[0] ?? null, after: upcoming[1] ?? null };
}

async function getAttendanceCount(meetingId: string) {
  const snapshot = await adminDb.collection("attendances").doc(meetingId).collection("members").get();
  const checkedIn = snapshot.docs.filter((d) => d.data().checkedIn).length;
  return { total: snapshot.size, checkedIn };
}

async function getQuarterDuesInfo(year: number, quarter: number) {
  const key = `${year}-Q${quarter}`;
  const snapshot = await adminDb.collection("members").get();
  let unpaid = 0;
  snapshot.forEach((doc) => { if (!doc.data().duesStatus?.[key]) unpaid++; });
  return { total: snapshot.size, unpaid };
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} (${weekdays[d.getDay()]})`;
}

export default async function DashboardPage() {
  const session = await auth();
  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);

  let timeline = { prev: null as Meeting | null, next: null as Meeting | null, after: null as Meeting | null };
  let duesInfo = { total: 0, unpaid: 0 };
  let attendanceInfo = { total: 0, checkedIn: 0 };

  try {
    [timeline, duesInfo] = await Promise.all([
      getTimelineMeetings(),
      getQuarterDuesInfo(year, quarter),
    ]);
    if (timeline.next) attendanceInfo = await getAttendanceCount(timeline.next.id);
  } catch {
    // Firebase 미설정 시 조용히 처리
  }

  const quarterMonths = [1, 2, 3].map((i) => `${(quarter - 1) * 3 + i}월`).join("·");
  const quarterLabel = `${year}년 ${quarter}분기 (${quarterMonths})`;

  const timelineItems = [
    timeline.prev ? { meeting: timeline.prev, type: "past" as const } : null,
    timeline.next ? { meeting: timeline.next, type: "next" as const } : null,
    timeline.after ? { meeting: timeline.after, type: "upcoming" as const } : null,
  ].filter(Boolean) as { meeting: Meeting; type: "past" | "next" | "upcoming" }[];

  return (
    <div className="py-6 space-y-5">
      {/* 환영 헤더 */}
      <div>
        <h1 className="text-xl font-bold">안녕하세요, {session?.user?.name?.split(" ")[0]}님 👋</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{year}년 {quarter}분기 운영 현황</p>
      </div>

      {/* 모임 타임라인 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground">모임 일정</h2>
          <Link href="/meetings" className="text-xs text-muted-foreground hover:text-foreground transition-colors">전체 보기 →</Link>
        </div>

        {timelineItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <p>등록된 모임이 없습니다</p>
            <Button asChild size="sm" className="mt-3">
              <Link href="/meetings/new">모임 등록하기</Link>
            </Button>
          </div>
        ) : (
          <div className="relative">
            {/* 세로선 */}
            <div className="absolute left-[5px] top-3 bottom-3 w-px bg-border" />

            <div className="space-y-1">
              {timelineItems.map(({ meeting, type }) => {
                const isNext = type === "next";
                const isPast = type === "past";

                return (
                  <div key={meeting.id} className="flex gap-4 items-start">
                    {/* 점 */}
                    <div className="flex-shrink-0 mt-4">
                      <div className={[
                        "w-[11px] h-[11px] rounded-full border-2 z-10 relative",
                        isNext  ? "bg-primary border-primary" :
                        isPast  ? "bg-muted border-muted-foreground/30" :
                                  "bg-background border-primary/60",
                      ].join(" ")} />
                    </div>

                    {/* 카드 */}
                    <div className={[
                      "flex-1 mb-3 rounded-2xl border transition-all",
                      isPast ? "opacity-50" : "",
                      isNext ? "ring-2 ring-primary shadow-md shadow-primary/15" : "",
                    ].join(" ")}>
                      <div className="p-3.5">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="text-xs font-medium text-muted-foreground">{formatDate(meeting.date)}</span>
                          {isNext && <Badge variant="default" className="text-xs">다음 모임</Badge>}
                          {isPast && <Badge variant="secondary" className="text-xs">완료</Badge>}
                        </div>

                        <p className="font-semibold text-sm leading-snug">『{meeting.title}』</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {meeting.presenter || "발제 미정"} · {meeting.venue || "장소 미정"}
                        </p>

                        {isNext ? (
                          <>
                            {attendanceInfo.total > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                신청 {attendanceInfo.total}명
                                {attendanceInfo.checkedIn > 0 && (
                                  <span className="text-green-600 ml-1">(출석 {attendanceInfo.checkedIn})</span>
                                )}
                              </p>
                            )}
                            <div className="flex gap-2 mt-2.5">
                              <Button asChild size="sm" className="flex-1 h-7 text-xs">
                                <Link href={`/meetings/${meeting.id}/attendance`}>출석 체크</Link>
                              </Button>
                              <Button asChild variant="outline" size="sm" className="flex-1 h-7 text-xs">
                                <Link href={`/announcements?meetingId=${meeting.id}`}>공지</Link>
                              </Button>
                              <Button asChild variant="outline" size="sm" className="h-7 text-xs px-2.5">
                                <Link href={`/meetings/${meeting.id}/presenter`}>수정</Link>
                              </Button>
                            </div>
                          </>
                        ) : (
                          <div className="mt-2">
                            <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                              <Link href={`/meetings/${meeting.id}/presenter`}>수정</Link>
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 분기 회비 현황 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-muted-foreground">이번 분기 회비</CardTitle>
            <span className="text-xs text-muted-foreground">{quarterLabel}</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold">{duesInfo.total - duesInfo.unpaid}
                <span className="text-lg text-muted-foreground font-normal"> / {duesInfo.total}명</span>
              </p>
              {duesInfo.unpaid > 0 && (
                <p className="text-sm text-destructive mt-1">미완납 {duesInfo.unpaid}명</p>
              )}
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/finance/dues">관리</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 빠른 실행 */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">빠른 실행</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: "/meetings/new", icon: "➕", label: "모임 등록" },
            { href: "/meetings", icon: "📋", label: "모임 목록" },
            { href: "/finance/afterparty", icon: "🍻", label: "뒤풀이 정산" },
            { href: "/members/regular", icon: "👥", label: "정회원 출석부" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 p-4 rounded-2xl glass hover:bg-violet-100/60 transition-all active:scale-[0.98]"
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
