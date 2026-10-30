// 청사진 기본 오프닝 — 게임의 실제 맵(map-view) 장면 2~4개 + 청사진 문장으로 다듬은 짧은 내레이션(2026-10-28 스위트 조립 장부).
//
// 장부·턴 기록: 장르와 무관한 프리셋 그림(왕국·마왕성·벽난로 노인), 회화풍 스틸과 도트 게임의 화풍 불일치, 오프닝이 아예 없거나 꺼짐.
// 청사진이 있으면 결정적으로 짓는다: 시작 장소 전경 → 청사진 다음 장소 1~2곳 → 시작 장소의 주인공 시작 위치. 글은 모델이 이미 쓴 청사진 문장
// (playerGoal·첫 단계 action·느낌)을 다듬기만 한다 — 새 모델 호출 없음, 숫자·암호·정답 낱말이 든 문장은 뺀다.
// 모델이 직접 만든 오프닝(생성·업로드 그림, 맵 화면, 글 장면)은 건드리지 않는다. 기본값·꺼짐·없음·장르가 안 맞는 번들 스틸·캐릭터 시트일 때만.
import { findOpeningStillMood } from "@/assets/openingStillMoods";
import { blueprintPremiseText, blueprintStoryText, pickTitleArtForStory } from "@/project/blueprintAssembly";
import type { GameBlueprint } from "@/project/gameBlueprint";
import { openingMapViewCrop, openingMapViewMapId } from "@/project/openingMapView";
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

/**
 * 청사진 문장 다듬기(새 모델 호출 없이): 괄호·영문 식별자를 빼고, 「4자리」「지하 2층」 같은 수량은 숫자째 덜어 낸다(정답·자릿수 누설 금지).
 * 남은 숫자나 퍼즐 장치(숫자·힌트·정답·암호…)·제작 낱말(컷신·스위치·이벤트·플레이어)이 든 문장은 뺀다. 「게임이 시작되면」 머리는 지운다. 46자 안.
 */
export function narrationLine(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const cleaned = text.replace(/\([^)]*\)|\[[^\]]*\]/gu, " ").replace(/\b[A-Za-z]+[_-][\w-]*\b/gu, " ")
    .replace(/\s*\d+\s*(?:자리|개|번째|번|층|칸|명|단계|일|시)(?=[\s을를이가의에은는도]|$)/gu, "");
  const sentences = cleaned.split(/(?<=[.!?。…])\s+|\s*\n\s*/u);
  const kept = sentences.map((s) => s.replace(/^(?:게임이\s*시작되면|게임\s*시작\s*시|시작하면)\s*,?\s*/u, "").replace(/\s+/gu, " ").trim())
    .filter((s) => s && !/\d|숫자|힌트|정답|답은|(?:암호|비밀\s*번호|코드|조합)\s*(?:는|은|가|이)(?![가-힣])|패스워드|password|컷신|스위치|이벤트|플레이어|튜토리얼/iu.test(s));
  let line = kept.join(" ").trim();
  if (!line) return undefined;
  if (Array.from(line).length > 46) {
    const cut = Array.from(line).slice(0, 46).join("");
    const at = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf(","));
    line = `${(at > 20 ? cut.slice(0, at) : cut).replace(/[,\s]+$/u, "")}…`;
  }
  return line;
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
  const overview = busiestFocus(start);
  const nearStart = Math.abs(overview.x - startPos.x) < 8 && Math.abs(overview.y - startPos.y) < 5;
  const shots: { map: GameMap; focus: { x: number; y: number }; zoom: number }[] = [
    ...(nearStart && others.length ? [] : [{ map: start, focus: overview, zoom: 1 }]),
    ...others.map((map) => ({ map, focus: busiestFocus(map), zoom: 1 })),
    // 마지막은 시작 위치를 당겨 본다 — 같은 맵의 첫 장면과 자른 영역이 같으면 도구가 「배경 재사용」으로 거절한다(작은 방은 늘 같다).
    { map: start, focus: { x: startPos.x, y: startPos.y }, zoom: 2 },
  ];
  // 같은 맵을 두 번 쓰면 오린 자리가 달라야 한다(도구가 「배경 재사용」으로 거절). 작은 방은 줌 1·2가 다 맵 전체라 더 당기고, 그래도 같으면 전경을 뺀다.
  // 도구의 판정(backdropKey)과 같게: 오린 자리 왼쪽 위를 32px 칸으로 반올림해 비교한다.
  const cropKey = (s: { map: GameMap; focus: { x: number; y: number }; zoom: number }) => {
    const c = openingMapViewCrop(s.map, STAGE, s.focus, s.zoom);
    return `${s.map.id}@${Math.round(c.x / 32)},${Math.round(c.y / 32)}`;
  };
  const finalShot = shots[shots.length - 1]!;
  while (finalShot.zoom < 4 && shots.slice(0, -1).some((s) => cropKey(s) === cropKey(finalShot))) finalShot.zoom += 1;
  const first = shots[0]!;
  if (shots.length > 1 && first.map.id === start.id && cropKey(first) === cropKey(finalShot)) {
    // 전경을 시작 위치 반대쪽 끝으로 옮긴다(방 하나짜리 게임도 장면 둘: 방 반대편 → 주인공 자리).
    first.focus = { x: startPos.x < start.width / 2 ? start.width - 1 : 0, y: startPos.y < start.height / 2 ? start.height - 1 : 0 };
  }
  if (shots.length > 1 && shots.slice(0, -1).some((s) => cropKey(s) === cropKey(finalShot))) shots.splice(0, 1);
  // 글: 목표 → 첫 단계 행동 → 느낌(마지막 장면, 말줄임).
  const step0 = blueprint.steps[0];
  const goal = narrationLine(blueprint.playerGoal), action = narrationLine(step0?.action);
  const feeling = step0?.feeling ? narrationLine(`${step0.feeling.replace(/[.。…]+$/u, "")}…`) : undefined;
  // 자리: 목표는 첫 장면, 느낌은 마지막 장면(주인공 자리), 첫 행동은 그 사이(장면이 둘뿐이면 목표가 없을 때 첫 장면).
  const captions = new Map<number, string>();
  const last = shots.length - 1;
  if (goal) captions.set(0, goal);
  if (feeling && !captions.has(last)) captions.set(last, feeling);
  if (action) {
    const slot = [1, 2, 0].find((i) => i < last && !captions.has(i)) ?? (!captions.has(last) ? last : undefined);
    if (slot !== undefined) captions.set(slot, action);
  }
  const music = project.system.opening?.musicResourceId;
  const saved = project.system.opening;
  project.system.opening = { enabled: true, skippable: true, scenes: [], ...(music ? { musicResourceId: music } : {}) } as typeof project.system.opening;
  try { shots.forEach((shot, i) => {
    const shotId = `${BLUEPRINT_OPENING_SHOT_PREFIX}${i + 1}`;
    run(project, "create_opening_animatic_shot", { shotId, durationMs: SHOT_MS, width: STAGE.width, height: STAGE.height, narration: captions.get(i) ?? "" });
    run(project, "place_opening_background", { shotId, layerId: "bg", mapId: shot.map.id, focus: shot.focus, zoom: shot.zoom });
    const caption = captions.get(i);
    if (caption) run(project, "set_opening_caption", { shotId, layerId: "caption", cues: [{ atMs: 350, text: caption }] });
  }); } catch (error) { project.system.opening = saved; throw error; } // 반쯤 지은 오프닝을 남기지 않는다
  if (project.system.opening) project.system.opening = { ...project.system.opening, enabled: true, skippable: true };
  return [`청사진 기본 오프닝(${verdict.why}): ${shots.map((s) => s.map.name || s.map.id).join(" → ")} 장면 ${shots.length}개, 내레이션 ${captions.size}줄`];
}
