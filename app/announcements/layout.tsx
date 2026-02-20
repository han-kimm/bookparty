import { AppLayout } from "@/components/app-layout";

export default function AnnouncementsLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout title="공지 작성">{children}</AppLayout>;
}
