// 어느 칩셋에서나 통하는 「빈 야외 땅」 판독과 그 칩셋의 야외 소품 고르기.
//
// 왜: 빈 터 찾기·채우기(kitAreaFurnish.ts)는 바닥 이름표 다섯 가지(눈밭·사막 모래·재 덮인 풀·풀밭·모래 — 몬스터 수집 시트)만 땅으로 셌다.
//   그 밖의 칩셋(설원·사막·스팀펑크…)으로 지은 야외 맵 13장이 전부 「맨땅 0% · 빈 터 없음」이었다(2026-11-11 구조 재점검 3-1).
// 무엇을: 이름표가 아니라 칸 정보로 읽는다 — 걸을 수 있는 지형 칸이고, 실내 바닥·길·물이 아닌 칸이 빈 야외 땅이다.
//   놓을 것은 그 칩셋의 구조 키트 가운데 야외 소품(role prop)에서 고른다.
//   칸 역할(role)을 안 적는 시트(버들항 beodeul_city — 3.8만 칸 전부 role 없음)는 땅 꼬리표(grass·sand)와 통행(passable)으로 읽는다.
//   2026-11-11 작은 일 재측정: 버들항 마을(풀밭 432칸)이 「맨땅 0%」 로 읽혀 조수가 나무를 맵 모서리 (0,0) 에 찍었다.
import { isPassable } from "@/project/collision";
import type { GameMap, Project, TilesetDef } from "@/project/types";

/** 이름표를 모르는 칩셋의 빈 야외 땅을 가리키는 바닥 이름(구획·조각이 «같은 바닥» 을 비교할 때 쓴다). */
export const OPEN_GROUND = "open ground";

/** 땅이 아닌 지형 칸의 꼬리표(칩셋 tileMeta.tags 의 낱말 그대로): 걷는 줄(길·보도·선로·다리·부두), 포장한 바닥(포석·광장), 물·얼음·구름. */
const NOT_GROUND_TAGS = new Set([
  "길", "흙길", "눈길", "돌길", "가도", "참배길", "대상로", "다진 눈길", "보도", "인도", "보행로", "골목", "차도", "도로", "차선", "횡단보도", "아스팔트",
  "선로", "철도", "궤도", "레일", "트랙", "연석", "경계석", "다리", "부두", "잔교", "갑판", "방파제", "판자", "계단", "돌계단", "승강장", "정거장", "착륙장", "안내선", "주차장",
  "road", "path", "walk", "sidewalk", "parking",
  "포석", "광장", "판석", "포장", "콘크리트", "줄눈",
  "물", "물가", "호수", "강", "얼음", "얼어붙은 호수·강", "운하", "늪", "용암", "웅덩이", "물웅덩이", "물거품", "바다", "구름", "하늘", "water", "lava", "swamp",
]);
/** 꼬리표가 성긴 오토타일 칸은 이름표 끝말로 한 번 더 거른다(「다진 눈길 (모양 255)」·「얼어붙은 호수·강 속 변형」). */
const NOT_GROUND_LABEL = /길(?![가-힣])|호수|얼어붙은|얼음|물가|용암|늪/u;
const INDOOR = /실내|interior|indoor/iu;
/** 칸 역할을 안 적는 시트에서 «땅» 을 뜻하는 꼬리표. */
const GROUND_TAGS = new Set(["grass", "풀밭", "sand", "모래", "dirt", "흙", "snow", "눈밭"]);
/** 나무·덤불·바위처럼 맨땅에 흩어 두는 자연 소품(키트 tags 로 가른다). 영어 낱말은 앞뒤가 글자가 아닐 때만(fld_rock_s 는 된다) — «prop-street» 의 tree 가 가로등·신호등·자판기를 나무로 만들었다. */
const NATURE = /나무|숲|덤불|풀|꽃|바위|돌|선인장|야자|고사리|버섯|수정|그루터기|(?<![a-z])(?:trees?|bush(?:es)?|shrubs?|rocks?|boulders?|stones?|flowers?|grass|cactus|palms?|ferns?|mushrooms?|stumps?|logs?)(?![a-z])/iu;
/** 어느 한 장소·던전 주제에 딸린 소품(사막 마을의 대추야자, 숲 던전의 룬 선돌) — 이름을 대지 않으면 고르지 않는다. */
const THEMED = /장소|던전|dungeon|주제/iu;

type Meta = { label?: string; role?: string; passage?: string; tags?: readonly string[] };

/** 빈 야외 땅이 될 수 있는 타일인가(걸을 수 있는 지형 칸, 실내 바닥·길·물이 아니다). */
function openGroundTile(tileset: TilesetDef, tile: number): boolean {
  const meta = tileset.tileMeta?.[tile] as Meta | undefined;
  if (!meta) return false;
  const tags = meta.tags ?? [];
  if (meta.role === undefined ? meta.passage !== "passable" || !tags.some((tag) => GROUND_TAGS.has(tag)) : meta.role !== "terrain") return false;
  return !tags.some((tag) => INDOOR.test(tag) || NOT_GROUND_TAGS.has(tag)) && !NOT_GROUND_LABEL.test(meta.label ?? "");
}

/** 칸마다 1 = 빈 야외 땅이 될 수 있는 바닥(위층·이벤트는 부르는 쪽이 본다). 실내 맵이면 전부 0. */
export function openGroundCells(project: Project, map: GameMap): Uint8Array {
  const out = new Uint8Array(map.width * map.height);
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset || map.mapRole === "interior" || map.mapRole === "dungeon") return out;
  const cache = new Map<number, boolean>();
  for (let i = 0; i < out.length; i++) {
    const tile = map.lowerTiles[i]!;
    let ok = cache.get(tile);
    if (ok === undefined) { ok = openGroundTile(tileset, tile); cache.set(tile, ok); }
    if (ok && isPassable(project, map, i % map.width, Math.floor(i / map.width))) out[i] = 1;
  }
  return out;
}

export interface OpenGroundProps {
  /** 키가 2칸 이상인 자연 소품(나무·큰 바위) — 덩이로 심는다. */
  readonly trees: readonly string[];
  /** 키가 2칸 이상인 그 밖의 소품(가로등·우물·동상) — 부르는 쪽이 골랐을 때만. */
  readonly features: readonly string[];
  /** 한 줄짜리 작은 소품(덤불·꽃·잔돌·통). */
  readonly smalls: readonly string[];
  /** 고른 이름 가운데 이 칩셋의 야외 소품에서 못 찾은 것. */
  readonly unknown: readonly string[];
  /** 이 칩셋의 야외 소품 이름 전부(못 찾았을 때 일러 줄 목록). */
  readonly all: readonly string[];
}

/**
 * 이 칩셋의 야외 소품 키트 이름. wanted(키트 id·이름·이름 일부)를 주면 그것만, 없으면 자연 소품(나무·덤불·바위)만 고른다 —
 * 가로등·노점·낙타 같은 것은 어디에 둘지 뜻이 있어야 하므로 기본으로 흩지 않는다.
 */
export function openGroundProps(tileset: TilesetDef, wanted?: readonly string[]): OpenGroundProps {
  const kits = (tileset.structureKits ?? []).filter((kit): kit is typeof kit & { name: string } => {
    if (!kit.name) return false;
    const ai = kit.ai as { role?: string; tags?: readonly string[]; access?: unknown } | undefined;
    if (ai?.role !== "prop" || ai.access !== undefined || INDOOR.test((ai.tags ?? []).join(" "))) return false;
    if (kit.width > 3 || kit.height > 4) return false;
    return kit.rows.some((row) => (row.upperTiles ?? []).some((tile) => tile >= 0));
  });
  const tagsOf = (kit: (typeof kits)[number]) => ((kit.ai as { tags?: readonly string[] } | undefined)?.tags ?? []).join(" ");
  const nature = (kit: (typeof kits)[number]) => NATURE.test(tagsOf(kit));
  const all = kits.map((kit) => kit.name);
  const unknown: string[] = [];
  // 기본 고르기는 어디에나 어울리는 자연 소품만 — 한 장소에 딸린 것까지 섞으면 풀밭 마을에 대추야자와 설원 소나무가 같이 선다. 전부가 딸린 것이면 그대로 쓴다.
  const plain = kits.filter((kit) => nature(kit) && !THEMED.test(tagsOf(kit)));
  let chosen = plain.length ? plain : kits.filter(nature);
  if (wanted?.length) {
    chosen = [];
    for (const want of wanted) {
      const key = want.trim().toLowerCase();
      const hit = kits.filter((kit) => kit.id.toLowerCase() === key || kit.name.toLowerCase() === key);
      // 이름 일부로 찾을 때는 어디에나 어울리는 자연 소품이 먼저다 — «나무» 가 대추야자·설원 소나무·나무 벤치까지 부르지 않게. 없으면 자연 소품, 그것도 없으면 이름이 맞는 것 전부.
      const named = hit.length ? [] : kits.filter((kit) => key.length >= 2 && kit.name.toLowerCase().includes(key));
      // 낱말로 든 것이 먼저다(«나무» 는 「버들항 나무」 이지 「통나무」 가 아니다).
      const asWord = named.filter((kit) => kit.name.toLowerCase().split(/[\s·:,()]+/u).includes(key));
      const partial = asWord.length ? asWord : named;
      const tiers = [partial.filter((kit) => plain.includes(kit)), partial.filter(nature), partial];
      const found = hit.length ? hit : tiers.find((tier) => tier.length) ?? [];
      if (!found.length) unknown.push(want);
      for (const kit of found) if (!chosen.includes(kit)) chosen.push(kit);
    }
  }
  const tall = chosen.filter((kit) => kit.height >= 2);
  return {
    trees: tall.filter(nature).map((kit) => kit.name),
    features: tall.filter((kit) => !nature(kit)).map((kit) => kit.name),
    smalls: chosen.filter((kit) => kit.height === 1).map((kit) => kit.name),
    unknown, all,
  };
}
