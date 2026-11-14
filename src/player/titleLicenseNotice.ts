// player/titleLicenseNotice.ts
// 타이틀 메뉴 「크레딧」 창. 플레이어에게는 짧은 한국어 크레딧(PLAYER_CREDITS)을 먼저 보여 주고,
// 소재별 전체 출처 문서(public/assets/ATTRIBUTION.md — 개발 기록·파일 경로가 섞인 영문 원문)는 단추를 눌렀을 때만 연다.
// 2026-11-14 폴른 스타 QA: 크레딧을 열면 548줄짜리 영문 개발 문서가 그대로 나왔다. CC BY 표기 의무(저작자·라이선스·출처·변경 사실)는
// 짧은 글이 직접 지고, 전체 문서는 웹 내보내기 zip 이 항상 싣는다(src/project/webExportAssets.ts) — 단일 HTML 판본에서는 이 창이 유일한 입구다.
import { withInlineAsset } from "@/assets/inlineAssetStore";
import { storeCredits } from "@/assetStore/pack";
import { isCancelKey, isConfirmKey } from "@/player/keyBindings";
import { store } from "@/project/store";

export const ATTRIBUTION_DOC_PATH = "/assets/ATTRIBUTION.md";

/**
 * 플레이어가 읽는 크레딧. 제목은 「## 」, 나머지는 한 줄이 한 문단이다(renderLicenseText).
 * 지켜야 하는 줄:
 *  - CC BY 4.0(EasyRPG RTP·Scarloxy): 저작자 이름, 라이선스와 주소, 원본 주소, 고쳤다는 사실, 보증하지 않는다는 문장.
 *    저작자 이름은 public/assets/easyrpg/AUTHORS.md 의 [CC-BY] 표기에서 뽑았다 — 그 표가 바뀌면 여기도 맞춘다.
 *  - REFMAP: 표기 줄 원문 그대로(public/assets/ATTRIBUTION.md 「RefmapDoll」).
 *  - OPRN BGM: 사람이 지은 곡처럼 적지 않는다(public/assets/oprn-bgm/LICENSE.txt).
 *  - general-good-writing: 저작자가 크레딧 표기를 조건으로 사용을 허락했다(루트 ATTRIBUTION.md, openwiki/licensing.md).
 * CC0 소재는 표기 의무가 없지만 고마움으로 이름을 남긴다. 개발 기록·파일 경로는 여기 쓰지 않는다.
 */
export const PLAYER_CREDITS = [
  "## 만든 도구",
  "OPRN Studio 로 만든 게임입니다.",
  "게임 엔진: Phaser (MIT)",
  "대사 다듬기 규칙: general-good-writing, 코드 연규(code-yeongyu)",
  "## 음악과 효과음",
  "OPRN BGM (AI 로 만든 음악, Google Lyria)",
  "음악: cynicmusic, pauliuw, RandomMind, Brandon Morris (CC0)",
  "효과음: artisticdude, rubberduck (CC0), EasyRPG RTP (CC BY 4.0)",
  "## 그림",
  "EasyRPG RTP (CC BY 4.0), 일부를 고쳐 그렸습니다.",
  "https://github.com/EasyRPG/RTP",
  "Garakuta, Juan Manuel Nigretti, Marina Navarro Travesset, MrBeast, Orochii Zouveleki, R.C.O., Stephen Challener (Redshrike), Tom Lemmens, VictorSena, andwhyisit, kou, lumiscosity, russidan (Alephman)",
  "",
  "Scarloxy (Ismael Garcia), Monster Taming Game Essentials (CC BY 4.0), 크기와 배치를 바꿨습니다.",
  "https://scarloxy.itch.io/mpwsp01",
  "",
  "REFMAP (http://refmap.wixsite.com/fsm-material), modified",
  "",
  "JasonPerry, Tom Lemmens, Blarumyrran, Verdant_Jack (CC0)",
  "## 글꼴",
  "Pretendard (길형진), Galmuri (이민서), SIL OFL 1.1",
  "## 라이선스",
  "CC BY 4.0: https://creativecommons.org/licenses/by/4.0/deed.ko",
  "원저작자는 이 게임을 보증하거나 후원하지 않습니다.",
  "OPRN Studio 기본 소재 전체의 표기라서, 이 게임에 쓰이지 않은 소재도 들어 있습니다.",
  "소재별 출처는 아래 「전체 출처 문서」에 있습니다.",
].join("\n");

/** 전체 출처 문서를 못 읽었을 때 창에 대신 보이는 문장. 입구는 타이틀 메뉴 「크레딧」이다(숨길 수 없다). */
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

/**
 * 기본 표기 뒤에 이 게임이 쓰는 에셋 스토어 상품의 크레딧을 붙인다(에셋 출처 origin 에서 만든다, src/assetStore/pack.ts).
 * 스토어 에셋이 없으면 기본 표기 그대로다.
 */
export function withStoreCredits(notices: string | null, credits: string): string | null {
  if (!credits) return notices;
  return `${(notices ?? licenseNoticeText()).trimEnd()}\n\n${credits}`;
}

/** 마크다운 기호(##, **, 백틱, 링크, 표 줄)를 걷어 플레이어가 읽을 문장으로 만든다. */
function plainMarkdownLine(line: string): string {
  return line
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

/** ATTRIBUTION.md 같은 마크다운 원문을 제목·문단 요소로 그린다. 내용은 그대로, 기호만 걷는다. */
function renderLicenseText(host: HTMLElement, text: string): void {
  const doc = host.ownerDocument;
  let gap = false;
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (line.trim() === "") { gap = true; continue; }
    if (/^\|[\s:|-]+\|$/.test(line.trim())) continue;
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    const node = doc.createElement(heading ? "h3" : "p");
    if (heading) node.className = "rm-license-dialog-heading";
    else if (gap && host.childElementCount > 0) node.className = "rm-license-dialog-para";
    gap = false;
    const cells = /^\|(.*)\|$/.exec(line.trim());
    node.textContent = plainMarkdownLine(heading ? heading[1] : cells ? cells[1].split("|").map((cell) => cell.trim()).join(" · ") : line);
    host.append(node);
  }
}

/** 타이틀 메뉴 「크레딧」이 여는 창. 짧은 크레딧(+ 이 게임이 쓴 스토어 상품 크레딧)을 바로 띄운다. 닫히면 onClose 로 타이틀 포커스를 돌려받는다. */
export function openLicenseDialog(onClose?: () => void): void {
  let credits = "";
  try { credits = storeCredits(store.getCurrent()); } catch { credits = ""; }
  showLicenseDialog(withStoreCredits(PLAYER_CREDITS, credits), onClose);
}

function showLicenseDialog(body: string | null, onClose?: () => void): void {
  const view = globalThis.document?.defaultView ?? null;
  if (!view) return;
  const dialog = view.document.createElement("dialog");
  dialog.className = "rm-license-dialog";
  dialog.setAttribute("aria-label", "크레딧 — 게임 에셋 저작자 표기");
  dialog.dataset.testid = "title-credits-dialog";
  const pre = view.document.createElement("div");
  pre.className = "rm-license-dialog-body";
  pre.tabIndex = 0;
  pre.setAttribute("aria-label", "저작자 표기");
  renderLicenseText(pre, body ?? licenseNoticeText());
  const heading = view.document.createElement("h2");
  heading.className = "rm-license-dialog-title";
  heading.textContent = "크레딧";
  const hint = view.document.createElement("p");
  hint.className = "rm-license-dialog-hint";
  hint.id = "title-credits-hint";
  hint.textContent = "↑↓ 로 읽고, Esc 로 닫습니다";
  const close = view.document.createElement("button");
  close.type = "button";
  close.textContent = "닫기";
  close.className = "rm-license-dialog-close";
  close.addEventListener("click", () => dialog.close());
  // 소재별 전체 출처 문서(영문 원문)는 이 단추로만 연다. 연 뒤에는 단추를 치우고 본문 맨 위부터 보여 준다.
  const full = view.document.createElement("button");
  full.type = "button";
  full.textContent = "전체 출처 문서 (영문)";
  full.className = "rm-license-dialog-full";
  full.dataset.testid = "title-credits-full";
  const openFull = (): void => {
    if (full.disabled) return;
    full.disabled = true;
    void fetchLicenseNotices().then((notices) => {
      if (!dialog.isConnected) return;
      pre.replaceChildren();
      renderLicenseText(pre, notices ?? licenseNoticeText());
      pre.scrollTop = 0;
      pre.dataset.view = "full";
      full.remove();
      close.focus({ preventScroll: true });
    });
  };
  full.addEventListener("click", openFull);
  const actions = view.document.createElement("div");
  actions.className = "rm-license-dialog-actions";
  actions.append(full, close);
  dialog.setAttribute("aria-describedby", hint.id);
  // Own keys before editor/document capture handlers (including their Escape stack).
  // 포커스는 닫기 단추에 있다. 본문이 창보다 길어 스크롤이 필요한데, 단추에 포커스가
  // 있으면 방향키의 기본 동작이 본문을 움직이지 않는다. 여기서 직접 민다.
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!dialog.open || !dialog.isConnected) return;
    event.stopPropagation();
    if (event.isComposing) return;
    if (scrollCreditsBody(pre, event.key)) {
      event.preventDefault();
      return;
    }
    // ←→: 두 단추 사이를 오간다(패드·키보드만 쓰는 플레이어가 전체 출처 문서를 열 수 있게).
    if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && full.isConnected && !full.disabled) {
      event.preventDefault();
      (view.document.activeElement === full ? close : full).focus({ preventScroll: true });
      return;
    }
    if (!isCancelKey(event.key) && !isConfirmKey(event.key)) return;
    event.preventDefault();
    if (event.repeat) return;
    if (isConfirmKey(event.key) && !isCancelKey(event.key) && view.document.activeElement === full) openFull();
    else dialog.close();
  };
  view.addEventListener("keydown", onKeyDown, true);
  dialog.append(heading, hint, pre, actions);
  dialog.addEventListener("close", () => {
    view.removeEventListener("keydown", onKeyDown, true);
    dialog.remove();
    onClose?.();
  });
  view.document.body.append(dialog);
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  close.focus({ preventScroll: true });
}

/** 닫기 단추에 포커스가 있어도 긴 저작자 표기를 키보드로 읽게 한다. */
function scrollCreditsBody(body: HTMLElement, key: string): boolean {
  const line = 32;
  const page = Math.max(line * 3, Math.round((body.clientHeight || line * 8) * 0.85));
  let next = body.scrollTop;
  switch (key) {
    case "ArrowDown": next += line; break;
    case "ArrowUp": next -= line; break;
    case "PageDown": next += page; break;
    case "PageUp": next -= page; break;
    case "Home": next = 0; break;
    case "End": next = body.scrollHeight; break;
    default: return false;
  }
  body.scrollTop = Math.max(0, next);
  return true;
}
