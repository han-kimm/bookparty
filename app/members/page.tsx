"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Member {
  id: string;
  nickname: string;
  joinedAt: string;
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Member | null>(null);
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const fetchMembers = async () => {
    const res = await fetch("/api/members");
    if (res.ok) {
      const data = await res.json();
      setMembers(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchMembers(); }, []);

  const openAdd = () => {
    setEditTarget(null);
    setNickname("");
    setOpen(true);
  };

  const openEdit = (member: Member) => {
    setEditTarget(member);
    setNickname(member.nickname);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!nickname.trim()) return;
    setSaving(true);

    if (editTarget) {
      await fetch("/api/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editTarget.id, nickname: nickname.trim() }),
      });
    } else {
      await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim() }),
      });
    }

    setSaving(false);
    setOpen(false);
    fetchMembers();
  };

  const filtered = members.filter((m) => m.nickname.includes(search));

  return (
    <div className="py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">회원 목록 ({members.length}명)</h1>
        <Button size="sm" onClick={openAdd}>+ 추가</Button>
      </div>

      <Input
        placeholder="닉네임 검색"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-gray-200 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {search ? "검색 결과가 없습니다." : "등록된 회원이 없습니다."}
        </div>
      ) : (
        <div className="grid gap-2 lg:grid-cols-3">
          {filtered.map((member) => (
            <Card key={member.id} className="cursor-pointer" onClick={() => openEdit(member)}>
              <CardContent className="p-4 flex items-center justify-between">
                <p className="font-semibold">{member.nickname}</p>
                <span className="text-sm text-muted-foreground">수정 →</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 추가/수정 다이얼로그 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? "회원 수정" : "회원 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>닉네임 *</Label>
              <Input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder="예: 길동이"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                취소
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving || !nickname.trim()}>
                {saving ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
