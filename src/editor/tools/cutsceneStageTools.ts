// script_cutscene_staged — 연출을 «배우 + 관계 + 타이밍» 으로 선언한다. 전용 도구 없이도 충돌·횡단·등장·퇴장·날아감을 쓴다.
// 컴파일(좌표·접촉·시각표)은 src/editor/cutsceneStage/compile.ts 가 하고, 결과는 기존 script_cutscene beat 로 들어가
// 같은 검증·커밋 게이트를 지난다. 조수는 JSON 만 쓰고, 임의 코드는 실행되지 않는다.
import { reviewedFaceIdForCharset } from "@/assets/reviewedCharsetFaces";
import { cropCharsetFrames, fetchPictureDataUrl, type CharsetAnyRole } from "@/editor/cutsceneArt/charsetFrames";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { pictureSize, pngSize } from "@/editor/cutsceneArt/pictureSize";
import { compileStage, StageError, type StageActor, type TimedStep } from "@/editor/cutsceneStage/compile";
import { DEFAULT_PLAY_RESOLUTION } from "@/project/playResolution";
import { CUTSCENE_WHITE_RESOURCE_ID } from "./impactCutsceneTools";
import { EVENT_TOOLS } from "./eventTools";
import { requireMap } from "./mapHelpers";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";

export const STAGED_CUTSCENE_TOOL = "script_cutscene_staged";
const DEFAULT_CHARSET = "tex_easyrpg_charset_actor1";
const WHITE_PIXEL_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGP8////fwYGBgYmBigAAD34BADaOyqcAAAAAElFTkSuQmCC";

const WALK_ROLES: CharsetAnyRole[] = ["Up", "Down", "Left", "Right"].flatMap((d) => [0, 1, 2].map((n) => `walk${d}${n}` as CharsetAnyRole));

const PLACE_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  description: "위치 관계. 하나만 고른다: {fx,fy} 화면 비율 / {x,y} 픽셀 / {dx,dy} 변위 / {at,side,gap} 다른 배우 옆 / {touch,overlap,dy} 다른 배우와 몸이 겹침 / {offscreen} 화면 밖. 위치는 «발 밑 가운데».",
  properties: {
    x: { type: "number" }, y: { type: "number" }, fx: { type: "number", minimum: -0.5, maximum: 1.5 }, fy: { type: "number", minimum: -0.5, maximum: 1.5 },
    dx: { type: "number" }, dy: { type: "number" },
    at: { type: "string", description: "기준 배우 이름" }, side: { type: "string", enum: ["left", "right", "top", "bottom", "front", "back"] }, gap: { type: "number" },
    touch: { type: "string", description: "몸이 겹칠 상대 배우 이름 — 움직이는 배우의 앞면이 상대 몸 안으로 파고든다" }, overlap: { type: "number", minimum: 0.05, maximum: 0.95, description: "상대 몸 폭 중 파고드는 비율(기본 0.35)" },
    offscreen: { type: "string", enum: ["left", "right", "top", "bottom"] },
  },
};

const STEP_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["do"],
  properties: {
    do: { type: "string", enum: ["show", "hide", "move", "enter", "exit", "pose", "fling", "say", "wait", "flash", "shake", "se", "bgm", "whiteout", "dewhite", "turn", "animate", "clear", "transfer", "fade", "expect"] },
    withPrevious: { type: "boolean", description: "앞 단계와 같은 때에 시작(동시 진행). say 는 불가." },
    actor: { type: "string" }, to: PLACE_SCHEMA,
    from: { type: "string", enum: ["left", "right", "top", "bottom"], description: "enter: 들어오는 화면 가장자리" },
    exitTo: { type: "string", enum: ["left", "right", "top", "bottom"], description: "exit: 나가는 가장자리" },
    ms: { type: "number", minimum: 0 }, ease: { type: "string", enum: ["linear", "in", "out", "inout"] }, anim: { type: "string", enum: ["walk"], description: "walk: 캐릭터셋 걷기 프레임 교체" },
    pose: { type: "string" }, spin: { type: "number" }, intensity: { type: "number" },
    speaker: { type: "string" }, text: { type: "string" }, context: { type: "string", enum: ["speech", "narration", "thought", "whisper", "shout"] }, autoAdvance: { type: "boolean" },
    resourceId: { type: "string", description: "se/bgm 리소스 id" },
    color: { type: "string", enum: ["white", "red", "green", "blue", "yellow", "purple", "black"], description: "flash 색" },
    mapId: { type: "string", description: "transfer: 옮겨 갈 맵" }, x: { type: "integer", description: "transfer: 도착 칸 x" }, y: { type: "integer", description: "transfer: 도착 칸 y" },
    faceDir: { type: "string", enum: ["up", "down", "left", "right"], description: "transfer: 도착 뒤 바라보는 방향" },
    fadeColor: { type: "string", enum: ["black", "white", "none"], description: "transfer: 화면 전환 색(기본 black)" },
    dir: { type: "string", enum: ["left", "right", "top", "bottom", "up", "down"], description: "fling: 날아가는 방향 / turn: 바라볼 방향(up·down·left·right)" },
    animationId: { type: "string", description: "animate: 게임의 전투 애니메이션 id(database.battleAnimations, 예: anim_scarloxy_fire)" },
    direction: { type: "string", enum: ["in", "out"], description: "fade: 검정으로 사라짐(out)/나타남(in)" },
    touching: { type: "array", items: { type: "string" }, description: "expect: 이 시점에 몸이 닿아야 하는 두 배우" }, min: { type: "number", minimum: 0, maximum: 1 },
  },
};

const ACTOR_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name"],
  properties: {
    name: { type: "string" },
    character: { type: "object", additionalProperties: false, properties: { resourceId: { type: "string" }, characterIndex: { type: "integer", minimum: 0, maximum: 7 } }, description: "게임 캐릭터셋 인물(걷기 프레임 포함). 사람은 Actor1~4(tex_easyrpg_charset_actor1, characterIndex 0~7) 중에서 고른다. 몬스터·동물 캐릭터셋(monster1~3, animal)도 가능." },
    hero: { type: "boolean", description: "true 면 이 인물을 주인공으로 삼아 맵 위 주인공 그래픽도 같은 캐릭터셋·번호로 맞춘다(컷신 속 인물 = 이세계의 주인공)." },
    resourceId: { type: "string", description: "생성한 소품 picture(generate_cutscene_art 결과)" },
    poses: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "resourceId"], properties: { name: { type: "string" }, resourceId: { type: "string" } } }, description: "이름 붙은 추가 그림(예: 놀란 자세)" },
    facing: { type: "string", enum: ["left", "right"], description: "그림이 바라보는 방향(기본: 캐릭터 right, 소품 left)" },
    at: PLACE_SCHEMA,
    z: { type: "integer", minimum: 2, maximum: 80, description: "겹침 순서(클수록 위)" },
    ghost: { type: "boolean", description: "맵 위에 실제로 서 있는 인물(주인공)을 배우로 삼는다 — 그림은 안 그리고 touch/at/expect·turn·animate 의 기준으로만 쓴다. 화면 자리는 tile 로 주면 도구가 카메라를 계산한다(at 직접 지정도 가능)." },
    tile: { type: "object", additionalProperties: false, properties: { x: { type: "integer" }, y: { type: "integer" } }, description: "ghost 배우가 서 있는 맵 칸(예: transfer 의 도착 칸). 화면 위치는 도구가 맵 크기·시야로 구한다." },
  },
};

type Raw = Record<string, unknown>;
/** 게임에 번들된 그림(몬스터 도트 등)의 크기 — 업로드 자산이 아니라 파일에서 읽어 prepare 때 채운다. */
const bundledSizes = new Map<string, { width: number; height: number }>();
const preparedActors = new Map<string, Awaited<ReturnType<typeof cropCharsetFrames>> | { readonly error: string }>();
const charKey = (resourceId: string, index: number): string => `${resourceId}:${index}`;

function characterOf(actor: Raw): { resourceId: string; characterIndex: number } | undefined {
  const c = actor.character;
  if (!c || typeof c !== "object" || Array.isArray(c)) return undefined;
  const r = c as Raw;
  return { resourceId: typeof r.resourceId === "string" && r.resourceId.trim() ? r.resourceId.trim() : DEFAULT_CHARSET, characterIndex: Math.max(0, Math.min(7, Math.trunc(Number(r.characterIndex ?? 0)))) };
}

const SCRIPT_CUTSCENE = EVENT_TOOLS.find((tool) => tool.name === "script_cutscene");

/** exit 단계의 `exitTo` 를 컴파일러의 `to`(Side) 로 옮긴다 — 스키마에서 to 가 PlaceSpec 이라 이름을 나눴다. */
function normalizeSteps(raw: unknown): TimedStep[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new ToolError("steps 는 1개 이상의 단계 배열이어야 합니다.", { code: "invalid-args" });
  return raw.map((entry, index) => {
    if (!entry || typeof entry !== "object") throw new ToolError(`steps[${index}] 는 객체여야 합니다.`, { code: "invalid-args" });
    const step = { ...(entry as Raw) };
    if (step.do === "exit") step.to = step.exitTo ?? (typeof step.to === "string" ? step.to : undefined);
    if (step.do === "exit" && typeof step.to !== "string") throw new ToolError(`steps[${index}] exit 에는 exitTo(left/right/top/bottom)가 필요합니다.`, { code: "invalid-args" });
    if ((step.do === "enter") && typeof step.from !== "string") throw new ToolError(`steps[${index}] enter 에는 from(들어오는 가장자리)이 필요합니다.`, { code: "invalid-args" });
    if ((step.do === "move" || step.do === "enter") && (!step.to || typeof step.to !== "object")) throw new ToolError(`steps[${index}] ${String(step.do)} 에는 to(위치 관계)가 필요합니다.`, { code: "invalid-args" });
    if (step.do === "fling" && (step.dir === "up" || step.dir === "down")) step.dir = step.dir === "up" ? "top" : "bottom";
    if (step.do === "turn" && step.dir === "top") step.dir = "up";
    if (step.do === "turn" && step.dir === "bottom") step.dir = "down";
    if (step.do === "turn" && typeof step.dir !== "string") throw new ToolError(`steps[${index}] turn 에는 dir(up/down/left/right)이 필요합니다.`, { code: "invalid-args" });
    if (step.do === "animate" && typeof step.animationId !== "string") throw new ToolError(`steps[${index}] animate 에는 animationId 가 필요합니다.`, { code: "invalid-args" });
    if (step.do === "transfer") {
      if (typeof step.mapId !== "string" || typeof step.x !== "number" || typeof step.y !== "number") throw new ToolError(`steps[${index}] transfer 에는 mapId, x, y 가 필요합니다.`, { code: "invalid-args" });
      if (typeof step.faceDir === "string") step.facing = step.faceDir;
      if (typeof step.fadeColor === "string") step.fade = step.fadeColor;
    }
    if (step.do === "fade" && typeof step.direction !== "string") throw new ToolError(`steps[${index}] fade 에는 direction(in/out)이 필요합니다.`, { code: "invalid-args" });
    return step as unknown as TimedStep;
  });
}

const scriptCutsceneStaged: ToolDefinition = {
  name: STAGED_CUTSCENE_TOOL,
  description:
    "컷신 연출: 그림(몬스터·동물·탈것·환영)이 화면을 달려 지나가거나 가로질러 등장·퇴장·충돌·날아가는 움직임을 «배우 + 관계 + 타이밍» 으로 선언해 컷신으로 만든다(충돌·횡단·등장·퇴장·날아감·화면 가림 등). 맵 위 NPC 이동으로 안 되는 큰 그림 연출에 쓴다. 픽셀 좌표는 쓰지 않는다 — 도구가 그림 크기로 계산한다. "
    + "배우: character(게임 캐릭터셋 인물, 걷기 프레임 포함) 또는 resourceId(generate_cutscene_art 소품). 위치 관계 예: 트럭이 오른쪽 화면 밖에서 들어와 인물 몸에 35% 파고든다 = "
    + "{do:'enter',actor:'트럭',from:'right',to:{touch:'인물',overlap:0.35,dy:6},ms:520}. 그 직후 {do:'expect',touching:['트럭','인물']} 로 닿았는지 못 박으면 어긋날 때 도구가 거부하고 고칠 방법을 알려 준다. "
    + "withPrevious:true 는 앞 단계와 동시 진행(예: flash·shake·fling·exit 를 충돌 순간에 함께). say 는 동시 진행 불가. 모든 그림은 게임 해상도 100% 배율이고, 위치는 «발 밑 가운데» 기준이다. "
    + "소재 고르는 순서: ① 몬스터·동물은 게임에 이미 있는 도트(list_monster_resources 의 resourceId, 예 scarloxy-monster-*)를 배우 resourceId 로 그대로 쓴다 ② 사람은 캐릭터셋 Actor1(characterIndex 0~7)에서 한 명을 골라 character 로 쓰고, 맵 위 주인공 그래픽도 upsert_actor(characterResourceId·characterIndex)로 같은 칸에 맞춘다 — 컷신 속 인물과 이세계의 주인공이 같아야 한다. 몬스터는 이 그림 도트이거나 맵 NPC 캐릭터셋(EasyRPG monster·animal) 중 게임 세계에 맞는 쪽을 쓴다 ③ 공격·마법·불꽃은 그림을 만들지 말고 animate 로 게임의 전투 애니메이션(get_database_records battleAnimations, 예 anim_scarloxy_fire)을 쓴다 ④ 효과음·BGM 은 list_resources(kind:se)·recommend_bgm 으로 고른 id 를 se/bgm 단계에 넣는다 ⑤ generate_cutscene_art 는 게임에 없는 것(트럭·거리 배경·회상 일러스트)에만 쓴다. 맵 위에 서 있는 주인공을 맞히거나 돌리려면 ghost 배우(tile 지정)를 쓴다 — turn(위·왼·오른·아래 둘러보기)·animate 대상이 된다. 새 장소로 넘어갈 땐 clear → transfer(fadeColor) 단계. 암전(fade out)으로 끝냈으면 fade in 으로 되돌려 화면을 검게 둔 채 끝내지 않는다. 끝나면 preview_cutscene 으로 핵심 장면을 눈으로 확인한다. 이미 있는 전용 연출(트럭 충돌: script_cutscene_impact)이 맞으면 그것을 쓴다.",
  mode: "write",
  domains: ["event"],
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["mapId", "actors", "steps"],
    properties: {
      mapId: { type: "string" },
      backdropResourceId: { type: "string", description: "빈 전체화면 배경 picture(generate_cutscene_art backdrop)" },
      actors: { type: "array", items: ACTOR_SCHEMA },
      steps: { type: "array", items: STEP_SCHEMA },
      eventId: { type: "string" }, x: { type: "integer" }, y: { type: "integer" },
      trigger: { type: "string", enum: ["auto", "action"], description: "기본 auto(한 번만)" },
      skippable: { type: "boolean" },
    },
  },
  invalidArgsExample: {
    mapId: "map1", backdropResourceId: "cutscene_backdrop_x",
    actors: [{ name: "인물", character: { resourceId: "tex_easyrpg_charset_actor1", characterIndex: 0 }, at: { fx: 0.5, fy: 0.6 } }, { name: "트럭", resourceId: "cutscene_sprite_y", facing: "left" }],
    steps: [{ do: "enter", actor: "트럭", from: "right", to: { touch: "인물", overlap: 0.35, dy: 6 }, ms: 520 }, { do: "expect", touching: ["트럭", "인물"] }, { do: "flash" }, { do: "fling", actor: "인물", withPrevious: true }],
  },
  async prepare(args): Promise<void> {
    const actors = Array.isArray(args.actors) ? (args.actors as Raw[]) : [];
    for (const actor of actors) {
      const picIds = [actor.resourceId, ...(Array.isArray(actor.poses) ? (actor.poses as Raw[]).map((p) => p.resourceId) : [])].filter((id): id is string => typeof id === "string" && id.trim().length > 0);
      for (const id of picIds) {
        if (bundledSizes.has(id)) continue;
        try {
          const url = resolveAssetResourceUrl(id, {});
          const size = url ? pngSize(await fetchPictureDataUrl(url)) : null;
          if (size) bundledSizes.set(id, size);
        } catch { /* 번들 그림이 아니면 run 이 업로드 자산으로 찾는다 */ }
      }
      const character = characterOf(actor);
      if (!character) continue;
      const key = charKey(character.resourceId, character.characterIndex);
      const cached = preparedActors.get(key);
      if (cached && !("error" in cached)) continue;
      try {
        preparedActors.set(key, await cropCharsetFrames(undefined, character.resourceId, character.characterIndex, WALK_ROLES));
      } catch (error) {
        preparedActors.set(key, { error: error instanceof Error ? error.message : String(error) });
      }
    }
  },
  run(draft, args): ToolExecResult {
    if (!SCRIPT_CUTSCENE) throw new ToolError("script_cutscene 도구를 찾을 수 없습니다.", { code: "missing-inner-tool" });
    const map = requireMap(draft, args.mapId as string);
    const viewport = draft.system.playResolution ?? DEFAULT_PLAY_RESOLUTION;
    const rawActors = Array.isArray(args.actors) ? (args.actors as Raw[]) : [];
    if (rawActors.length === 0) throw new ToolError("actors 가 비어 있습니다.", { code: "invalid-args" });
    const actors: StageActor[] = rawActors.map((raw, index) => {
      const name = typeof raw.name === "string" ? raw.name.trim() : "";
      if (!name) throw new ToolError(`actors[${index}].name 이 필요합니다.`, { code: "invalid-args" });
      const at = raw.at && typeof raw.at === "object" ? (raw.at as StageActor["at"]) : undefined;
      const z = typeof raw.z === "number" ? Math.trunc(raw.z) : undefined;
      const character = characterOf(raw);
      if (character) {
        const prepared = preparedActors.get(charKey(character.resourceId, character.characterIndex));
        if (!prepared) throw new ToolError(`배우 '${name}' 의 캐릭터 프레임이 준비되지 않았습니다 — 같은 인자로 다시 호출하세요.`, { code: "character-not-prepared" });
        if ("error" in prepared) throw new ToolError(`배우 '${name}' 의 캐릭터 프레임을 만들지 못했습니다: ${prepared.error}`, { code: "character-frames-failed" });
        for (const frame of Object.values(prepared.frames)) {
          draft.assets.uploaded[frame.id] = { id: frame.id, name: `컷신 캐릭터 프레임`, kind: "picture", dataUrl: frame.dataUrl, meta: { width: prepared.width, height: prepared.height } };
        }
        const f = (role: string): string => prepared.frames[role]!.id;
        const trio = (d: string): readonly [string, string, string] => [f(`walk${d}0`), f(`walk${d}1`), f(`walk${d}2`)];
        return {
          name, width: prepared.width, height: prepared.height, facing: raw.facing === "left" ? "left" : "right",
          // 방향 정지 포즈 — pose 단계로 «트럭 쪽을 돌아본다» 같은 연출을 한다.
          poses: { default: f("walkDown1"), down: f("walkDown1"), up: f("walkUp1"), left: f("walkLeft1"), right: f("walkRight1"), ...Object.fromEntries((Array.isArray(raw.poses) ? (raw.poses as Raw[]) : []).map((p) => [String(p.name), String(p.resourceId)])) },
          walk: { down: trio("Down"), up: trio("Up"), left: trio("Left"), right: trio("Right") },
          ...(at ? { at } : {}), ...(z !== undefined ? { z } : {}),
        };
      }
      if (raw.ghost === true) {
        const tile = raw.tile && typeof raw.tile === "object" ? (raw.tile as { x?: unknown; y?: unknown }) : undefined;
        let ghostAt = at;
        if (!ghostAt && tile && typeof tile.x === "number" && typeof tile.y === "number") {
          const T = map.tileSize ?? draft.tilesets[map.tilesetId]?.tileSize ?? 16;
          const mapW = map.width * T, mapH = map.height * T;
          const camX = mapW <= viewport.width ? (mapW - viewport.width) / 2 : Math.max(0, Math.min(mapW - viewport.width, tile.x * T + T / 2 - viewport.width / 2));
          const camY = mapH <= viewport.height ? (mapH - viewport.height) / 2 : Math.max(0, Math.min(mapH - viewport.height, tile.y * T + T / 2 - viewport.height / 2));
          ghostAt = { x: Math.round(tile.x * T + T / 2 - camX), y: Math.round((tile.y + 1) * T - camY) };
        }
        if (!ghostAt) throw new ToolError(`배우 '${name}' 는 ghost 라서 tile(맵 칸) 또는 at(화면 자리)이 필요합니다.`, { code: "invalid-args" });
        return { name, width: 24, height: 32, facing: raw.facing === "left" ? "left" : "right", poses: { default: "" }, ghost: true, at: ghostAt, ...(z !== undefined ? { z } : {}) };
      }
      const resourceId = typeof raw.resourceId === "string" ? raw.resourceId.trim() : "";
      if (!resourceId || (!draft.assets.uploaded[resourceId] && !bundledSizes.has(resourceId))) throw new ToolError(`배우 '${name}' 에는 character, 게임에 있는 그림 resourceId(예: 몬스터 scarloxy-monster-*), 또는 등록된 생성 그림(generate_cutscene_art 결과)이 필요합니다.`, { code: "unknown-resource" });
      const size = draft.assets.uploaded[resourceId] ? pictureSize(draft, resourceId, { width: 48, height: 48 }) : bundledSizes.get(resourceId)!;
      const poses: Record<string, string> = { default: resourceId };
      for (const p of Array.isArray(raw.poses) ? (raw.poses as Raw[]) : []) {
        const id = String(p.resourceId);
        if (!draft.assets.uploaded[id] && !bundledSizes.has(id)) throw new ToolError(`배우 '${name}' 포즈 '${String(p.name)}' 의 resourceId '${id}' 가 등록된 그림이 아닙니다.`, { code: "unknown-resource" });
        poses[String(p.name)] = id;
      }
      return { name, width: size.width, height: size.height, facing: raw.facing === "right" ? "right" : "left", poses, ...(at ? { at } : {}), ...(z !== undefined ? { z } : {}) };
    });
    let backdrop: { id: string; width: number; height: number } | undefined;
    if (typeof args.backdropResourceId === "string" && args.backdropResourceId.trim()) {
      const id = args.backdropResourceId.trim();
      if (!draft.assets.uploaded[id]) throw new ToolError(`backdropResourceId '${id}' 는 등록된 그림이 아닙니다.`, { code: "unknown-resource" });
      backdrop = { id, ...pictureSize(draft, id, viewport) };
    }
    if (!draft.assets.uploaded[CUTSCENE_WHITE_RESOURCE_ID]) {
      draft.assets.uploaded[CUTSCENE_WHITE_RESOURCE_ID] = { id: CUTSCENE_WHITE_RESOURCE_ID, name: "컷신 흰 화면", kind: "picture", dataUrl: WHITE_PIXEL_DATA_URL, meta: { width: 2, height: 2 } };
    }
    const knownAnimations = new Set((draft.database.battleAnimations ?? []).map((record) => record.id));
    for (const step of normalizeSteps(args.steps)) {
      if (step.do === "animate" && !knownAnimations.has(step.animationId)) {
        throw new ToolError(`animate: 전투 애니메이션 '${step.animationId}' 가 없습니다 — get_database_records(collection:"battleAnimations") 로 id 를 조회하세요(예: ${[...knownAnimations].slice(0, 4).join(", ")}).`, { code: "unknown-animation" });
      }
    }
    let result: ReturnType<typeof compileStage>;
    try {
      result = compileStage({ viewport, ...(backdrop ? { backdrop } : {}), actors, steps: normalizeSteps(args.steps), whiteResourceId: CUTSCENE_WHITE_RESOURCE_ID });
    } catch (error) {
      if (error instanceof StageError) throw new ToolError(error.message, { code: "stage-invalid" });
      throw error;
    }
    const trigger = args.trigger === "action" ? "action" : "auto";
    const cutsceneArgs: Raw = { _composedByStageTool: true, mapId: map.id, beats: result.beats, skippable: args.skippable !== false, trigger, ...(trigger === "auto" ? { once: true } : {}) };
    if (typeof args.eventId === "string" && args.eventId.trim()) cutsceneArgs.eventId = args.eventId.trim();
    if (typeof args.x === "number") cutsceneArgs.x = Math.trunc(args.x);
    if (typeof args.y === "number") cutsceneArgs.y = Math.trunc(args.y);
    const cut = SCRIPT_CUTSCENE.run(draft, cutsceneArgs);
    let heroNote = "";
    for (const raw of rawActors) {
      const character = raw.hero === true ? characterOf(raw) : undefined;
      if (!character) continue;
      const hero = draft.database.actors.find((actor) => actor.id === "actor_hero") ?? draft.database.actors[0];
      if (!hero) continue;
      hero.characterResourceId = character.resourceId.replace(/^tex_easyrpg_charset_/u, "easyrpg-charset-");
      hero.characterIndex = character.characterIndex;
      const face = reviewedFaceIdForCharset(hero.characterResourceId, character.characterIndex);
      if (face) hero.faceResourceId = face;
      heroNote = ` 주인공 '${hero.name}' 의 맵 그래픽도 ${hero.characterResourceId} #${character.characterIndex} 로 맞췄습니다.`;
    }
    return {
      summary: `${map.name}에 연출 컷신 배치 — 배우 ${actors.length}명, 단계 ${normalizeSteps(args.steps).length}개, 약 ${(result.durationMs / 1000).toFixed(1)}초`
        + (result.contacts.length ? `, 접촉 확인 ${result.contacts.map((c) => `${c.pair} ${Math.round(c.overlap * 100)}%`).join(", ")}` : "") + `. preview_cutscene 으로 확인하세요.${heroNote}`,
      data: { eventId: (cut.data as { eventId?: string } | undefined)?.eventId, layout: result.layout, contacts: result.contacts, beatCount: result.beats.length },
      ...(cut.warnings && cut.warnings.length > 0 ? { warnings: cut.warnings } : {}),
    };
  },
};

export const CUTSCENE_STAGE_TOOLS: readonly ToolDefinition[] = [scriptCutsceneStaged];
