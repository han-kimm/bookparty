"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface AttendanceMember {
  id: string;
  nickname: string;
  checkedIn: boolean;
  checkedInAt?: string;
  isAfterparty: boolean;
}

interface Meeting {
  id: string;
  title: string;
  date: string;
  venue: string;
  formUrl?: string;
}

export default function AttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [members, setMembers] = useState<AttendanceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newNickname, setNewNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [sheetSyncing, setSheetSyncing] = useState(false);
  const [sheetSyncResult, setSheetSyncResult] = useState<"ok" | "error" | null>(null);
  const [importing, setImporting] = useState(false);
  const [creatingForm, setCreatingForm] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const sortedIdsRef = useRef<string[]>([]); // 초기 로드 시 정렬 순서 고정
  const [importResult, setImportResult] = useState<string | null>(null);

  // 저장 전 변경사항: memberId -> 변경된 checkedIn 값
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});
  // 마지막으로 저장된 상태 (변경 감지용)
  const [savedState, setSavedState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all([
      fetch(`/api/meetings/${id}`).then((r) => r.json()),
      fetch(`/api/meetings/${id}/attendance`).then((r) => r.json()),
    ]).then(([meetingData, membersData]) => {
      setMeeting(meetingData);
      const list: AttendanceMember[] = Array.isArray(membersData) ? membersData : [];
      const sorted = [...list].sort((a, b) => a.nickname.localeCompare(b.nickname, "ko"));
      sortedIdsRef.current = sorted.map((m) => m.id);
      setMembers(list);
      const state: Record<string, boolean> = {};
      list.forEach((m) => { state[m.id] = m.checkedIn; });
      setSavedState(state);
      setLoading(false);
    });
  }, [id]);

  const toggleCheckin = (member: AttendanceMember) => {
    const newValue = !member.checkedIn;

    // 로컬 표시 업데이트
    setMembers((list) =>
      list.map((m) => m.id === member.id ? { ...m, checkedIn: newValue } : m)
    );

    // 원래 저장 상태와 같으면 pendingChanges에서 제거, 다르면 추가
    setPendingChanges((prev) => {
      const next = { ...prev };
      if (savedState[member.id] === newValue) {
        delete next[member.id];
      } else {
        next[member.id] = newValue;
      }
      return next;
    });
  };

  const saveAll = async () => {
    if (Object.keys(pendingChanges).length === 0) return;
    setSaving(true);

    await Promise.all(
      Object.entries(pendingChanges).map(([memberId, checkedIn]) =>
        fetch(`/api/meetings/${id}/attendance`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberId, checkedIn }),
        })
      )
    );

    // 변경 이력 기록
    const memberMap = Object.fromEntries(members.map((m) => [m.id, m.nickname]));
    fetch("/api/change-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "출석",
        context: `${meeting?.title ?? ""} (${meeting?.date ?? ""})`,
        entries: Object.entries(pendingChanges).map(([memberId, to]) => ({
          target: memberMap[memberId] ?? memberId,
          from: savedState[memberId] ? "출석" : "미출석",
          to: to ? "출석" : "미출석",
        })),
      }),
    });

    setSavedState((prev) => ({ ...prev, ...pendingChanges }));
    setPendingChanges({});
    setSaving(false);

    // 구글 시트에 비동기 동기화 (실패해도 저장은 완료)
    syncToSheets();
  };

  const syncToSheets = async () => {
    setSheetSyncing(true);
    setSheetSyncResult(null);
    try {
      const res = await fetch(`/api/meetings/${id}/sync-sheets`, { method: "POST" });
      setSheetSyncResult(res.ok ? "ok" : "error");
    } catch {
      setSheetSyncResult("error");
    } finally {
      setSheetSyncing(false);
    }
  };

  const addMember = async () => {
    if (!newNickname.trim()) return;
    setAdding(true);
    const res = await fetch(`/api/meetings/${id}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: newNickname.trim() }),
    });
    if (res.ok) {
      const { id: newId } = await res.json();
      const newMember: AttendanceMember = {
        id: newId,
        nickname: newNickname.trim(),
        checkedIn: false,
        isAfterparty: false,
      };
      sortedIdsRef.current = [...sortedIdsRef.current, newId];
      setMembers((list) => [...list, newMember]);
      setSavedState((prev) => ({ ...prev, [newId]: false }));
      setNewNickname("");
    }
    setAdding(false);
  };

  const syncAfterparty = async () => {
    setSyncing(true);
    setImportResult(null);
    try {
      const res = await fetch(`/api/meetings/${id}/sync-afterparty`, { method: "POST" });
      if (res.ok) {
        const { updated } = await res.json();
        // 변경된 내용 반영을 위해 명단 새로고침
        const membersRes = await fetch(`/api/meetings/${id}/attendance`);
        if (membersRes.ok) {
          const list: AttendanceMember[] = await membersRes.json();
          setMembers(list);
          const state: Record<string, boolean> = {};
          list.forEach((m) => { state[m.id] = m.checkedIn; });
          setSavedState(state);
          sortedIdsRef.current = [...list].sort((a, b) => a.nickname.localeCompare(b.nickname, "ko")).map((m) => m.id);
        }
        setImportResult(updated > 0 ? `뒤풀이 ${updated}명 수정됨` : "이미 최신 상태입니다.");
      } else {
        setImportResult("동기화 실패");
      }
    } finally {
      setSyncing(false);
    }
  };

  const createForm = async () => {
    setCreatingForm(true);
    setImportResult(null);
    try {
      const res = await fetch(`/api/meetings/${id}/create-form`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMeeting((prev) => prev ? { ...prev, formUrl: data.formUrl } : prev);
        setImportResult("구글폼이 생성됐습니다.");
      } else {
        const detail = data.detail ? ` (${JSON.stringify(data.detail)})` : "";
        setImportResult(`폼 생성 실패: ${data.error ?? res.status}${detail}`);
      }
    } finally {
      setCreatingForm(false);
    }
  };

  const importFromForm = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch(`/api/meetings/${id}/form-responses`);
      if (!res.ok) {
        const { error } = await res.json();
        setImportResult(error ?? "불러오기 실패");
        return;
      }
      const responses: { responseId: string; nickname: string; afterparty: "참석" | "불참" | null }[] = await res.json();

      // trim 기준으로 중복 체크
      const existingNicknamesTrimmed = new Set(members.map((m) => m.nickname.trim()));
      const newResponses = responses.filter((r) => !existingNicknamesTrimmed.has(r.nickname));

      // 신규 멤버 추가
      const added: AttendanceMember[] = [];
      await Promise.all(
        newResponses.map(async (r) => {
          const addRes = await fetch(`/api/meetings/${id}/attendance`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nickname: r.nickname,
              isAfterparty: r.afterparty === "참석",
            }),
          });
          if (addRes.ok) {
            const { id: newId } = await addRes.json();
            added.push({
              id: newId,
              nickname: r.nickname,
              checkedIn: false,
              isAfterparty: r.afterparty === "참석",
            });
          }
        })
      );

      if (added.length > 0) {
        sortedIdsRef.current = [...sortedIdsRef.current, ...added.map((m) => m.id)];
        setMembers((list) => [...list, ...added]);
        setSavedState((prev) => {
          const next = { ...prev };
          added.forEach((m) => { next[m.id] = false; });
          return next;
        });
      }

      // 뒤풀이 동기화 (신규 + 기존 멤버 모두)
      const syncRes = await fetch(`/api/meetings/${id}/sync-afterparty`, { method: "POST" });
      if (syncRes.ok) {
        const membersRes = await fetch(`/api/meetings/${id}/attendance`);
        if (membersRes.ok) {
          const list: AttendanceMember[] = await membersRes.json();
          setMembers(list);
          const state: Record<string, boolean> = {};
          list.forEach((m) => { state[m.id] = m.checkedIn; });
          setSavedState(state);
          sortedIdsRef.current = [...list]
            .sort((a, b) => a.nickname.localeCompare(b.nickname, "ko"))
            .map((m) => m.id);
        }
      }

      setImportResult(
        added.length > 0 ? `${added.length}명 추가 · 뒤풀이 동기화 완료` : "뒤풀이 동기화 완료"
      );
    } finally {
      setImporting(false);
    }
  };

  const removeMember = async (memberId: string, nickname: string) => {
    if (!confirm(`"${nickname}"을(를) 명단에서 제거하시겠습니까?`)) return;
    await fetch(`/api/meetings/${id}/attendance`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    setMembers((list) => list.filter((m) => m.id !== memberId));
    sortedIdsRef.current = sortedIdsRef.current.filter((sid) => sid !== memberId);
    setSavedState((prev) => { const next = { ...prev }; delete next[memberId]; return next; });
    setPendingChanges((prev) => { const next = { ...prev }; delete next[memberId]; return next; });
  };

  const pendingCount = Object.keys(pendingChanges).length;
  const checkedCount = members.filter((m) => m.checkedIn).length;
  const memberMap = Object.fromEntries(members.map((m) => [m.id, m]));
  const sortedMembers = sortedIdsRef.current.map((id) => memberMap[id]).filter(Boolean);

  if (loading) {
    return (
      <div className="py-6 space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-gray-200 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="py-6 space-y-4 pb-32">
      {/* 헤더 */}
      <div>
        <button onClick={() => router.back()} className="text-sm text-muted-foreground mb-2">
          ← 뒤로
        </button>
        <h1 className="text-xl font-bold">출석 체크</h1>
        {meeting && (
          <p className="text-sm text-muted-foreground">
            『{meeting.title}』 · {new Date(meeting.date).toLocaleDateString("ko-KR")}
          </p>
        )}
      </div>

      {/* 현황 요약 */}
      <Card className="bg-violet-50 border-violet-400">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-4xl font-bold text-black">{checkedCount}</p>
            <p className="text-sm text-black/60">출석 / 전체 {members.length}명</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-black">{members.length - checkedCount}명</p>
            <p className="text-sm text-black/60">미체크</p>
          </div>
        </CardContent>
      </Card>

      {/* 구글 시트 동기화 */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">구글 시트 출석부</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {sheetSyncing
                ? "시트에 반영 중..."
                : sheetSyncResult === "ok"
                  ? "시트 반영 완료"
                  : sheetSyncResult === "error"
                    ? "시트 반영 실패 — 다시 시도"
                    : "출석 저장 시 자동으로 시트에 반영됩니다"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={syncToSheets}
            disabled={sheetSyncing || members.length === 0}
            className="shrink-0"
          >
            {sheetSyncing ? "동기화 중..." : "지금 동기화"}
          </Button>
        </CardContent>
      </Card>

      {/* 구글폼 */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {meeting?.formUrl ? "구글폼 신청자 불러오기" : "구글폼 없음"}
            </p>
            {importResult && (
              <p className="text-xs text-muted-foreground mt-0.5">{importResult}</p>
            )}
          </div>
          {meeting?.formUrl ? (
            <Button
              variant="outline"
              size="sm"
              onClick={importFromForm}
              disabled={importing}
              className="shrink-0"
            >
              {importing ? "불러오는 중..." : "불러오기"}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={createForm}
              disabled={creatingForm}
              className="shrink-0"
            >
              {creatingForm ? "생성 중..." : "폼 생성"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 직접 추가 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground">현장 추가</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder="닉네임 입력"
            value={newNickname}
            onChange={(e) => setNewNickname(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addMember()}
            className="border-2 border-violet-300 focus-visible:border-primary/50"
          />
          <Button onClick={addMember} disabled={adding || !newNickname.trim()} variant="default">
            {adding ? "..." : "추가"}
          </Button>
        </CardContent>
      </Card>

      {/* 출석 목록 */}
      <div className="space-y-2">
        {sortedMembers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <p>명단이 없습니다.</p>
            <p className="mt-1">구글폼 신청자를 불러오거나 직접 추가하세요.</p>
          </div>
        ) : (
          sortedMembers.map((member) => {
            const isPending = member.id in pendingChanges;
            return (
              <div key={member.id} className="relative group">
                <button
                  onClick={() => toggleCheckin(member)}
                  className={[
                    "w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left pr-12",
                    isPending
                      ? "border-amber-400 bg-amber-50/60"
                      : member.checkedIn
                        ? "border-green-500 bg-green-50/80"
                        : "border-violet-300 bg-violet-50/80 hover:bg-violet-100/60",
                  ].join(" ")}
                >
                  <div>
                    <p className="font-semibold text-base">{member.nickname}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {member.isAfterparty && (
                      <Badge variant="outline" className="text-xs">뒤풀이</Badge>
                    )}
                    <span className="text-2xl transition-all">
                      {member.checkedIn ? "✅" : "☐"}
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => removeMember(member.id, member.nickname)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  aria-label="제거"
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* 출석률 하단 요약 */}
      {members.length > 0 && (
        <>
          <Separator />
          <p className="text-center text-sm text-muted-foreground pb-4">
            출석률 {Math.round((checkedCount / members.length) * 100)}%
            · 뒤풀이 {members.filter((m) => m.isAfterparty).length}명
          </p>
        </>
      )}

      {/* 플로팅 저장 버튼 */}
      {pendingCount > 0 && (
        <div className="fixed bottom-24 left-0 right-0 flex justify-center z-50 px-4">
          <Button
            size="lg"
            onClick={saveAll}
            disabled={saving}
            className="shadow-xl shadow-primary/30 rounded-full px-8 gap-2"
          >
            {saving ? "저장 중..." : `변경사항 저장 (${pendingCount}명)`}
          </Button>
        </div>
      )}
    </div>
  );
}
