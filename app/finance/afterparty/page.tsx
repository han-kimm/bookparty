"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface Meeting {
  id: string;
  title: string;
  date: string;
  isAfterparty: boolean;
}

interface Participant {
  name: string;
  amount: number;
  paid: boolean;
}

interface RoundData {
  totalAmount: string;
  participants: Participant[];
  notes: string;
}

const ROUNDS = [1, 2, 3] as const;
type Round = (typeof ROUNDS)[number];

const emptyRound = (): RoundData => ({ totalAmount: "", participants: [], notes: "" });

export default function AfterpartyPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>("");
  const [selectedRound, setSelectedRound] = useState<Round>(1);
  const [roundData, setRoundData] = useState<Record<Round, RoundData>>({
    1: emptyRound(),
    2: emptyRound(),
    3: emptyRound(),
  });
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const selectedButtonRef = useRef<HTMLButtonElement | null>(null);

  const current = roundData[selectedRound];

  // 모임 목록 로드
  useEffect(() => {
    fetch("/api/meetings")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data)
          ? [...data.filter((m: Meeting) => m.isAfterparty)].sort((a, b) =>
              a.date.localeCompare(b.date)
            )
          : [];
        setMeetings(list);
        if (list.length > 0) {
          const today = new Date().toISOString().slice(0, 10);
          const closest = list.find((m: Meeting) => m.date >= today) ?? list[list.length - 1];
          setSelectedMeetingId(closest.id);
        }
      });
  }, []);

  useEffect(() => {
    if (selectedButtonRef.current) {
      selectedButtonRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [selectedMeetingId]);

  // 모임 선택 시 모든 차수 데이터 로드
  useEffect(() => {
    if (!selectedMeetingId) return;
    setSyncMsg(null);

    Promise.all(
      ROUNDS.map((round) =>
        fetch(`/api/finance/afterparty?meetingId=${selectedMeetingId}&round=${round}`).then((r) =>
          r.json()
        )
      )
    ).then(async ([r1, r2, r3]) => {
      const fromFirebase = (d: RoundData | null): RoundData | null =>
        d && (d.participants?.length > 0 || Number(d.totalAmount) > 0)
          ? { totalAmount: String(d.totalAmount || ""), participants: d.participants || [], notes: d.notes || "" }
          : null;

      const loaded: Record<Round, RoundData> = {
        1: fromFirebase(r1) ?? emptyRound(),
        2: fromFirebase(r2) ?? emptyRound(),
        3: fromFirebase(r3) ?? emptyRound(),
      };

      // 1차 저장 데이터 없으면 출석체크에서 자동 로드
      if (loaded[1].participants.length === 0) {
        const res = await fetch(`/api/meetings/${selectedMeetingId}/attendance`);
        if (res.ok) {
          const members: { nickname: string; isAfterparty: boolean }[] = await res.json();
          const auto = members
            .filter((m) => m.isAfterparty)
            .map((m) => ({ name: m.nickname.trim(), amount: 0, paid: false }));
          loaded[1].participants = auto;
          if (auto.length > 0) setSyncMsg(`1차: 출석체크에서 ${auto.length}명 자동 불러옴`);
        }
      }

      setRoundData(loaded);
      setSelectedRound(1);
    });
  }, [selectedMeetingId]);

  const updateRound = (updates: Partial<RoundData>) =>
    setRoundData((prev) => ({
      ...prev,
      [selectedRound]: { ...prev[selectedRound], ...updates },
    }));

  // 1차 출석 재동기화 (수동)
  const syncFromAttendance = async () => {
    if (!selectedMeetingId) return;
    setSyncing(true);
    setSyncMsg(null);
    const res = await fetch(`/api/meetings/${selectedMeetingId}/attendance`);
    if (res.ok) {
      const members: { nickname: string; isAfterparty: boolean }[] = await res.json();
      const afterpartyNames = members.filter((m) => m.isAfterparty).map((m) => m.nickname.trim());
      setRoundData((prev) => {
        const existing = new Set(prev[1].participants.map((p) => p.name.trim()));
        const toAdd = afterpartyNames.filter((n) => !existing.has(n));
        const newList = [...prev[1].participants, ...toAdd.map((n) => ({ name: n, amount: 0, paid: false }))];
        setSyncMsg(toAdd.length > 0 ? `${toAdd.length}명 추가됨` : "이미 최신 상태입니다.");
        return { ...prev, 1: { ...prev[1], participants: newList } };
      });
    } else {
      setSyncMsg("동기화 실패");
    }
    setSyncing(false);
  };

  const addParticipant = () => {
    if (!newName.trim()) return;
    updateRound({ participants: [...current.participants, { name: newName.trim(), amount: 0, paid: false }] });
    setNewName("");
  };

  const removeParticipant = (idx: number) =>
    updateRound({ participants: current.participants.filter((_, i) => i !== idx) });

  const togglePaid = (idx: number) =>
    updateRound({
      participants: current.participants.map((p, i) => (i === idx ? { ...p, paid: !p.paid } : p)),
    });

  const total = Number(current.totalAmount) || 0;
  const perPerson = current.participants.length > 0 ? Math.ceil(total / current.participants.length) : 0;
  const unpaidCount = current.participants.filter((p) => !p.paid).length;
  const paidCount = current.participants.length - unpaidCount;

  const handleSave = async () => {
    if (!selectedMeetingId) return;
    setSaving(true);
    await fetch("/api/finance/afterparty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meetingId: selectedMeetingId,
        round: selectedRound,
        totalAmount: total,
        participants: current.participants,
        notes: current.notes,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const buildSettlementText = () => {
    const meeting = meetings.find((m) => m.id === selectedMeetingId);
    const dateStr = meeting
      ? new Date(meeting.date).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })
      : "";
    const titleStr = meeting ? `『${meeting.title}』` : "";

    const unpaid = current.participants.filter((p) => !p.paid);
    const paid = current.participants.filter((p) => p.paid);

    const lines: string[] = [
      `[뒤풀이 ${selectedRound}차 정산] ${titleStr} ${dateStr}`.trim(),
      ``,
      `💰 총액 ${total.toLocaleString()}원 · ${current.participants.length}명 · 1인당 ${perPerson.toLocaleString()}원`,
    ];

    if (current.notes) {
      lines.push(``, current.notes);
    }

    if (unpaid.length > 0) {
      lines.push(``, `미납 (${unpaid.length}명)`);
      unpaid.forEach((p) => lines.push(`❌ ${p.name} · ${perPerson.toLocaleString()}원`));
    }

    if (paid.length > 0) {
      lines.push(``, `납부 완료 (${paid.length}명)`);
      lines.push(`✅ ${paid.map((p) => p.name).join(", ")}`);
    }

    return lines.join("\n");
  };

  const copySettlement = () => {
    navigator.clipboard.writeText(buildSettlementText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="py-6 space-y-4 pb-8">
      <h1 className="text-xl font-bold">뒤풀이 정산</h1>

      {/* 모임 선택 */}
      {meetings.length === 0 ? (
        <p className="text-sm text-muted-foreground">뒤풀이 있는 모임이 없습니다.</p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {meetings.map((m) => (
            <button
              key={m.id}
              ref={selectedMeetingId === m.id ? selectedButtonRef : null}
              onClick={() => setSelectedMeetingId(m.id)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                selectedMeetingId === m.id
                  ? "bg-primary/90 text-primary-foreground border-primary/30 shadow-[0_2px_12px_oklch(0.54_0.23_293/0.25)]"
                  : "glass text-muted-foreground hover:bg-violet-100/60"
              }`}
            >
              {new Date(m.date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}{" "}
              『{m.title.slice(0, 8)}』
            </button>
          ))}
        </div>
      )}

      {selectedMeetingId && (
        <>
          {/* 차수 탭 */}
          <div className="flex gap-2">
            {ROUNDS.map((round) => {
              const hasData =
                roundData[round].participants.length > 0 || Number(roundData[round].totalAmount) > 0;
              return (
                <button
                  key={round}
                  onClick={() => { setSelectedRound(round); setSyncMsg(null); }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border-2 ${
                    selectedRound === round
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : hasData
                        ? "border-violet-300 text-violet-700 bg-violet-50/60"
                        : "border-border text-muted-foreground bg-background"
                  }`}
                >
                  {round}차
                  {hasData && selectedRound !== round && (
                    <span className="ml-1.5 text-xs opacity-60">{roundData[round].participants.length}명</span>
                  )}
                </button>
              );
            })}
          </div>

          {syncMsg && (
            <p className="text-xs text-center text-muted-foreground">{syncMsg}</p>
          )}

          <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start space-y-4 lg:space-y-0">
            {/* 금액 + 메모 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{selectedRound}차 총 금액</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={current.totalAmount ? Number(current.totalAmount).toLocaleString("ko-KR") : ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      updateRound({ totalAmount: raw });
                    }}
                    className="text-xl font-bold border-2 border-violet-300 focus-visible:border-primary/50"
                  />
                  <span className="text-lg font-medium shrink-0">원</span>
                </div>
                {perPerson > 0 && (
                  <div className="p-3 bg-blue-50 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">1인당</p>
                    <p className="text-2xl font-bold text-blue-700">{perPerson.toLocaleString()}원</p>
                  </div>
                )}
                <Textarea
                  placeholder="계좌번호 등 메모 (공지 복사 시 포함됨)"
                  value={current.notes}
                  onChange={(e) => updateRound({ notes: e.target.value })}
                  rows={2}
                  className="border-2 border-violet-300 focus-visible:border-primary/50"
                />
                {current.participants.length > 0 && (
                  <>
                    <div className="rounded-xl border bg-muted/40 px-4 py-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">공지 미리보기</p>
                      <pre className="text-xs text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">
                        {buildSettlementText()}
                      </pre>
                    </div>
                    <Button variant="outline" className="w-full" onClick={copySettlement}>
                      {copied ? "✅ 복사됨" : `📋 ${selectedRound}차 공지 복사`}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* 참가자 */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    {selectedRound}차 참가자 ({current.participants.length}명)
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md bg-primary text-white leading-none">이체 확인</span>
                    {unpaidCount > 0 && (
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md bg-red-500 text-white leading-none">미확인 {unpaidCount}명</span>
                    )}
                  </CardTitle>
                  {selectedRound === 1 && (
                    <Button variant="outline" size="sm" onClick={syncFromAttendance} disabled={syncing}>
                      {syncing ? "동기화 중..." : "출석 동기화"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="이름 입력"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addParticipant()}
                    className="border-2 border-violet-300 focus-visible:border-primary/50"
                  />
                  <Button variant="outline" onClick={addParticipant}>
                    추가
                  </Button>
                </div>

                {current.participants.length > 0 && (
                  <div className="space-y-2">
                    {current.participants.map((p, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <button
                          onClick={() => togglePaid(idx)}
                          className={`flex-1 flex items-center justify-between p-3 rounded-lg border-2 text-left transition-colors ${
                            p.paid
                              ? "border-green-300/60 bg-green-50/70"
                              : "glass hover:bg-violet-100/60"
                          }`}
                        >
                          <span className="font-medium">{p.name}</span>
                          <div className="flex items-center gap-2">
                            {perPerson > 0 && (
                              <span className="text-sm text-muted-foreground">
                                {perPerson.toLocaleString()}원
                              </span>
                            )}
                            <span className={p.paid ? "opacity-100" : "opacity-20"}>✅</span>
                          </div>
                        </button>
                        <button
                          onClick={() => removeParticipant(idx)}
                          className="text-muted-foreground hover:text-destructive text-xl w-8 h-8 flex items-center justify-center"
                        >
                          ×
                        </button>
                      </div>
                    ))}

                    {perPerson > 0 && (
                      <>
                        <Separator />
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">미납 ({unpaidCount}명)</span>
                          <span className="font-semibold text-destructive">
                            {(unpaidCount * perPerson).toLocaleString()}원
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">납부 완료 ({paidCount}명)</span>
                          <span className="font-semibold text-green-600">
                            {(paidCount * perPerson).toLocaleString()}원
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </>
      )}
      {/* 플로팅 저장 버튼 */}
      {selectedMeetingId && (
        <div className="fixed bottom-24 left-0 right-0 flex justify-center z-50 px-4">
          <Button
            size="lg"
            onClick={handleSave}
            disabled={saving}
            className="shadow-xl shadow-primary/30 rounded-full px-8"
          >
            {saved ? "✅ 저장됨" : saving ? "저장 중..." : "저장"}
          </Button>
        </div>
      )}
    </div>
  );
}
