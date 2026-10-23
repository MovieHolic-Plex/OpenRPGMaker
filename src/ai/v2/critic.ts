// 조수 v2 독립 비평가 — 요청 원문과 1배 그림만 본다(짓기 이유·명세·앞선 점수는 모른다). major 를 칸 좌표와 함께 돌려준다.
// 실내는 v1 의 보정된 루브릭(featureReview.ts, 축 1·2·6)을 그대로 쓰고, 바깥·던전은 장르 관례만 바꾼 같은 루브릭이다.
import { featureCriticPrompt, parseFeatureCritic, type CriticVerdict } from "@/ai/piAgent/featureReview";
import type { PlaceType } from "./types";

const OUTDOOR_CONVENTIONS: Record<string, string> = {
  village: "Genre conventions (do NOT count as majors): an outdoor village map is meant to fill the whole frame with ground; trees, bushes and grass between houses are scenery, not void; roads may run off the map edges (that is how the player leaves); fenced fields and roofs are not walkable and that is fine.",
  street: "Genre conventions (do NOT count as majors): a modern street map fills the frame; pavement and asphalt are ground, not void; buildings are seen from the 3/4 front; roads running off the edges are exits.",
  dungeon: "Genre conventions (do NOT count as majors): a dungeon or cave floor is drawn inside dark rock; dark rock or black OUTSIDE the walls is solid ground, not void — count void only for bare, purposeless floor INSIDE the walkable area. Stairs and ladders are the exits between floors.",
};

/** 비평 지시문. 실내면 v1 루브릭 그대로, 아니면 장르 관례만 갈아 끼운다. */
export function criticPrompt(task: string, type: PlaceType | "content", mapName: string, cells: { width: number; height: number }, px: { width: number; height: number } | undefined, otherMaps: readonly string[]): string {
  const base = featureCriticPrompt(task, mapName, cells, px, otherMaps);
  if (type === "interior" || type === "house") return base;
  const key = type === "cave" ? "dungeon" : type === "street" ? "street" : type === "dungeon" ? "dungeon" : "village";
  return base.split("\n").map((line) => line.startsWith("Genre conventions") ? OUTDOOR_CONVENTIONS[key]! : line).join("\n");
}

export function pngSize(dataUrl: string): { width: number; height: number } | undefined {
  const comma = dataUrl.indexOf(",");
  const b64 = dataUrl.slice(comma + 1, comma + 1 + 44);
  const bytes = typeof Buffer !== "undefined" ? Buffer.from(b64, "base64") : Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return bytes.length >= 24 ? { width: view.getUint32(16), height: view.getUint32(20) } : undefined;
}

export interface CriticRun {
  readonly verdict: CriticVerdict;
  readonly ms: number;
}

/** 비평가 한 번: 대표 맵 그림 1장 + 같은 짓기의 다른 맵(문맥용). sideChat 은 조수와 같은 모델의 따로 부르는 호출. */
export async function critique(input: {
  readonly task: string;
  readonly type: PlaceType | "content";
  readonly map: { readonly id: string; readonly name: string; readonly width: number; readonly height: number };
  readonly image: string;
  readonly others: readonly { readonly name: string; readonly image: string }[];
  readonly sideChat: (messages: readonly unknown[], signal?: AbortSignal) => Promise<string>;
  readonly signal?: AbortSignal;
}): Promise<CriticRun> {
  const t0 = Date.now();
  const text = criticPrompt(input.task, input.type, input.map.name, input.map, pngSize(input.image), input.others.map((o) => o.name));
  const reply = await input.sideChat([{ role: "user", content: [
    { type: "text", text },
    { type: "image_url", image_url: { url: input.image } },
    ...input.others.map((o) => ({ type: "image_url", image_url: { url: o.image } })),
  ] }], input.signal);
  return { verdict: parseFeatureCritic(reply, input.map.id, 1 + input.others.length), ms: Date.now() - t0 };
}
