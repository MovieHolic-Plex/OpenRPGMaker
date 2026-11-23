// 장면 키트 — 장소 낱말(편의점 앞·수산시장·조선 장터…)을 「같이 놓이는 기물」 역할 칸으로 바꾼다.
// 측정(2026-11-23 object-search 레인, Sonnet 5.5): 놓친 개념의 가장 큰 몫은 「목록에 있었는데 안 고름」이었다 — 편의점 앞 밤거리에서
// 편의점 건물만 고르고 쓰레기통·파라솔 탁자를 안 썼고, 수산시장에서 손저울·그물 바구니를 안 골랐다. 장소 낱말로만 찾으면 물건 이름에
// 그 낱말이 없어 목록 뒤로 밀리거나(어휘) 건물 변형이 앞을 채운다. 장면 키트는 역할 칸(건물·바닥 소품·생활 소품·조명·자연)마다
// 물건 낱말과 그 낱말에 맞는 기물 몇 개를 보여 줘서, 모델이 역할마다 하나씩 고르게 한다.
// 사전 src/assets/objectScenes.json: 장소마다 사람이 말하는 낱말(triggers)과 역할별 일상 물건 낱말. 카탈로그에 없는 낱말은 키트에서 빠진다.
import scenesData from "@/assets/objectScenes.json";

export type SceneRole = "structure" | "floor" | "life" | "light" | "nature";

export const SCENE_ROLES: readonly { readonly role: SceneRole; readonly label: string; readonly pick: string }[] = [
  { role: "structure", label: "건물·큰 구조", pick: "1~2" },
  { role: "floor", label: "바닥 소품", pick: "3~5" },
  { role: "life", label: "생활 소품", pick: "3~5" },
  { role: "light", label: "조명·간판", pick: "1~2" },
  { role: "nature", label: "자연", pick: "1~3" },
];

export interface ObjectScene {
  readonly place: string;
  readonly triggers: readonly string[];
  readonly roles: Readonly<Record<SceneRole, readonly string[]>>;
}

export const OBJECT_SCENES: readonly ObjectScene[] = (scenesData as { scenes: ObjectScene[] }).scenes;

const norm = (value: string) => value.toLocaleLowerCase().replace(/\s+/gu, " ").trim();
const squash = (value: string) => norm(value).replace(/ /gu, "");

/**
 * 글에 든 장면. 가장 긴 trigger 가 맞는 장면 하나(같은 길이면 사전 순서). 띄어쓰기는 무시한다(「편의점앞」 = 「편의점 앞」).
 * 두 글자 미만 trigger 는 쓰지 않는다 — 「절」「독」 같은 한 글자는 다른 낱말 속에 너무 자주 든다(「절벽」「독서대」).
 */
export function findObjectScene(...texts: readonly (string | undefined)[]): { scene: ObjectScene; trigger: string } | undefined {
  const hay = texts.filter((text): text is string => Boolean(text && text.trim())).map(squash).join("|");
  if (!hay) return undefined;
  // 장면 이름 자체가 맞으면 다른 장면의 비슷한 말보다 앞선다 — 「수산시장 골목」은 전통시장의 「시장 골목」이 아니라 수산시장,
  // 「사당 기도터」는 신전의 「기도터」가 아니라 사당이다.
  let best: { scene: ObjectScene; trigger: string; length: number; own: boolean } | undefined;
  for (const scene of OBJECT_SCENES) {
    for (const trigger of [scene.place, ...scene.triggers]) {
      const key = squash(trigger);
      if (key.length < 2 || !hay.includes(key)) continue;
      const own = key === squash(scene.place);
      if (!best || Number(own) - Number(best.own) > 0 || (own === best.own && key.length > best.length)) best = { scene, trigger, length: key.length, own };
    }
  }
  return best && { scene: best.scene, trigger: best.trigger };
}

export interface SceneCandidate {
  readonly id: string;
  readonly name: string;
  readonly tilesetId: string | null;
  readonly tags: readonly string[];
  readonly width?: number;
  readonly height?: number;
}

export interface SceneKitSlot<T> {
  readonly role: SceneRole;
  readonly label: string;
  readonly pick: string;
  readonly items: readonly { readonly word: string; readonly rows: readonly T[] }[];
}

export interface SceneKit<T> {
  readonly place: string;
  readonly trigger: string;
  readonly slots: readonly SceneKitSlot<T>[];
  /** 기본 장면 한 벌: 칸을 돌아가며 낱말마다 첫 행 하나(건물 1 → 바닥 → 생활 → 조명 → 자연 → 바닥 …). 같은 물건을 두 번 넣지 않는다. */
  readonly suggested: readonly T[];
}

const SUGGESTED_SIZE = 10;

function suggestScene<T>(slots: readonly SceneKitSlot<T>[]): T[] {
  const out: T[] = [];
  const queues = slots.map(slot => ({ role: slot.role, rows: slot.items.map(item => item.rows[0]!).slice(0, slot.role === "structure" ? 1 : undefined) }));
  for (let round = 0; out.length < SUGGESTED_SIZE && queues.some(queue => queue.rows.length > round); round += 1) {
    for (const queue of queues) {
      const row = queue.rows[round];
      if (row && out.length < SUGGESTED_SIZE) out.push(row);
    }
  }
  return out;
}

/** 물건 낱말이 기물 이름에 든다(낱말 여럿이면 모두). 이름이 「버들항 기물 · 저울 · …」처럼 접두를 달고 있어도 맞다. */
export function nameHasWord(name: string, word: string): boolean {
  const target = norm(name);
  return word.split("|").some(alternative => {
    const parts = norm(alternative).split(" ").filter(Boolean);
    return parts.length > 0 && parts.every(part => target.includes(part));
  });
}

/** 사전 낱말은 「항아리|독|옹기」처럼 같은 물건의 다른 이름을 | 로 잇는다 — 보여 줄 때는 첫 이름만. */
export const sceneWordLabel = (word: string) => word.split("|")[0]!;

/**
 * 장면 키트를 만든다. 낱말마다 그 낱말이 이름에 든 기물 중 `perWord` 개를 고른다 — 질의의 다른 낱말(「조선」「밤거리」…)이
 * 이름·태그에 더 많이 든 행, 그다음 넘겨받은 순서(도구의 순위·계열 선호)를 따른다. 한 기물은 키트에 한 번만 나온다.
 * 기물이 하나도 없는 낱말·칸은 뺀다.
 */
export function buildSceneKit<T extends SceneCandidate>(
  found: { scene: ObjectScene; trigger: string },
  candidates: readonly T[],
  contextWords: readonly string[],
  options: { perWord?: number; perRole?: number } = {},
): SceneKit<T> {
  // 측정(Sonnet 5.5 각 3회): 낱말당 2행·칸당 6낱말이 낱말당 1행·8낱말이나 칸마다 2~5낱말로 줄인 것보다 나았다.
  const perWord = options.perWord ?? 2;
  const perRole = options.perRole ?? 6;
  const triggerKey = squash(found.trigger);
  const context = contextWords.map(norm).filter(word => word.length >= 1 && !triggerKey.includes(squash(word)));
  const contextScore = (row: T) => {
    const fields = [row.name, ...row.tags].map(norm);
    return context.filter(word => fields.some(field => field.includes(word))).length;
  };
  const scored = candidates.map((row, index) => ({ row, index, score: contextScore(row) }));
  const used = new Set<string>();
  const slots: SceneKitSlot<T>[] = [];
  for (const { role, label, pick } of SCENE_ROLES) {
    const items: { word: string; rows: T[] }[] = [];
    for (const word of found.scene.roles[role] ?? []) {
      if (items.length >= perRole) break;
      const rows = scored.filter(entry => !used.has(entry.row.id) && nameHasWord(entry.row.name, word))
        .sort((a, b) => b.score - a.score || a.index - b.index).slice(0, perWord).map(entry => entry.row);
      if (!rows.length) continue;
      for (const row of rows) used.add(row.id);
      items.push({ word: sceneWordLabel(word), rows });
    }
    if (items.length) slots.push({ role, label, pick, items });
  }
  return { place: found.scene.place, trigger: found.trigger, slots, suggested: suggestScene(slots) };
}
