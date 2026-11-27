// player/titleLicenseNotice.ts
// 타이틀 메뉴 「크레딧」 창.
// 프로젝트가 실제로 사용하는 에셋만 감사(auditProjectAssetLicenses)하여 해당 언어(ko/en/ja/zh)로 크레딧을 생성한다.
// 사용하지 않은 AI 음악(Google Lyria), EasyRPG RTP, Scarloxy, REFMAP 문구는 절대 노출하지 않는다.
// 제작자가 직접 작성한 팀/게임 크레딧(project.meta.customCredits)이 있으면 맨 위에 우선 표시한다.
import { withInlineAsset } from "@/assets/inlineAssetStore";
import type { SupportedLocale } from "@/i18n/locale";
import { isCancelKey, isConfirmKey } from "@/player/keyBindings";
import { runtimeUiLocale, runtimeUiTextForLocale } from "@/player/runtimeUiStrings";
import { auditProjectAssetLicenses, type StoreCreditAuditEntry } from "@/project/assetLicenseAudit";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

export const ATTRIBUTION_DOC_PATH = "/assets/ATTRIBUTION.md";

const EASYRPG_CC_BY_AUTHORS =
  "Garakuta, Juan Manuel Nigretti, Marina Navarro Travesset, MrBeast, Orochii Zouveleki, R.C.O., Stephen Challener (Redshrike), Tom Lemmens, VictorSena, andwhyisit, kou, lumiscosity, russidan (Alephman)";

const REFMAP_REQUIRED_CREDIT = "REFMAP (http://refmap.wixsite.com/fsm-material), modified";

const CC_BY_DEED_URL: Readonly<Record<SupportedLocale, string>> = {
  ko: "https://creativecommons.org/licenses/by/4.0/deed.ko",
  en: "https://creativecommons.org/licenses/by/4.0/",
  ja: "https://creativecommons.org/licenses/by/4.0/deed.ja",
  zh: "https://creativecommons.org/licenses/by/4.0/deed.zh-hans",
};

interface CreditCopy {
  readonly builtWithOprn: string;
  readonly enginePhaser: string;
  readonly aiBgmLine: string;
  readonly cc0MusicLine: string;
  readonly cc0SfxLine: string;
  readonly easyRpgSfxLine: string;
  readonly easyRpgHeader: string;
  readonly scarloxyHeader: string;
  readonly cc0GraphicsLine: string;
  readonly fontsLine: string;
  readonly ccByPrefix: string;
  readonly noEndorsement: string;
  readonly fullDocNote: string;
  readonly storeAiTag: string;
}

const CREDIT_COPY: Readonly<Record<SupportedLocale, CreditCopy>> = {
  ko: {
    builtWithOprn: "OPRN Studio 로 만든 게임입니다.",
    enginePhaser: "게임 엔진: Phaser (MIT)",
    aiBgmLine: "OPRN BGM (AI 로 만든 음악, Google Lyria)",
    cc0MusicLine: "음악: cynicmusic, pauliuw, RandomMind, Brandon Morris (CC0)",
    cc0SfxLine: "효과음: artisticdude, rubberduck (CC0)",
    easyRpgSfxLine: "효과음: EasyRPG RTP (CC BY 4.0)",
    easyRpgHeader: "EasyRPG RTP (CC BY 4.0), 일부를 고쳐 그렸습니다.",
    scarloxyHeader: "Scarloxy (Ismael Garcia), Monster Taming Game Essentials (CC BY 4.0), 크기와 배치를 바꿨습니다.",
    cc0GraphicsLine: "JasonPerry, Tom Lemmens, Blarumyrran, Verdant_Jack (CC0)",
    fontsLine: "Pretendard (길형진), Galmuri (이민서), SIL OFL 1.1",
    ccByPrefix: "CC BY 4.0",
    noEndorsement: "원저작자는 이 게임을 보증하거나 후원하지 않습니다.",
    fullDocNote: "소재별 상세 출처는 아래 「전체 출처 문서」에서 확인할 수 있습니다.",
    storeAiTag: "AI 생성 포함",
  },
  en: {
    builtWithOprn: "Made with OPRN Studio.",
    enginePhaser: "Game Engine: Phaser (MIT)",
    aiBgmLine: "OPRN BGM (AI-generated music, Google Lyria)",
    cc0MusicLine: "Music: cynicmusic, pauliuw, RandomMind, Brandon Morris (CC0)",
    cc0SfxLine: "Sound Effects: artisticdude, rubberduck (CC0)",
    easyRpgSfxLine: "Sound Effects: EasyRPG RTP (CC BY 4.0)",
    easyRpgHeader: "EasyRPG RTP (CC BY 4.0), modified.",
    scarloxyHeader: "Scarloxy (Ismael Garcia), Monster Taming Game Essentials (CC BY 4.0), resized and repacked.",
    cc0GraphicsLine: "JasonPerry, Tom Lemmens, Blarumyrran, Verdant_Jack (CC0)",
    fontsLine: "Pretendard (Kil Hyung-jin), Galmuri (Minseo Lee), SIL OFL 1.1",
    ccByPrefix: "CC BY 4.0",
    noEndorsement: "The original authors do not endorse or sponsor this game.",
    fullDocNote: "See the Full Attribution Document below for detailed per-asset sources.",
    storeAiTag: "Includes AI-generated content",
  },
  ja: {
    builtWithOprn: "OPRN Studio で制作されたゲームです。",
    enginePhaser: "ゲームエンジン: Phaser (MIT)",
    aiBgmLine: "OPRN BGM（AI生成音楽・Google Lyria）",
    cc0MusicLine: "音楽: cynicmusic, pauliuw, RandomMind, Brandon Morris (CC0)",
    cc0SfxLine: "効果音: artisticdude, rubberduck (CC0)",
    easyRpgSfxLine: "効果音: EasyRPG RTP (CC BY 4.0)",
    easyRpgHeader: "EasyRPG RTP (CC BY 4.0)、一部改変。",
    scarloxyHeader: "Scarloxy (Ismael Garcia), Monster Taming Game Essentials (CC BY 4.0)、サイズ・配置を改変。",
    cc0GraphicsLine: "JasonPerry, Tom Lemmens, Blarumyrran, Verdant_Jack (CC0)",
    fontsLine: "Pretendard (Kil Hyung-jin), Galmuri (Minseo Lee), SIL OFL 1.1",
    ccByPrefix: "CC BY 4.0",
    noEndorsement: "原著作者は本ゲームを推奨または後援していません。",
    fullDocNote: "素材ごとの詳細な出典は下の「詳細クレジット文書」をご確認ください。",
    storeAiTag: "AI生成素材を含む",
  },
  zh: {
    builtWithOprn: "使用 OPRN Studio 制作。",
    enginePhaser: "游戏引擎：Phaser (MIT)",
    aiBgmLine: "OPRN BGM（AI生成音乐，Google Lyria）",
    cc0MusicLine: "音乐：cynicmusic, pauliuw, RandomMind, Brandon Morris (CC0)",
    cc0SfxLine: "音效：artisticdude, rubberduck (CC0)",
    easyRpgSfxLine: "音效：EasyRPG RTP (CC BY 4.0)",
    easyRpgHeader: "EasyRPG RTP (CC BY 4.0)，已作修改。",
    scarloxyHeader: "Scarloxy (Ismael Garcia), Monster Taming Game Essentials (CC BY 4.0)，已调整尺寸与排列。",
    cc0GraphicsLine: "JasonPerry, Tom Lemmens, Blarumyrran, Verdant_Jack (CC0)",
    fontsLine: "Pretendard (Kil Hyung-jin), Galmuri (Minseo Lee), SIL OFL 1.1",
    ccByPrefix: "CC BY 4.0",
    noEndorsement: "原作者不对此游戏提供背书或赞助。",
    fullDocNote: "各素材详细署名请参阅下方“完整署名文档”。",
    storeAiTag: "含AI生成内容",
  },
};

/**
 * 레거시 호환용 전체 기본 소재 크레딧 참고 상수.
 * 실제 타이틀 크레딧 창은 이 고정 문자열 대신 `buildPlayerCredits(project, locale)` 를 사용한다.
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
  EASYRPG_CC_BY_AUTHORS,
  "",
  "Scarloxy (Ismael Garcia), Monster Taming Game Essentials (CC BY 4.0), 크기와 배치를 바꿨습니다.",
  "https://scarloxy.itch.io/mpwsp01",
  "",
  REFMAP_REQUIRED_CREDIT,
  "",
  "JasonPerry, Tom Lemmens, Blarumyrran, Verdant_Jack (CC0)",
  "## 글꼴",
  "Pretendard (길형진), Galmuri (이민서), SIL OFL 1.1",
  "## 라이선스",
  "CC BY 4.0: https://creativecommons.org/licenses/by/4.0/deed.ko",
  "원저작자는 이 게임을 보증하거나 후원하지 않습니다.",
  "소재별 출처는 아래 「전체 출처 문서」에 있습니다.",
].join("\n");

function formatStoreCreditLines(entries: readonly StoreCreditAuditEntry[], locale: SupportedLocale): string[] {
  const copy = CREDIT_COPY[locale];
  const lines: string[] = [];
  for (const entry of entries) {
    const parts = [`「${entry.title}」 — ${entry.author}`, entry.license];
    if (entry.aiGenerated) parts.push(copy.storeAiTag);
    lines.push(parts.join(" · "));
    if (entry.credits.trim()) lines.push(entry.credits.trim());
  }
  return lines;
}

/**
 * 프로젝트가 실제로 사용하는 에셋의 크레딧만 지정 언어(ko/en/ja/zh)로 생성한다.
 * - 제작자 직접 작성 크레딧(`project.meta.customCredits`)이 있으면 맨 위에 우선 표시한다.
 * - 사용하지 않은 AI 음악(Google Lyria), EasyRPG RTP, Scarloxy, REFMAP 문구는 포함하지 않는다.
 */
export function buildPlayerCredits(
  project: Project | null | undefined,
  locale?: SupportedLocale,
): string {
  const lang = locale ?? runtimeUiLocale(project);
  const copy = CREDIT_COPY[lang];
  const audit = project ? auditProjectAssetLicenses(project) : null;
  const sections: string[] = [];

  // 1. 제작자 커스텀 팀/게임 크레딧 (최우선)
  const custom = project?.meta?.customCredits?.trim();
  if (custom) {
    const customHasHeading = /^#{1,6}\s+/m.test(custom);
    sections.push(
      customHasHeading
        ? custom
        : `## ${runtimeUiTextForLocale(lang, "credits.section.game")}\n${custom}`,
    );
  }

  // 2. 만든 도구
  sections.push([
    `## ${runtimeUiTextForLocale(lang, "credits.section.engine")}`,
    copy.builtWithOprn,
    copy.enginePhaser,
  ].join("\n"));

  // 3. 음악과 효과음 (실제로 쓴 것만)
  if (audit) {
    const audioLines: string[] = [];
    if (audit.usesAiBgm) {
      audioLines.push(copy.aiBgmLine);
    }
    if (audit.usesCc0Audio) {
      audioLines.push(copy.cc0MusicLine);
      audioLines.push(copy.cc0SfxLine);
    }
    if (audit.usesEasyRpgRtpAudio) {
      audioLines.push(copy.easyRpgSfxLine);
    }
    if (audioLines.length > 0) {
      sections.push([`## ${runtimeUiTextForLocale(lang, "credits.section.audio")}`, ...audioLines].join("\n"));
    }

    // 4. 그림 (실제로 쓴 것만)
    const graphicBlocks: string[] = [];
    if (audit.usesEasyRpgRtp) {
      graphicBlocks.push([
        copy.easyRpgHeader,
        "https://github.com/EasyRPG/RTP",
        EASYRPG_CC_BY_AUTHORS,
      ].join("\n"));
    }
    if (audit.usesScarloxy) {
      graphicBlocks.push([
        copy.scarloxyHeader,
        "https://scarloxy.itch.io/mpwsp01",
      ].join("\n"));
    }
    if (audit.usesRefmap) {
      graphicBlocks.push(REFMAP_REQUIRED_CREDIT);
    }
    if (audit.usesCc0Graphics) {
      graphicBlocks.push(copy.cc0GraphicsLine);
    }
    if (graphicBlocks.length > 0) {
      sections.push([
        `## ${runtimeUiTextForLocale(lang, "credits.section.graphics")}`,
        graphicBlocks.join("\n\n"),
      ].join("\n"));
    }

    // 5. 에셋 스토어 (설치된 상품이 있을 때만)
    if (audit.storeCredits.length > 0) {
      sections.push([
        `## ${runtimeUiTextForLocale(lang, "credits.section.store")}`,
        ...formatStoreCreditLines(audit.storeCredits, lang),
      ].join("\n"));
    }
  }

  // 6. 글꼴
  sections.push([
    `## ${runtimeUiTextForLocale(lang, "credits.section.fonts")}`,
    copy.fontsLine,
  ].join("\n"));

  // 7. 라이선스 (법적 표기 의무가 있거나 전체 출처 안내가 필요한 경우)
  const hasCcBy = audit ? (audit.usesEasyRpgRtp || audit.usesScarloxy || audit.storeCredits.some((s) => s.license === "CC-BY-4.0" || s.license === "CC-BY-SA-4.0")) : false;
  if (!audit || audit.requiresAttribution || hasCcBy) {
    const licenseLines: string[] = [];
    if (hasCcBy) {
      licenseLines.push(`${copy.ccByPrefix}: ${CC_BY_DEED_URL[lang]}`);
    }
    licenseLines.push(copy.noEndorsement);
    licenseLines.push(copy.fullDocNote);
    sections.push([
      `## ${runtimeUiTextForLocale(lang, "credits.section.license")}`,
      ...licenseLines,
    ].join("\n"));
  }

  return sections.join("\n");
}

/** 전체 출처 문서를 못 읽었을 때 창에 대신 보이는 문장. */
export function licenseNoticeText(locale: SupportedLocale = "ko"): string {
  return runtimeUiTextForLocale(locale, "credits.fallbackNotice");
}

/** 편집기·출하 플레이어 공통. ATTRIBUTION.md 가 없으면 null 이다. */
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
 * 기본 표기 뒤에 이 게임이 쓰는 에셋 스토어 상품의 크레딧을 붙인다.
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

function safeCurrentProject(): Project | undefined {
  try {
    return store.getCurrent();
  } catch {
    return undefined;
  }
}

/** 타이틀 메뉴 「크레딧」이 여는 창. 실제 사용 에셋 기반·프로젝트 언어 크레딧을 바로 띄운다. 닫히면 onClose 로 타이틀 포커스를 돌려받는다. */
export function openLicenseDialog(onClose?: () => void, projectOverride?: Project): void {
  const project = projectOverride ?? safeCurrentProject();
  const locale = runtimeUiLocale(project);
  const body = buildPlayerCredits(project, locale);
  showLicenseDialog(body, locale, onClose);
}

function showLicenseDialog(body: string | null, locale: SupportedLocale, onClose?: () => void): void {
  const view = globalThis.document?.defaultView ?? null;
  if (!view) return;
  const dialog = view.document.createElement("dialog");
  dialog.className = "rm-license-dialog";
  dialog.setAttribute("aria-label", runtimeUiTextForLocale(locale, "credits.ariaLabel"));
  dialog.dataset.testid = "title-credits-dialog";
  const pre = view.document.createElement("div");
  pre.className = "rm-license-dialog-body";
  pre.tabIndex = 0;
  pre.setAttribute("aria-label", runtimeUiTextForLocale(locale, "credits.bodyAriaLabel"));
  renderLicenseText(pre, body ?? licenseNoticeText(locale));
  const heading = view.document.createElement("h2");
  heading.className = "rm-license-dialog-title";
  heading.textContent = runtimeUiTextForLocale(locale, "credits.title");
  const hint = view.document.createElement("p");
  hint.className = "rm-license-dialog-hint";
  hint.id = "title-credits-hint";
  hint.textContent = runtimeUiTextForLocale(locale, "credits.hint");
  const close = view.document.createElement("button");
  close.type = "button";
  close.textContent = runtimeUiTextForLocale(locale, "credits.close");
  close.className = "rm-license-dialog-close";
  close.addEventListener("click", () => dialog.close());
  // 소재별 전체 출처 문서(영문 원문)는 이 단추로만 연다. 연 뒤에는 단추를 치우고 본문 맨 위부터 보여 준다.
  const full = view.document.createElement("button");
  full.type = "button";
  full.textContent = runtimeUiTextForLocale(locale, "credits.fullDoc");
  full.className = "rm-license-dialog-full";
  full.dataset.testid = "title-credits-full";
  const openFull = (): void => {
    if (full.disabled) return;
    full.disabled = true;
    void fetchLicenseNotices().then((notices) => {
      if (!dialog.isConnected) return;
      pre.replaceChildren();
      renderLicenseText(pre, notices ?? licenseNoticeText(locale));
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
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!dialog.open || !dialog.isConnected) return;
    event.stopPropagation();
    if (event.isComposing) return;
    if (scrollCreditsBody(pre, event.key)) {
      event.preventDefault();
      return;
    }
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
