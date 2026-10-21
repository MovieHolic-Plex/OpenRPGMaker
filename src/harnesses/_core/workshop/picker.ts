// src/harnesses/_core/workshop/picker.ts
/**
 * 「알아서 고르기」의 고르는 단계 — object-gen(`objectgen/picker.py`) 의 picker 를 옮겼다(2026-10-21).
 * 검수(블라인드)를 통과한 후보가 둘 이상이면 새 판정자 호출 한 번이 그중 하나를 고른다. 하나면 그것, 없으면 고르지 않는다(사람에게 넘긴다).
 *
 * 원본과 같은 점: 지시문 뜻(3/4 시점·1배 실루엣·차분한 명암·구조·잡화소, 1배 읽힘 우선), 숫자 꼬리표를 섞어 「A」 편애를 막는다,
 * 답은 꼬리표 하나 + 한 문장 이유. 다른 점: 견본 그림 판 대신 후보 하나마다 8배·1배·2배 그림을 따로 붙인다(글자 그리기 없이),
 * 물건 배경(setting)을 함께 준다, 한 번만 묻는다(원본 기본 3번 다수결).
 * 고른 기록은 사람 선택(`review.pick`)이 아니다 — 굽기가 출처에 `/auto-pick` 을 붙인다.
 */
import type { ChatMessage, ContentPart } from "@/ai/llmClient";
import { onBackground, renderGrid, scaleImage } from "./grid";
import type { Grid, Palette, Rgba, WorkshopEnv, WorkshopItem } from "./types";

const FLOOR: Rgba = [146, 118, 88, 255];

export const PICKER_PROMPT = `You pick ONE drawing for a 16 px pixel-art RPG tileset (3/4 top-down view, hand-placed pixels).
All candidates already passed a strict review. Choose the one that would sit best in the map:
the 3/4 view (top plane visible, short front, no side face), a clear silhouette at 1x that reads as the named object in its setting,
calm banded shading, believable structure, no stray or noisy pixels. Prefer the one that reads clearly at 1x over fine detail at 8x.
Answer with ONE line of JSON only: {"pick": "<label>", "reason": "<one sentence, what makes it better than the other(s)>"}`;

export type PickerCandidate = { readonly letter: string; readonly grid: Grid };
export type PickerBoard = { readonly messages: ChatMessage[]; readonly labels: Readonly<Record<string, string>> };

/** 후보 순서를 섞어 숫자 꼬리표를 붙이고 메시지를 만든다. random 은 시험용으로 바꿀 수 있다. */
export function pickerMessages(item: WorkshopItem, candidates: readonly PickerCandidate[], palette: Palette, env: WorkshopEnv, random: () => number = Math.random): PickerBoard {
  const order = [...candidates];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const labels: Record<string, string> = {};
  const parts: ContentPart[] = [{ type: "text", text: `Object: ${item.title} - ${item.description}${item.setting ? `\nSetting: ${item.setting}` : ""}\nCandidates (label, then 8x, then 1x and 2x on the floor):` }];
  order.forEach((candidate, index) => {
    const label = String(index + 1);
    labels[label] = candidate.letter;
    const art = onBackground(renderGrid(candidate.grid, palette), FLOOR);
    parts.push(
      { type: "text", text: `Candidate ${label} at 8x:` },
      { type: "image_url", image_url: { url: env.encodePng(scaleImage(art, 8)), detail: "high" } },
      { type: "text", text: `Candidate ${label} at 1x and 2x (how the player sees it):` },
      { type: "image_url", image_url: { url: env.encodePng(art), detail: "high" } },
      { type: "image_url", image_url: { url: env.encodePng(scaleImage(art, 2)), detail: "high" } },
    );
  });
  parts.push({ type: "text", text: `Pick one label from: ${Object.keys(labels).join(", ")}.` });
  return { messages: [{ role: "system", content: PICKER_PROMPT }, { role: "user", content: parts }], labels };
}

/** 답 → 고른 글자와 이유. 꼬리표가 없거나 이유가 짧으면 null(원본 parse 와 같은 조건). */
export function parsePicker(text: string, labels: Readonly<Record<string, string>>): { letter: string; reason: string } | null {
  for (const found of (text.match(/\{[^{}]*\}/gu) ?? []).reverse()) {
    try {
      const answer = JSON.parse(found) as { pick?: unknown; reason?: unknown };
      const label = String(answer.pick ?? "").trim();
      const reason = String(answer.reason ?? "").trim();
      if (labels[label] && reason.length >= 10) {
        // 이유 속 꼬리표 번호를 후보 글자로 바꿔 보여 준다(원본 readable).
        const readable = reason
          .replace(/\b([Cc]andidates?)\s+(\d+)\b/gu, (whole, word: string, n: string) => (labels[n] ? `${word} ${labels[n]}` : whole))
          .replace(/(?<![\w.])(\d+)(?='s\b)/gu, (whole, n: string) => labels[n] ?? whole)
          .replace(/[.\s]+$/u, "");
        return { letter: labels[label]!, reason: readable.slice(0, 400) };
      }
    } catch { /* 다음 조각 */ }
  }
  return null;
}
