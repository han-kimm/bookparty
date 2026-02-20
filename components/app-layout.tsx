import { BottomNav, SideNav, TopBar } from "@/components/nav";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  return (
    <div className="min-h-screen lg:flex">
      <SideNav />
      <div className="flex-1 min-w-0 lg:ml-56">
        <TopBar title={title} />
        <main className="max-w-lg mx-auto pb-24 px-4 lg:max-w-5xl lg:pb-12 lg:px-10 lg:pt-2">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
