import { google } from "googleapis";
import type { drive_v3 } from "googleapis";

export interface FormResponse {
  responseId: string;
  submittedAt: string;
  nickname: string;
  afterparty: "참석" | "불참" | null;
}

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: [
      "https://www.googleapis.com/auth/forms.body",
      "https://www.googleapis.com/auth/forms.responses.readonly",
      "https://www.googleapis.com/auth/drive",
    ],
  });
}

function extractFormId(formUrl: string): string {
  const match = formUrl.match(/\/forms\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) throw new Error("유효하지 않은 구글폼 URL입니다.");
  return match[1];
}

export async function getFormResponses(formUrl: string): Promise<FormResponse[]> {
  const formId = extractFormId(formUrl);
  const auth = getAuth();
  const forms = google.forms({ version: "v1", auth });

  const formData = await forms.forms.get({ formId });
  const items = formData.data.items ?? [];

  const questionTitleById: Record<string, string> = {};
  for (const item of items) {
    const qid = item.questionItem?.question?.questionId;
    if (qid && item.title) {
      questionTitleById[qid] = item.title;
    }
  }

  const responsesData = await forms.forms.responses.list({ formId });
  const responses = responsesData.data.responses ?? [];

  return responses.map((r) => {
    const answers = r.answers ?? {};
    let nickname = "";
    let afterparty: "참석" | "불참" | null = null;

    for (const [qid, answer] of Object.entries(answers)) {
      const title = questionTitleById[qid] ?? "";
      // CHECKBOX는 answers 배열에 선택된 항목이 각각 들어옴
      const values = answer.textAnswers?.answers?.map((a) => a.value ?? "") ?? [];

      if (title.includes("닉네임")) {
        nickname = (values[0] ?? "").trim();
      } else if (title.includes("뒤풀이") && title.includes("참석")) {
        afterparty = values.some((v) => v.trim() === "참석") ? "참석" : "불참";
      }
    }

    return {
      responseId: r.responseId ?? "",
      submittedAt: r.lastSubmittedTime ?? "",
      nickname,
      afterparty,
    };
  });
}

export async function updateFormKakaoUrl(formUrl: string, kakaoUrl: string): Promise<void> {
  const formId = extractFormId(formUrl);
  const auth = getAuth();
  const forms = google.forms({ version: "v1", auth });

  const formData = await forms.forms.get({ formId });
  const items = formData.data.items ?? [];

  // "오픈카톡방" 질문 찾기
  const kakaoItem = items.find((item) => item.title?.includes("오픈카톡방"));
  if (!kakaoItem || !kakaoItem.itemId) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: any[] = kakaoItem.questionItem?.question?.choiceQuestion?.options ?? [];
  // 마지막 옵션이 링크 (URL로 시작하거나 기존 카카오 URL)
  const updatedOptions = options.map((opt, idx) => {
    if (idx === options.length - 1) {
      return { value: kakaoUrl };
    }
    return opt;
  });

  await forms.forms.batchUpdate({
    formId,
    requestBody: {
      requests: [{
        updateItem: {
          item: {
            itemId: kakaoItem.itemId,
            title: kakaoItem.title,
            questionItem: {
              question: {
                questionId: kakaoItem.questionItem?.question?.questionId,
                required: true,
                choiceQuestion: { type: "CHECKBOX", options: updatedOptions },
              },
            },
          },
          location: { index: items.indexOf(kakaoItem) },
          updateMask: "questionItem.question.choiceQuestion.options",
        },
      }],
    },
  });
}

export function buildFormTitle(title: string, date: string): string {
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const d = new Date(date);
  const weekday = weekdays[d.getDay()];
  const formattedDate = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  return `${formattedDate} (${weekday}) 책읽당 (${title}) 독서 모임 신청 양식`;
}

export function buildFormDescription({
  author,
  title,
  publisher,
  year,
  deadline,
}: {
  author: string;
  title: string;
  publisher?: string;
  year?: string;
  deadline?: string;
}): string {
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const bookInfo = [author, `『${title}』`, publisher, year].filter(Boolean).join(", ");
  let desc = `${bookInfo} 를 읽고 이야기를 나눕니다.`;
  if (deadline) {
    const d = new Date(deadline);
    const weekday = weekdays[d.getDay()];
    const formatted = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
    desc += `\n(${formatted} (${weekday}) 22:00 이후 신청 불가)`;
  }
  return desc;
}

export async function updateFormTitle(formUrl: string, newTitle: string, description?: string): Promise<void> {
  const formId = extractFormId(formUrl);
  const auth = getAuth();
  const forms = google.forms({ version: "v1", auth });

  await forms.forms.batchUpdate({
    formId,
    requestBody: {
      requests: [{
        updateFormInfo: {
          info: {
            title: newTitle,
            ...(description !== undefined && { description }),
          },
          updateMask: description !== undefined ? "title,description" : "title",
        },
      }],
    },
  });
}

export async function createMeetingForm({
  title,
  author,
  date,
  publisher,
  year,
  deadline,
  kakaoUrl,
  accessToken,
}: {
  title: string;
  author: string;
  date: string;
  publisher?: string;
  year?: string;
  deadline?: string;
  isAfterparty: boolean;
  kakaoUrl?: string;
  accessToken?: string;
}): Promise<string> {
  // 사용자 access token이 있으면 그걸 사용 (서비스 계정 저장공간 문제 해결)
  const authClient = accessToken
    ? new google.auth.OAuth2()
    : getAuth();
  if (accessToken) {
    (authClient as InstanceType<typeof google.auth.OAuth2>).setCredentials({ access_token: accessToken });
  }
  const forms = google.forms({ version: "v1", auth: authClient });
  const drive = google.drive({ version: "v3", auth: authClient });

  const formTitle = buildFormTitle(title, date);

  // Forms API 직접 생성 대신 Drive API로 Form 파일 생성 (backendError 우회)
  // GOOGLE_DRIVE_FOLDER_ID: 서비스 계정과 공유된 Drive 폴더 ID (저장공간 문제 해결)
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  console.log("[create-form] GOOGLE_DRIVE_FOLDER_ID:", folderId ?? "(없음 - 환경변수 미설정)");
  const parents = folderId ? [folderId] : undefined;

  const driveFile = await (drive as unknown as { files: drive_v3.Resource$Files }).files.create({
    // 공유 드라이브 지원 (서비스 계정 저장공간 문제 해결)
    supportsAllDrives: true,
    requestBody: {
      name: formTitle,
      mimeType: "application/vnd.google-apps.form",
      ...(parents && { parents }),
    },
    fields: "id",
  });
  const formId = driveFile.data.id!;

  // Forms API로 제목 + 설명 설정
  const formDescription = buildFormDescription({ author, title, publisher, year, deadline });
  await forms.forms.batchUpdate({
    formId,
    requestBody: {
      requests: [{
        updateFormInfo: {
          info: { title: formTitle, description: formDescription },
          updateMask: "title,description",
        },
      }],
    },
  });

  await new Promise((r) => setTimeout(r, 800));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requests: any[] = [
    {
      createItem: {
        item: {
          title: "모임에서 사용할 닉네임을 적어주세요 :)",
          questionItem: {
            question: { required: true, textQuestion: { paragraph: false } },
          },
        },
        location: { index: 0 },
      },
    },
    {
      createItem: {
        item: {
          title: "(신규 신청자 / 비회원만 응답) 연락 가능한 핸드폰 번호 또는 이메일",
          description: "번호 공개가 어려운 경우 연락 가능한 이메일 주소를 남겨주세요.",
          questionItem: {
            question: { required: false, textQuestion: { paragraph: false } },
          },
        },
        location: { index: 1 },
      },
    },
    {
      createItem: {
        item: {
          title: "책을 읽으신 후 감상 및 기대평 혹은 나누고 싶은 질문을 두 문장 이상 남겨주세요.",
          description: "책을 다 읽지 못하셨다면 책이나 모임에 대한 기대를 두 문장 이상 남겨주세요.\n\n'무응답, 네, 알겠습니다' 등 책의 내용이나 기대에 대한 답변이 아닌 경우 신청 인원에서 제외될 수 있습니다.\n\n감상 및 기대평은 발제자에게 도움이 됩니다.",
          questionItem: {
            question: { required: true, textQuestion: { paragraph: true } },
          },
        },
        location: { index: 2 },
      },
    },
    {
      createItem: {
        item: {
          title: "책읽당 독서모임 참여경로를 체크해주세요.",
          questionItem: {
            question: {
              required: true,
              choiceQuestion: {
                type: "RADIO",
                options: [
                  { value: "책읽당 정회원" },
                  { value: "책읽당 오픈카톡방(기존 모임 1-2회 참가자)" },
                  { value: "한국게이인권운동단체 친구사이 홈페이지" },
                  { value: "이반시티 홈페이지" },
                  { value: "책읽당 회원 권유" },
                  { value: "지인 권유" },
                  { isOther: true },
                ],
              },
            },
          },
        },
        location: { index: 3 },
      },
    },
    {
      createItem: {
        item: {
          title: "독서모임 이후 뒤풀이 참석 여부를 체크해주세요.",
          description: "파악된 인원으로 뒤풀이 장소를 예약합니다. 뒤풀이 비용은 1/N로 운영합니다.\n미참석으로 체크하셔도 당일 참석으로 변경 가능합니다.",
          questionItem: {
            question: {
              required: true,
              choiceQuestion: {
                type: "CHECKBOX",
                options: [{ value: "참석" }, { value: "미참석" }],
              },
            },
          },
        },
        location: { index: 4 },
      },
    },
    {
      createItem: {
        item: {
          title: "다음의 항목을 잘 읽고 체크해주세요.",
          questionItem: {
            question: {
              required: true,
              choiceQuestion: {
                type: "CHECKBOX",
                options: [
                  { value: "모임은 서로의 다른 생각을 확인하는 과정이기도 합니다." },
                  { value: "나와 다른 의견이 있더라도 존중하고 배려하는 태도 부탁드립니다." },
                ],
              },
            },
          },
        },
        location: { index: 5 },
      },
    },
    {
      createItem: {
        item: {
          title: "오픈카톡방에 입장해주세요.",
          questionItem: {
            question: {
              required: true,
              choiceQuestion: {
                type: "CHECKBOX",
                options: [
                  { value: "첫 질문에서 답변해주신 닉네임으로 입장해주세요." },
                  { value: "모임 장소 및 시간 변동시 오픈카톡방에서 공지드립니다." },
                  { value: "오픈카톡방은 모임이 끝나고 일요일 저녁에 삭제됩니다." },
                  { value: kakaoUrl ?? "오픈카톡방 링크는 모임 수정 페이지에서 확인하세요." },
                ],
              },
            },
          },
        },
        location: { index: 6 },
      },
    },
  ];

  // Google Forms API backendError 방지: 폼 초기화 대기 후 1개씩 순차 전송
  // 개별 전송 시 index는 현재 아이템 수(i)로 재설정
  await new Promise((r) => setTimeout(r, 1500));
  for (let i = 0; i < requests.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req: any = { ...requests[i] };
    if (req.createItem) {
      req.createItem = { ...req.createItem, location: { index: i } };
    }
    await forms.forms.batchUpdate({
      formId,
      requestBody: { requests: [req] },
    });
    await new Promise((r) => setTimeout(r, 300));
  }

  return `https://docs.google.com/forms/d/${formId}/viewform`;
}
