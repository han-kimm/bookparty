"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  buildInternalAnnouncement,
  buildExternalAnnouncement,
  formatDeadline,
  computeDeadlineFromMeetingDate,
} from "@/lib/announcements";

interface Meeting {
  id: string;
  title: string;
  author: string;
  date: string;
  deadline?: string;
  presenter: string;
  venue: string;
  formUrl: string;
  bookUrl: string;
  isAfterparty: boolean;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

function AnnouncementsContent() {
  const searchParams = useSearchParams();
  const initMeetingId = searchParams.get("meetingId") || "";

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedId, setSelectedId] = useState(initMeetingId);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [deadline, setDeadline] = useState("");

  const [internalText, setInternalText] = useState("");
  const [externalText, setExternalText] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [copied, setCopied] = useState<string | null>(null);

  // 이미지 (base64로 Firestore에 직접 저장)
  const [coverImageBase64, setCoverImageBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 자동 생성 텍스트 (리셋용)
  const autoInternal = useRef("");
  const autoExternal = useRef("");

  useEffect(() => {
    fetch("/api/meetings")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const today = new Date().toISOString().slice(0, 10);
          const upcoming = data.filter((m: Meeting) => m.date >= today);
          const past = data.filter((m: Meeting) => m.date < today).reverse();
          const sorted = [...upcoming, ...past];
          setMeetings(sorted);
          if (!selectedId && sorted.length > 0) setSelectedId(sorted[0].id);
        }
      });
  }, []);

  // 모임 선택 시 마감일 계산 + 저장된 공지 불러오기
  useEffect(() => {
    if (!selectedId || meetings.length === 0) return;
    const found = meetings.find((m) => m.id === selectedId);
    if (!found) return;

    setMeeting(found);
    setSaveStatus("idle");

    // 마감일: 모임에 deadline 필드가 있으면 사용, 없으면 모임 전 수요일로 자동 계산
    const newDeadline = found.deadline
      ? formatDeadline(found.deadline)
      : computeDeadlineFromMeetingDate(found.date);
    setDeadline(newDeadline);

    // 저장된 공지 불러오기
    fetch(`/api/announcements/${selectedId}`)
      .then((r) => r.json())
      .then((saved) => {
        const generatedInternal = buildInternalAnnouncement(found);
        const generatedExternal = buildExternalAnnouncement(found);
        autoInternal.current = generatedInternal;
        autoExternal.current = generatedExternal;

        if (saved && saved.internalText) {
          setInternalText(saved.internalText);
          setExternalText(saved.externalText);
        } else {
          setInternalText(generatedInternal);
          setExternalText(generatedExternal);
        }
        setCoverImageBase64(saved?.coverImageBase64 ?? null);
      });
  }, [selectedId, meetings]);

  // 마감일 input 직접 편집 시 자동 생성 텍스트 갱신 (저장된 값이 없을 때만)
  useEffect(() => {
    if (!meeting) return;
    // deadline string을 임시로 meeting에 주입해서 빌드
    const meetingWithDeadline = { ...meeting, deadline: undefined as string | undefined };
    // deadline 문자열을 그대로 사용하는 빌드 (lib 함수는 ISO 변환 없이 직접 사용)
    const newInternal = buildInternalAnnouncement(meetingWithDeadline).replace(
      /o .+ 22시 참가 양식 응답 마감됩니다\./,
      deadline ? `o ${deadline} 22시 참가 양식 응답 마감됩니다.` : ""
    );
    const newExternal = buildExternalAnnouncement(meetingWithDeadline).replace(
      /o .+ 22시 참가 양식 응답 마감됩니다\./,
      deadline ? `o ${deadline} 22시 참가 양식 응답 마감됩니다.` : ""
    );
    if (internalText === autoInternal.current) setInternalText(newInternal);
    if (externalText === autoExternal.current) setExternalText(newExternal);
    autoInternal.current = newInternal;
    autoExternal.current = newExternal;
  }, [deadline]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!selectedId) return;
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/announcements/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ internalText, externalText, coverImageBase64 }),
      });
      setSaveStatus(res.ok ? "saved" : "error");
      if (res.ok) setTimeout(() => setSaveStatus("idle"), 2500);
    } catch {
      setSaveStatus("error");
    }
  };

  const handleFileChange = (file: File | null) => {
    if (!file) return;
    // Canvas로 리사이즈 + JPEG 압축 후 base64 변환
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const MAX_W = 600;
      const scale = Math.min(1, MAX_W / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      setCoverImageBase64(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.src = objectUrl;
  };

  const removeImage = () => setCoverImageBase64(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const saveLabel =
    saveStatus === "saving" ? "저장 중..." :
    saveStatus === "saved" ? "✓ 저장됨" :
    saveStatus === "error" ? "오류" : "저장";

  const coverImageUI = (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground font-medium">책표지 이미지</p>
      {coverImageBase64 ? (
        <div className="flex items-end gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverImageBase64}
            alt="책표지"
            className="h-36 w-auto rounded-xl object-cover border border-violet-300/50 shadow"
          />
          <div className="flex flex-col gap-1.5">
            <a
              href={coverImageBase64}
              download="책표지.jpg"
              className="text-xs text-primary underline"
            >
              다운로드
            </a>
            <button onClick={() => fileInputRef.current?.click()} className="text-xs text-muted-foreground underline">교체</button>
            <button onClick={removeImage} className="text-xs text-red-400 underline">삭제</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center w-full h-20 rounded-xl border-2 border-dashed border-gray-200 bg-violet-50/60 hover:bg-violet-100/60 transition-colors text-sm text-muted-foreground gap-2"
        >
          <span className="text-lg">🖼️</span>
          <span>이미지 선택</span>
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );

  return (
    <div className="py-6 space-y-4">
      <h1 className="text-xl font-bold">공지 작성</h1>

      {/* 모임 선택 */}
      <div className="space-y-1.5">
        <Label>모임 선택</Label>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {meetings.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={`shrink-0 px-3 py-2 rounded-full text-sm font-medium transition-colors border ${
                selectedId === m.id
                  ? "bg-primary/90 text-primary-foreground border-primary/30 backdrop-blur-sm shadow-[0_2px_12px_oklch(0.54_0.23_293/0.25)]"
                  : "glass text-muted-foreground hover:bg-violet-100/60"
              }`}
            >
              {new Date(m.date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
            </button>
          ))}
        </div>
      </div>

      {/* 마감일 편집 */}
      {meeting && (
        <div className="space-y-1.5">
          <Label>응답 마감일</Label>
          <Input
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            placeholder="예: 02. 18 (수)"
            className="bg-violet-50/90 border-2 border-violet-300 focus-visible:border-primary/50"
          />
          <p className="text-xs text-muted-foreground">모임 전 수요일로 자동 계산됩니다.</p>
        </div>
      )}

      {meeting ? (
        <Tabs defaultValue="internal">
          <div className="flex items-center justify-between gap-2 mb-2">
            <TabsList className="flex-1">
              <TabsTrigger value="internal" className="flex-1">내부 공지</TabsTrigger>
              <TabsTrigger value="external" className="flex-1">외부 공지</TabsTrigger>
            </TabsList>
            <Button
              size="sm"
              onClick={save}
              disabled={saveStatus === "saving"}
              variant={saveStatus === "saved" ? "outline" : "default"}
              className="shrink-0"
            >
              {saveLabel}
            </Button>
          </div>

          <TabsContent value="internal" className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-medium">내부 공지문 (밴드·카톡)</p>
                <Button size="sm" variant="outline" onClick={() => copy(internalText, "internal")}>
                  {copied === "internal" ? "✅ 복사됨" : "📋 복사"}
                </Button>
              </div>
              <Textarea
                value={internalText}
                onChange={(e) => setInternalText(e.target.value)}
                className="text-sm font-sans leading-relaxed min-h-[280px] resize-none bg-violet-50/90 border-2 border-violet-300 focus-visible:border-primary/50"
              />
            </div>
            {coverImageUI}
            <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
              <p className="font-semibold">게시 채널</p>
              <p>① 책읽당 밴드 — 내부 공지 + 일정 첨부 + 책표지 이미지</p>
              <p>② 카카오톡 단톡방 — 내부 공지 그대로 게시</p>
            </div>
          </TabsContent>

          <TabsContent value="external" className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-medium">외부 공지문 (친구사이·이반시티)</p>
                <Button size="sm" variant="outline" onClick={() => copy(externalText, "external")}>
                  {copied === "external" ? "✅ 복사됨" : "📋 복사"}
                </Button>
              </div>
              <Textarea
                value={externalText}
                onChange={(e) => setExternalText(e.target.value)}
                className="text-sm font-sans leading-relaxed min-h-[320px] resize-none bg-violet-50/90 border-2 border-violet-300 focus-visible:border-primary/50"
              />
            </div>
            {coverImageUI}
            <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
              <p className="font-semibold">게시 채널</p>
              <p>① 친구사이 홈페이지 — 활동 → 소모임 → 책읽당 게시판</p>
              <p>② 이반시티 — 프라이드 → 퀴어뉴스, 말머리 &apos;친구사이&apos;로 설정</p>
              <p className="mt-1 text-gray-500">* 두 곳 모두 책표지 이미지 첨부 필요</p>
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <p>모임을 선택하면 공지문이 자동으로 생성됩니다.</p>
        </div>
      )}
    </div>
  );
}

export default function AnnouncementsPage() {
  return (
    <Suspense>
      <AnnouncementsContent />
    </Suspense>
  );
}
