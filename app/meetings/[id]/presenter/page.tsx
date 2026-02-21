"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Meeting {
  id: string;
  title: string;
  author: string;
  publisher: string;
  year: string;
  date: string;
  deadline: string;
  presenter: string;
  venue: string;
  formUrl: string;
  kakaoUrl: string;
  bookUrl: string;
  isAfterparty: boolean;
}

export default function PresenterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Meeting>>({});
  const [responseCount, setResponseCount] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [creatingForm, setCreatingForm] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<"ok" | "error" | null>(null);
  const [formUrlInput, setFormUrlInput] = useState("");   // 입력 중인 URL (아직 저장 안 됨)
  const [savingFormUrl, setSavingFormUrl] = useState(false);

  useEffect(() => {
    fetch(`/api/meetings/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setForm(data);
        setLoading(false);
        if (data.formUrl) {
          fetch(`/api/meetings/${id}/form-responses`)
            .then((r) => r.ok ? r.json() : null)
            .then((responses) => {
              if (Array.isArray(responses)) setResponseCount(responses.length);
            })
            .catch(() => {});
        }
      });
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setSaveResult(null);
    const res = await fetch(`/api/meetings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setSaveResult("error");
    } else if (data.formSyncError) {
      setSaveResult(data.formSyncError);
    } else {
      setSaveResult("ok");
    }
  };

  const handleDelete = async () => {
    await fetch(`/api/meetings/${id}`, { method: "DELETE" });
    router.push("/meetings");
  };

  const syncForm = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(`/api/meetings/${id}/form-responses`);
      if (!res.ok) {
        const { error } = await res.json();
        setSyncResult(error ?? "불러오기 실패");
        return;
      }
      const responses: { nickname: string; afterparty: "참석" | "불참" | null }[] = await res.json();
      setResponseCount(responses.length);

      // 현재 출석 명단 조회
      const attendRes = await fetch(`/api/meetings/${id}/attendance`);
      const existing: { nickname: string }[] = attendRes.ok ? await attendRes.json() : [];
      const existingNicknames = new Set(existing.map((m) => m.nickname));
      const newOnes = responses.filter((r) => !existingNicknames.has(r.nickname));

      if (newOnes.length === 0) {
        setSyncResult("새로운 신청자가 없습니다.");
        return;
      }

      await Promise.all(
        newOnes.map((r) =>
          fetch(`/api/meetings/${id}/attendance`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nickname: r.nickname, isAfterparty: r.afterparty === "참석" }),
          })
        )
      );
      setSyncResult(`${newOnes.length}명 출석 명단에 추가됐습니다.`);
    } finally {
      setSyncing(false);
    }
  };

  const createForm = async () => {
    setCreatingForm(true);
    setSyncResult(null);
    try {
      const res = await fetch(`/api/meetings/${id}/create-form`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setForm((prev) => ({ ...prev, formUrl: data.formUrl }));
        setSyncResult("구글폼이 생성됐습니다.");
      } else {
        setSyncResult(`폼 생성 실패: ${data.error ?? res.status}`);
      }
    } finally {
      setCreatingForm(false);
    }
  };

  const saveFormUrl = async () => {
    if (!formUrlInput.trim()) return;
    setSavingFormUrl(true);
    setSyncResult(null);
    const res = await fetch(`/api/meetings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formUrl: formUrlInput.trim() }),
    });
    if (res.ok) {
      setForm((prev) => ({ ...prev, formUrl: formUrlInput.trim() }));
      setFormUrlInput("");
      setSyncResult("구글폼이 연결됐습니다.");
    } else {
      setSyncResult("저장에 실패했습니다.");
    }
    setSavingFormUrl(false);
  };

  const set = (field: keyof Meeting) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  if (loading) return <div className="py-6 text-center text-muted-foreground">불러오는 중...</div>;

  return (
    <div className="py-6 space-y-4">
      <div>
        <button onClick={() => router.back()} className="text-sm text-muted-foreground mb-2">
          ← 뒤로
        </button>
        <h1 className="text-xl font-bold">모임 수정</h1>
      </div>

      <Card className="border-blue-200 bg-blue-50/60">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">구글폼</p>
            {form.formUrl ? (
              <Button asChild variant="outline" size="sm">
                <Link href={form.formUrl.replace("/viewform", "/edit")} target="_blank">수정하기</Link>
              </Button>
            ) : null}
          </div>

          {form.formUrl ? (
            <>
              <p className="text-xs text-muted-foreground truncate">{form.formUrl}</p>
              {responseCount !== null && (
                <p className="text-sm">신청자 <span className="font-bold text-blue-700">{responseCount}명</span></p>
              )}
              <Button
                size="sm"
                className="w-full"
                onClick={syncForm}
                disabled={syncing}
              >
                {syncing ? "동기화 중..." : "신청자 → 출석 명단 동기화"}
              </Button>
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="기존 구글폼 URL 붙여넣기"
                  value={formUrlInput}
                  onChange={(e) => setFormUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveFormUrl()}
                  className="text-xs bg-violet-50/90 border-2 border-violet-300"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  disabled={!formUrlInput.trim() || savingFormUrl}
                  onClick={saveFormUrl}
                >
                  {savingFormUrl ? "..." : "저장"}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-muted-foreground">또는</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={createForm}
                disabled={creatingForm}
              >
                {creatingForm ? "생성 중..." : "새 구글폼 생성"}
              </Button>
            </div>
          )}

          {syncResult && (
            <p className="text-xs text-center text-muted-foreground">{syncResult}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">모임 정보 수정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>책 제목</Label>
            <Input value={form.title || ""} onChange={set("title")} className="bg-violet-50/90 border-2 border-violet-300 focus-visible:border-primary/50" />
          </div>
          <div className="space-y-1.5">
            <Label>저자</Label>
            <Input value={form.author || ""} onChange={set("author")} placeholder="예: 강보원, 박은지, 황인찬" className="bg-violet-50/90 border-2 border-violet-300 focus-visible:border-primary/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>출판사</Label>
              <Input value={form.publisher || ""} onChange={set("publisher")} placeholder="예: 민음사" className="bg-violet-50/90 border-2 border-violet-300 focus-visible:border-primary/50" />
            </div>
            <div className="space-y-1.5">
              <Label>출판연도</Label>
              <Input value={form.year || ""} onChange={set("year")} placeholder="예: 2025" className="bg-violet-50/90 border-2 border-violet-300 focus-visible:border-primary/50" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>날짜</Label>
            <Input type="date" value={form.date || ""} onChange={set("date")} className="bg-violet-50/90 border-2 border-violet-300 focus-visible:border-primary/50" />
          </div>
          <div className="space-y-1.5">
            <Label>신청 마감일</Label>
            <Input type="date" value={form.deadline || ""} onChange={set("deadline")} className="bg-violet-50/90 border-2 border-violet-300 focus-visible:border-primary/50" />
            <p className="text-xs text-muted-foreground">미설정 시 모임 전 수요일로 자동 계산됩니다. 폼 설명에 "해당 날짜 22:00 이후 신청 불가"로 표시됩니다.</p>
          </div>
          <div className="space-y-1.5">
            <Label>발제자</Label>
            <Input value={form.presenter || ""} onChange={set("presenter")} placeholder="예: 홍길동" className="bg-violet-50/90 border-2 border-violet-300 focus-visible:border-primary/50" />
          </div>
          <div className="space-y-1.5">
            <Label>장소</Label>
            <Input value={form.venue || ""} onChange={set("venue")} className="bg-violet-50/90 border-2 border-violet-300 focus-visible:border-primary/50" />
          </div>
          <div className="space-y-1.5">
            <Label>오픈카톡방 URL</Label>
            <Input type="url" value={form.kakaoUrl || ""} onChange={set("kakaoUrl")} placeholder="https://open.kakao.com/o/..." className="bg-violet-50/90 border-2 border-violet-300 focus-visible:border-primary/50" />
          </div>
          <div className="space-y-1.5">
            <Label>책 소개 URL</Label>
            <Input type="url" value={form.bookUrl || ""} onChange={set("bookUrl")} className="bg-violet-50/90 border-2 border-violet-300 focus-visible:border-primary/50" />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={!!form.isAfterparty}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isAfterparty: !!checked }))}
              className="border-2 border-violet-400"
            />
            <Label className="cursor-pointer">뒤풀이 있음</Label>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => router.back()}>
              뒤로
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? "저장 중..." : "저장"}
            </Button>
          </div>
          {saveResult === "ok" && (
            <p className="text-sm text-center text-green-600">저장됐습니다.</p>
          )}
          {saveResult === "error" && (
            <p className="text-sm text-center text-destructive">저장에 실패했습니다.</p>
          )}
          {saveResult && saveResult !== "ok" && saveResult !== "error" && (
            <p className="text-sm text-center text-amber-600">저장됨 · ⚠️ {saveResult}</p>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full">모임 삭제</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>모임을 삭제하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                  『{form.title}』 모임이 영구적으로 삭제됩니다. 출석 명단도 함께 삭제되며 이 작업은 되돌릴 수 없습니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  삭제
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
