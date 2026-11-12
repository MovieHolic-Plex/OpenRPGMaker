// 청사진 기본 오프닝 — 게임의 실제 맵(map-view) 장면 2~4개 + 청사진 문장으로 다듬은 짧은 내레이션(2026-10-28 스위트 조립 장부).
//
// 장부·턴 기록: 장르와 무관한 프리셋 그림(왕국·마왕성·벽난로 노인), 회화풍 스틸과 도트 게임의 화풍 불일치, 오프닝이 아예 없거나 꺼짐.
// 청사진이 있으면 결정적으로 짓는다: 시작 장소 전경 → 청사진 다음 장소 1~2곳 → 시작 장소의 주인공 시작 위치. 글은 플레이어에게 쓴 줄
// (playerGoal — 구절 단위로 나눈다)과 장소 이름뿐이다 — 단계의 action · feeling 은 설계 메모라 싣지 않는다. 새 모델 호출 없음, 숫자·암호·정답 낱말이 든 문장은 뺀다.
// 모델이 직접 만든 오프닝(생성·업로드 그림, 맵 화면, 글 장면)은 건드리지 않는다. 기본값·꺼짐·없음·장르가 안 맞는 번들 스틸·캐릭터 시트일 때만.
// 2026-11-11 Terra 네 판 장부(오프닝 15줄): «인물이 한 명도 없고 대사도 없이 맵 조각만», «첫 프레임이 붉은 점무늬». 장면마다 그 맵에 처음부터 서 있는 사람을
// 제 칸에 그대로 세우고(걷는 연기는 붙이지 않는다 — 움직이는 오프닝은 author_opening_stage 몫), 자막을 장면 끝까지 두고, 전환은 cut 으로 둔다.
import { CHARSET_FRAME_COUNT, CHARSET_FRAME_HEIGHT, CHARSET_FRAME_WIDTH, CHARSET_SHEET_COLUMNS, charsetFrameIndex } from "@/assets/easyrpgRtp";
import { findOpeningStillMood } from "@/assets/openingStillMoods";
import { blueprintPremiseText, blueprintStoryText, pickTitleArtForStory } from "@/project/blueprintAssembly";
import type { GameBlueprint } from "@/project/gameBlueprint";
import { pageAtStart } from "@/project/eventPageNow";
import { openingMapViewCrop, openingMapViewMapId, openingMapViewResourceId } from "@/project/openingMapView";
import type { GameMap, Project } from "@/project/types";
import { titleMapFrame } from "@/player/titleMapFraming";
import { characterSheetKind } from "./cinematicTools";
import { OPENING_ANIMATIC_TOOLS } from "./openingAnimaticTools";

export const BLUEPRINT_OPENING_SHOT_PREFIX = "bp-open-";
const STAGE = { width: 384, height: 216 } as const;
const SHOT_MS = 4200;

/** 오프닝 장면들이 쓰는 그림 id(그림 장면 resourceId + 애니메틱 레이어 resourceId). */
function openingVisuals(project: Project): { ids: string[]; textOnly: boolean; ours: boolean } {
  const scenes = project.system.opening?.scenes ?? [];
  const ids: string[] = [];
  let textOnly = scenes.length > 0, ours = scenes.length > 0;
  for (const scene of scenes) {
    if (!String(scene.id ?? "").startsWith(BLUEPRINT_OPENING_SHOT_PREFIX)) ours = false;
    if (scene.kind !== "text") textOnly = false;
    const s = scene as { resourceId?: string; composition?: { layers?: { resourceId?: string }[] } };
    if (s.resourceId) ids.push(s.resourceId);
    for (const layer of s.composition?.layers ?? []) if (layer.resourceId) ids.push(layer.resourceId);
  }
  return { ids, textOnly, ours };
}

/**
 * 기본 오프닝으로 바꿔도 되는가: 없음·꺼짐·장면 0, 이 함수가 전에 지은 것, 또는 그림이 전부 «번들 스틸»(이야기에 강하게 맞지 않음)·캐릭터 시트뿐.
 * 생성·업로드 그림, 맵 화면, 글만 있는 장면은 모델이 만든 것으로 보고 둔다.
 */
export function blueprintOpeningReplaceable(project: Project): { replace: boolean; why: string } {
  const opening = project.system.opening;
  // 모델이 지은 엔진 무대(author_opening_stage)가 오프닝이다 — 그림 장면이 없어도 맵 조각 장면을 다시 깔지 않는다.
  if (opening?.stage && opening.enabled !== false) return { replace: false, why: "엔진 무대 오프닝(모델이 지은 것)" };
  if (!opening || !opening.scenes.length) return { replace: true, why: "오프닝이 없었다" };
  if (opening.enabled === false) return { replace: true, why: "오프닝이 꺼져 있었다" };
  const { ids, textOnly, ours } = openingVisuals(project);
  if (ours) return { replace: true, why: "전에 깐 기본 오프닝을 새 맵으로 다시" };
  if (textOnly || !ids.length) return { replace: false, why: "글 장면 오프닝(모델이 쓴 것)" };
  const blueprint = project.gameBlueprint;
  const strong = blueprint ? pickTitleArtForStory(blueprintPremiseText(project, blueprint), blueprintStoryText(project, blueprint))?.id : undefined;
  const bad = ids.every((id) => !openingMapViewMapId(id) && (characterSheetKind(project, id) !== undefined || (!!findOpeningStillMood(id) && id !== strong)));
  return bad ? { replace: true, why: `장르에 안 맞는 번들 그림·캐릭터 시트뿐이었다(${[...new Set(ids)].slice(0, 3).join(", ")})` } : { replace: false, why: "모델이 고른 그림 오프닝" };
}

/** 자막 한 줄의 길이(무대 384px · 11px 글꼴에서 두 줄 안). */
const CAPTION_CHARS = 46;

/**
 * 오프닝 자막 줄 — 새 플레이어 안내(playerGoal) 한 문장을 자르지 않고 구절(쉼표·문장 끝) 단위로 나눈다. 한 구절이 길면 이어 주는 어미 뒤나 가운데 어절 사이에서 고르게 나눈다(말줄임 없음).
 * 괄호·영문 식별자는 빼고, 숫자나 퍼즐 장치(정답·암호…)·제작 낱말(스위치·이벤트·플레이어)이 든 문장은 싣지 않는다(정답 누설 금지). 「게임이 시작되면」 머리는 지운다.
 * 왜: 전에는 46자에서 잘라 «…기관실의…» 로 끝났고, 나머지 장면에는 단계의 action · feeling(설계 메모)을 실었다(2026-11-12 증기의 심장).
 */
const size = (line: string) => Array.from(line).length;

/** 한 줄보다 긴 구절을 둘로 고르게 나눈다(되풀이) — 이어 주는 어미(…고 · …며 · …서 · …따라 · …위해) 뒤를 먼저, 없으면 가운데에 가장 가까운 어절 사이. */
function breakClause(clause: string): string[] {
  const words = clause.split(/\s+/u);
  if (size(clause) <= CAPTION_CHARS || words.length < 2) return [clause];
  const half = size(clause) / 2;
  let best = 1, bestCost = Infinity, at = 0;
  for (let i = 1; i < words.length; i += 1) {
    at += size(words[i - 1]!) + (i > 1 ? 1 : 0);
    const cost = Math.abs(at - half) - (/(?:고|며|서|면|따라|위해|지만|도록)$/u.test(words[i - 1]!) ? 8 : 0);
    if (cost < bestCost) { bestCost = cost; best = i; }
  }
  return [...breakClause(words.slice(0, best).join(" ")), ...breakClause(words.slice(best).join(" "))];
}

export function captionLines(text: string | undefined): string[] {
  if (!text) return [];
  const cleaned = text.replace(/\([^)]*\)|\[[^\]]*\]/gu, " ").replace(/\b[A-Za-z]+[_-][\w-]*\b/gu, " ")
    .replace(/\s*\d+\s*(?:자리|개|번째|번|층|칸|명|단계|일|시)(?=[\s을를이가의에은는도]|$)/gu, "");
  const sentences = cleaned.split(/(?<=[.!?。…])\s+|\s*\n\s*/u)
    .map((s) => s.replace(/^(?:게임이\s*시작되면|게임\s*시작\s*시|시작하면)\s*,?\s*/u, "").replace(/\s+/gu, " ").trim())
    .filter((s) => s && !/\d|숫자|힌트|정답|답은|(?:암호|비밀\s*번호|코드|조합)\s*(?:는|은|가|이)(?![가-힣])|패스워드|password|컷신|스위치|이벤트|플레이어|튜토리얼/iu.test(s));
  const out: string[] = [];
  for (const sentence of sentences) {
    let line = "";
    // 구절(쉼표 뒤)마다 이어 붙이다 한 줄을 넘으면 줄을 바꾼다. 구절 하나가 한 줄보다 길면 breakClause 가 나눈다.
    for (const clause of sentence.split(/(?<=[,，、])\s*/u).flatMap(breakClause)) {
      const next = line ? `${line} ${clause}` : clause;
      if (line && size(next) > CAPTION_CHARS) { out.push(line); line = clause; } else line = next;
    }
    if (line) out.push(line);
  }
  return out;
}

function mapForPlace(project: Project, place: string | undefined): GameMap | undefined {
  const name = place?.trim() ?? "";
  if (!name) return undefined;
  const maps = Object.values(project.maps);
  return project.maps[name] ?? maps.find((m) => m.name?.trim() === name)
    ?? (name.length >= 2 ? maps.find((m) => !!m.name?.trim() && (m.name.includes(name) || name.includes(m.name.trim()))) : undefined);
}

function drawable(project: Project, map: GameMap | undefined): map is GameMap {
  return !!map && !!project.tilesets[map.tilesetId] && map.width > 0 && map.height > 0 && map.upperTiles.concat(map.lowerTiles).some((t) => t !== map.lowerTiles[0]);
}

/** 맵의 볼 것이 가장 많은 창 가운데(오프닝 무대 384×216 기준) — 타이틀 틀 잡기와 같은 규칙. */
function busiestFocus(map: GameMap): { x: number; y: number } {
  const ts = map.tileSize || 16;
  const frame = titleMapFrame(map, undefined, map.width * ts, map.height * ts, STAGE.width, STAGE.height);
  const cx = (Math.min(STAGE.width, frame.width) / 2 - frame.x) / frame.scale / ts;
  const cy = (Math.min(STAGE.height, frame.height) / 2 - frame.y) / frame.scale / ts;
  return { x: Math.max(0, Math.min(map.width - 1, Math.floor(cx))), y: Math.max(0, Math.min(map.height - 1, Math.floor(cy))) };
}

type Shot = { map: GameMap; focus: { x: number; y: number }; zoom: number; hero?: boolean };
type Standing = { x: number; y: number; resourceId: string; frame: number; hero?: boolean };
/** 자막 띠(letterbox 0.15) 높이 — 이 안에 든 사람은 가려져 안 보인다. */
const BAR = Math.ceil(STAGE.height * 0.15);
/** 맵이 보이는 띠(자막 띠 사이). 배경은 이 띠에만 깐다 — 무대 전체에 깔면 맵 맨 아래·맨 위 줄(과 거기 선 사람)이 자막 띠 밑에 들어가 안 보인다. */
const BAND = { width: STAGE.width, height: STAGE.height - 2 * BAR } as const;
const shotCrop = (shot: Shot) => openingMapViewCrop(shot.map, BAND, shot.focus, shot.zoom);
/** 한 장면에 세우는 사람 수 상한(장면이 인물 그림으로 덮이지 않게). */
const MAX_CAST = 8;

/** 그 맵에 게임 시작부터 서 있는 사람 — 새 게임에서 도는 쪽(pageAtStart)의 그림이 사람 캐릭터 칩 한 칸인 이벤트(스위치 뒤에 나타나는 사람·몬스터·수정·상자는 뺀다). */
function standingPeople(project: Project, map: GameMap): Standing[] {
  const out: Standing[] = [];
  for (const event of map.events) {
    const page = pageAtStart(project, event);
    const sprite = page?.graphic?.sprite as { id?: string } | undefined;
    if (!page || page.graphic?.transparent || !sprite?.id) continue;
    if (!/charset/iu.test(sprite.id) || /monster|object|vehicle/iu.test(sprite.id) || typeof page.graphic?.pattern !== "number" || page.graphic.pattern >= CHARSET_FRAME_COUNT) continue;
    out.push({ x: event.x, y: event.y, resourceId: sprite.id, frame: page.graphic.pattern });
  }
  return out;
}

/** 주인공(시작 파티의 첫 배우)의 캐릭터 칩 — 아래를 보고 선 칸. */
function heroStanding(project: Project): Standing | undefined {
  const leadId = project.system.startActorIds?.[0] ?? project.database.actors[0]?.id;
  const actor = project.database.actors.find((a) => a.id === leadId) as { characterResourceId?: string; characterIndex?: number; characterTransparent?: boolean } | undefined;
  if (!actor?.characterResourceId || actor.characterTransparent || !project.startPos) return undefined;
  return { ...project.startPos, resourceId: actor.characterResourceId, frame: charsetFrameIndex({ characterIndex: actor.characterIndex ?? 0, direction: "down", pattern: 1 }), hero: true };
}

/** 그 장면의 무대 좌표로 옮긴 사람 그림 자리(왼쪽 위) — 자막 띠나 무대 밖에 걸리면 undefined. 발이 제 칸 바닥에 닿는다. */
function castSpot(shot: Shot, who: Standing): { x: number; y: number; scale: number } | undefined {
  const crop = shotCrop(shot), ts = shot.map.tileSize || 16;
  const stretch = BAND.width / crop.width, scale = Math.max(1, Math.round(stretch));
  const x = Math.round(((who.x + 0.5) * ts - crop.x) * stretch - (CHARSET_FRAME_WIDTH * scale) / 2);
  const y = BAR + Math.round(((who.y + 1) * ts - crop.y) * stretch - CHARSET_FRAME_HEIGHT * scale);
  if (x < 0 || x + CHARSET_FRAME_WIDTH * scale > STAGE.width || y < BAR || y + CHARSET_FRAME_HEIGHT * scale > STAGE.height - BAR) return undefined;
  return { x, y, scale };
}

/** 장면에 보이는 사람들(주인공 장면이면 주인공 먼저). */
function castOf(project: Project, shot: Shot): { who: Standing; at: { x: number; y: number; scale: number } }[] {
  const hero = shot.hero ? heroStanding(project) : undefined;
  return [...(hero ? [hero] : []), ...standingPeople(project, shot.map)]
    .map((who) => ({ who, at: castSpot(shot, who) }))
    .filter((c): c is { who: Standing; at: { x: number; y: number; scale: number } } => !!c.at)
    .slice(0, MAX_CAST);
}

/** 전경의 가운데 칸 — 볼 것이 많은 창(busiestFocus)과 사람이 선 칸들 가운데, 사람이 가장 많이 보이는 쪽(같으면 볼 것이 많은 창). */
function peopledFocus(project: Project, map: GameMap): { x: number; y: number } {
  const busiest = busiestFocus(map);
  let best = busiest, most = castOf(project, { map, focus: busiest, zoom: 1 }).length;
  for (const person of standingPeople(project, map)) {
    // 사람을 화면 아래쪽 삼분의 일에 둔다(위에 건물·광장이 보이게).
    const focus = { x: person.x, y: Math.max(0, person.y - 2) };
    const seen = castOf(project, { map, focus, zoom: 1 }).length;
    if (seen > most) { best = focus; most = seen; }
  }
  return best;
}

function run(project: Project, name: string, args: Record<string, unknown>): void {
  const tool = OPENING_ANIMATIC_TOOLS.find((t) => t.name === name);
  if (!tool?.run) throw new Error(`도구 ${name} 이 없다`);
  tool.run(project, args);
}

/**
 * 청사진 기본 오프닝을 깐다(바꿀 때만). 바꾼 설명을 돌려준다(안 바꿨으면 빈 배열). 도구를 그대로 불러 같은 검사를 거친다.
 * 맵이 아직 다 빈 프로젝트(청사진만 쓴 직후)는 건너뛴다 — 끝맺음 조립이 다시 부른다.
 */
export function applyBlueprintOpening(project: Project): string[] {
  const blueprint: GameBlueprint | undefined = project.gameBlueprint;
  if (!blueprint) return [];
  const start = project.maps[project.startMapId];
  if (!drawable(project, start)) return [];
  const verdict = blueprintOpeningReplaceable(project);
  if (!verdict.replace) return [];
  // 장소: 시작 맵 전경 → 청사진 다음 장소 1~2곳(시작 맵과 다른 맵) → 시작 맵의 주인공 시작 위치.
  const others: GameMap[] = [];
  for (const step of blueprint.steps) {
    const map = mapForPlace(project, step.place);
    if (!drawable(project, map) || map.id === start.id || others.some((o) => o.id === map.id)) continue;
    // 같은 장소의 층(「마왕의 동굴 지하 1층」·「…2층」)은 하나만 — 장면이 거의 같다.
    const stem = (name: string) => name.replace(/\s*(?:지하\s*)?\d+\s*층.*$|\s*[·:-].*$/u, "").trim();
    if (others.some((o) => stem(o.name ?? "") && stem(o.name ?? "") === stem(map.name ?? ""))) continue;
    others.push(map);
    if (others.length >= 2) break;
  }
  const startPos = project.startPos ?? { x: Math.floor(start.width / 2), y: Math.floor(start.height / 2) };
  // 전경은 사람이 많이 보이는 창 — 다만 그 창이 주인공 자리(마지막 장면)와 겹치면 볼 것이 많은 창을 쓴다(같은 자리를 두 번 보이지 않는다).
  const near = (focus: { x: number; y: number }) => Math.abs(focus.x - startPos.x) < 8 && Math.abs(focus.y - startPos.y) < 5;
  const peopled = peopledFocus(project, start), busiest = busiestFocus(start);
  const overview = near(peopled) && !near(busiest) ? busiest : peopled;
  const nearStart = near(overview);
  const shots: Shot[] = [
    ...(nearStart && others.length ? [] : [{ map: start, focus: overview, zoom: 1 }]),
    ...others.map((map) => ({ map, focus: peopledFocus(project, map), zoom: 1 })),
    // 마지막은 시작 위치를 당겨 본다 — 같은 맵의 첫 장면과 자른 영역이 같으면 도구가 「배경 재사용」으로 거절한다(작은 방은 늘 같다).
    { map: start, focus: { x: startPos.x, y: startPos.y }, zoom: 2, hero: true },
  ];
  // 같은 맵을 두 번 쓰면 오린 자리가 달라야 한다(도구가 「배경 재사용」으로 거절). 작은 방은 줌 1·2가 다 맵 전체라 더 당기고, 그래도 같으면 전경을 뺀다.
  // 도구의 판정(backdropKey)과 같게: 오린 자리 왼쪽 위를 32px 칸으로 반올림해 비교한다.
  const cropKey = (s: Shot) => {
    const c = shotCrop(s);
    return `${s.map.id}@${Math.round(c.x / 32)},${Math.round(c.y / 32)}:${Math.round(c.width / 32)}x${Math.round(c.height / 32)}`;
  };
  const finalShot = shots[shots.length - 1]!;
  while (finalShot.zoom < 4 && shots.slice(0, -1).some((s) => cropKey(s) === cropKey(finalShot))) finalShot.zoom += 1;
  const first = shots[0]!;
  if (shots.length > 1 && first.map.id === start.id && cropKey(first) === cropKey(finalShot)) {
    // 전경을 시작 위치 반대쪽 끝으로 옮긴다(방 하나짜리 게임도 장면 둘: 방 반대편 → 주인공 자리).
    first.focus = { x: startPos.x < start.width / 2 ? start.width - 1 : 0, y: startPos.y < start.height / 2 ? start.height - 1 : 0 };
  }
  if (shots.length > 1 && shots.slice(0, -1).some((s) => cropKey(s) === cropKey(finalShot))) shots.splice(0, 1);
  // 글: 플레이어에게 쓴 줄만 — 새 플레이어 안내(playerGoal)를 구절 단위로 앞 장면부터 싣고, 남는 장면에는 그 장소 이름을 싣는다.
  // 단계의 action · feeling 은 설계 메모라 싣지 않는다.
  const goal = captionLines(blueprint.playerGoal);
  const captions = new Map<number, string[]>();
  // 줄이 장면보다 많으면 차례대로 고르게 나눠 한 장면에 여러 줄을 잇는다.
  const per = Math.max(1, Math.ceil(goal.length / shots.length));
  goal.forEach((line, i) => { const at = Math.min(shots.length - 1, Math.floor(i / per)); captions.set(at, [...(captions.get(at) ?? []), line]); });
  // 글이 없는 장면은 장소 이름, 그 이름을 이미 실었으면 게임 제목 — 자막 없는 맵 조각은 «무슨 장면인지 모를 그림»으로 읽혔다.
  const named = new Set<string>();
  shots.forEach((shot, i) => {
    if (captions.has(i)) return;
    const name = [shot.map.name?.trim(), blueprint.title.trim()].find((text) => !!text && !named.has(text));
    if (!name) return;
    named.add(name);
    captions.set(i, [name]);
  });
  const music = project.system.opening?.musicResourceId;
  const saved = project.system.opening;
  project.system.opening = { enabled: true, skippable: true, scenes: [], ...(music ? { musicResourceId: music } : {}) } as typeof project.system.opening;
  try { shots.forEach((shot, i) => {
    const shotId = `${BLUEPRINT_OPENING_SHOT_PREFIX}${i + 1}`;
    run(project, "create_opening_animatic_shot", { shotId, durationMs: SHOT_MS, width: STAGE.width, height: STAGE.height, narration: (captions.get(i) ?? []).join(" ") });
    run(project, "place_opening_background", { shotId, layerId: "bg", mapId: shot.map.id, focus: shot.focus, zoom: shot.zoom });
    // 배경을 자막 띠 사이에만 다시 깐다(같은 레이어 id) — 띠 밑에 깔린 맵 줄은 어차피 안 보이고, 가장자리 줄에 선 사람을 가린다.
    run(project, "upsert_opening_layer", { shotId, layer: { id: "bg", kind: "image", role: "background", resourceId: openingMapViewResourceId(shot.map.id),
      x: 0, y: BAR, width: BAND.width, height: BAND.height, anchorX: 0, anchorY: 0, sampling: "nearest", crop: shotCrop(shot) } });
    // 전환은 cut — 도트 무대의 기본 전환(fade·dither·flash)은 장면 첫 순간을 점무늬·번쩍임으로 덮는다.
    run(project, "set_opening_transition", { shotId, transition: { kind: "cut", durationMs: 0 } });
    castOf(project, shot).forEach(({ who, at }, n) => {
      const layer = {
        id: who.hero ? "hero" : `person_${n + 1}`, kind: "image", role: "actor", resourceId: who.resourceId, x: at.x, y: at.y,
        width: CHARSET_FRAME_WIDTH * at.scale, height: CHARSET_FRAME_HEIGHT * at.scale, sampling: "nearest", characterRole: who.hero ? "hero" : "villager",
        sheet: { frameWidth: CHARSET_FRAME_WIDTH, frameHeight: CHARSET_FRAME_HEIGHT, columns: CHARSET_SHEET_COLUMNS, count: CHARSET_FRAME_COUNT, fps: 0 },
        // 서 있는 한 칸 — 걷는 연기는 붙이지 않는다(제 칸에 선 모습 그대로).
        walk: { stride: 8 * at.scale, frames: [who.frame], holdFrame: who.frame },
      };
      // 그 장르에 못 쓰는 칩·시트가 아닌 그림은 도구가 거절한다 — 그 사람만 빼고 장면은 남긴다.
      try { run(project, "upsert_opening_layer", { shotId, layer }); } catch { /* 이 사람은 세우지 않는다 */ }
    });
    const lines = captions.get(i) ?? [];
    // 자막은 장면 끝까지 남는다(fadeOutMs 0) — 끝 순간에 글이 사라진 그림이 «대사 없음»으로 읽혔다. 여러 줄이면 장면 시간을 고르게 나눈다.
    if (lines.length) run(project, "set_opening_caption", { shotId, layerId: "caption", cues: lines.map((text, n) => ({ atMs: 200 + Math.round((SHOT_MS - 400) * n / lines.length), text })), fadeOutMs: 0 });
  }); } catch (error) { project.system.opening = saved; throw error; } // 반쯤 지은 오프닝을 남기지 않는다
  if (project.system.opening) project.system.opening = { ...project.system.opening, enabled: true, skippable: true };
  const cast = (project.system.opening?.scenes ?? []).reduce((sum, scene) => sum + ((scene as { composition?: { layers?: { role?: string }[] } }).composition?.layers?.filter((l) => l.role === "actor").length ?? 0), 0);
  return [`청사진 기본 오프닝(${verdict.why}): ${shots.map((s) => s.map.name || s.map.id).join(" → ")} 장면 ${shots.length}개, 내레이션 ${captions.size}줄, 선 사람 ${cast}명`];
}
