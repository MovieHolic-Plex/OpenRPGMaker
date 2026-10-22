// src/harnesses/_core/workshop/picker.ts
/**
 * 「알아서 고르기」의 고르는 단계 — object-gen(`objectgen/picker.py`) 의 picker 를 옮겼다(2026-10-21).
 * 검수(블라인드)를 통과한 후보가 둘 이상이면 새 판정자 호출 한 번이 그중 하나를 고른다. 하나면 그것, 없으면 고르지 않는다(사람에게 넘긴다).
 *
 * 원본과 같은 점: 지시문(object-gen 흐름 실행기는 원본 PROMPT 그대로, objectGenFlow.ogPickerPrompt)·견본 그림(exemplars)·숫자 꼬리표 섞기·
 * 답 형식, 3번 물어 다수결(PICK_RUNS). 다른 점: 그림판 글자 대신 그림 앞에 꼬리표 글을 붙인다.
 * 고른 기록은 사람 선택(`review.pick`)이 아니다 — 굽기가 출처에 `/auto-pick` 을 붙인다.
 */
import type { ChatMessage, ContentPart } from "@/ai/llmClient";
import { kitConstant, objectGenKit } from "./genKits";
import { onBackground, renderGrid, scaleImage } from "./grid";
import type { Grid, Palette, Rgba, RgbaImage, WorkshopEnv, WorkshopItem } from "./types";

const FLOOR: Rgba = [146, 118, 88, 255];

// 견본 없는 옛 실행기용 짧은 지시문(편집기 자체 문장). object-gen 흐름은 원본 picker.PROMPT(ogPickerPrompt, gen-kits)를 쓴다.
export const PICKER_PROMPT = `You pick ONE drawing for a 16 px pixel-art RPG tileset (3/4 top-down view, hand-placed pixels).
All candidates already passed a strict review. Choose the one that would sit best in the map:
the 3/4 view (top plane visible, short front, no side face), a clear silhouette at 1x that reads as the named object in its setting,
calm banded shading, believable structure, no stray or noisy pixels. Prefer the one that reads clearly at 1x over fine detail at 8x.
Answer with ONE line of JSON only: {"pick": "<label>", "reason": "<one sentence, what makes it better than the other(s)>"}`;

export type PickerCandidate = { readonly letter: string; readonly grid: Grid };
/** 원본 picker.RUNS(gen-kits 생성물) — 꼬리표를 매번 다시 섞어 그만큼 묻고 다수결. */
export const PICK_RUNS = kitConstant<number>(objectGenKit, "picker", "RUNS");

export type PickerBoard = { readonly messages: ChatMessage[]; readonly labels: Readonly<Record<string, string>> };

/** 후보 순서를 섞어 숫자 꼬리표를 붙이고 메시지를 만든다. random 은 시험용으로 바꿀 수 있다. */
export function pickerMessages(item: WorkshopItem, candidates: readonly PickerCandidate[], palette: Palette, env: WorkshopEnv, random: () => number = Math.random,
  og?: { readonly prompt: string; readonly exemplars: RgbaImage | null; readonly floor: Rgba }): PickerBoard {
  const order = [...candidates];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const labels: Record<string, string> = {};
  const floor = og?.floor ?? FLOOR;
  const parts: ContentPart[] = og
    ? [{ type: "text", text: og.prompt }]
    : [{ type: "text", text: `Object: ${item.title} - ${item.description}${item.setting ? `\nSetting: ${item.setting}` : ""}\nCandidates (label, then 8x, then 1x and 2x on the floor):` }];
  if (og?.exemplars) parts.push({ type: "text", text: "exemplars.png (8x):" }, { type: "image_url", image_url: { url: env.encodePng(og.exemplars), detail: "high" } });
  order.forEach((candidate, index) => {
    const label = String(index + 1);
    labels[label] = candidate.letter;
    const art = onBackground(renderGrid(candidate.grid, palette), floor);
    parts.push(
      { type: "text", text: `${og ? "candidates.png — " : ""}Candidate ${label} at 8x:` },
      { type: "image_url", image_url: { url: env.encodePng(scaleImage(art, 8)), detail: "high" } },
      { type: "text", text: `${og ? "actual-size.png — " : ""}Candidate ${label} at 1x and 2x (how the player sees it):` },
      { type: "image_url", image_url: { url: env.encodePng(art), detail: "high" } },
      { type: "image_url", image_url: { url: env.encodePng(scaleImage(art, 2)), detail: "high" } },
    );
  });
  parts.push({ type: "text", text: `Pick one label from: ${Object.keys(labels).join(", ")}.` });
  return { messages: og ? [{ role: "user", content: parts }] : [{ role: "system", content: PICKER_PROMPT }, { role: "user", content: parts }], labels };
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
          // 한국어 답(「후보 2는…」)·맨 숫자 주어(「2 wins …」)도 — 시험 2(2026-10-21)에서 고른 글자 A 와 「후보 2」가 같이 보였다.
          .replace(/후보\s*(\d+)/gu, (whole, n: string) => (labels[n] ? `후보 ${labels[n]}` : whole))
          .replace(/(?<![\w.])(\d+)(?=\s+(?:wins|is|has|keeps|reads|breaks|loses)\b)/gu, (whole, n: string) => labels[n] ?? whole)
          .replace(/[.\s]+$/u, "");
        return { letter: labels[label]!, reason: readable.slice(0, 400) };
      }
    } catch { /* 다음 조각 */ }
  }
  return null;
}

/** 여러 번 물은 답의 다수결(원본 picker.pick). 과반이 없으면 null. */
export function pickerMajority(votes: readonly { letter: string; reason: string }[]): { letter: string; reason: string; tally: string } | null {
  const count = new Map<string, number>();
  for (const vote of votes) count.set(vote.letter, (count.get(vote.letter) ?? 0) + 1);
  const [top, n] = [...count].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  if (!top || n * 2 <= votes.length) return null;
  const win = votes.find((vote) => vote.letter === top)!;
  return { letter: top, reason: win.reason, tally: `${n}/${votes.length}` };
}
