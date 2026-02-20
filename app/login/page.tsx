"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      {/* 배경 장식 블러 오브 */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-violet-400/20 blur-3xl" />
        <div className="absolute top-1/3 -right-24 w-80 h-80 rounded-full bg-pink-400/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 w-72 h-72 rounded-full bg-blue-400/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* 메인 카드 */}
        <div className="glass-strong rounded-3xl p-8 text-center space-y-8">
          {/* 로고 */}
          <div className="space-y-3">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl glass shadow-[0_8px_32px_oklch(0.54_0.23_293/0.2)] text-4xl">
              📚
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-br from-violet-700 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                책읽당
              </h1>
              <p className="text-sm text-muted-foreground mt-1">운영진 전용 관리 대시보드</p>
            </div>
          </div>

          {/* 로그인 버튼 */}
          <div className="space-y-3">
            <button
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
              className="w-full h-12 flex items-center justify-center gap-3 rounded-2xl glass border-violet-300/60 hover:bg-violet-100/60 transition-all text-sm font-medium text-foreground shadow-sm active:scale-[0.98]"
            >
              <GoogleIcon className="w-5 h-5 shrink-0" />
              Google 계정으로 로그인
            </button>
            <p className="text-xs text-muted-foreground">
              운영진으로 등록된 계정만 접속 가능합니다
            </p>
          </div>
        </div>

        {/* 하단 브랜딩 */}
        <p className="text-center text-xs text-muted-foreground/60 mt-6">
          한국게이인권운동단체 친구사이 산하 독서 모임
        </p>
      </div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
