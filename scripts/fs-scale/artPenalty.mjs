/**
 * 그림 감점 두 계열 — 읽기 전용, 모델 호출 0, 네트워크 0. 점수에서 계열당 5점을 빼고 상한은 10점이다(오너 2026-11-10 「크게 감점」).
 *
 *   npc-chipset  — 실제 맵에 놓인 무리의 적 그림(monsterResourceId)이 사람·캐릭터 시트(액터·NPC 칩)이면 해당한다. 필드에 선 상징(이벤트 그림)은
 *                  보지 않는다: 몬스터 프리셋의 트레이너는 사람 칩으로 서 있고 전투 그림은 몬스터라 해당하지 않는다.
 *   map-lookalike — 한 게임 안의 맵들이 서로 같은 타일 분포다. 맵마다 타일 id 분포(아래층·위층)의 코사인이 SIMILAR_COSINE 이상인 쌍을 센다.
 *                  시작 맵과 참조 프리셋 맵(id 접두 map_ref_)은 뺀다. 맵이 적으면(<= FEW_MAPS) 비슷한 쌍이 MIN_SIMILAR_PAIRS 개 이상이면 해당하고,
 *                  맵이 많으면 쌍 총수 대비 비율이 SIMILAR_SHARE 이상일 때만 해당한다(맵이 많다는 이유만으로 벌 받지 않게).
 *
 * 임계는 오너가 정했다: 0.97(숲-숲 0.987 ↔ 마을-숲 ~0, 실제 화면 18장으로 확인), 3쌍, 계열당 -5, 상한 -10.
 */

export const SIMILAR_COSINE = 0.97;
export const EXTRA_COSINE = 0.99;
export const MIN_SIMILAR_PAIRS = 3;
export const FEW_MAPS = 8;
export const SIMILAR_SHARE = 0.5;
export const PENALTY_PER_FAMILY = 5;
export const PENALTY_CAP = 10;

const CHARACTER_SHEET = /(^|[-_])(charset[-_]?(actor|people|modern|npc)|actor|people)\d*([-_]|$)|^easyrpg-charset-actor|^oprn-charset|^tex_.*charset_(people|actor)|^shared-.*(bust|people)/iu;
// charset-battler-* 는 걷기 칩 사람 그림을 전투용으로 다시 그린 시트(charsetBattlers.ts)라 «NPC 걷기 칩을 몬스터로 쓴 것» 이 아니다.
const MONSTER_ART = /^(generated-enemy-|harness-monster-|easyrpg-monster|monster[-_]|charset-battler-)/iu;

/** 이 그림 id 가 사람·캐릭터 시트인가(몬스터 그림 접두가 먼저 이긴다). */
export function isCharacterSheetId(id) {
  if (typeof id !== "string" || !id) return false;
  if (MONSTER_ART.test(id)) return false;
  return CHARACTER_SHEET.test(id);
}

function walk(node, visit) {
  if (Array.isArray(node)) { for (const item of node) walk(item, visit); return; }
  if (node && typeof node === "object") {
    visit(node);
    for (const key of Object.keys(node)) walk(node[key], visit);
  }
}

/** 실제 맵(이벤트 전투·조우표·필드 스폰)에 놓인 무리 id. */
export function placedTroopIds(doc) {
  const ids = new Set();
  for (const map of Object.values(doc.maps ?? {})) {
    walk(map.events ?? [], (item) => {
      if (item.kind === "battleProcessing" && typeof item.troopId === "string") ids.add(item.troopId);
    });
    for (const entry of map.encounterTable ?? []) if (typeof entry?.troopId === "string") ids.add(entry.troopId);
    for (const id of map.troopIds ?? []) if (typeof id === "string") ids.add(id);
    for (const spawn of map.fieldSpawns ?? []) if (typeof spawn?.troopId === "string") ids.add(spawn.troopId);
  }
  return ids;
}

/** 사람·캐릭터 시트를 적 그림으로 쓰는 적: [{ enemyId, name, resourceId, troopId }]. */
export function characterSheetEnemies(doc) {
  const troops = new Map((doc.database?.troops ?? []).map((troop) => [troop.id, troop]));
  const enemies = new Map((doc.database?.enemies ?? []).map((enemy) => [enemy.id, enemy]));
  const hits = [];
  const seen = new Set();
  for (const troopId of placedTroopIds(doc)) {
    const troop = troops.get(troopId);
    const enemyIds = troop?.enemyIds?.length ? troop.enemyIds : (troop?.members ?? []).map((member) => member.enemyId);
    for (const enemyId of enemyIds ?? []) {
      const enemy = enemies.get(enemyId);
      if (!enemy || seen.has(enemyId)) continue;
      // walkChip 이 있으면 전투에는 그 걷기 칩이 선다(monsterResourceId 대신) — 사람 시트를 적으로 쓰는 가장 직접적인 길.
      const resourceId = enemy.walkChip?.characterResourceId ?? enemy.monsterResourceId;
      if (enemy.walkChip?.characterResourceId || isCharacterSheetId(resourceId)) {
        seen.add(enemyId);
        hits.push({ enemyId, name: enemy.name ?? enemyId, resourceId, troopId });
      }
    }
  }
  return hits;
}

function tileDistribution(map) {
  const set = typeof map.tilesetId === "string" ? map.tilesetId : "";
  const counts = new Map();
  let total = 0;
  for (const [layer, key] of [["l", "lowerTiles"], ["u", "upperTiles"]]) {
    const tiles = map[key];
    if (!Array.isArray(tiles)) continue;
    for (const tile of tiles) {
      if (typeof tile !== "number" || tile < 0) continue;
      const id = `${set}:${layer}${tile}`;
      counts.set(id, (counts.get(id) ?? 0) + 1);
      total += 1;
    }
  }
  const out = new Map();
  for (const [id, n] of counts) out.set(id, n / (total || 1));
  return out;
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (const value of a.values()) na += value * value;
  for (const value of b.values()) nb += value * value;
  for (const [id, value] of a) dot += value * (b.get(id) ?? 0);
  return na > 0 && nb > 0 ? dot / Math.sqrt(na * nb) : 0;
}

/** 서로 비슷한 맵 쌍. 시작 맵·참조 프리셋 맵(map_ref_ 접두)은 뺀다. */
export function similarMapPairs(doc, threshold = SIMILAR_COSINE) {
  const maps = Object.entries(doc.maps ?? {})
    .filter(([key, map]) => Array.isArray(map?.lowerTiles) && map.lowerTiles.length > 0 && key !== doc.startMapId && !key.startsWith("map_ref_"))
    .map(([, map]) => map);
  const dist = maps.map((map) => tileDistribution(map));
  const pairs = [];
  const partnered = new Set();
  let total = 0;
  for (let i = 0; i < maps.length; i += 1) for (let j = i + 1; j < maps.length; j += 1) {
    total += 1;
    const sim = cosine(dist[i], dist[j]);
    if (sim >= threshold) {
      partnered.add(i);
      partnered.add(j);
      pairs.push({ a: maps[i].name ?? maps[i].id, b: maps[j].name ?? maps[j].id, cosine: Math.round(sim * 1000) / 1000 });
    }
  }
  return { maps: maps.length, totalPairs: total, pairs, partnered: partnered.size };
}

/** 게임 하나의 그림 감점. 읽기 전용. */
export function artPenalty(doc) {
  const characterEnemies = characterSheetEnemies(doc);
  const similar = similarMapPairs(doc);
  const extra = similarMapPairs(doc, EXTRA_COSINE);
  const share = similar.totalPairs > 0 ? similar.pairs.length / similar.totalPairs : 0;
  const lookalike = similar.maps <= FEW_MAPS ? similar.pairs.length >= MIN_SIMILAR_PAIRS : share >= SIMILAR_SHARE && similar.pairs.length >= MIN_SIMILAR_PAIRS;
  const families = [];
  if (characterEnemies.length > 0) families.push("npc-chipset");
  if (lookalike) families.push("map-lookalike");
  return {
    penalty: Math.min(PENALTY_CAP, families.length * PENALTY_PER_FAMILY),
    families,
    npcChipset: { hits: characterEnemies.length, enemies: characterEnemies.slice(0, 6) },
    mapLookalike: { partnerShare: similar.maps > 0 ? Math.round((similar.partnered / similar.maps) * 1000) / 1000 : 0, maps: similar.maps, similarPairs: similar.pairs.length, extraPairs099: extra.pairs.length, totalPairs: similar.totalPairs, share: Math.round(share * 1000) / 1000, pairs: similar.pairs.slice(0, 6) },
    lines: [
      ...(characterEnemies.length > 0 ? [`art: npc-chipset −${PENALTY_PER_FAMILY} — 적 ${characterEnemies.slice(0, 3).map((hit) => `${hit.name}(${hit.resourceId})`).join(", ")} 이 사람·캐릭터 시트 그림`] : []),
      ...(lookalike ? [`art: map-lookalike −${PENALTY_PER_FAMILY} — 비슷한 맵 쌍 ${similar.pairs.length}/${similar.totalPairs}(코사인 ≥ ${SIMILAR_COSINE}): ${similar.pairs.slice(0, 3).map((pair) => `${pair.a}↔${pair.b}`).join(", ")}`] : []),
    ],
  };
}

/** 점수에 감점을 적용한다(0 아래로는 내리지 않는다). */
export function applyArtPenalty(score, penalty) {
  return Math.max(0, Math.round((score - penalty.penalty) * 10) / 10);
}
