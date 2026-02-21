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
  const [sheetSyncing, setSheetSyncing] = useState(false);
  const [sheetSyncMsg, setSheetSyncMsg] = useState<string | null>(null);

  // 추가 다이얼로그
  const [addOpen, setAddOpen] = useState(false);
  const [newNickname, setNewNickname] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  // 삭제 확인
  const [deleteTarget, setDeleteTarget] = useState<AssociateMember | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const fetchAll = async () => {
    const [membersRes, meetingsRes] = await Promise.all([
      fetch("/api/associate-members"),
      fetch("/api/meetings"),
    ]);
    const membersData = await membersRes.json();
    const meetingsData = await meetingsRes.json();

    const list: AssociateMember[] = Array.isArray(membersData) ? membersData : [];
    setMembers(list);

    const filtered = (Array.isArray(meetingsData) ? meetingsData : [])
      .filter((m: Meeting) => m.date.startsWith("2026-"))
      .sort((a: Meeting, b: Meeting) => a.date.localeCompare(b.date));
    setMeetings(filtered);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

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
      <div className="text-xs text-muted-foreground bg-muted/60 rounded-xl px-4 py-3 mb-4">
        <p>· 출석은 각 모임 출석체크에서 자동으로 반영됩니다.</p>
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
              <div className="sticky left-0 z-20 flex items-center px-3 py-2.5 min-w-[88px] border-r border-violet-300/40 font-semibold text-xs text-muted-foreground uppercase tracking-wide" style={{ background: "oklch(0.54 0.23 293 / 0.05)" }}>
                닉네임
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
              {/* 삭제 열 헤더 */}
              <div className="w-10 min-w-[40px]" />
            </div>

            {/* 행 */}
            {members.map((member, idx) => {
              const isEven = idx % 2 === 0;
              const rowStyle = isEven
                ? { background: "transparent" }
                : { background: "oklch(0.54 0.23 293 / 0.02)" };

              return (
                <div
                  key={member.id}
                  className="flex border-b last:border-b-0 border-violet-300/35"
                  style={rowStyle}
                >
                  {/* 닉네임 고정 열 */}
                  <div
                    className="sticky left-0 z-10 flex items-center px-3 py-2.5 min-w-[88px] border-r border-violet-300/40"
                    style={{ background: isEven ? "oklch(0.97 0.012 290 / 0.65)" : "oklch(0.99 0.006 290 / 0.50)", backdropFilter: "blur(24px)" }}
                  >
                    <span className="font-semibold text-sm leading-tight">{member.nickname}</span>
                  </div>

                  {/* 출석 셀 (읽기 전용) */}
                  {meetings.map((meeting) => {
                    const attended = member.attendance?.[meeting.id] ?? false;
                    return (
                      <div
                        key={meeting.id}
                        className={`${CELL_W} flex items-center justify-center border-r border-violet-300/35 ${attended ? "bg-green-50/40" : ""}`}
                        style={{ minHeight: 44 }}
                      >
                        {attended ? (
                          <span className="text-xs font-bold text-green-600 bg-green-100/70 rounded-full px-1.5 py-0.5">참</span>
                        ) : (
                          <span className="text-muted-foreground/25 text-base">·</span>
                        )}
                      </div>
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
