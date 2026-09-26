// player/titleLicenseNotice.ts
// 타이틀 화면의 에셋 라이선스 표기. 정본 내용은 public/assets/ATTRIBUTION.md 이고,
// 웹 내보내기 zip 이 이 파일을 항상 싣기 때문에 출하 플레이어에서도 같은 경로로 읽힌다.
import { withInlineAsset } from "@/assets/inlineAssetStore";

export const ATTRIBUTION_DOC_PATH = "/assets/ATTRIBUTION.md";

/** 표기 파일을 못 읽었을 때 창에 대신 보이는 문장. 입구는 타이틀 메뉴 「크레딧」이다(숨길 수 없다). */
export function licenseNoticeText(): string {
  return "이 게임에는 CC BY 라이선스의 에셋이 포함되어 있습니다.";
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

/** 타이틀 메뉴 「크레딧」이 여는 저작자 표기 창. 닫히면 onClose 로 타이틀 포커스를 돌려받는다. */
export function openLicenseDialog(onClose?: () => void): void {
  void fetchLicenseNotices().then((notices) => showLicenseDialog(notices, onClose)).catch(() => undefined);
}

function showLicenseDialog(body: string | null, onClose?: () => void): void {
  const view = globalThis.document?.defaultView ?? null;
  if (!view) return;
  const dialog = view.document.createElement("dialog");
  dialog.className = "rm-license-dialog";
  dialog.setAttribute("aria-label", "크레딧 — 게임 에셋 저작자 표기");
  dialog.dataset.testid = "title-credits-dialog";
  const pre = view.document.createElement("pre");
  pre.className = "rm-license-dialog-body";
  pre.textContent = body ?? licenseNoticeText();
  const heading = view.document.createElement("h2");
  heading.className = "rm-license-dialog-title";
  heading.textContent = "크레딧";
  const close = view.document.createElement("button");
  close.type = "button";
  close.textContent = "닫기";
  close.className = "rm-license-dialog-close";
  close.addEventListener("click", () => dialog.close());
  // A native dialog owns its keys; they must not reach the game's document handler.
  dialog.addEventListener("keydown", (event) => event.stopPropagation());
  dialog.append(heading, pre, close);
  dialog.addEventListener("close", () => { dialog.remove(); onClose?.(); });
  view.document.body.append(dialog);
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}
