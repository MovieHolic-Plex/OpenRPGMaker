// start/conceptFeed/stageArt.ts
// 컨셉 카드의 「무대」 그림 — 그 컨셉이 실제로 지어질 번들 칩셋의 등록 장소 그림(480×270, 원본 화소 그대로 자른 것).
// 굽기: scripts/content/bake-home-stage-art.py → public/assets/start/stages/. 무대 그림이 없는 칩셋은 null(생성 일러스트를 그대로 쓴다).
import type { GameConcept } from "@/concepts/format";

const BASE = "/assets/start/stages/";

const STAGES: Readonly<Record<string, readonly string[]>> = {
  joseon_baram: ["joseon-town", "joseon-palace", "joseon-field", "joseon-inn"],
  jp_city: ["jp-shopstreet", "jp-town", "jp-tram", "jp-school"],
  wizarding_world: ["wz-library", "wz-common", "wz-potions", "wz-greenhouse"],
};

function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) value = Math.imul(value ^ text.charCodeAt(index), 16777619);
  return value >>> 0;
}

/**
 * 같은 컨셉은 한 화면 안에서 늘 같은 장면. 같은 칩셋 컨셉이 나란히 같은 그림이 되지 않게
 * 처음 본 순서대로 그 칩셋의 장면을 돌려 쓴다(슬러그 해시만으로는 20장 중 셋이 한 장면에 몰렸다 — 2026-10-20 캡처).
 */
const seen = new Map<string, number>();
const perTileset = new Map<string, number>();

export function conceptStageArt(concept: Pick<GameConcept, "slug" | "tilesetHint">): string | null {
  const tileset = concept.tilesetHint ?? "";
  const list = STAGES[tileset];
  if (!list || list.length === 0) return null;
  const key = `${tileset}\u0000${concept.slug}`;
  let nth = seen.get(key);
  if (nth === undefined) {
    const used = perTileset.get(tileset) ?? 0;
    nth = (hash(tileset) + used) % list.length;
    perTileset.set(tileset, used + 1);
    seen.set(key, nth);
  }
  return BASE + list[nth] + ".png";
}
