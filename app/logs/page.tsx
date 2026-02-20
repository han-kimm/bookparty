"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface LogEntry {
  target: string;
  from: string;
  to: string;
}

interface ChangeLog {
  id: string;
  type: string;
  context: string;
  entries: LogEntry[];
  savedAt: string;
  savedBy: string;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const MM = String(d.getMonth() + 1).padStart(2, "0");
  const DD = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${MM}/${DD} ${hh}:${mm}`;
}

const TYPE_COLORS: Record<string, string> = {
  출석: "bg-violet-100 text-violet-700",
  회비: "bg-blue-100 text-blue-700",
  "정회원 출석부": "bg-indigo-100 text-indigo-700",
};

export default function LogsPage() {
  const [logs, setLogs] = useState<ChangeLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/change-logs?limit=100")
      .then((r) => r.json())
      .then((data) => {
        setLogs(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="py-6 space-y-3 pb-32">
      <h1 className="text-xl font-bold">변경 이력</h1>

      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-gray-200 animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <p>저장된 이력이 없습니다.</p>
        </div>
      ) : (
        logs.map((log) => (
          <Card key={log.id} className="glass border-violet-300/50">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                      TYPE_COLORS[log.type] ?? "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {log.type}
                  </span>
                  <span className="text-sm font-medium truncate">{log.context}</span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDateTime(log.savedAt)}
                </span>
              </div>
              <div className="space-y-1">
                {(log.entries ?? []).map((e, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-sm">
                    <span className="font-medium min-w-[4rem]">{e.target}</span>
                    <span className="text-muted-foreground text-xs">{e.from}</span>
                    <span className="text-muted-foreground text-xs">→</span>
                    <span className="text-xs font-semibold text-foreground">{e.to}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground/70">저장: {log.savedBy}</p>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
