// 충돌 컷신(트럭에 치임 등) — 「그림을 그린 다음 그 그림을 움직인다」의 둘째 절반.
// 조수는 배경·탈것·피해자 그림 id 와 대사만 고른다. 어디서 출발해 어디서 닿고 어디로 튕겨 나가는지의
// 좌표·타이밍은 여기서 계산해 script_cutscene 의 picture/flash/shake/music beat 로 컴파일한다.
// (손으로 맞출 때 «트럭이 사람에게 닿지 않는» 결함이 났다 — 2026-10-02 조수 시험.)
import { DEFAULT_PLAY_RESOLUTION } from "@/project/playResolution";
import { EVENT_TOOLS } from "./eventTools";
import { requireMap } from "./mapHelpers";
import { pictureSize } from "@/editor/cutsceneArt/pictureSize";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

export const IMPACT_CUTSCENE_TOOL = "script_cutscene_impact";

/** 2×2 순백 PNG. 컷신이 화면을 하얗게 덮을 때 크게 늘려 쓴다(fade 는 검정뿐이다). */
const WHITE_PIXEL_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGP8////fwYGBgYmBigAAD34BADaOyqcAAAAAElFTkSuQmCC";
export const CUTSCENE_WHITE_RESOURCE_ID = "cutscene_white_screen";

/** 기본 효과음(Kenney CC0 강한 타격). */
const DEFAULT_IMPACT_SE = "cc0-se-kis-impactpunch-heavy-002";

type RecordValue = Record<string, unknown>;

function requireResource(id: unknown, field: string, optional = false): string | undefined {
  if (id === undefined || id === null || id === "") {
    if (optional) return undefined;
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

export interface ImpactChoreography {
  readonly beats: RecordValue[];
  readonly layout: {
    readonly victim: { readonly x: number; readonly yStart: number; readonly yEnd: number; readonly scale: number; readonly width: number; readonly height: number };
    readonly vehicle: { readonly y: number; readonly scale: number; readonly width: number; readonly height: number; readonly contactX: number; readonly fromX: number; readonly exitX: number; readonly facing: "left" | "right" };
    readonly backdropScale: number;
  };
}

export interface ImpactChoreographyInput {
  readonly viewport: { readonly width: number; readonly height: number };
  readonly backdrop: { readonly id: string; readonly width: number; readonly height: number };
  readonly vehicle: { readonly id: string; readonly width: number; readonly height: number; readonly facing: "left" | "right" };
  readonly victim: { readonly id: string; readonly shockId?: string; readonly width: number; readonly height: number };
  readonly speaker: string;
  readonly beforeLines: readonly string[];
  readonly honkText: string;
  readonly afterLines: readonly string[];
  readonly bgmResourceId?: string;
  readonly impactSeResourceId: string;
  readonly honkSeResourceId?: string;
  /** 도로 아래 끝(화면 높이 비율). 피해자 발끝과 탈것 바퀴가 여기에 놓인다. */
  readonly roadBottom: number;
  /** 횡단 위치(화면 너비 비율, 피해자 가운데). */
  readonly crossingX: number;
}

/** 순수 계산: 입력 → beat 목록과 배치. 테스트와 미리보기가 같은 함수를 쓴다. */
export function buildImpactChoreography(input: ImpactChoreographyInput): ImpactChoreography {
  const { viewport: { width: W, height: H } } = input;
  const backdropScale = Math.round((W / input.backdrop.width) * 100);
  const victimScale = Math.max(20, Math.round(((0.27 * H) / input.victim.height) * 100));
  const victimW = (input.victim.width * victimScale) / 100;
  const victimH = (input.victim.height * victimScale) / 100;
  // 탈것은 사람 키의 1.7배쯤 보여야 한다 — 너비 0.7W 와 높이 0.46H 중 작은 쪽에 맞춘다.
  const vehicleScale = Math.max(20, Math.round(Math.min((0.7 * W) / input.vehicle.width, (0.46 * H) / input.vehicle.height) * 100));
  const vehicleW = (input.vehicle.width * vehicleScale) / 100;
  const vehicleH = (input.vehicle.height * vehicleScale) / 100;
  const feetY = H * input.roadBottom - H * 0.06;
  const yEnd = Math.round(feetY - victimH);
  const yStart = Math.round(yEnd - H * 0.2);
  const victimX = Math.round(W * input.crossingX - victimW / 2);
  const vehicleY = Math.round(H * input.roadBottom - vehicleH);
  const facingLeft = input.vehicle.facing === "left";
  // 탈것이 바라보는 쪽의 반대편에서 들어와 피해자 몸통(가까운 쪽 35%)에 앞면이 닿는다.
  const contactX = Math.round(facingLeft ? victimX + victimW * 0.65 : victimX + victimW * 0.35 - vehicleW);
  const fromX = facingLeft ? Math.round(W + 12) : Math.round(-vehicleW - 12);
  const exitX = facingLeft ? Math.round(-vehicleW - 24) : Math.round(W + 24);
  const flyX = Math.round(victimX + (facingLeft ? -1 : 1) * W * 0.4);
  const flyY = Math.round(-victimH * 0.4);
  const steps = 6;
  const walk: RecordValue[] = [];
  for (let i = 1; i <= steps; i += 1) {
    walk.push({
      kind: "picture", action: "move", pictureId: "pic2", x: victimX, y: Math.round(yStart + ((yEnd - yStart) * i) / steps),
      scale: victimScale, rotation: i % 2 === 0 ? -4 : 4, durationMs: 280, wait: true,
    });
  }
  const beats: RecordValue[] = [
    { kind: "fade", direction: "out", durationMs: 0 },
    { kind: "picture", action: "show", pictureId: "pic1", resourceId: input.backdrop.id, x: 0, y: 0, scale: backdropScale },
    { kind: "picture", action: "show", pictureId: "pic2", resourceId: input.victim.id, x: victimX, y: yStart, scale: victimScale },
    ...(input.bgmResourceId ? [{ kind: "music", action: "bgm", resourceId: input.bgmResourceId }] : []),
    { kind: "fade", direction: "in", durationMs: 900, wait: true },
    ...input.beforeLines.flatMap((text): RecordValue[] => [
      { kind: "say", speaker: input.speaker, text, context: "thought" },
      { kind: "wait", ms: 250 },
    ]),
    ...walk,
    ...(input.victim.shockId
      ? [
        { kind: "picture", action: "erase", pictureId: "pic2" },
        { kind: "picture", action: "show", pictureId: "pic2", resourceId: input.victim.shockId, x: victimX, y: yEnd, scale: victimScale },
      ]
      : []),
    { kind: "shake", intensity: 3, durationMs: 350 },
    ...(input.honkSeResourceId ? [{ kind: "music", action: "se", resourceId: input.honkSeResourceId }] : []),
    { kind: "say", context: "shout", autoAdvance: true, text: input.honkText },
    { kind: "wait", ms: 500 },
    { kind: "picture", action: "show", pictureId: "pic3", resourceId: input.vehicle.id, x: fromX, y: vehicleY, scale: vehicleScale },
    { kind: "picture", action: "move", pictureId: "pic3", x: contactX, y: vehicleY, scale: vehicleScale, durationMs: 520, wait: true },
    { kind: "music", action: "se", resourceId: input.impactSeResourceId },
    { kind: "flash", color: "white", durationMs: 600 },
    { kind: "shake", intensity: 9, durationMs: 900 },
    { kind: "parallel", beats: [
      { kind: "picture", action: "move", pictureId: "pic2", x: flyX, y: flyY, scale: Math.round(victimScale * 1.3), rotation: 720, opacity: 0, durationMs: 800 },
      { kind: "picture", action: "move", pictureId: "pic3", x: exitX, y: vehicleY, scale: vehicleScale, durationMs: 700 },
    ] },
    { kind: "wait", ms: 900 },
    { kind: "picture", action: "show", pictureId: "pic5", resourceId: CUTSCENE_WHITE_RESOURCE_ID, x: 0, y: 0, scale: Math.max(W, H) * 50, opacity: 0 },
    { kind: "picture", action: "move", pictureId: "pic5", x: 0, y: 0, scale: Math.max(W, H) * 50, opacity: 255, durationMs: 900, wait: true },
    ...input.afterLines.flatMap((text): RecordValue[] => [{ kind: "say", context: "narration", text }, { kind: "wait", ms: 300 }]),
  ];
  return {
    beats,
    layout: {
      victim: { x: victimX, yStart, yEnd, scale: victimScale, width: Math.round(victimW), height: Math.round(victimH) },
      vehicle: { y: vehicleY, scale: vehicleScale, width: Math.round(vehicleW), height: Math.round(vehicleH), contactX, fromX, exitX, facing: input.vehicle.facing },
      backdropScale,
    },
  };
}

const SCRIPT_CUTSCENE = EVENT_TOOLS.find((tool) => tool.name === "script_cutscene");

const scriptCutsceneImpact: ToolDefinition = {
  name: IMPACT_CUTSCENE_TOOL,
  description:
    "탈것이 인물에게 돌진해 부딪히는 충돌 컷신(트럭 사고 등)을 한 번에 만든다. 그림이 움직이는 연출이므로 맵 타일·NPC 이동 없이 picture 로 처리한다. "
    + "먼저 generate_cutscene_art 로 배경(role:backdrop)·탈것(role:sprite, 가로 시점)·인물(role:sprite)을 만들고 그 resourceId 를 넣는다. "
    + "도구가 좌표·타이밍을 계산한다: 인물이 걸어 들어오고 → 경적 대사 → 탈것이 달려와 닿는 순간 효과음·플래시·화면 흔들림 → 인물이 회전하며 날아가고 → 화면이 하얗게 덮이며 afterLines 내레이션. "
    + "vehicleFacing 은 탈것 그림이 바라보는 방향(left 면 오른쪽에서 들어온다). roadBottom 은 배경 그림에서 도로 아래 끝의 화면 높이 비율(0.4~0.95, 기본 0.7). "
    + "끝난 뒤 preview_cutscene 으로 핵심 장면을 눈으로 확인한다. 엔딩/이세계 이동 등 이후 연출은 같은 이벤트에 이어 붙이지 말고 별도 처리한다.",
  mode: "write",
  domains: ["event"],
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["mapId", "backdropResourceId", "vehicleResourceId", "victimResourceId"],
    properties: {
      mapId: { type: "string" },
      backdropResourceId: { type: "string", description: "빈 전체화면 배경 picture 리소스" },
      vehicleResourceId: { type: "string", description: "탈것 sprite picture 리소스(옆모습)" },
      vehicleFacing: { type: "string", enum: ["left", "right"], description: "탈것 그림이 바라보는 방향(기본 left)" },
      victimResourceId: { type: "string", description: "인물 sprite picture 리소스" },
      victimShockResourceId: { type: "string", description: "경적에 놀란 자세(선택)" },
      speaker: { type: "string", description: "속마음 화자 이름(기본 '나')" },
      beforeLines: { type: "array", items: { type: "string" }, description: "사고 전 속마음 대사" },
      honkText: { type: "string", description: "경적 대사(기본 '빠아아아앙——!!!')" },
      afterLines: { type: "array", items: { type: "string" }, description: "흰 화면 위 내레이션" },
      bgmResourceId: { type: "string" },
      impactSeResourceId: { type: "string", description: "충돌 효과음(기본 강한 타격)" },
      honkSeResourceId: { type: "string" },
      roadBottom: { type: "number", minimum: 0.4, maximum: 0.95 },
      crossingX: { type: "number", minimum: 0.2, maximum: 0.8, description: "횡단 위치(화면 너비 비율, 기본 0.5)" },
      eventId: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
      trigger: { type: "string", enum: ["auto", "action"], description: "기본 auto(한 번만)" },
      skippable: { type: "boolean" },
    },
  },
  invalidArgsExample: {
    mapId: "map1", backdropResourceId: "cutscene_backdrop_x", vehicleResourceId: "cutscene_sprite_y", victimResourceId: "cutscene_sprite_z",
    beforeLines: ["오늘도 야근이었다."], afterLines: ["……쿵.", "눈을 떴을 때, 세상은 새하얗게 비어 있었다."],
  },
  run(draft, args): ToolExecResult {
    if (!SCRIPT_CUTSCENE) throw new ToolError("script_cutscene 도구를 찾을 수 없습니다.", { code: "missing-inner-tool" });
    const map = requireMap(draft, args.mapId as string);
    const viewport = draft.system.playResolution ?? DEFAULT_PLAY_RESOLUTION;
    const backdropId = requireResource(args.backdropResourceId, "backdropResourceId")!;
    const vehicleId = requireResource(args.vehicleResourceId, "vehicleResourceId")!;
    const victimId = requireResource(args.victimResourceId, "victimResourceId")!;
    const shockId = requireResource(args.victimShockResourceId, "victimShockResourceId", true);
    for (const [field, id] of [["backdropResourceId", backdropId], ["vehicleResourceId", vehicleId], ["victimResourceId", victimId]] as const) {
      if (!draft.assets.uploaded[id]) throw new ToolError(`${field} '${id}' 는 등록된 그림이 아닙니다 — generate_cutscene_art 의 결과 id 를 쓰세요.`, { code: "unknown-resource" });
    }
    const facing = args.vehicleFacing === "right" ? "right" : "left";
    const choreography = buildImpactChoreography({
      viewport,
      backdrop: { id: backdropId, ...pictureSize(draft, backdropId, viewport) },
      vehicle: { id: vehicleId, facing, ...pictureSize(draft, vehicleId, { width: 192, height: 96 }) },
      victim: { id: victimId, ...(shockId ? { shockId } : {}), ...pictureSize(draft, victimId, { width: 64, height: 128 }) },
      speaker: typeof args.speaker === "string" && args.speaker.trim() ? args.speaker.trim() : "나",
      beforeLines: strings(args.beforeLines),
      honkText: typeof args.honkText === "string" && args.honkText.trim() ? args.honkText.trim() : "빠아아아앙——!!!",
      afterLines: strings(args.afterLines),
      ...(typeof args.bgmResourceId === "string" && args.bgmResourceId.trim() ? { bgmResourceId: args.bgmResourceId.trim() } : {}),
      impactSeResourceId: typeof args.impactSeResourceId === "string" && args.impactSeResourceId.trim() ? args.impactSeResourceId.trim() : DEFAULT_IMPACT_SE,
      ...(typeof args.honkSeResourceId === "string" && args.honkSeResourceId.trim() ? { honkSeResourceId: args.honkSeResourceId.trim() } : {}),
      roadBottom: ratio(args.roadBottom, 0.7, 0.4, 0.95),
      crossingX: ratio(args.crossingX, 0.5, 0.2, 0.8),
    });
    if (!draft.assets.uploaded[CUTSCENE_WHITE_RESOURCE_ID]) {
      draft.assets.uploaded[CUTSCENE_WHITE_RESOURCE_ID] = {
        id: CUTSCENE_WHITE_RESOURCE_ID, name: "컷신 흰 화면", kind: "picture", dataUrl: WHITE_PIXEL_DATA_URL, meta: { width: 2, height: 2 },
      };
    }
    const trigger = args.trigger === "action" ? "action" : "auto";
    const cutsceneArgs: Record<string, unknown> = {
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
    return {
      summary: `${map.name}에 충돌 컷신 배치 — beat ${choreography.beats.length}개 (탈것이 x=${choreography.layout.vehicle.contactX} 에서 인물에 닿음). preview_cutscene 으로 확인하세요.`,
      data: { eventId: (cut.data as { eventId?: string } | undefined)?.eventId, layout: choreography.layout, beatCount: choreography.beats.length },
      ...(cut.warnings && cut.warnings.length > 0 ? { warnings: cut.warnings } : {}),
    };
  },
};

export const IMPACT_CUTSCENE_TOOLS: readonly ToolDefinition[] = [scriptCutsceneImpact];
