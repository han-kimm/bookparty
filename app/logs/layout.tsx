import { AppLayout } from "@/components/app-layout";

export default function LogsLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout title="이력">{children}</AppLayout>;
}
