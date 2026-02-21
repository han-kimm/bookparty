"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Meeting {
  id: string;
  date: string;
  title: string;
  author: string;
  presenter: string;
  venue: string;
  isAfterparty: boolean;
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);
  const [activeMonthKey, setActiveMonthKey] = useState<string>(today.slice(0, 7));
  const nextRef = useRef<HTMLDivElement | null>(null);
  const monthRefs = useRef<Record<string, HTMLDivElement>>({});

  useEffect(() => {
    fetch("/api/meetings")
      .then((r) => r.json())
      .then((data: Meeting[]) => {
        if (Array.isArray(data)) {
          const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
          setMeetings(sorted);
        }
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!loading && nextRef.current) {
      nextRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [loading]);

  // IntersectionObserver로 현재 보이는 월 추적
  useEffect(() => {
    if (loading) return;
    const observers: IntersectionObserver[] = [];
    Object.entries(monthRefs.current).forEach(([key, el]) => {
      const observer = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveMonthKey(key); },
        { threshold: 0, rootMargin: "-56px 0px -70% 0px" }
      );
      observer.observe(el);
      observers.push(observer);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [loading, meetings]);

  const scrollToMonth = useCallback((key: string) => {
    const el = monthRefs.current[key];
    if (!el) return;
    const topBarHeight = 56; // TopBar h-14
    const y = el.getBoundingClientRect().top + window.scrollY - topBarHeight - 12;
    window.scrollTo({ top: y, behavior: "smooth" });
  }, []);

  const nextMeetingId = meetings.find((m) => m.date >= today)?.id;

  // 연도별 그룹핑
  const grouped = meetings.reduce<Record<string, Meeting[]>>((acc, m) => {
    const year = m.date.slice(0, 4);
    if (!acc[year]) acc[year] = [];
    acc[year].push(m);
    return acc;
  }, {});
  const years = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  // 플로팅 월 목록: "YYYY-MM" 키 순서대로
  const monthKeys = meetings.reduce<string[]>((acc, m) => {
    const key = m.date.slice(0, 7);
    if (!acc.includes(key)) acc.push(key);
    return acc;
  }, []);

  if (loading) {
    return (
      <div className="py-6 space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-gray-200 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="py-6 pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">모임 목록</h1>
        <Button asChild size="sm">
          <Link href="/meetings/new">+ 새 모임</Link>
        </Button>
      </div>

      {meetings.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📚</p>
          <p className="text-muted-foreground">등록된 모임이 없습니다</p>
          <Button asChild className="mt-4">
            <Link href="/meetings/new">첫 모임 등록하기</Link>
          </Button>
        </div>
      ) : (
        <>
          {/* 플로팅 월 선택기 */}
          <div className="fixed left-2 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-0.5 lg:hidden">
            <div className="glass rounded-2xl px-1 py-2 flex flex-col gap-0.5 shadow-md border border-violet-200/60">
              {monthKeys.map((key) => {
                const month = parseInt(key.slice(5, 7));
                const year = key.slice(0, 4);
                const isActive = activeMonthKey === key;
                const showYear = key === monthKeys[0] || key.slice(0, 4) !== monthKeys[monthKeys.indexOf(key) - 1]?.slice(0, 4);
                return (
                  <div key={key}>
                    {showYear && (
                      <p className="text-[9px] text-center text-muted-foreground/60 font-medium pb-0.5 pt-1 leading-none">
                        {year.slice(2)}
                      </p>
                    )}
                    <button
                      onClick={() => scrollToMonth(key)}
                      className={cn(
                        "w-7 h-7 rounded-xl text-xs font-bold transition-all flex items-center justify-center",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm scale-110"
                          : "text-muted-foreground hover:text-primary hover:bg-violet-100/60"
                      )}
                    >
                      {month}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-8">
            {years.map((year) => (
              <div key={year}>
                {/* 연도 헤더 */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-sm font-bold text-muted-foreground">{year}년</span>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">{grouped[year].length}회</span>
                </div>

                {/* 타임라인 */}
                <div className="relative">
                  <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border" />

                  <div className="space-y-1">
                    {grouped[year].map((meeting, idx) => {
                      const isPast = meeting.date < today;
                      const isNext = meeting.id === nextMeetingId;
                      const d = new Date(meeting.date);
                      const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
                      const dateLabel = `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} (${weekdays[d.getDay()]})`;
                      const month = d.getMonth();
                      const prevMonth = idx > 0 ? new Date(grouped[year][idx - 1].date).getMonth() : null;
                      const showMonthLabel = idx === 0 || month !== prevMonth;
                      const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

                      return (
                        <div key={meeting.id}>
                          {/* 월 구분 레이블 */}
                          {showMonthLabel && (
                            <div
                              ref={(el) => { if (el) monthRefs.current[monthKey] = el; }}
                              className={`flex gap-4 items-center mb-2 ${idx === 0 ? "mt-0" : "mt-20"}`}
                            >
                              <div className="flex-shrink-0 w-[11px] flex justify-center">
                                <div className="w-px h-4 bg-border" />
                              </div>
                              <span className="text-sm font-extrabold text-primary shrink-0">{month + 1}월</span>
                              <div className="flex-1 border-t-2 border-dashed border-primary/40" />
                            </div>
                          )}

                          <div
                            ref={isNext ? nextRef : null}
                            className="flex gap-4 items-start"
                          >
                            {/* 타임라인 점 */}
                            <div className="relative flex-shrink-0 mt-3.5">
                              <div className={[
                                "w-[11px] h-[11px] rounded-full border-2 z-10 relative",
                                isNext
                                  ? "bg-primary border-primary"
                                  : isPast
                                    ? "bg-muted border-muted-foreground/30"
                                    : "bg-background border-primary/60",
                              ].join(" ")} />
                            </div>

                            {/* 카드 */}
                            <div className={[
                              "flex-1 mb-3 rounded-2xl border transition-all",
                              isPast ? "opacity-50" : "",
                              isNext ? "ring-2 ring-primary shadow-md shadow-primary/15" : "",
                            ].join(" ")}>
                              <div className="p-3.5">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-medium text-muted-foreground">{dateLabel}</span>
                                    {isNext && <Badge variant="default" className="text-xs">다음 모임</Badge>}
                                    {!isPast && !isNext && <Badge variant="outline" className="text-xs">예정</Badge>}
                                    {meeting.isAfterparty && <Badge variant="outline" className="text-xs">뒤풀이</Badge>}
                                  </div>
                                </div>
                                <p className="font-semibold text-sm leading-snug">『{meeting.title}』</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {meeting.presenter || "발제 미정"} · {meeting.venue || "장소 미정"}
                                </p>
                                <div className="flex gap-2 mt-2.5">
                                  <Button asChild size="sm" className="flex-1 h-7 text-xs">
                                    <Link href={`/meetings/${meeting.id}/attendance`}>출석</Link>
                                  </Button>
                                  <Button asChild variant="outline" size="sm" className="flex-1 h-7 text-xs">
                                    <Link href={`/meetings/${meeting.id}/presenter`}>수정</Link>
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
