"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard",    label: "홈",   icon: "🏠" },
  { href: "/meetings",     label: "모임",  icon: "📅" },
  { href: "/finance/afterparty", label: "뒤풀이", icon: "🍻" },
  { href: "/announcements",label: "공지",  icon: "📢" },
  { href: "/members/regular", label: "회원",  icon: "👥" },
  { href: "/logs",         label: "이력",  icon: "📋" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-nav border-t lg:hidden">
      <div className="flex items-center justify-around max-w-lg mx-auto pb-safe">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-3 text-xs font-medium transition-all flex-1 min-w-0 relative",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              {isActive && (
                <span className="absolute top-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
              <span className={cn("text-xl transition-transform", isActive && "scale-110")}>
                {item.icon}
              </span>
              <span className={cn(isActive && "font-semibold")}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function TopBar({ title }: { title?: string }) {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-40 glass-nav border-b lg:hidden">
      <div className="flex h-14 items-center justify-between px-4 max-w-lg mx-auto">
        <span className="text-base font-bold tracking-tight">
          <span className="text-primary">📚</span>{" "}
          <span className="bg-gradient-to-r from-violet-600 to-purple-500 bg-clip-text text-transparent">
            {title || "책읽당"}
          </span>
        </span>
        {session?.user && (
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors glass px-3 py-1.5 rounded-full"
          >
            {session.user.name?.split(" ")[0]} · 로그아웃
          </button>
        )}
      </div>
    </header>
  );
}

export function SideNav() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-56 border-r glass-nav z-50">
      <div className="px-5 py-4 border-b">
        <span className="text-base font-bold tracking-tight">
          <span className="text-primary">📚</span>{" "}
          <span className="bg-gradient-to-r from-violet-600 to-purple-500 bg-clip-text text-transparent">
            책읽당
          </span>
        </span>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-violet-200/50 hover:text-foreground"
              )}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {session?.user && (
        <div className="p-3 border-t">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-violet-200/50 hover:text-foreground transition-colors text-left"
          >
            <span className="text-base">👤</span>
            <span className="flex-1 truncate">{session.user.name}</span>
            <span className="text-xs shrink-0">로그아웃</span>
          </button>
        </div>
      )}
    </aside>
  );
}
