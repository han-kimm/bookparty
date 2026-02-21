"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface AssociateMember {
  id: string;
  nickname: string;
  order: number;
  attendance: Record<string, boolean>;
  promotedAt?: string;
}

interface Meeting {
  id: string;
  date: string;
  title: string;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function AssociateMembersPage() {
  const [members, setMembers] = useState<AssociateMember[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sheetSyncing, setSheetSyncing] = useState(false);
  const [sheetSyncMsg, setSheetSyncMsg] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, Record<string, boolean>>>({});
  const savedStateRef = useRef<Record<string, Record<string, boolean>>>({});

  // 추가 다이얼로그
  const [addOpen, setAddOpen] = useState(false);
  const [newNickname, setNewNickname] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  // 삭제 확인
  const [deleteTarget, setDeleteTarget] = useState<AssociateMember | null>(null);

  // 정회원 전환
  const [promoteTarget, setPromoteTarget] = useState<AssociateMember | null>(null);
  const [promoting, setPromoting] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const fetchAll = async () => {
    const [membersRes, meetingsRes] = await Promise.all([
      fetch("/api/associate-members"),
      fetch("/api/meetings"),
    ]);
    const membersData = await membersRes.json();
    const meetingsData = await meetingsRes.json();

    const list: AssociateMember[] = Array.isArray(membersData) ? membersData : [];
    const state: Record<string, Record<string, boolean>> = {};
    list.forEach((m) => {
      state[m.id] = {};
      Object.entries(m.attendance ?? {}).forEach(([k, v]) => {
        state[m.id][`attendance.${k}`] = v;
      });
    });
    savedStateRef.current = state;
    setMembers(list);

    const filtered = (Array.isArray(meetingsData) ? meetingsData : [])
      .filter((m: Meeting) => m.date.startsWith("2026-"))
      .sort((a: Meeting, b: Meeting) => a.date.localeCompare(b.date));
    setMeetings(filtered);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const toggle = (memberId: string, meetingId: string, currentValue: boolean) => {
    const newValue = !currentValue;
    const fieldPath = `attendance.${meetingId}`;
    setMembers((list) =>
      list.map((m) => {
        if (m.id !== memberId) return m;
        return { ...m, attendance: { ...m.attendance, [meetingId]: newValue } };
      })
    );
    setPendingChanges((prev) => {
      const memberPending = { ...(prev[memberId] ?? {}), [fieldPath]: newValue };
      if ((savedStateRef.current[memberId]?.[fieldPath] ?? false) === newValue) {
        delete memberPending[fieldPath];
      }
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

    const memberMap = Object.fromEntries(members.map((m) => [m.id, m]));

    await Promise.all(
      entries.flatMap(([memberId, changes]) => {
        const member = memberMap[memberId];
        return Object.entries(changes).map(([fieldPath, checkedIn]) => {
          const meetingId = fieldPath.split(".")[1];
          return fetch(`/api/meetings/${meetingId}/attendance`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nickname: member?.nickname, checkedIn }),
          });
        });
      })
    );

    Object.entries(pendingChanges).forEach(([memberId, fields]) => {
      if (!savedStateRef.current[memberId]) savedStateRef.current[memberId] = {};
      Object.assign(savedStateRef.current[memberId], fields);
    });
    setPendingChanges({});
    setSaving(false);

    syncToSheets();
  };

  const syncToSheets = async () => {
    setSheetSyncing(true);
    setSheetSyncMsg(null);
    try {
      const res = await fetch("/api/associate-members/sync-sheets", { method: "POST" });
      if (res.ok) {
        setSheetSyncMsg("시트 반영 완료");
      } else {
        const data = await res.json();
        setSheetSyncMsg(`시트 반영 실패: ${data.error ?? res.status}`);
      }
    } catch {
      setSheetSyncMsg("시트 반영 실패");
    } finally {
      setSheetSyncing(false);
    }
  };

  const handlePromote = async () => {
    if (!promoteTarget) return;
    setPromoting(true);
    try {
      const res = await fetch(`/api/associate-members/${promoteTarget.id}/promote`, { method: "POST" });
      if (res.ok) {
        setMembers((list) =>
          list.map((m) => m.id === promoteTarget.id ? { ...m, promotedAt: today } : m)
        );
      }
    } finally {
      setPromoting(false);
      setPromoteTarget(null);
    }
  };

  const handleAdd = async () => {
    if (!newNickname.trim()) return;
    setAddSaving(true);
    await fetch("/api/associate-members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: newNickname.trim() }),
    });
    setAddSaving(false);
    setAddOpen(false);
    setNewNickname("");
    setLoading(true);
    fetchAll();
  };

  const handleDelete = async (member: AssociateMember) => {
    await fetch("/api/associate-members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: member.id }),
    });
    setDeleteTarget(null);
    setLoading(true);
    fetchAll();
  };

  const pendingCount = Object.keys(pendingChanges).length;

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

  return (
    <div className="py-6 pb-32">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold">준회원 출석부</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={syncToSheets}
            disabled={sheetSyncing}
            className="text-xs text-primary/70 hover:text-primary transition-colors disabled:opacity-40"
          >
            {sheetSyncing ? "동기화 중..." : "시트 동기화"}
          </button>
          <Button size="sm" onClick={() => setAddOpen(true)}>+ 추가</Button>
        </div>
      </div>
      {sheetSyncMsg && (
        <p className="text-xs text-center text-muted-foreground mb-2">{sheetSyncMsg}</p>
      )}
      <div className="text-xs text-muted-foreground bg-muted/60 rounded-xl px-4 py-3 mb-4 space-y-1">
        <p>· 셀을 탭하면 출석(참) / 미출석으로 토글됩니다. (출석체크와 동기화)</p>
        <p>· 3회 이상 출석 시 정회원으로 전환할 수 있습니다.</p>
        <p>· 변경 후 우측 하단 <strong>저장</strong> 버튼을 눌러야 반영됩니다.</p>
      </div>

      {members.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <p>등록된 준회원이 없습니다.</p>
          <Button size="sm" className="mt-3" onClick={() => setAddOpen(true)}>준회원 추가</Button>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4">
          <div className="inline-block min-w-full rounded-2xl overflow-hidden border border-violet-300/60 shadow-sm" style={{ background: "oklch(0.97 0.012 290 / 0.70)", backdropFilter: "blur(24px)" }}>
            {/* 헤더 */}
            <div className="flex border-b border-violet-300/40" style={{ background: "oklch(0.54 0.23 293 / 0.05)" }}>
              <div className="sticky left-0 z-20 flex items-center px-3 py-2.5 min-w-[100px] border-r border-violet-300/40 font-semibold text-xs text-muted-foreground uppercase tracking-wide" style={{ background: "oklch(0.54 0.23 293 / 0.05)" }}>
                닉네임
              </div>
              {/* 출석 합계 + 전환 열 헤더 */}
              <div className="w-16 min-w-[64px] flex items-center justify-center text-xs font-semibold text-muted-foreground border-r border-violet-300/35">
                합계
              </div>
              {meetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className={`${CELL_W} flex flex-col items-center justify-center py-2.5 border-r border-violet-300/35 text-xs font-medium ${
                    meeting.date < today ? "text-muted-foreground/60" : "text-foreground"
                  }`}
                >
                  <span>{formatDate(meeting.date)}</span>
                </div>
              ))}
              <div className="w-10 min-w-[40px]" />
            </div>

            {/* 행 */}
            {members.map((member, idx) => {
              const isPendingRow = member.id in pendingChanges;
              const isEven = idx % 2 === 0;
              const isPromoted = !!member.promotedAt;
              const attendanceCount = Object.values(member.attendance ?? {}).filter(Boolean).length;
              const canPromote = attendanceCount >= 3 && !isPromoted;

              const rowStyle = isPromoted
                ? { background: "oklch(0.95 0.02 260 / 0.40)" }
                : isPendingRow
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
                    className="sticky left-0 z-10 flex flex-col justify-center px-3 py-2 min-w-[100px] border-r border-violet-300/40"
                    style={{ background: isPendingRow ? "oklch(0.95 0.08 85 / 0.25)" : isEven ? "oklch(0.97 0.012 290 / 0.65)" : "oklch(0.99 0.006 290 / 0.50)", backdropFilter: "blur(24px)" }}
                  >
                    <span className={`font-semibold text-sm leading-tight ${isPromoted ? "text-muted-foreground" : ""}`}>
                      {member.nickname}
                    </span>
                    {isPromoted && (
                      <span className="text-[10px] text-primary font-semibold leading-tight mt-0.5">
                        정회원 전환됨
                      </span>
                    )}
                  </div>

                  {/* 출석 합계 + 전환 버튼 */}
                  <div className="w-16 min-w-[64px] flex items-center justify-center border-r border-violet-300/35" style={{ minHeight: 44 }}>
                    {isPromoted ? (
                      <span className="text-xs text-muted-foreground/50">{attendanceCount}회</span>
                    ) : canPromote ? (
                      <button
                        onClick={() => setPromoteTarget(member)}
                        className="flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg bg-primary text-white text-[10px] font-bold leading-tight hover:bg-primary/90 active:scale-95 transition-all"
                      >
                        <span>{attendanceCount}회</span>
                        <span>전환↑</span>
                      </button>
                    ) : (
                      <span className={`text-xs font-semibold ${attendanceCount >= 2 ? "text-amber-500" : "text-muted-foreground/50"}`}>
                        {attendanceCount}회
                      </span>
                    )}
                  </div>

                  {/* 출석 셀 */}
                  {meetings.map((meeting) => {
                    const attended = member.attendance?.[meeting.id] ?? false;
                    const fieldPath = `attendance.${meeting.id}`;
                    const isPendingCell = pendingChanges[member.id]?.[fieldPath] !== undefined;
                    return (
                      <button
                        key={meeting.id}
                        onClick={() => !isPromoted && toggle(member.id, meeting.id, attended)}
                        disabled={isPromoted}
                        className={`${CELL_W} flex items-center justify-center border-r border-violet-300/35 transition-all ${
                          isPromoted ? "opacity-40 cursor-default" :
                          isPendingCell ? "bg-amber-50/50 active:scale-95" :
                          attended ? "bg-green-50/40 active:scale-95" :
                          "hover:bg-violet-100/40 active:scale-95"
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
                  })}

                  {/* 삭제 버튼 */}
                  <button
                    onClick={() => setDeleteTarget(member)}
                    className="w-10 min-w-[40px] flex items-center justify-center text-muted-foreground/40 hover:text-destructive transition-colors"
                    style={{ minHeight: 44 }}
                    aria-label="삭제"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

      {/* 정회원 전환 확인 다이얼로그 */}
      <Dialog open={!!promoteTarget} onOpenChange={(o) => { if (!o) setPromoteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>정회원으로 전환</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            <strong>{promoteTarget?.nickname}</strong>을(를) 정회원으로 전환하시겠습니까?
          </p>
          <p className="text-xs text-muted-foreground -mt-1">
            준회원 출석 이력은 그대로 보존됩니다.
          </p>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setPromoteTarget(null)}>
              취소
            </Button>
            <Button className="flex-1" onClick={handlePromote} disabled={promoting}>
              {promoting ? "전환 중..." : "정회원으로 전환"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 추가 다이얼로그 */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>준회원 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              value={newNickname}
              onChange={(e) => setNewNickname(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="닉네임"
              autoFocus
            />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setAddOpen(false)}>
                취소
              </Button>
              <Button className="flex-1" onClick={handleAdd} disabled={addSaving || !newNickname.trim()}>
                {addSaving ? "추가 중..." : "추가"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>준회원 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            <strong>{deleteTarget?.nickname}</strong>을(를) 삭제하시겠습니까?
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>
              취소
            </Button>
            <Button variant="destructive" className="flex-1" onClick={() => deleteTarget && handleDelete(deleteTarget)}>
              삭제
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
