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

interface AssociateMember {
  id: string;
  nickname: string;
  order: number;
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [associateMembers, setAssociateMembers] = useState<AssociateMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Member | null>(null);
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  // 준회원 추가 다이얼로그
  const [assocOpen, setAssocOpen] = useState(false);
  const [assocNickname, setAssocNickname] = useState("");
  const [assocSaving, setAssocSaving] = useState(false);

  // 준회원 삭제 확인
  const [assocDeleteTarget, setAssocDeleteTarget] = useState<AssociateMember | null>(null);

  const fetchMembers = async () => {
    const [membersRes, assocRes] = await Promise.all([
      fetch("/api/members"),
      fetch("/api/associate-members"),
    ]);
    if (membersRes.ok) {
      const data = await membersRes.json();
      setMembers(Array.isArray(data) ? data : []);
    }
    if (assocRes.ok) {
      const data = await assocRes.json();
      setAssociateMembers(Array.isArray(data) ? data : []);
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

  const handleAssocAdd = async () => {
    if (!assocNickname.trim()) return;
    setAssocSaving(true);
    await fetch("/api/associate-members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: assocNickname.trim() }),
    });
    setAssocSaving(false);
    setAssocOpen(false);
    setAssocNickname("");
    fetchMembers();
  };

  const handleAssocDelete = async (member: AssociateMember) => {
    await fetch("/api/associate-members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: member.id }),
    });
    setAssocDeleteTarget(null);
    fetchMembers();
  };

  const [filter, setFilter] = useState<"전체" | "정회원" | "준회원">("전체");

  const filtered = members.filter((m) => m.nickname.includes(search));
  const filteredAssoc = associateMembers.filter((m) => m.nickname.includes(search));

  return (
    <div className="py-6 space-y-4">
      {/* 필터 + 검색 */}
      <div className="flex gap-2">
        {(["전체", "정회원", "준회원"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground border-primary"
                : "glass text-muted-foreground hover:bg-violet-100/60"
            }`}
          >
            {f}
            <span className="ml-1 text-xs opacity-70">
              {f === "전체" ? members.length + associateMembers.length
               : f === "정회원" ? members.length
               : associateMembers.length}
            </span>
          </button>
        ))}
      </div>
      <Input
        placeholder="닉네임 검색"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* 정회원 섹션 */}
      {(filter === "전체" || filter === "정회원") && <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold">정회원 ({members.length}명)</h2>
          <Button size="sm" onClick={openAdd}>+ 추가</Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-3 gap-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-gray-200 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            {search ? "검색 결과가 없습니다." : "등록된 정회원이 없습니다."}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {filtered.map((member) => (
              <Card key={member.id} className="cursor-pointer" onClick={() => openEdit(member)}>
                <CardContent className="px-3 py-2 flex flex-col gap-1">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-primary text-white leading-none w-fit">정회원</span>
                  <p className="font-semibold text-sm truncate">{member.nickname}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>}

      {/* 준회원 섹션 */}
      {(filter === "전체" || filter === "준회원") && <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold">준회원 ({associateMembers.length}명)</h2>
          <Button size="sm" variant="outline" onClick={() => setAssocOpen(true)}>+ 추가</Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-3 gap-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-gray-200 animate-pulse" />
            ))}
          </div>
        ) : filteredAssoc.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            {search ? "검색 결과가 없습니다." : "등록된 준회원이 없습니다."}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {filteredAssoc.map((member) => (
              <Card key={member.id}>
                <CardContent className="px-3 py-2 flex flex-col gap-1">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground leading-none w-fit">준회원</span>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm truncate">{member.nickname}</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); setAssocDeleteTarget(member); }}
                      className="text-xs text-muted-foreground/50 hover:text-destructive transition-colors flex-shrink-0 ml-1"
                    >
                      ✕
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>}

      {/* 정회원 추가/수정 다이얼로그 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? "정회원 수정" : "정회원 추가"}</DialogTitle>
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

      {/* 준회원 추가 다이얼로그 */}
      <Dialog open={assocOpen} onOpenChange={setAssocOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>준회원 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>닉네임 *</Label>
              <Input
                value={assocNickname}
                onChange={(e) => setAssocNickname(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAssocAdd()}
                placeholder="예: 길동이"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setAssocOpen(false)}>
                취소
              </Button>
              <Button className="flex-1" onClick={handleAssocAdd} disabled={assocSaving || !assocNickname.trim()}>
                {assocSaving ? "추가 중..." : "추가"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 준회원 삭제 확인 다이얼로그 */}
      <Dialog open={!!assocDeleteTarget} onOpenChange={(o) => { if (!o) setAssocDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>준회원 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            <strong>{assocDeleteTarget?.nickname}</strong>을(를) 삭제하시겠습니까?
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setAssocDeleteTarget(null)}>
              취소
            </Button>
            <Button variant="destructive" className="flex-1" onClick={() => assocDeleteTarget && handleAssocDelete(assocDeleteTarget)}>
              삭제
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
