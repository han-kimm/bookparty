import { AppLayout } from "@/components/app-layout";
import TabLinkClient from "./tab-link";

export default function MembersLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout title="회원 관리">
      <div className="flex gap-1 pt-4 pb-1 border-b">
        <TabLinkClient href="/members" exact>회원 목록</TabLinkClient>
        <TabLinkClient href="/members/regular">정회원 출석부</TabLinkClient>
      </div>
      {children}
    </AppLayout>
  );
}
