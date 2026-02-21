"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface DuesMember {
  id: string;
  realName: string;
  nickname: string;
  paid: boolean;
}

function getQuarterOptions() {
  return [1, 2, 3, 4].map((q) => ({ value: `2026-Q${q}`, label: `2026년 ${q}분기` }));
}

export default function DuesPage() {
  const quarterOptions = getQuarterOptions();
  const [selectedQuarter, setSelectedQuarter] = useState(quarterOptions[0].value);
  const [members, setMembers] = useState<DuesMember[]>([]);
  const [savedState, setSavedState] = useState<Record<string, boolean>>({});
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchDues = async (quarter: string) => {
    setLoading(true);
    setPendingChanges({});
    const res = await fetch(`/api/finance/dues?month=${quarter}`);
    if (res.ok) {
      const data: DuesMember[] = await res.json();
      setMembers(Array.isArray(data) ? data : []);
      const state: Record<string, boolean> = {};
      data.forEach((m) => { state[m.id] = m.paid; });
      setSavedState(state);
    }
    setLoading(false);
  };

  useEffect(() => { fetchDues(selectedQuarter); }, [selectedQuarter]);

  const toggle = (member: DuesMember) => {
    const newPaid = !member.paid;
    setMembers((list) => list.map((m) => m.id === member.id ? { ...m, paid: newPaid } : m));
    setPendingChanges((prev) => {
      const next = { ...prev };
      if (savedState[member.id] === newPaid) {
        delete next[member.id];
      } else {
        next[member.id] = newPaid;
      }
      return next;
    });
  };

  const saveAll = async () => {
    const entries = Object.entries(pendingChanges);
    if (!entries.length) return;
    setSaving(true);

    await Promise.all(
      entries.map(([memberId, paid]) =>
        fetch("/api/finance/dues", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberId, month: selectedQuarter, paid }),
        })
      )
    );

    // 변경 이력 기록
    const memberMap = Object.fromEntries(members.map((m) => [m.id, m.realName]));
    fetch("/api/change-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "회비",
        context: selectedQuarter,
        entries: entries.map(([memberId, to]) => ({
          target: memberMap[memberId] ?? memberId,
          from: savedState[memberId] ? "납부" : "미납",
          to: to ? "납부" : "미납",
        })),
      }),
    });

    setSavedState((prev) => ({ ...prev, ...pendingChanges }));
    setPendingChanges({});
    setSaving(false);
  };

  const pendingCount = Object.keys(pendingChanges).length;
  const paidCount = members.filter((m) => m.paid).length;
  // 저장된 상태 기준으로 그룹 유지 (저장 전엔 이동 안 함)
  const unpaidMembers = members.filter((m) => !savedState[m.id]);
  const paidMembers = members.filter((m) => savedState[m.id]);

  return (
    <div className="py-6 space-y-4 pb-32">
      <h1 className="text-xl font-bold">회비 현황</h1>

      {/* 분기 선택 */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {quarterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSelectedQuarter(opt.value)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
              selectedQuarter === opt.value
                ? "bg-primary/90 text-primary-foreground border-primary/30 backdrop-blur-sm shadow-[0_2px_12px_oklch(0.54_0.23_293/0.25)]"
                : "glass text-muted-foreground hover:bg-violet-100/60"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 요약 */}
      <Card className="bg-gradient-to-br from-blue-50/70 to-indigo-50/70">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold">
                {paidCount}
                <span className="text-lg font-normal text-muted-foreground"> / {members.length}명</span>
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">납부 완료</p>
            </div>
            {unpaidMembers.length > 0 && (
              <Badge variant="destructive" className="text-sm px-3 py-1">
                미납 {unpaidMembers.length}명
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-gray-200 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start space-y-4 lg:space-y-0">
            {/* 미납 */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-destructive">미납 ({unpaidMembers.length}명)</h2>
              {unpaidMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">미납자가 없습니다 🎉</p>
              ) : unpaidMembers.map((member) => {
                const isPending = member.id in pendingChanges;
                return (
                  <button
                    key={member.id}
                    onClick={() => toggle(member)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 text-left transition-all ${
                      isPending
                        ? "border-amber-400 bg-amber-50/70"
                        : "border-red-300/60 bg-red-50/70 backdrop-blur-sm"
                    }`}
                  >
                    <div>
                      <p className="font-semibold">{member.realName}</p>
                      {member.nickname !== member.realName && (
                        <p className="text-xs text-muted-foreground">{member.nickname}</p>
                      )}
                    </div>
                    <span className="text-2xl">{member.paid ? "✅" : "☐"}</span>
                  </button>
                );
              })}
            </div>

            {/* 납부 완료 */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-green-600">납부 완료 ({paidMembers.length}명)</h2>
              {paidMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">납부자가 없습니다.</p>
              ) : paidMembers.map((member) => {
                const isPending = member.id in pendingChanges;
                return (
                  <button
                    key={member.id}
                    onClick={() => toggle(member)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 text-left transition-all ${
                      isPending
                        ? "border-amber-400 bg-amber-50/70"
                        : "border-green-300/60 bg-green-50/70 backdrop-blur-sm opacity-70"
                    }`}
                  >
                    <div>
                      <p className="font-semibold">{member.realName}</p>
                      {member.nickname !== member.realName && (
                        <p className="text-xs text-muted-foreground">{member.nickname}</p>
                      )}
                    </div>
                    <span className="text-2xl">{member.paid ? "✅" : "☐"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {members.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <p>회원 정보가 없습니다.</p>
              <p className="mt-1">회원 관리 탭에서 회원을 추가하세요.</p>
            </div>
          )}
        </>
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
    </div>
  );
}
