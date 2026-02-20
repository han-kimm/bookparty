export interface Meeting {
  id: string;
  date: string; // ISO string
  title: string; // 책 제목
  author: string; // 저자
  presenter: string; // 발제자
  venue: string; // 장소
  formUrl: string; // 구글폼 URL
  kakaoUrl?: string; // 오픈카톡방 URL
  bookUrl?: string; // 책 소개 URL
  maxAttendees?: number;
  isAfterparty: boolean;
  createdAt: string;
}

export interface Member {
  id: string;
  nickname: string;
  email?: string;
  joinedAt: string;
  duesStatus: Record<string, boolean>; // { "2026-01": true }
}

export interface Attendance {
  memberId: string;
  nickname: string;
  checkedIn: boolean;
  checkedInAt?: string;
  isAfterparty: boolean;
}

export interface AfterpartyFinance {
  meetingId: string;
  totalAmount: number;
  participants: {
    name: string;
    amount: number;
    paid: boolean;
  }[];
  notes: string;
  perPerson?: number;
}
