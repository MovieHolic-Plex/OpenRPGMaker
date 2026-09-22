// player/titleLicenseNotice.ts
// 타이틀 화면의 에셋 라이선스 표기. 정본 내용은 public/assets/ATTRIBUTION.md 이고,
// 웹 내보내기 zip 이 이 파일을 항상 싣기 때문에 출하 플레이어에서도 같은 경로로 읽힌다.
import { withInlineAsset } from "@/assets/inlineAssetStore";
import { el } from "@/util/dom";

export const ATTRIBUTION_DOC_PATH = "/assets/ATTRIBUTION.md";

/** 타이틀 화면 한 줄 표기. CC BY 계열 자산을 쓰는 이상 이 줄은 빠지면 안 된다. */
export function licenseNoticeText(): string {
  return "이 게임에는 CC BY 라이선스의 에셋이 포함되어 있습니다 · 저작자 표기 보기";
}

/** 편집기·출하 플레이어 공통. ATTRIBUTION.md 가 없으면 (사실상 없을) null 이다. */
export async function fetchLicenseNotices(): Promise<string | null> {
  try {
    const response = await fetch(withInlineAsset(ATTRIBUTION_DOC_PATH));
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export function createLicenseNotice(): HTMLElement {
  const link = el("button", {
    class: "rm-title-license",
    text: licenseNoticeText(),
    dataset: {
      testid: "title-license-notice",
      // 타이틀은 포인터 차단 구역이다(런타임 포인터 계약). 이 한 버튼만 차단기의
      // 명시적 소유자로 등록해 클릭을 통과시킨다 — 라이선스 표기는 자동 재생 차단과
      // 무관하게 항상 열 수 있어야 한다.
      playInputOwner: "license-notice",
    },
  });
  link.addEventListener("click", () => {
    void fetchLicenseNotices().then((notices) => showLicenseDialog(notices)).catch(() => undefined);
  });
  return link;
}

function showLicenseDialog(body: string | null): void {
  const view = globalThis.document?.defaultView ?? null;
  if (!view) return;
  const dialog = view.document.createElement("dialog");
  dialog.className = "rm-license-dialog";
  dialog.setAttribute("aria-label", "게임 에셋 라이선스 표기");
  const pre = view.document.createElement("pre");
  pre.className = "rm-license-dialog-body";
  pre.textContent = body ?? licenseNoticeText();
  const close = view.document.createElement("button");
  close.type = "button";
  close.textContent = "닫기";
  close.className = "rm-license-dialog-close";
  close.addEventListener("click", () => dialog.close());
  // A native dialog owns its keys; they must not reach the game's document handler.
  dialog.addEventListener("keydown", (event) => event.stopPropagation());
  dialog.append(pre, close);
  dialog.addEventListener("close", () => dialog.remove());
  view.document.body.append(dialog);
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}
