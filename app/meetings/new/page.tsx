"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewMeetingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    author: "",
    publisher: "",
    year: "",
    date: "",
    deadline: "",
    presenter: "",
    venue: "친구사이 사무실(사정전)",
    kakaoUrl: "",
    bookUrl: "",
    isAfterparty: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.date) return;

    setLoading(true);
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        router.push("/meetings");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="py-6">
      <h1 className="text-xl font-bold mb-6">새 모임 등록</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">모임 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="title">책 제목 *</Label>
              <Input id="title" placeholder="예: 양면의 조개 껍데기" value={form.title} onChange={set("title")} required className="border-2 border-violet-400 focus-visible:border-primary/50" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="author">저자</Label>
              <Input id="author" placeholder="예: 강보원, 박은지, 황인찬" value={form.author} onChange={set("author")} className="border-2 border-violet-400 focus-visible:border-primary/50" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="publisher">출판사</Label>
                <Input id="publisher" placeholder="예: 민음사" value={form.publisher} onChange={set("publisher")} className="border-2 border-violet-400 focus-visible:border-primary/50" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="year">출판연도</Label>
                <Input id="year" placeholder="예: 2025" value={form.year} onChange={set("year")} className="border-2 border-violet-400 focus-visible:border-primary/50" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="date">모임 날짜 *</Label>
              <Input id="date" type="date" value={form.date} onChange={set("date")} required className="border-2 border-violet-400 focus-visible:border-primary/50" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="deadline">신청 마감일</Label>
              <Input id="deadline" type="date" value={form.deadline} onChange={set("deadline")} className="border-2 border-violet-400 focus-visible:border-primary/50" />
              <p className="text-xs text-muted-foreground">미설정 시 모임 전 수요일로 자동 계산됩니다. 폼 설명에 "해당 날짜 22:00 이후 신청 불가"로 표시됩니다.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="presenter">발제자</Label>
              <Input id="presenter" placeholder="예: 홍길동" value={form.presenter} onChange={set("presenter")} className="border-2 border-violet-400 focus-visible:border-primary/50" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="venue">장소</Label>
              <Input id="venue" value={form.venue} onChange={set("venue")} className="border-2 border-violet-400 focus-visible:border-primary/50" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="kakaoUrl">오픈카톡방 URL</Label>
              <Input id="kakaoUrl" type="url" placeholder="https://open.kakao.com/o/..." value={form.kakaoUrl} onChange={set("kakaoUrl")} className="border-2 border-violet-400 focus-visible:border-primary/50" />
            </div>

            <div className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
              구글 신청폼이 자동으로 생성됩니다.
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bookUrl">책 소개 URL (yes24 등)</Label>
              <Input id="bookUrl" type="url" placeholder="https://www.yes24.com/..." value={form.bookUrl} onChange={set("bookUrl")} className="border-2 border-violet-400 focus-visible:border-primary/50" />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="isAfterparty"
                checked={form.isAfterparty}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, isAfterparty: !!checked }))
                }
                className="border-2 border-violet-400"
              />
              <Label htmlFor="isAfterparty" className="cursor-pointer">뒤풀이 있음</Label>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
                취소
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "저장 중..." : "저장"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
