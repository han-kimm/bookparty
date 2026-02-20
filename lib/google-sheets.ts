import { google } from "googleapis";

const MEETING_SCHEDULE_SHEET_ID = "1uXbUv0tGR4yJr7RdRTVV-f_KQ3GRHkp3m7fXOoHaRnw";

// "2026-02-07" → "2/7"
function toSheetDate(isoDate: string): string {
  const d = new Date(isoDate);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// 저자, 『책제목』, 출판사 형식
function buildBookCell(title: string, author?: string, publisher?: string): string {
  return [author, `『${title}』`, publisher].filter(Boolean).join(", ");
}

export async function syncMeetingToSheet(meeting: {
  date: string;
  title: string;
  author?: string;
  publisher?: string;
  presenter?: string;
  venue?: string;
}): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: MEETING_SCHEDULE_SHEET_ID,
    range: "B:B",
  });

  const rows = res.data.values ?? [];
  const targetDate = toSheetDate(meeting.date);

  const rowIndex = rows.findIndex((row) => row[0] === targetDate);
  if (rowIndex === -1) {
    console.warn(`[google-sheets] 날짜 ${targetDate} 에 해당하는 행을 찾을 수 없습니다.`);
    return;
  }
  const sheetRow = rowIndex + 1;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: MEETING_SCHEDULE_SHEET_ID,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        { range: `C${sheetRow}`, values: [[buildBookCell(meeting.title, meeting.author, meeting.publisher)]] },
        { range: `D${sheetRow}`, values: [[meeting.presenter ?? ""]] },
        { range: `F${sheetRow}`, values: [[meeting.venue ?? ""]] },
      ],
    },
  });
}

export interface AttendanceMemberForSheet {
  nickname: string;
  checkedIn: boolean;
  checkedInAt?: string | null;
  isAfterparty: boolean;
}

// 열 인덱스(0-based) → 스프레드시트 열 문자 (0→A, 1→B, 26→AA ...)
function indexToColumn(index: number): string {
  let result = "";
  let i = index;
  do {
    result = String.fromCharCode(65 + (i % 26)) + result;
    i = Math.floor(i / 26) - 1;
  } while (i >= 0);
  return result;
}

// "2026-02-21" → ["2월 21일", "02월 21일"] (시트 헤더 매칭용)
function dateHeaderVariants(isoDate: string): string[] {
  const d = new Date(isoDate);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return [`${m}월 ${day}일`, `${String(m).padStart(2, "0")}월 ${day}일`];
}

// "2026-Q1" → ["1분기\n회비", "1분기 회비", "1분기회비"]
function quarterHeaderVariants(quarterKey: string): string[] {
  const match = quarterKey.match(/Q(\d)/);
  if (!match) return [];
  const q = match[1];
  return [`${q}분기\n회비`, `${q}분기 회비`, `${q}분기회비`, `${q}분기\r\n회비`];
}

export interface RegularMemberForSheet {
  nickname: string;
  attendance: Record<string, boolean>; // meetingId → attended
  dues: Record<string, boolean | undefined>; // "2026-Q1" → true/false/undefined
}

/**
 * 정회원 출석부를 기존 구글 시트 구조에 맞춰 동기화합니다.
 * - 날짜 열: "참" / ""
 * - 분기 회비 열: "O" / "X" / ""
 * - 권리당원 여부 열의 수식 결과를 읽어 반환합니다.
 */
export async function syncRegularMembersToSheet(
  members: RegularMemberForSheet[],
  meetings: Array<{ id: string; date: string }>,
): Promise<Map<string, boolean>> {
  const spreadsheetId = getSpreadsheetId();
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  // 첫 번째 시트 이름 조회
  const spreadsheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
  const firstSheetName = spreadsheetMeta.data.sheets?.[0]?.properties?.title ?? "Sheet1";

  // 전체 데이터 읽기
  const readRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: firstSheetName,
  });
  const allRows = (readRes.data.values ?? []) as string[][];

  // "닉네임" 셀이 있는 헤더 행 찾기
  let headerRowIndex = -1;
  for (let i = 0; i < allRows.length; i++) {
    if (allRows[i].some((cell) => String(cell ?? "").trim() === "닉네임")) {
      headerRowIndex = i;
      break;
    }
  }
  if (headerRowIndex === -1) {
    throw new Error("시트에서 '닉네임' 헤더를 찾을 수 없습니다.");
  }

  const headerRow = allRows[headerRowIndex].map((c) => String(c ?? "").trim());
  const nicknameColIndex = headerRow.findIndex((h) => h === "닉네임");

  // 모임 날짜 → 열 인덱스 맵 구성
  const meetingColMap = new Map<string, number>();
  for (const meeting of meetings) {
    const variants = dateHeaderVariants(meeting.date);
    const colIdx = headerRow.findIndex((h) => variants.includes(h));
    if (colIdx !== -1) meetingColMap.set(meeting.id, colIdx);
  }

  // 분기 → 열 인덱스 맵 구성
  const duesColMap = new Map<string, number>();
  for (const q of ["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"]) {
    const variants = quarterHeaderVariants(q);
    const colIdx = headerRow.findIndex((h) => variants.includes(h));
    if (colIdx !== -1) duesColMap.set(q, colIdx);
  }

  // 권리당원 여부 열 인덱스
  const votingColIndex = headerRow.findIndex((h) => h === "권리당원 여부");

  // 닉네임 → 행 인덱스 맵 (헤더 + 책/행사명 행 이후부터)
  const dataStartRow = headerRowIndex + 2;
  const nicknameRowMap = new Map<string, number>();
  for (let i = dataStartRow; i < allRows.length; i++) {
    const nick = String(allRows[i]?.[nicknameColIndex] ?? "").trim();
    if (nick) nicknameRowMap.set(nick, i);
  }

  // 배치 업데이트 데이터 구성
  const updateData: { range: string; values: string[][] }[] = [];

  for (const member of members) {
    const rowIndex = nicknameRowMap.get(member.nickname);
    if (rowIndex === undefined) continue;
    const sheetRow = rowIndex + 1; // 1-based

    // 출석 열
    for (const meeting of meetings) {
      const colIndex = meetingColMap.get(meeting.id);
      if (colIndex === undefined) continue;
      const attended = member.attendance?.[meeting.id] ?? false;
      updateData.push({
        range: `${firstSheetName}!${indexToColumn(colIndex)}${sheetRow}`,
        values: [[attended ? "참" : ""]],
      });
    }

    // 분기 회비 열
    for (const qKey of ["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"]) {
      const colIndex = duesColMap.get(qKey);
      if (colIndex === undefined) continue;
      const paid = member.dues?.[qKey];
      const cellValue = paid === true ? "O" : paid === false ? "X" : "";
      updateData.push({
        range: `${firstSheetName}!${indexToColumn(colIndex)}${sheetRow}`,
        values: [[cellValue]],
      });
    }
  }

  if (updateData.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: updateData,
      },
    });
  }

  // 권리당원 여부 열 읽어서 반환
  const result = new Map<string, boolean>();
  if (votingColIndex !== -1) {
    const votingCol = indexToColumn(votingColIndex);
    const votingRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${firstSheetName}!${votingCol}1:${votingCol}${allRows.length}`,
    });
    const votingValues = (votingRes.data.values ?? []) as string[][];
    for (const [nickname, rowIndex] of nicknameRowMap) {
      const val = String(votingValues[rowIndex]?.[0] ?? "").trim();
      result.set(nickname, val === "O");
    }
  }

  return result;
}

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSpreadsheetId(): string {
  // 환경변수 미설정 시 기본 출석부 시트 ID 사용
  return process.env.GOOGLE_SHEETS_ATTENDANCE_ID ?? "1e2NtAQaTvqSAqnWHPYAqBVFRSnsbU0Jm7b9U9ZB7KXg";
}

function buildSheetTitle(date: string, title: string): string {
  const d = new Date(date);
  const formatted = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  // 시트 탭 이름 최대 100자, 특수문자 제한
  const safeTitle = title.replace(/[\\/*?[\]:]/g, "").slice(0, 50);
  return `${formatted} ${safeTitle}`;
}

export async function syncAttendanceToSheet(
  date: string,
  title: string,
  members: AttendanceMemberForSheet[]
): Promise<void> {
  const spreadsheetId = getSpreadsheetId();
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const sheetTitle = buildSheetTitle(date, title);

  // 기존 시트 목록 조회
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheets = spreadsheet.data.sheets ?? [];
  const existingSheet = existingSheets.find(
    (s) => s.properties?.title === sheetTitle
  );

  if (!existingSheet) {
    // 새 탭 생성
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetTitle,
              },
            },
          },
        ],
      },
    });
  }

  // 정렬: 출석 → 미출석, 가나다순
  const sorted = [...members].sort((a, b) => {
    if (a.checkedIn !== b.checkedIn) return a.checkedIn ? -1 : 1;
    return a.nickname.localeCompare(b.nickname, "ko");
  });

  const checkedCount = members.filter((m) => m.checkedIn).length;
  const afterpartyCount = members.filter((m) => m.isAfterparty).length;

  // 헤더 + 요약 + 데이터 행 구성
  const rows: string[][] = [
    ["닉네임", "출석", "뒤풀이", "체크인 시간"],
    [`출석 ${checkedCount}/${members.length}명 · 뒤풀이 ${afterpartyCount}명`, "", "", ""],
    ...sorted.map((m) => [
      m.nickname,
      m.checkedIn ? "O" : "X",
      m.isAfterparty ? "O" : "",
      m.checkedInAt
        ? new Date(m.checkedInAt).toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "",
    ]),
  ];

  // 기존 데이터 클리어 후 새로 쓰기
  const range = `${sheetTitle}!A1`;
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${sheetTitle}!A:D`,
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows },
  });
}
