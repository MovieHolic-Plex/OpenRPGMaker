// 월드맵 키트 지도의 지형 태그 (2026-10-15, FF6급 감사 #29·#28).
//
// 배경: edit_world_terrain 이 만든 세계 지도 칩셋은 모든 칸의 지형 태그가 0 이었다 — 그래서 (1) 지형별 조우율·전투 배경(terrain 레코드)이
// 세계 지도에서 한 번도 적용되지 않았고, (2) 바다·강 칸에 vehiclePassage 가 없어 배·뗏목이 못 다녔다.
// 칸 이름표(label, 키트가 정한 한국어 지형 이름)로 지형 종류를 정하고, 프로젝트 지형 목록(database.terrains)에 「월드 지형」 레코드를
// **뒤에 덧붙여** 그 번호(1부터)를 칸 태그로 쓴다. 기존 레코드의 순서·내용은 건드리지 않는다(태그 N = terrains[N-1]).
import type { DatabaseTerrainRecord, Project } from "./types";

export type WorldTerrainKind = "sea" | "river" | "plains" | "road" | "forest" | "desert" | "snow" | "swamp" | "wasteland" | "volcano" | "mountain";

interface Spec {
  readonly key: WorldTerrainKind;
  readonly name: string;
  readonly rate: number;
  readonly background?: string;
  readonly passage: DatabaseTerrainRecord["vehiclePassage"];
}

const LAND = { boat: false, ship: false, airshipLand: true } as const;

/** 세계 지형 종류 → 지형 레코드. 조우율은 길 40%·숲·늪 140%·황무지·화산 160%(들판 100% 기준), 전투 배경은 번들 전투 배경 중 가장 가까운 것. */
export const WORLD_TERRAIN_SPECS: readonly Spec[] = [
  { key: "sea", name: "세계 바다", rate: 100, background: "battle-scenery-plains", passage: { boat: true, ship: true, airshipLand: false, raft: false } },
  { key: "river", name: "세계 강", rate: 100, background: "battle-scenery-forest", passage: { boat: true, ship: false, airshipLand: false, raft: true } },
  { key: "plains", name: "세계 초원", rate: 100, background: "battle-scenery-plains", passage: { ...LAND } },
  { key: "road", name: "세계 길", rate: 40, background: "battle-scenery-plains", passage: { ...LAND } },
  { key: "forest", name: "세계 숲", rate: 140, background: "battle-scenery-forest", passage: { ...LAND, chocobo: true } },
  { key: "desert", name: "세계 사막", rate: 120, background: "battle-scenery-desert", passage: { ...LAND } },
  { key: "snow", name: "세계 설원", rate: 120, background: "battle-scenery-snow", passage: { ...LAND } },
  { key: "swamp", name: "세계 늪", rate: 140, background: "battle-scenery-forest", passage: { ...LAND } },
  { key: "wasteland", name: "세계 황무지", rate: 160, background: "battle-scenery-cave", passage: { ...LAND } },
  { key: "volcano", name: "세계 화산지대", rate: 160, background: "battle-scenery-cave", passage: { ...LAND } },
  { key: "mountain", name: "세계 산지", rate: 160, background: "battle-scenery-cave", passage: { ...LAND, chocobo: false } },
];

export const WORLD_TERRAIN_ID_PREFIX = "terrain_world_";

export function worldTerrainRecordId(kind: WorldTerrainKind): string {
  return `${WORLD_TERRAIN_ID_PREFIX}${kind}`;
}

/**
 * 키트 칸 이름표(한국어) → 지형 종류. 알 수 없는 이름은 undefined(태그 0 = 보통 땅).
 * 바다·호수·강은 가장자리 변형(「바다·호수 · 초원」)까지 같은 종류다. 해안(「초원 해안」)은 땅이다.
 */
export function worldTerrainKindOfLabel(label: string | undefined): WorldTerrainKind | undefined {
  if (!label) return undefined;
  const head = label.split(" · ")[0]!.trim();
  if (label.startsWith("다리")) return "road";
  if (head === "바다" || head.startsWith("바다·호수")) return "sea";
  if (head === "강") return "river";
  if (label.includes("해안")) return undefined;
  if (head === "길") return "road";
  if (/숲|수림/.test(head)) return head.includes("눈") ? "snow" : head.includes("죽은") || head.includes("고사") ? "wasteland" : "forest";
  if (/눈 산|산맥|^산$|메사|협곡|^산지/.test(head)) return "mountain";
  if (/모래|사구|사막|모래언덕/.test(head)) return "desert";
  if (/^눈$|설원|빙하|툰드라/.test(head)) return "snow";
  if (/늪|습지|독물|독수/.test(head)) return "swamp";
  if (/용암|화산|분화구|현무암|^재$|화산재/.test(head)) return "volcano";
  if (/황무지|^흙$|붉은 협곡토/.test(head)) return "wasteland";
  if (/초원|밭|사바나|정글|경사로|푸른/.test(head)) return "plains";
  return undefined;
}

/** 세계 지형 레코드가 프로젝트 지형 목록에 있게 하고 종류 → 태그(1부터)를 돌려준다. 없는 레코드만 뒤에 덧붙인다. */
export function ensureWorldTerrainRecords(project: Pick<Project, "database">): Record<WorldTerrainKind, number> {
  const terrains = (project.database.terrains ??= []);
  const tags = {} as Record<WorldTerrainKind, number>;
  for (const spec of WORLD_TERRAIN_SPECS) {
    const id = worldTerrainRecordId(spec.key);
    let index = terrains.findIndex((record) => record.id === id);
    if (index < 0) {
      terrains.push({
        id, name: spec.name, damage: 0, encounterRatePercent: spec.rate,
        ...(spec.background ? { battleBackgroundResourceId: spec.background } : {}),
        characterDisplay: "normal",
        vehiclePassage: { ...spec.passage },
      });
      index = terrains.length - 1;
    }
    tags[spec.key] = index + 1;
  }
  return tags;
}
