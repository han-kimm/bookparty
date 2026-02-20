"use client";

import { useEffect, useState } from "react";

export function KakaoBrowserBanner() {
  const [platform, setPlatform] = useState<"ios" | "android-manual" | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    if (!/KAKAOTALK/i.test(ua)) return;

    if (/Android/i.test(ua)) {
      const url = window.location.href.replace(/^https?:\/\//, "");
      const chromeIntent = `intent://${url}#Intent;scheme=https;package=com.android.chrome;end;`;
      const samsungIntent = `intent://${url}#Intent;scheme=https;package=com.sec.android.app.sbrowser;end;`;

      // 1차: Chrome 시도
      window.location.href = chromeIntent;

      // 2차: Chrome 미설치 시 삼성 브라우저 시도
      const samsungTimer = setTimeout(() => {
        window.location.href = samsungIntent;

        // 3차: 둘 다 없을 경우 수동 안내
        const manualTimer = setTimeout(() => {
          setPlatform("android-manual");
        }, 2000);

        return () => clearTimeout(manualTimer);
      }, 2000);

      return () => clearTimeout(samsungTimer);
    } else if (/iPhone|iPad|iPod/i.test(ua)) {
      setPlatform("ios");
    }
  }, []);

  if (platform === null) return null;

  const isIos = platform === "ios";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-8">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-400 text-xl">
            📱
          </div>
          <p className="text-base font-bold text-gray-900">외부 브라우저로 열기</p>
        </div>
        <p className="mb-5 text-sm leading-relaxed text-gray-600">
          카카오톡 브라우저에서는 로그인이 제한될 수 있어요.
          <br />
          {isIos ? "Safari" : "기본 브라우저"}에서 열어주세요.
        </p>
        <ol className="mb-6 space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold">
              1
            </span>
            {isIos ? (
              <>오른쪽 하단 <strong className="mx-1">···</strong> 버튼을 누르세요</>
            ) : (
              <>오른쪽 상단 <strong className="mx-1">⋮</strong> 버튼을 누르세요</>
            )}
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold">
              2
            </span>
            <strong>기본 브라우저로 열기</strong>를 선택하세요
          </li>
        </ol>
        <button
          onClick={() => setPlatform(null)}
          className="w-full rounded-xl bg-gray-100 py-3 text-sm font-medium text-gray-600 active:bg-gray-200"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
