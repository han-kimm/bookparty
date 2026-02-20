"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface RegularMember {
  id: string;
  nickname: string;
  role: string;
  order: number;
  attendance: Record<string, boolean>;
  dues: Record<string, boolean>;
}

interface Meeting {
  id: string;
  date: string;
  title: string;
}

const QUARTERS = [
  { key: "2026-Q1", label: "1분기", months: [1, 2, 3] },
  { key: "2026-Q2", label: "2분기", months: [4, 5, 6] },
  { key: "2026-Q3", label: "3분기", months: [7, 8, 9] },
  { key: "2026-Q4", label: "4분기", months: [10, 11, 12] },
];

type Col =
  | { type: "meeting"; meeting: Meeting }
  | { type: "dues"; quarter: typeof QUARTERS[number] };

function getQuarter(dateStr: string) {
  const month = new Date(dateStr).getMonth() + 1;
  return QUARTERS.find((q) => q.months.includes(month));
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function buildColumns(meetings: Meeting[]): Col[] {
  const cols: Col[] = [];
  for (const q of QUARTERS) {
    const qMeetings = meetings.filter((m) => q.months.includes(new Date(m.date).getMonth() + 1));
    qMeetings.forEach((m) => cols.push({ type: "meeting", meeting: m }));
    // 해당 분기 모임이 있거나 회비 데이터가 있을 분기면 열 추가
    if (qMeetings.length > 0) cols.push({ type: "dues", quarter: q });
  }
  return cols;
}

export default function RegularMembersPage() {
  const [members, setMembers] = useState<RegularMember[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, Record<string, boolean>>>({});
  // 저장된 원본 상태: memberId -> fieldPath -> value
  const savedStateRef = useRef<Record<string, Record<string, boolean>>>({});

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    Promise.all([
      fetch("/api/regular-members").then((r) => r.json()),
      fetch("/api/meetings").then((r) => r.json()),
    ]).then(([membersData, meetingsData]) => {
      const list: RegularMember[] = Array.isArray(membersData) ? membersData : [];
      // savedState 초기화
      const state: Record<string, Record<string, boolean>> = {};
      list.forEach((m) => {
        state[m.id] = {};
        Object.entries(m.attendance ?? {}).forEach(([k, v]) => { state[m.id][`attendance.${k}`] = v; });
        Object.entries(m.dues ?? {}).forEach(([k, v]) => { state[m.id][`dues.${k}`] = v; });
      });
      savedStateRef.current = state;
      setMembers(list);
      const filtered = (Array.isArray(meetingsData) ? meetingsData : [])
        .filter((m: Meeting) => m.date.startsWith("2026-"))
        .sort((a: Meeting, b: Meeting) => a.date.localeCompare(b.date));
      setMeetings(filtered);
      setLoading(false);
    });
  }, []);

  const toggle = (memberId: string, fieldPath: string, currentValue: boolean) => {
    const newValue = !currentValue;
    setMembers((list) =>
      list.map((m) => {
        if (m.id !== memberId) return m;
        const [field, key] = fieldPath.split(".");
        return { ...m, [field]: { ...(m[field as keyof RegularMember] as Record<string, boolean>), [key]: newValue } };
      })
    );
    setPendingChanges((prev) => {
      const memberPending = { ...(prev[memberId] ?? {}), [fieldPath]: newValue };
      // 원래 값과 같아지면 해당 필드 제거 (undefined는 false와 동일 취급)
      if ((savedStateRef.current[memberId]?.[fieldPath] ?? false) === newValue) {
        delete memberPending[fieldPath];
      }
      // 해당 멤버의 변경사항이 모두 없어지면 멤버 자체 제거
      const next = { ...prev };
      if (Object.keys(memberPending).length === 0) {
        delete next[memberId];
      } else {
        next[memberId] = memberPending;
      }
      return next;
    });
  };

  const saveAll = async () => {
    const entries = Object.entries(pendingChanges);
    if (!entries.length) return;
    setSaving(true);
    await Promise.all(
      entries.map(([memberId, changes]) =>
        fetch(`/api/regular-members/${memberId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changes),
        })
      )
    );

    // 변경 이력 기록
    const memberMap = Object.fromEntries(members.map((m) => [m.id, m.nickname]));
    const logEntries: { target: string; from: string; to: string }[] = [];
    entries.forEach(([memberId, fields]) => {
      Object.entries(fields).forEach(([fieldPath, to]) => {
        const from = savedStateRef.current[memberId]?.[fieldPath] ?? false;
        const [field, key] = fieldPath.split(".");
        const fieldLabel = field === "attendance" ? "출석" : "회비";
        const colLabel = field === "attendance"
          ? (meetings.find((m) => m.id === key)?.title ?? key)
          : key;
        logEntries.push({
          target: memberMap[memberId] ?? memberId,
          from: `${colLabel} ${from ? (field === "attendance" ? "출석" : "납부") : (field === "attendance" ? "미출석" : "미납")}`,
          to: `${colLabel} ${to ? (field === "attendance" ? "출석" : "납부") : (field === "attendance" ? "미출석" : "미납")}`,
        });
      });
    });
    fetch("/api/change-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "정회원 출석부", context: "2026", entries: logEntries }),
    });

    // savedState 업데이트
    Object.entries(pendingChanges).forEach(([memberId, fields]) => {
      if (!savedStateRef.current[memberId]) savedStateRef.current[memberId] = {};
      Object.assign(savedStateRef.current[memberId], fields);
    });
    setPendingChanges({});
    setSaving(false);
  };

  const pendingCount = Object.keys(pendingChanges).length;
  const columns = buildColumns(meetings);

  if (loading) {
    return (
      <div className="py-6 space-y-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-11 rounded-2xl bg-violet-50/60 animate-pulse" />
        ))}
      </div>
    );
  }

  const CELL_W = "w-11 min-w-[44px]";
  const DUES_W = "w-14 min-w-[56px]";

  return (
    <div className="py-6 pb-32">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold">정회원 출석부</h1>
        <Link href="/members" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          회원 목록 →
        </Link>
      </div>
      <div className="text-xs text-muted-foreground bg-muted/60 rounded-xl px-4 py-3 mb-4 space-y-1">
        <p>· 셀을 탭하면 출석(참) / 미출석으로 토글됩니다.</p>
        <p>· 회비 셀은 탭할 때마다 납부(O) → 미납(X) → 미설정 순으로 변경됩니다.</p>
        <p>· 변경 후 우측 하단 <strong>저장</strong> 버튼을 눌러야 반영됩니다.</p>
      </div>

      {/* 테이블 래퍼 */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="inline-block min-w-full rounded-2xl overflow-hidden border border-violet-300/60 shadow-sm" style={{ background: "oklch(0.97 0.012 290 / 0.70)", backdropFilter: "blur(24px)" }}>

          {/* 헤더 */}
          <div className="flex border-b border-violet-300/40" style={{ background: "oklch(0.54 0.23 293 / 0.05)" }}>
            {/* 닉네임 고정 열 헤더 */}
            <div className="sticky left-0 z-20 flex items-center px-3 py-2.5 min-w-[88px] border-r border-violet-300/40 font-semibold text-xs text-muted-foreground uppercase tracking-wide" style={{ background: "oklch(0.54 0.23 293 / 0.05)" }}>
              닉네임
            </div>
            {/* 모임 + 분기 회비 헤더 (분기 끝마다 회비 열) */}
            {columns.map((col, i) =>
              col.type === "meeting" ? (
                <div
                  key={col.meeting.id}
                  className={`${CELL_W} flex flex-col items-center justify-center py-2.5 border-r border-violet-300/35 text-xs font-medium ${
                    col.meeting.date < today ? "text-muted-foreground/60" : "text-foreground"
                  }`}
                >
                  <span>{formatDate(col.meeting.date)}</span>
                </div>
              ) : (
                <div
                  key={col.quarter.key}
                  className={`${DUES_W} flex flex-col items-center justify-center py-2 border-r border-violet-300/35 text-xs font-semibold text-primary ${i === columns.length - 1 ? "border-r-0" : ""}`}
                  style={{ background: "oklch(0.54 0.23 293 / 0.04)" }}
                >
                  <span>{col.quarter.label}</span>
                  <span className="text-[10px] font-normal text-primary/70">회비</span>
                </div>
              )
            )}
          </div>

          {/* 행 */}
          {members.map((member, idx) => {
            const isPendingRow = member.id in pendingChanges;
            const isEven = idx % 2 === 0;
            const rowStyle = isPendingRow
              ? { background: "oklch(0.92 0.10 85 / 0.20)" }
              : isEven
                ? { background: "transparent" }
                : { background: "oklch(0.54 0.23 293 / 0.02)" };

            return (
              <div
                key={member.id}
                className={`flex border-b last:border-b-0 border-violet-300/35 transition-colors ${isPendingRow ? "ring-1 ring-inset ring-amber-400/40" : ""}`}
                style={rowStyle}
              >
                {/* 닉네임 고정 열 */}
                <div
                  className="sticky left-0 z-10 flex flex-col justify-center px-3 py-2.5 min-w-[88px] border-r border-violet-300/40"
                  style={{ background: isPendingRow ? "oklch(0.95 0.08 85 / 0.25)" : isEven ? "oklch(0.97 0.012 290 / 0.65)" : "oklch(0.99 0.006 290 / 0.50)", backdropFilter: "blur(24px)" }}
                >
                  <span className="font-semibold text-sm leading-tight">{member.nickname}</span>
                  {member.role && (
                    <span className="text-[10px] text-primary/70 leading-tight mt-0.5">{member.role}</span>
                  )}
                </div>

                {/* 출석 + 분기 회비 셀 (분기 끝마다 회비 열) */}
                {columns.map((col, i) => {
                  const isLast = i === columns.length - 1;
                  if (col.type === "meeting") {
                    const attended = member.attendance?.[col.meeting.id] ?? false;
                    const fieldPath = `attendance.${col.meeting.id}`;
                    const isPendingCell = pendingChanges[member.id]?.[fieldPath] !== undefined;
                    return (
                      <button
                        key={col.meeting.id}
                        onClick={() => toggle(member.id, fieldPath, attended)}
                        className={`${CELL_W} flex items-center justify-center border-r border-violet-300/35 transition-all active:scale-95 ${
                          isPendingCell ? "bg-amber-50/50" : attended ? "bg-green-50/40" : "hover:bg-violet-100/40"
                        }`}
                        style={{ minHeight: 44 }}
                      >
                        {attended ? (
                          <span className="text-xs font-bold text-green-600 bg-green-100/70 rounded-full px-1.5 py-0.5">참</span>
                        ) : (
                          <span className="text-muted-foreground/25 text-base">·</span>
                        )}
                      </button>
                    );
                  } else {
                    const paid = member.dues?.[col.quarter.key];
                    const fieldPath = `dues.${col.quarter.key}`;
                    const isPendingCell = pendingChanges[member.id]?.[fieldPath] !== undefined;
                    const isEmpty = paid === undefined || paid === null;
                    return (
                      <button
                        key={col.quarter.key}
                        onClick={() => toggle(member.id, fieldPath, paid ?? false)}
                        className={`${DUES_W} flex items-center justify-center ${isLast ? "" : "border-r"} border-violet-300/35 transition-all active:scale-95 ${
                          isPendingCell ? "bg-amber-50/50" :
                          paid === true ? "bg-green-50/40" :
                          paid === false ? "bg-red-50/40" :
                          "hover:bg-violet-100/40"
                        }`}
                        style={{ minHeight: 44, background: isPendingCell ? undefined : "oklch(0.54 0.23 293 / 0.02)" }}
                      >
                        {isEmpty ? (
                          <span className="text-muted-foreground/25 text-base">·</span>
                        ) : paid ? (
                          <span className="text-xs font-bold text-green-600 bg-green-100/70 rounded-full w-6 h-6 flex items-center justify-center">O</span>
                        ) : (
                          <span className="text-xs font-bold text-red-500 bg-red-100/70 rounded-full w-6 h-6 flex items-center justify-center">X</span>
                        )}
                      </button>
                    );
                  }
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* 플로팅 저장 버튼 */}
      {pendingCount > 0 && (
        <div className="fixed bottom-24 left-0 right-0 flex justify-center z-50 px-4">
          <Button
            size="lg"
            onClick={saveAll}
            disabled={saving}
            className="shadow-xl shadow-primary/30 rounded-full px-8"
          >
            {saving ? "저장 중..." : `변경사항 저장 (${pendingCount}명)`}
          </Button>
        </div>
      )}
    </div>
  );
}
