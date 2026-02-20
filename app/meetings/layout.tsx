import { AppLayout } from "@/components/app-layout";

export default function MeetingsLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout title="모임 관리">{children}</AppLayout>;
}
