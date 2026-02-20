"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export default function AfterpartyPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>("");
  const [totalAmount, setTotalAmount] = useState<string>("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newName, setNewName] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const selectedButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    fetch("/api/meetings")
      .then((r) => r.json())
      .then((data) => {
        const withAfterparty = Array.isArray(data)
          ? [...data.filter((m) => m.isAfterparty)].sort((a, b) => a.date.localeCompare(b.date))
          : [];
        setMeetings(withAfterparty);
        if (withAfterparty.length > 0) {
          const today = new Date().toISOString().slice(0, 10);
          const closest =
            withAfterparty.find((m) => m.date >= today) ??
            withAfterparty[withAfterparty.length - 1];
          setSelectedMeetingId(closest.id);
        }
      });
  }, []);

  useEffect(() => {
    if (selectedButtonRef.current) {
      selectedButtonRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [selectedMeetingId]);

  useEffect(() => {
    if (!selectedMeetingId) return;
    fetch(`/api/finance/afterparty?meetingId=${selectedMeetingId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          setTotalAmount(String(data.totalAmount || ""));
          setParticipants(data.participants || []);
          setNotes(data.notes || "");
        } else {
          setTotalAmount("");
          setParticipants([]);
          setNotes("");
        }
      });
  }, [selectedMeetingId]);

  const syncFromAttendance = async () => {
    if (!selectedMeetingId) return;
    setSyncing(true);
    setSyncResult(null);
    const res = await fetch(`/api/meetings/${selectedMeetingId}/attendance`);
    if (res.ok) {
      const members: { nickname: string; isAfterparty: boolean }[] = await res.json();
      const afterpartyMembers = members.filter((m) => m.isAfterparty).map((m) => m.nickname.trim());
      setParticipants((prev) => {
        const existingNames = new Set(prev.map((p) => p.name.trim()));
        const toAdd = afterpartyMembers.filter((name) => !existingNames.has(name));
        const newList = [...prev, ...toAdd.map((name) => ({ name, amount: 0, paid: false }))];
        setSyncResult(toAdd.length > 0 ? `${toAdd.length}명 추가됨` : "이미 최신 상태입니다.");
        return newList;
      });
    } else {
      setSyncResult("동기화 실패");
    }
    setSyncing(false);
  };

  const addParticipant = () => {
    if (!newName.trim()) return;
    setParticipants((list) => [...list, { name: newName.trim(), amount: 0, paid: false }]);
    setNewName("");
  };

  const removeParticipant = (idx: number) =>
    setParticipants((list) => list.filter((_, i) => i !== idx));

  const togglePaid = (idx: number) =>
    setParticipants((list) =>
      list.map((p, i) => (i === idx ? { ...p, paid: !p.paid } : p))
    );

  const total = Number(totalAmount) || 0;
  const perPerson = participants.length > 0 ? Math.ceil(total / participants.length) : 0;
  const unpaidTotal = participants.filter((p) => !p.paid).length * perPerson;

  const handleSave = async () => {
    if (!selectedMeetingId) return;
    setSaving(true);
    await fetch("/api/finance/afterparty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meetingId: selectedMeetingId,
        totalAmount: total,
        participants,
        notes,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const copySettlement = () => {
    const lines = [
      `[뒤풀이 정산]`,
      `총 금액: ${total.toLocaleString()}원`,
      `인원: ${participants.length}명`,
      `1인당: ${perPerson.toLocaleString()}원`,
      ``,
      ...participants.map(
        (p) => `${p.paid ? "✅" : "❌"} ${p.name} — ${perPerson.toLocaleString()}원`
      ),
    ];
    if (notes) lines.push(``, `메모: ${notes}`);
    navigator.clipboard.writeText(lines.join("\n"));
  };

  return (
    <div className="py-6 space-y-4">
      <h1 className="text-xl font-bold">뒤풀이 정산</h1>

      {/* 모임 선택 */}
      <div className="space-y-1.5">
        <Label>모임 선택</Label>
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
                    ? "bg-primary/90 text-primary-foreground border-primary/30 backdrop-blur-sm shadow-[0_2px_12px_oklch(0.54_0.23_293/0.25)]"
                    : "glass text-muted-foreground hover:bg-violet-100/60"
                }`}
              >
                {new Date(m.date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })} 『{m.title.slice(0, 8)}』
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedMeetingId && (
        <>
          <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start space-y-4 lg:space-y-0">
          {/* 금액 입력 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">총 금액</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="0"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className="text-xl font-bold"
                />
                <span className="text-lg font-medium shrink-0">원</span>
              </div>
              {perPerson > 0 && (
                <div className="p-3 bg-blue-50 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">1인당</p>
                  <p className="text-2xl font-bold text-blue-700">{perPerson.toLocaleString()}원</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 참가자 */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">참가자 ({participants.length}명)</CardTitle>
                <div className="flex items-center gap-2">
                  {syncResult && <span className="text-xs text-muted-foreground">{syncResult}</span>}
                  <Button variant="outline" size="sm" onClick={syncFromAttendance} disabled={syncing}>
                    {syncing ? "동기화 중..." : "출석 동기화"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="이름 입력"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addParticipant()}
                />
                <Button variant="outline" onClick={addParticipant}>추가</Button>
              </div>

              {participants.length > 0 && (
                <div className="space-y-2">
                  {participants.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <button
                        onClick={() => togglePaid(idx)}
                        className={`flex-1 flex items-center justify-between p-3 rounded-lg border-2 text-left transition-colors ${
                          p.paid ? "border-green-300/60 bg-green-50/70 backdrop-blur-sm" : "glass hover:bg-violet-100/60"
                        }`}
                      >
                        <span className="font-medium">{p.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">{perPerson.toLocaleString()}원</span>
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

                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">미납 합계</span>
                    <span className="font-semibold text-destructive">{unpaidTotal.toLocaleString()}원</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">납부 완료</span>
                    <span className="font-semibold text-green-600">
                      {(total - unpaidTotal).toLocaleString()}원
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          </div>{/* end 2-col grid */}

          {/* 메모 */}
          <div className="space-y-1.5">
            <Label>메모</Label>
            <Textarea
              placeholder="추가 메모 (선택)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* 버튼 */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={copySettlement}>
              📋 복사
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saved ? "✅ 저장됨" : saving ? "저장 중..." : "저장"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
