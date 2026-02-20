export const VENUE_FULL =
  "친구사이 사무실(사정전) / 서울 종로구 돈화문로 39-1(치킨뱅이 종로3가점 건물) 3층";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function formatDeadline(isoDate: string): string {
  const d = new Date(isoDate);
  return `${String(d.getMonth() + 1).padStart(2, "0")}. ${String(d.getDate()).padStart(2, "0")} (${WEEKDAYS[d.getDay()]})`;
}

export function computeDeadlineFromMeetingDate(meetingDate: string): string {
  const d = new Date(meetingDate);
  const day = d.getDay();
  const daysToWed = day >= 3 ? day - 3 : day + 4;
  const wed = new Date(d);
  wed.setDate(d.getDate() - daysToWed);
  return formatDeadline(wed.toISOString().slice(0, 10));
}

export interface MeetingForAnnouncement {
  title: string;
  author?: string;
  date: string;
  deadline?: string; // ISO date
  presenter?: string;
  venue?: string;
  formUrl?: string;
  bookUrl?: string;
  isAfterparty?: boolean;
}

function getDeadlineString(meeting: MeetingForAnnouncement): string {
  return meeting.deadline
    ? formatDeadline(meeting.deadline)
    : computeDeadlineFromMeetingDate(meeting.date);
}

function formatMeetingDate(dateStr: string): string {
  return new Date(dateStr)
    .toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/\. /g, ".")
    .replace(".", "년 ")
    .replace(".", "월 ")
    .replace(".", "일");
}

export function buildInternalAnnouncement(meeting: MeetingForAnnouncement): string {
  const deadline = getDeadlineString(meeting);
  const dateFormatted = formatMeetingDate(meeting.date);
  const shortDate = new Date(meeting.date)
    .toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })
    .replace(". ", "월 ")
    .replace(".", "일");

  const lines = [
    `[책읽당] ${shortDate} 오프라인 독서 모임`,
    ``,
    `이번에 선정한 책은 ${meeting.author ? `${meeting.author}, ` : ""}『${meeting.title}』입니다.`,
    ``,
    meeting.bookUrl ? `o 책소개 : ${meeting.bookUrl}` : "",
    meeting.formUrl ? `o 신청양식 : ${meeting.formUrl}` : "",
    `o ${deadline} 22시 참가 양식 응답 마감됩니다.`,
    `o 일시: ${dateFormatted} 오후 4시~6시`,
    `o 장소 : ${meeting.venue || VENUE_FULL}`,
    `o 발제자 : ${meeting.presenter || "미정"}`,
    meeting.isAfterparty ? `o 뒤풀이 있음` : "",
    `o 개별적 안내 메일은 발송하지 않습니다.`,
    meeting.formUrl ? `o 신청양식이 오류가 났을 경우, 아래 메일로 문의하시면 답변 드리겠습니다.` : "",
    meeting.formUrl ? `  (문의 : 7942bookparty@gmail.com)` : "",
  ];

  return lines.filter(Boolean).join("\n");
}

export function buildExternalAnnouncement(meeting: MeetingForAnnouncement): string {
  const deadline = getDeadlineString(meeting);
  const dateFormatted = formatMeetingDate(meeting.date);

  const lines = [
    `안녕하세요, 책읽당입니다.`,
    `* 책읽당은 한국게이인권운동단체 친구사이 산하 독서 모임입니다. 성소수자들이 한 달에 두 차례 모임을 하고 책을 읽고 함께 이야기를 나눕니다.`,
    `* 책읽당 독서 모임은 게이뿐아니라 레즈비언, 바이섹슈얼, 트랜스젠더, 에이섹슈얼 등 모든 성소수자를 환영합니다. 인권감수성을 가진 비(非)성소수자를 위한 자리도 물론 있습니다.`,
    ``,
    `${dateFormatted} 독서 모임 일정을 알립니다.`,
    ``,
    `이번에 선정한 책은 ${meeting.author ? `${meeting.author}, ` : ""}『${meeting.title}』입니다.`,
    ``,
    meeting.bookUrl ? `o 책소개 : ${meeting.bookUrl}` : "",
    meeting.formUrl ? `o 신청양식 : ${meeting.formUrl}` : "",
    `o ${deadline} 22시 참가 양식 응답 마감됩니다.`,
    `o 일시: ${dateFormatted} 오후 4시~6시`,
    `o 장소 : ${meeting.venue || VENUE_FULL}`,
    `o 개별적 안내 메일은 발송하지 않습니다.`,
    `o 신청양식이 오류가 났을 경우, 아래 메일로 문의하시면 답변 드리겠습니다.`,
    `  (문의 : 7942bookparty@gmail.com)`,
  ];

  return lines.filter(Boolean).join("\n");
}
