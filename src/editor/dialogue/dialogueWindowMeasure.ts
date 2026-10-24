// editor/dialogue/dialogueWindowMeasure.ts
// 「대사」 탭의 창 넘침 판정 — 런타임 대화창과 **같은 CSS·같은 클래스** 로 보이지 않는 창을 만들어 실제 글 폭·글꼴·줄 수를 잰다.
//
// 런타임(player/dialogue.ts)은 플레이 화면(프로젝트 해상도) 안에 .dialogue-overlay.position-bottom > .dialogue-box > .body 를 붙이고
//   글 폭 = min(해상도 − 여백 상수, .body 실제 안쪽 폭)
//   한 장 줄 수 = min(3, .body 높이 / 줄 높이)
//   글자 폭 = .body 의 계산된 font 로 캔버스 measureText
// 를 써서 paginateDialogueSegments 로 장을 나눈다. 여기서도 같은 값을 재고 같은 함수를 돌린다. 판정 기준은 «한 장을 넘는가»(다음 장으로 넘겨야 하는가).
// 화자 대화 스타일·글꼴·얼굴 칸이 다르면 폭이 달라지므로 그 조합마다 한 번씩 잰다.

import { preloadRuntimeStyles } from "@/app/runtimeStyles";
import { resolveDialogueLook, type DialogueLook } from "@/project/dialogueStyles";
import { projectFontStack, resolveFontStack } from "@/project/fontRegistry";
import { resolvePlayResolution } from "@/project/playResolution";
import { dialogueSpeakerInsetPx } from "@/player/dialoguePresentation";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";
import { dialogueLineUsesMessageWindow, type DialogueLine } from "./dialogueIndex";
import { measureDialogueFit, visibleDialogueText, estimateDialogueWindowMetrics, type DialogueFit, type DialogueWindowMetrics } from "./dialogueText";
import { actorNamesOf } from "./dialogueEdits";

const VISIBLE_LINES = 3;

interface MeasuredWindow {
  readonly metrics: DialogueWindowMetrics;
  readonly measure: (text: string) => number;
}

export interface DialogueWindowMeasurer {
  /** 대화창 줄이 아니면 undefined. */
  fit(line: Pick<DialogueLine, "kind" | "speaker" | "context" | "withFace">, text: string): DialogueFit | undefined;
  /** 그 줄이 뜨는 창의 기준(글 폭·글꼴·한 장 줄 수). */
  metrics(line: Pick<DialogueLine, "speaker" | "context" | "withFace">): DialogueWindowMetrics;
  /** 사람에게 보여 줄 기준: 「글 폭 442px · Pretendard 9px · 한 장 3줄」. */
  describe(line?: Pick<DialogueLine, "kind" | "speaker" | "context" | "withFace">): string;
  dispose(): void;
}

function lookKey(look: DialogueLook, withFace: boolean, hasSpeaker: boolean): string {
  return `${look.style}|${look.context}|${look.font ?? ""}|${withFace ? 1 : 0}|${hasSpeaker ? 1 : 0}`;
}

function firstFamily(fontFamily: string): string {
  return (fontFamily.split(",")[0] ?? fontFamily).replace(/["']/gu, "").trim();
}

/** 실제 런타임 CSS 로 재는 측정기. 런타임 시트를 늦게 받으므로 비동기다. */
export async function createDialogueWindowMeasurer(project: Project): Promise<DialogueWindowMeasurer> {
  await preloadRuntimeStyles();
  const resolution = resolvePlayResolution(project.system);
  const host = el("div", {
    class: "db-dialogue-measure-host",
    attrs: { "aria-hidden": "true", translate: "no" },
  });
  host.style.cssText = `position:fixed;left:-30000px;top:0;width:${resolution.width}px;height:${resolution.height}px;visibility:hidden;pointer-events:none;contain:strict;`;
  host.style.setProperty("--runtime-dialogue-font", projectFontStack(project.system.fonts, "ui"));
  document.body.append(host);
  const actorNames = actorNamesOf(project);
  const windows = new Map<string, MeasuredWindow>();
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  const measureWindow = (look: DialogueLook, withFace: boolean, hasSpeaker: boolean): MeasuredWindow => {
    const key = lookKey(look, withFace, hasSpeaker);
    const cached = windows.get(key);
    if (cached) return cached;
    const overlay = el("div", { class: "dialogue-overlay position-bottom", dataset: { dialogueStyle: look.style } });
    const box = el("div", {
      class: ["dialogue-box", "page-ready", withFace ? "with-face" : "", hasSpeaker ? "has-speaker" : ""].filter(Boolean).join(" "),
      dataset: { dialogueStyle: look.style, ...(look.context !== "speech" ? { dialogueContext: look.context } : {}) },
    });
    if (look.font) box.style.setProperty("--runtime-dialogue-font", resolveFontStack(look.font));
    const content = el("div", { class: "dialogue-content" });
    if (withFace) content.append(el("div", { class: "dialogue-face", attrs: { style: "width:48px;height:48px" } }));
    const body = el("div", { class: "body", text: "가" });
    content.append(el("div", { class: "dialogue-text-column", children: [body] }));
    box.append(content);
    let nameplate: HTMLElement | null = null;
    if (hasSpeaker) {
      nameplate = el("div", { class: "speaker speaker-nameplate", text: "이름" });
      box.append(nameplate);
    }
    overlay.append(box);
    host.append(overlay);
    if (nameplate) {
      const fallback = Number.parseFloat(getComputedStyle(box).paddingTop);
      const inset = dialogueSpeakerInsetPx(nameplate.offsetTop, nameplate.offsetHeight, Number.isFinite(fallback) ? fallback : 0);
      if (inset !== undefined) box.style.setProperty("--runtime-dialogue-speaker-inset", `${inset}px`);
    }
    const style = getComputedStyle(body);
    const inner = body.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
    const estimate = estimateDialogueWindowMetrics(resolution.width, { face: withFace });
    const width = inner > 0 ? Math.min(inner, estimate.bodyWidthPx) : estimate.bodyWidthPx;
    const fontSize = parseFloat(style.fontSize) || 9;
    const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.2;
    const derived = body.clientHeight > 0 ? Math.max(1, Math.floor(body.clientHeight / lineHeight + 0.05)) : VISIBLE_LINES;
    const font = style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const metrics: DialogueWindowMetrics = {
      bodyWidthPx: width,
      fontSizePx: fontSize,
      maxLines: Math.min(VISIBLE_LINES, derived),
      source: "dom",
      fontLabel: `${firstFamily(style.fontFamily)} ${Math.round(fontSize * 10) / 10}px`,
    };
    let measure: (text: string) => number;
    if (context) {
      context.font = font;
      measure = (text) => {
        context.font = font;
        const value = context.measureText(text).width;
        return Number.isFinite(value) ? value : text.length * fontSize;
      };
    } else {
      measure = (text) => text.length * fontSize;
    }
    overlay.remove();
    const window = { metrics, measure };
    windows.set(key, window);
    return window;
  };

  // 웹 글꼴이 아직 안 들어왔으면 캔버스가 대체 글꼴로 잰다 — 기본 창 글꼴을 먼저 받아 둔다.
  try {
    const probe = measureWindow(resolveDialogueLook(project), false, true);
    windows.clear();
    await document.fonts?.load?.(`${probe.metrics.fontSizePx}px ${probe.metrics.fontLabel.replace(/ [\d.]+px$/u, "")}`, "가A");
    await document.fonts?.ready;
  } catch {
    // 글꼴 대기 실패는 측정을 막지 않는다(대체 글꼴 폭으로 잰다).
  }

  const windowFor = (line: Pick<DialogueLine, "speaker" | "context" | "withFace">): MeasuredWindow => {
    const look = resolveDialogueLook(project, { speaker: line.speaker, context: line.context });
    const hasSpeaker = Boolean(line.speaker) && !look.hideName;
    return measureWindow(look, line.withFace && !look.hideFace, hasSpeaker);
  };

  return {
    metrics(line) {
      return windowFor(line).metrics;
    },
    fit(line, text) {
      if (!dialogueLineUsesMessageWindow(line)) return undefined;
      const window = windowFor(line);
      return measureDialogueFit(visibleDialogueText(text, { actorNames }), window.metrics, window.measure);
    },
    describe(line) {
      const window = windowFor(line ?? { speaker: "이름", withFace: false });
      const { metrics } = window;
      return `글 폭 ${Math.round(metrics.bodyWidthPx)}px · ${metrics.fontLabel} · 한 장 ${metrics.maxLines}줄 (${resolution.width}×${resolution.height} 화면)`;
    },
    dispose() {
      host.remove();
    },
  };
}
