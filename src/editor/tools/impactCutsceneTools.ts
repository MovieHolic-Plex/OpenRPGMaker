// 충돌 컷신(트럭에 치임 등) — 「그림을 그린 다음 그 그림을 움직인다」의 둘째 절반.
// 조수는 배경·탈것 그림 id, 피해자 캐릭터(게임 캐릭터셋), 대사만 고른다. 어디서 출발해 어디서 닿고 어디로 튕겨 나가는지의
// 좌표·타이밍은 여기서 계산해 script_cutscene 의 picture/flash/shake/music beat 로 컴파일한다.
// 모든 그림은 게임 해상도(320×240, 16px 타일) 그대로 100% 배율로 놓는다 — 확대하면 도트 크기가 섞여 이질감이 난다.
import { reviewedFaceIdForCharset } from "@/assets/reviewedCharsetFaces";
import { cropCharsetFrames, CHARSET_FRAME_ROLES, type CharsetFramePictures, type CharsetFrameRole } from "@/editor/cutsceneArt/charsetFrames";
import { pictureSize } from "@/editor/cutsceneArt/pictureSize";
import { DEFAULT_PLAY_RESOLUTION } from "@/project/playResolution";
import { EVENT_TOOLS } from "./eventTools";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

export const IMPACT_CUTSCENE_TOOL = "script_cutscene_impact";

/** 2×2 순백 PNG. 컷신이 화면을 하얗게 덮을 때 크게 늘려 쓴다(fade 는 검정뿐이다). */
const WHITE_PIXEL_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGP8////fwYGBgYmBigAAD34BADaOyqcAAAAAElFTkSuQmCC";
export const CUTSCENE_WHITE_RESOURCE_ID = "cutscene_white_screen";

/** 기본 효과음(Kenney CC0 강한 타격). */
const DEFAULT_IMPACT_SE = "cc0-se-kis-impactpunch-heavy-002";
const DEFAULT_CHARSET = "tex_easyrpg_charset_actor1";

type RecordValue = Record<string, unknown>;

function requireResource(id: unknown, field: string): string {
  if (id === undefined || id === null || id === "") {
    throw new ToolError(`${field} 가 필요합니다 — generate_cutscene_art 가 돌려준 resourceId 를 넣으세요.`, { code: "invalid-args" });
  }
  if (typeof id !== "string") throw new ToolError(`${field} 는 문자열이어야 합니다.`, { code: "invalid-args" });
  return id.trim();
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).map((entry) => entry.trim()) : [];
}

function ratio(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

export interface VictimFrames {
  /** 걷기 프레임(아래 방향 0·1·2). 없으면 정지 그림 하나로 이동만 한다. */
  readonly walk?: readonly [string, string, string];
  /** 경적에 놀라 트럭 쪽을 보는 자세. */
  readonly shock?: string;
  /** 정지 그림(걷기 프레임이 없을 때). */
  readonly still: string;
  readonly width: number;
  readonly height: number;
}

export interface ImpactChoreographyInput {
  readonly viewport: { readonly width: number; readonly height: number };
  readonly backdrop: { readonly id: string; readonly width: number; readonly height: number };
  readonly vehicle: { readonly id: string; readonly width: number; readonly height: number; readonly facing: "left" | "right" };
  readonly victim: VictimFrames;
  readonly speaker: string;
  readonly beforeLines: readonly string[];
  readonly honkText: string;
  readonly afterLines: readonly string[];
  readonly bgmResourceId?: string;
  readonly impactSeResourceId: string;
  readonly honkSeResourceId?: string;
  /** 도로 띠의 위·아래 끝(화면 높이 비율). 보도에서 걸어 나와 도로 가운데에서 치인다. */
  readonly roadTop: number;
  readonly roadBottom: number;
  /** 횡단 위치(화면 너비 비율, 인물 가운데). */
  readonly crossingX: number;
}

export interface ImpactChoreography {
  readonly beats: RecordValue[];
  readonly layout: {
    readonly victim: { readonly x: number; readonly yStart: number; readonly yEnd: number; readonly width: number; readonly height: number };
    readonly vehicle: { readonly y: number; readonly width: number; readonly height: number; readonly contactX: number; readonly fromX: number; readonly exitX: number; readonly facing: "left" | "right" };
    readonly backdropScale: number;
  };
}

const WALK_CYCLE = [1, 0, 1, 2] as const;
const WALK_STEPS = 8;
const WALK_STEP_MS = 230;

/** 순수 계산: 입력 → beat 목록과 배치. 테스트와 미리보기가 같은 함수를 쓴다. */
export function buildImpactChoreography(input: ImpactChoreographyInput): ImpactChoreography {
  const { viewport: { width: W, height: H }, victim, vehicle } = input;
  const backdropScale = Math.round((W / input.backdrop.width) * 100);
  const roadTopY = H * input.roadTop;
  const roadH = Math.max(16, H * input.roadBottom - roadTopY);
  // 발 위치(그림 아래 끝). 보도 끝에서 출발해 도로 가운데 근처에서 멈춘다.
  const feetStart = Math.round(roadTopY - 4);
  const feetEnd = Math.round(roadTopY + roadH * 0.5);
  const yStart = feetStart - victim.height;
  const yEnd = feetEnd - victim.height;
  const victimX = Math.round(W * input.crossingX - victim.width / 2);
  // 탈것은 화면에 더 가까운 차선 — 바퀴 바닥이 인물 발보다 조금 아래.
  const baseline = Math.min(Math.round(H * input.roadBottom) - 2, feetEnd + Math.round(roadH * 0.22));
  const vehicleY = baseline - vehicle.height;
  const facingLeft = vehicle.facing === "left";
  // 탈것의 앞면이 인물 몸통 가운데까지 파고든다(가까운 쪽 35% 지점) — 겹침 진단이 이 값으로 통과한다.
  const contactX = Math.round(facingLeft ? victimX + victim.width * 0.65 : victimX + victim.width * 0.35 - vehicle.width);
  const fromX = facingLeft ? W + 8 : -vehicle.width - 8;
  const exitX = facingLeft ? -vehicle.width - 16 : W + 16;
  const flyX = Math.round(victimX + (facingLeft ? -1 : 1) * W * 0.35);
  const flyY = Math.round(-victim.height * 2);

  const walk: RecordValue[] = [];
  const walkFrames = victim.walk;
  for (let i = 1; i <= WALK_STEPS; i += 1) {
    const yFrom = Math.round(yStart + ((yEnd - yStart) * (i - 1)) / WALK_STEPS);
    const yTo = Math.round(yStart + ((yEnd - yStart) * i) / WALK_STEPS);
    if (walkFrames) {
      walk.push({ kind: "picture", action: "erase", pictureId: "pic2" });
      walk.push({ kind: "picture", action: "show", pictureId: "pic2", resourceId: walkFrames[WALK_CYCLE[(i - 1) % WALK_CYCLE.length]!], x: victimX, y: yFrom });
    }
    walk.push({ kind: "picture", action: "move", pictureId: "pic2", x: victimX, y: yTo, durationMs: WALK_STEP_MS, wait: true });
  }
  const beats: RecordValue[] = [
    { kind: "fade", direction: "out", durationMs: 0 },
    { kind: "picture", action: "show", pictureId: "pic1", resourceId: input.backdrop.id, x: 0, y: 0, scale: backdropScale },
    { kind: "picture", action: "show", pictureId: "pic2", resourceId: walkFrames ? walkFrames[1] : victim.still, x: victimX, y: yStart },
    ...(input.bgmResourceId ? [{ kind: "music", action: "bgm", resourceId: input.bgmResourceId }] : []),
    { kind: "fade", direction: "in", durationMs: 900, wait: true },
    ...input.beforeLines.flatMap((text): RecordValue[] => [
      { kind: "say", speaker: input.speaker, text, context: "thought", position: "top" },
      { kind: "wait", ms: 250 },
    ]),
    ...walk,
    ...(victim.shock
      ? [
        { kind: "picture", action: "erase", pictureId: "pic2" },
        { kind: "picture", action: "show", pictureId: "pic2", resourceId: victim.shock, x: victimX, y: yEnd },
      ]
      : []),
    { kind: "shake", intensity: 3, durationMs: 350 },
    ...(input.honkSeResourceId ? [{ kind: "music", action: "se", resourceId: input.honkSeResourceId }] : []),
    { kind: "say", context: "shout", autoAdvance: true, text: input.honkText, position: "top" },
    { kind: "wait", ms: 500 },
    { kind: "picture", action: "show", pictureId: "pic3", resourceId: vehicle.id, x: fromX, y: vehicleY },
    { kind: "picture", action: "move", pictureId: "pic3", x: contactX, y: vehicleY, durationMs: 520, wait: true },
    { kind: "music", action: "se", resourceId: input.impactSeResourceId },
    { kind: "flash", color: "white", durationMs: 600 },
    { kind: "shake", intensity: 9, durationMs: 900 },
    { kind: "parallel", beats: [
      // 날아가는 동안만 2배(정수 배율 — 도트가 뭉개지지 않는다).
      { kind: "picture", action: "move", pictureId: "pic2", x: flyX, y: flyY, scale: 200, rotation: 720, opacity: 0, durationMs: 800 },
      { kind: "picture", action: "move", pictureId: "pic3", x: exitX, y: vehicleY, durationMs: 700 },
    ] },
    { kind: "wait", ms: 900 },
    { kind: "picture", action: "show", pictureId: "pic5", resourceId: CUTSCENE_WHITE_RESOURCE_ID, x: 0, y: 0, scale: Math.max(W, H) * 50, opacity: 0 },
    { kind: "picture", action: "move", pictureId: "pic5", x: 0, y: 0, scale: Math.max(W, H) * 50, opacity: 255, durationMs: 900, wait: true },
    ...input.afterLines.flatMap((text): RecordValue[] => [{ kind: "say", context: "narration", text }, { kind: "wait", ms: 300 }]),
  ];
  return {
    beats,
    layout: {
      victim: { x: victimX, yStart, yEnd, width: victim.width, height: victim.height },
      vehicle: { y: vehicleY, width: vehicle.width, height: vehicle.height, contactX, fromX, exitX, facing: vehicle.facing },
      backdropScale,
    },
  };
}

// ── 게임 캐릭터셋 프레임 준비(비동기 prepare → 동기 run) ─────────────────────────────────────────
const preparedCharacters = new Map<string, CharsetFramePictures | { readonly error: string }>();
const characterKey = (resourceId: string, index: number): string => `${resourceId}:${index}`;

function characterArg(args: Record<string, unknown>): { resourceId: string; characterIndex: number } | undefined {
  const raw = args.victimCharacter;
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) throw new ToolError("victimCharacter 는 {resourceId, characterIndex} 객체여야 합니다.", { code: "invalid-args" });
  const record = raw as RecordValue;
  const resourceId = typeof record.resourceId === "string" && record.resourceId.trim() ? record.resourceId.trim() : DEFAULT_CHARSET;
  if (!/actor[1-4]$/iu.test(resourceId)) {
    throw new ToolError(`victimCharacter 는 캐릭터셋 Actor1~4 에서 고릅니다('${resourceId}' 아님) — 예: {resourceId:'tex_easyrpg_charset_actor1', characterIndex:0}(인물 0~7번). 선택한 인물로 맵 위 주인공 그래픽도 맞춰 줍니다.`, { code: "invalid-args" });
  }
  const index = typeof record.characterIndex === "number" && Number.isFinite(record.characterIndex) ? Math.trunc(record.characterIndex) : 0;
  return { resourceId, characterIndex: Math.max(0, Math.min(7, index)) };
}

const SCRIPT_CUTSCENE = EVENT_TOOLS.find((tool) => tool.name === "script_cutscene");

const scriptCutsceneImpact: ToolDefinition = {
  name: IMPACT_CUTSCENE_TOOL,
  description:
    "탈것이 인물에게 돌진해 부딪히는 충돌 컷신(트럭 사고 등)을 한 번에 만든다. 맵 타일·NPC 이동 없이 picture 로 처리하며 모든 그림은 게임 해상도 100% 배율이다. "
    + "먼저 generate_cutscene_art 로 배경(role:backdrop)과 탈것(role:sprite, tiles 로 크기)을 만들고 그 resourceId 를 넣는다. "
    + "피해자는 생성하지 않고 게임 캐릭터셋의 인물을 쓴다 — victimCharacter 는 캐릭터셋 Actor1~4 에서 한 명을 고른다(예 tex_easyrpg_charset_actor1 번호 0~7, 생략하면 Actor1 0번) — 고른 인물로 맵 위 주인공 그래픽도 자동으로 맞춰져 컷신 속 인물과 이세계의 주인공이 같은 사람이 된다. 걷기 프레임이 진짜로 교체된다. "
    + "도구가 좌표·타이밍을 계산한다: 인물이 보도에서 걸어 나오고 → 경적 대사 → 탈것이 달려와 닿는 순간 효과음·플래시·화면 흔들림 → 인물이 회전하며 날아가고 → 화면이 하얗게 덮이며 afterLines 내레이션. "
    + "roadTop·roadBottom 은 배경 그림에서 도로 띠의 위·아래 끝이 화면 높이의 몇 %인지(0~1)로, 생성 결과 그림을 보고 읽어 넣는다. vehicleFacing 은 탈것 그림이 바라보는 방향(left 면 오른쪽에서 들어온다). "
    + "끝난 뒤 preview_cutscene 으로 핵심 장면을 눈으로 확인한다. 엔딩/이세계 이동 등 이후 연출은 같은 이벤트에 이어 붙이지 말고 별도 처리한다.",
  mode: "write",
  domains: ["event"],
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["mapId", "backdropResourceId", "vehicleResourceId"],
    properties: {
      mapId: { type: "string" },
      backdropResourceId: { type: "string", description: "빈 전체화면 배경 picture 리소스" },
      vehicleResourceId: { type: "string", description: "탈것 sprite picture 리소스" },
      vehicleFacing: { type: "string", enum: ["left", "right"], description: "탈것 그림이 바라보는 방향(기본 left)" },
      victimCharacter: {
        type: "object",
        additionalProperties: false,
        properties: {
          resourceId: { type: "string", description: "캐릭터셋 리소스 id(기본 tex_easyrpg_charset_actor1)" },
          characterIndex: { type: "integer", minimum: 0, maximum: 7, description: "캐릭터셋 안의 인물 번호 0~7" },
        },
        description: "피해자로 쓸 게임 캐릭터(주인공 배우의 캐릭터 그림)",
      },
      victimResourceId: { type: "string", description: "대안: 이미 등록된 정지 인물 picture(걷기 프레임 없이 이동만 한다)" },
      speaker: { type: "string", description: "속마음 화자 이름(기본 '나')" },
      beforeLines: { type: "array", items: { type: "string" }, description: "사고 전 속마음 대사" },
      honkText: { type: "string", description: "경적 대사(기본 '빠아아아앙——!!!')" },
      afterLines: { type: "array", items: { type: "string" }, description: "흰 화면 위 내레이션" },
      bgmResourceId: { type: "string" },
      impactSeResourceId: { type: "string", description: "충돌 효과음(기본 강한 타격)" },
      honkSeResourceId: { type: "string" },
      roadTop: { type: "number", minimum: 0.2, maximum: 0.8, description: "도로 띠 위 끝(화면 높이 비율, 기본 0.45)" },
      roadBottom: { type: "number", minimum: 0.4, maximum: 0.95, description: "도로 띠 아래 끝(화면 높이 비율, 기본 0.8)" },
      crossingX: { type: "number", minimum: 0.2, maximum: 0.8, description: "횡단 위치(화면 너비 비율, 기본 0.5 — 횡단보도 중앙)" },
      eventId: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
      trigger: { type: "string", enum: ["auto", "action"], description: "기본 auto(한 번만)" },
      skippable: { type: "boolean" },
    },
  },
  invalidArgsExample: {
    mapId: "map1", backdropResourceId: "cutscene_backdrop_x", vehicleResourceId: "cutscene_sprite_y",
    victimCharacter: { resourceId: "tex_easyrpg_charset_actor1", characterIndex: 0 }, roadTop: 0.48, roadBottom: 0.82,
    beforeLines: ["오늘도 야근이었다."], afterLines: ["……쿵.", "눈을 떴을 때, 세상은 새하얗게 비어 있었다."],
  },
  async prepare(args): Promise<void> {
    const character = characterArg(args);
    if (!character) return;
    const key = characterKey(character.resourceId, character.characterIndex);
    if (preparedCharacters.get(key) && !("error" in preparedCharacters.get(key)!)) return;
    try {
      // prepare 는 프로젝트를 받지 못한다 — 번들 캐릭터셋(tex_easyrpg_*)은 프로젝트 없이 풀린다. 업로드 캐릭터셋은 지원하지 않는다.
      preparedCharacters.set(key, await cropCharsetFrames(undefined, character.resourceId, character.characterIndex));
    } catch (error) {
      preparedCharacters.set(key, { error: error instanceof Error ? error.message : String(error) });
    }
  },
  run(draft, args): ToolExecResult {
    if (!SCRIPT_CUTSCENE) throw new ToolError("script_cutscene 도구를 찾을 수 없습니다.", { code: "missing-inner-tool" });
    const map = requireMap(draft, args.mapId as string);
    const viewport = draft.system.playResolution ?? DEFAULT_PLAY_RESOLUTION;
    const backdropId = requireResource(args.backdropResourceId, "backdropResourceId");
    const vehicleId = requireResource(args.vehicleResourceId, "vehicleResourceId");
    for (const [field, id] of [["backdropResourceId", backdropId], ["vehicleResourceId", vehicleId]] as const) {
      if (!draft.assets.uploaded[id]) throw new ToolError(`${field} '${id}' 는 등록된 그림이 아닙니다 — generate_cutscene_art 의 결과 id 를 쓰세요.`, { code: "unknown-resource" });
    }
    const character = characterArg(args);
    let victim: VictimFrames;
    if (character) {
      const prepared = preparedCharacters.get(characterKey(character.resourceId, character.characterIndex));
      if (!prepared) throw new ToolError("캐릭터 프레임이 준비되지 않았습니다 — 같은 인자로 다시 호출하세요.", { code: "character-not-prepared" });
      if ("error" in prepared) throw new ToolError(`캐릭터 프레임을 만들지 못했습니다: ${prepared.error}`, { code: "character-frames-failed" });
      for (const role of CHARSET_FRAME_ROLES) {
        const frame = prepared.frames[role];
        draft.assets.uploaded[frame.id] = { id: frame.id, name: `컷신 캐릭터 ${role}`, kind: "picture", dataUrl: frame.dataUrl, meta: { width: prepared.width, height: prepared.height } };
      }
      const id = (role: CharsetFrameRole): string => prepared.frames[role].id;
      victim = { walk: [id("walkDown0"), id("walkDown1"), id("walkDown2")], shock: id("faceRight"), still: id("walkDown1"), width: prepared.width, height: prepared.height };
    } else {
      const victimId = requireResource(args.victimResourceId, "victimCharacter 또는 victimResourceId");
      if (!draft.assets.uploaded[victimId]) throw new ToolError(`victimResourceId '${victimId}' 는 등록된 그림이 아닙니다.`, { code: "unknown-resource" });
      const size = pictureSize(draft, victimId, { width: 24, height: 32 });
      victim = { still: victimId, width: size.width, height: size.height };
    }
    const facing = args.vehicleFacing === "right" ? "right" : "left";
    const roadTop = ratio(args.roadTop, 0.45, 0.2, 0.8);
    const roadBottom = Math.max(roadTop + 0.1, ratio(args.roadBottom, 0.8, 0.4, 0.95));
    const choreography = buildImpactChoreography({
      viewport,
      backdrop: { id: backdropId, ...pictureSize(draft, backdropId, viewport) },
      vehicle: { id: vehicleId, facing, ...pictureSize(draft, vehicleId, { width: 96, height: 48 }) },
      victim,
      speaker: typeof args.speaker === "string" && args.speaker.trim() ? args.speaker.trim() : "나",
      beforeLines: strings(args.beforeLines),
      honkText: typeof args.honkText === "string" && args.honkText.trim() ? args.honkText.trim() : "빠아아아앙——!!!",
      afterLines: strings(args.afterLines),
      ...(typeof args.bgmResourceId === "string" && args.bgmResourceId.trim() ? { bgmResourceId: args.bgmResourceId.trim() } : {}),
      impactSeResourceId: typeof args.impactSeResourceId === "string" && args.impactSeResourceId.trim() ? args.impactSeResourceId.trim() : DEFAULT_IMPACT_SE,
      ...(typeof args.honkSeResourceId === "string" && args.honkSeResourceId.trim() ? { honkSeResourceId: args.honkSeResourceId.trim() } : {}),
      roadTop,
      roadBottom,
      crossingX: ratio(args.crossingX, 0.5, 0.2, 0.8),
    });
    if (!draft.assets.uploaded[CUTSCENE_WHITE_RESOURCE_ID]) {
      draft.assets.uploaded[CUTSCENE_WHITE_RESOURCE_ID] = {
        id: CUTSCENE_WHITE_RESOURCE_ID, name: "컷신 흰 화면", kind: "picture", dataUrl: WHITE_PIXEL_DATA_URL, meta: { width: 2, height: 2 },
      };
    }
    const trigger = args.trigger === "action" ? "action" : "auto";
    const cutsceneArgs: Record<string, unknown> = {
      _composedByStageTool: true,
      mapId: map.id,
      beats: choreography.beats,
      skippable: args.skippable !== false,
      trigger,
      ...(trigger === "auto" ? { once: true } : {}),
    };
    if (typeof args.eventId === "string" && args.eventId.trim()) cutsceneArgs.eventId = args.eventId.trim();
    if (typeof args.x === "number") cutsceneArgs.x = Math.trunc(args.x);
    if (typeof args.y === "number") cutsceneArgs.y = Math.trunc(args.y);
    const cut = SCRIPT_CUTSCENE.run(draft, cutsceneArgs);
    // 컷신 속 인물과 이세계(맵)의 주인공이 같은 사람이어야 한다 — 고른 Actor 인물로 주인공 그래픽을 맞춘다.
    let heroNote = "";
    if (character) {
      const hero = draft.database.actors.find((actor) => actor.id === "actor_hero") ?? draft.database.actors[0];
      if (hero) {
        hero.characterResourceId = character.resourceId.replace(/^tex_easyrpg_charset_/u, "easyrpg-charset-");
        hero.characterIndex = character.characterIndex;
        const face = reviewedFaceIdForCharset(hero.characterResourceId, character.characterIndex);
        if (face) hero.faceResourceId = face;
        heroNote = ` 주인공 '${hero.name}' 의 맵 그래픽도 ${hero.characterResourceId} #${character.characterIndex} 로 맞췄습니다.`;
      }
    }
    return {
      summary: `${map.name}에 충돌 컷신 배치 — beat ${choreography.beats.length}개 (탈것이 x=${choreography.layout.vehicle.contactX} 에서 인물에 닿음). preview_cutscene 으로 확인하세요.${heroNote}`,
      data: { eventId: (cut.data as { eventId?: string } | undefined)?.eventId, layout: choreography.layout, beatCount: choreography.beats.length },
      ...(cut.warnings && cut.warnings.length > 0 ? { warnings: cut.warnings } : {}),
    };
  },
};

export const IMPACT_CUTSCENE_TOOLS: readonly ToolDefinition[] = [scriptCutsceneImpact];
