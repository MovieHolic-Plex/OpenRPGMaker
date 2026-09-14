// editor/tools/cinematicTools.ts
// 오프닝 시네마틱(system.opening)의 AI 저작면. DB 「오프닝」 탭과 같은 레코드를 쓰므로
// 런타임(새 게임 시작 전 재생)이 그대로 소비한다.
import {
  CINEMATIC_DURATION_MAX_MS,
  CINEMATIC_SCENE_LIMIT,
  normalizeCinematicSequence,
  type CinematicMotion,
  type CinematicScene,
  type CinematicSequence,
} from "@/project/cinematicSettings";
import { listDatabaseResourceOptions, type DatabaseResourcePickerKind } from "@/editor/resourceOptions";
import type { Project } from "@/project/types";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";

const OPENING_MEDIA_KINDS = ["image", "movie", "sound"] as const;
type OpeningMediaKind = (typeof OPENING_MEDIA_KINDS)[number];

const MEDIA_KIND_LABEL: Record<OpeningMediaKind, string> = {
  image: "이미지",
  movie: "영상",
  sound: "내레이션 음성",
};

const MOTIONS: readonly CinematicMotion[] = ["none", "fade", "pan", "zoom"];
const MEDIA_RESULT_LIMIT_MAX = 200;

const OPENING_FIELD_NAMES = [
  "id", "kind", "narration", "narrationAudioResourceId", "durationMs", "resourceId", "motion",
] as const;

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ToolError(`${label}은 객체여야 합니다.`, { code: "invalid-args" });
  }
  return value as Record<string, unknown>;
}

function catalogIds(project: Project, kind: OpeningMediaKind): string[] {
  return listDatabaseResourceOptions(kind as DatabaseResourcePickerKind, project).map(entry => entry.id);
}

/** kind별 피커 카탈로그 조회 — 한 호출 안에서 종류별로 한 번만 만든다(카탈로그 스캔이 수백 개 id를 돈다). */
function catalogLookup(project: Project): (kind: OpeningMediaKind, id: string) => boolean {
  const cache = new Map<OpeningMediaKind, Set<string>>();
  return (kind, id) => {
    let ids = cache.get(kind);
    if (!ids) {
      ids = new Set(catalogIds(project, kind));
      cache.set(kind, ids);
    }
    return ids.has(id);
  };
}

function sceneKind(value: unknown, index: number): CinematicScene["kind"] {
  if (value === "text" || value === "image" || value === "video") return value;
  throw new ToolError(
    `scenes[${index}].kind는 text/image/video 중 하나여야 합니다: ${JSON.stringify(value)}`,
    { code: "invalid-args" },
  );
}

function sceneDuration(value: unknown, index: number): number {
  if (value === undefined) return 0;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > CINEMATIC_DURATION_MAX_MS) {
    throw new ToolError(
      `scenes[${index}].durationMs는 0~${CINEMATIC_DURATION_MAX_MS} 사이의 정수여야 합니다(0은 확인 입력/영상 끝까지).`,
      { code: "invalid-args" },
    );
  }
  return value;
}

function sceneNarration(value: unknown, index: number): string {
  if (value === undefined) return "";
  if (typeof value !== "string") {
    throw new ToolError(`scenes[${index}].narration은 문자열이어야 합니다.`, { code: "invalid-args" });
  }
  return value;
}

function resolveResourceId(
  project: Project,
  kind: OpeningMediaKind,
  raw: unknown,
  index: number,
  field: "resourceId" | "narrationAudioResourceId",
  isKnown: (kind: OpeningMediaKind, id: string) => boolean,
): string {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new ToolError(
      `scenes[${index}].${field}는 비어 있지 않은 리소스 id여야 합니다.`,
      { code: "invalid-args" },
    );
  }
  const id = raw.trim();
  if (!isKnown(kind, id)) {
    const candidates = catalogIds(project, kind).slice(0, 20).join(", ");
    throw new ToolError(
      `scenes[${index}].${field} id를 프로젝트에서 찾을 수 없습니다: ${id}. `
      + `list_opening_media(kind:"${kind}")로 ${MEDIA_KIND_LABEL[kind]} 후보를 확인하세요.`
      + (candidates ? ` 현재 후보: ${candidates}` : ""),
      { code: "resource-not-found" },
    );
  }
  return id;
}

function normalizeScene(project: Project, raw: unknown, index: number, isKnown: (kind: OpeningMediaKind, id: string) => boolean): CinematicScene {
  const scene = requireRecord(raw, `scenes[${index}]`);
  for (const key of Object.keys(scene)) {
    if (!(OPENING_FIELD_NAMES as readonly string[]).includes(key)) {
      throw new ToolError(`scenes[${index}].${key}는 지원하지 않는 필드입니다.`, { code: "invalid-args" });
    }
  }

  const kind = sceneKind(scene.kind, index);
  const id = scene.id === undefined ? `opening-scene-${index + 1}` : scene.id;
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new ToolError(`scenes[${index}].id는 비어 있을 수 없습니다.`, { code: "invalid-args" });
  }

  const narration = sceneNarration(scene.narration, index);
  const durationMs = sceneDuration(scene.durationMs, index);
  const narrationAudioResourceId = scene.narrationAudioResourceId === undefined
    ? undefined
    : resolveResourceId(project, "sound", scene.narrationAudioResourceId, index, "narrationAudioResourceId", isKnown);
  const common = {
    id: id.trim(),
    narration,
    durationMs,
    ...(narrationAudioResourceId ? { narrationAudioResourceId } : {}),
  };

  if (kind === "text") {
    for (const forbidden of ["resourceId", "motion"] as const) {
      if (scene[forbidden] !== undefined) {
        throw new ToolError(
          `scenes[${index}]는 텍스트 장면이라 ${forbidden}를 가질 수 없습니다. 그림/영상은 kind를 image/video로 두세요.`,
          { code: "invalid-args" },
        );
      }
    }
    return { ...common, kind: "text" };
  }

  const resourceId = resolveResourceId(project, kind === "video" ? "movie" : "image", scene.resourceId, index, "resourceId", isKnown);
  if (kind === "video") {
    if (scene.motion !== undefined) {
      throw new ToolError(`scenes[${index}]는 영상 장면이라 motion을 가질 수 없습니다(움직임은 image 전용).`, { code: "invalid-args" });
    }
    return { ...common, kind: "video", resourceId };
  }

  const motion = scene.motion === undefined ? "none" : scene.motion;
  if (!MOTIONS.includes(motion as CinematicMotion)) {
    throw new ToolError(`scenes[${index}].motion은 ${MOTIONS.join("/")} 중 하나여야 합니다.`, { code: "invalid-args" });
  }
  return { ...common, kind: "image", resourceId, motion: motion as CinematicMotion };
}

function buildSequence(project: Project, args: Record<string, unknown>): { sequence: CinematicSequence; warnings: string[] } {
  const rawScenes = args.scenes;
  if (!Array.isArray(rawScenes)) {
    throw new ToolError("scenes는 장면 배열이어야 합니다.", { code: "invalid-args" });
  }
  if (rawScenes.length > CINEMATIC_SCENE_LIMIT) {
    throw new ToolError(
      `장면은 최대 ${CINEMATIC_SCENE_LIMIT}개까지 저장할 수 있습니다(요청 ${rawScenes.length}개).`,
      { code: "too-many-scenes" },
    );
  }
  for (const key of Object.keys(args)) {
    if (key !== "enabled" && key !== "skippable" && key !== "scenes") {
      throw new ToolError(`set_opening의 ${key}는 지원하지 않는 인자입니다.`, { code: "invalid-args" });
    }
  }

  const warnings: string[] = [];
  const isKnown = catalogLookup(project);
  const scenes = rawScenes.map((raw, index) => normalizeScene(project, raw, index, isKnown));
  const ids = new Set<string>();
  for (const [index, scene] of scenes.entries()) {
    if (ids.has(scene.id)) {
      throw new ToolError(`scenes[${index}].id가 중복입니다: ${scene.id}`, { code: "duplicate-scene-id" });
    }
    ids.add(scene.id);
  }

  const existing = project.system.opening;
  const enabled = args.enabled === undefined ? existing?.enabled ?? true : args.enabled;
  if (typeof enabled !== "boolean") {
    throw new ToolError("enabled는 true/false여야 합니다.", { code: "invalid-args" });
  }
  const skippable = args.skippable === undefined ? existing?.skippable ?? true : args.skippable;
  if (typeof skippable !== "boolean") {
    throw new ToolError("skippable은 true/false여야 합니다.", { code: "invalid-args" });
  }

  const sequence = normalizeCinematicSequence({ enabled, skippable, scenes });
  if (!sequence.enabled && sequence.scenes.length > 0) {
    warnings.push("오프닝 사용이 꺼져 있어 실제 게임에서는 재생되지 않습니다. 재생하려면 enabled:true로 다시 저장하세요.");
  }
  return { sequence, warnings };
}

function countByKind(sequence: CinematicSequence): string {
  const counts = new Map<CinematicScene["kind"], number>();
  for (const scene of sequence.scenes) counts.set(scene.kind, (counts.get(scene.kind) ?? 0) + 1);
  const label: Record<CinematicScene["kind"], string> = { text: "텍스트", image: "이미지", video: "영상" };
  return [...counts.entries()].map(([kind, count]) => `${label[kind]} ${count}`).join("·");
}

const OPENING_SCENE_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["kind"],
  properties: {
    id: { type: "string" },
    kind: { type: "string", enum: ["text", "image", "video"] },
    narration: { type: "string" },
    durationMs: { type: "integer", minimum: 0, maximum: CINEMATIC_DURATION_MAX_MS },
    resourceId: { type: "string" },
    motion: { type: "string", enum: MOTIONS },
    narrationAudioResourceId: { type: "string" },
  },
};

const getOpening: ToolDefinition = {
  name: "get_opening",
  description: "현재 오프닝 시네마틱(system.opening)을 그대로 반환한다. 없으면 opening:null 이며 기본값을 만들지 않는다.",
  mode: "read",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  run(project): ToolExecResult {
    const opening = project.system.opening;
    if (!opening) {
      return { summary: "오프닝 시네마틱이 아직 없습니다(새 게임 시작 시 재생되는 연출 없음).", data: { opening: null, sceneCount: 0 } };
    }
    const warnings: string[] = [];
    if (!opening.enabled && opening.scenes.length > 0) {
      warnings.push("오프닝 사용이 꺼져 있어 실제 게임에서는 재생되지 않습니다.");
    }
    const isKnown = catalogLookup(project);
    const missing = opening.scenes
      .flatMap(scene => (scene.kind === "text" ? [] : [[scene.kind === "video" ? "movie" : "image", scene.resourceId] as const]))
      .filter(([kind, id]) => !isKnown(kind, id))
      .map(([, id]) => id);
    if (missing.length > 0) warnings.push(`프로젝트에서 찾을 수 없는 미디어 참조가 있습니다: ${[...new Set(missing)].join(", ")}`);
    return {
      summary: `오프닝 장면 ${opening.scenes.length}개(${countByKind(opening)}), 사용 ${opening.enabled ? "켜짐" : "꺼짐"}, 건너뛰기 ${opening.skippable ? "가능" : "불가"}.`,
      data: { opening, sceneCount: opening.scenes.length, enabled: opening.enabled, skippable: opening.skippable },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

const setOpening: ToolDefinition = {
  name: "set_opening",
  description:
    "새 게임 시작 전에 재생되는 오프닝(system.opening) 장면 목록을 통째로 저장한다. "
    + "장면: kind text/image/video, image·video 는 resourceId 필수, motion 은 image 전용, "
    + "durationMs 0 은 확인 입력(영상은 재생 끝)까지 기다린다. 일부만 고치려면 get_opening 결과에 바꿀 장면을 반영해 전체를 보낸다. "
    + "미디어 id 는 list_opening_media 로 확인하고, 재생되게 하려면 enabled:true.",
  mode: "write",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["scenes"],
    properties: {
      enabled: { type: "boolean" },
      skippable: { type: "boolean" },
      scenes: { type: "array", items: OPENING_SCENE_SCHEMA },
    },
  },
  invalidArgsExample: {
    enabled: true,
    skippable: true,
    scenes: [
      { kind: "text", narration: "오래된 편지 한 장이 남았다.", durationMs: 0 },
      { kind: "image", resourceId: "picture_img_0001", narration: "그날의 사진", durationMs: 4000, motion: "zoom" },
      { kind: "video", resourceId: "movie_intro", narration: "영상", durationMs: 0, narrationAudioResourceId: "sound_voice" },
    ],
  },
  invalidArgsHint: "미디어 id는 list_opening_media(kind:\"image\"|\"movie\"|\"sound\") 결과에서 고르세요.",
  run(draft, args): ToolExecResult {
    const { sequence, warnings } = buildSequence(draft, args);
    draft.system.opening = sequence;
    return {
      summary: `오프닝 장면 ${sequence.scenes.length}개를 저장했습니다(${countByKind(sequence) || "빈 시퀀스"}), 사용 ${sequence.enabled ? "켜짐" : "꺼짐"}, 건너뛰기 ${sequence.skippable ? "가능" : "불가"}.`,
      data: { opening: sequence },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

const removeOpening: ToolDefinition = {
  name: "remove_opening",
  description: "오프닝 시퀀스를 프로젝트에서 제거한다(작성한 장면을 전부 지움). 장면을 잠시 끄려면 set_opening(enabled:false)을 쓴다.",
  mode: "write",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  run(draft): ToolExecResult {
    if (!draft.system.opening) {
      throw new ToolError("제거할 오프닝 시퀀스가 없습니다.", { code: "opening-missing" });
    }
    const scenes = draft.system.opening.scenes.length;
    delete draft.system.opening;
    return { summary: `오프닝 시퀀스(장면 ${scenes}개)를 제거했습니다.`, data: { removed: true, sceneCount: scenes } };
  },
};

const listOpeningMedia: ToolDefinition = {
  name: "list_opening_media",
  description:
    "오프닝 장면에 쓸 미디어 후보를 DB 「오프닝」 탭과 같은 목록에서 반환한다. "
    + "kind image(그림)/movie(영상)/sound(내레이션 음성) — 결과에 없는 id 는 저장이 거부된다.",
  mode: "read",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["kind"],
    properties: {
      kind: { type: "string", enum: OPENING_MEDIA_KINDS },
      query: { type: "string" },
      offset: { type: "integer", minimum: 0 },
      limit: { type: "integer", minimum: 1, maximum: MEDIA_RESULT_LIMIT_MAX },
    },
  },
  run(project, args): ToolExecResult {
    const kind = OPENING_MEDIA_KINDS.find(entry => entry === args.kind);
    if (!kind) {
      throw new ToolError(`알 수 없는 미디어 종류: ${String(args.kind)} — image/movie/sound 중 하나여야 합니다.`, { code: "invalid-kind" });
    }
    const rawQuery = args.query;
    if (rawQuery !== undefined && typeof rawQuery !== "string") {
      throw new ToolError("query는 문자열이어야 합니다.", { code: "invalid-args" });
    }
    const offset = args.offset === undefined ? 0 : args.offset;
    const limit = args.limit === undefined ? 20 : args.limit;
    if (typeof offset !== "number" || !Number.isSafeInteger(offset) || offset < 0) {
      throw new ToolError("offset은 0 이상의 정수여야 합니다.", { code: "invalid-args" });
    }
    if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > MEDIA_RESULT_LIMIT_MAX) {
      throw new ToolError(`limit은 1~${MEDIA_RESULT_LIMIT_MAX}의 정수여야 합니다.`, { code: "invalid-args" });
    }

    const needle = (rawQuery ?? "").trim().toLocaleLowerCase();
    const all = listDatabaseResourceOptions(kind as DatabaseResourcePickerKind, project)
      .filter(entry => needle.length === 0
        || entry.id.toLocaleLowerCase().includes(needle)
        || entry.name.toLocaleLowerCase().includes(needle)
        || (entry.searchTerms ?? []).some(term => term.toLocaleLowerCase().includes(needle)));
    const matches = all.slice(offset, offset + limit).map(entry => ({ id: entry.id, name: entry.name }));
    const nextOffset = offset + matches.length < all.length ? offset + matches.length : null;
    return {
      summary: `${MEDIA_KIND_LABEL[kind]} 후보 ${matches.length}개 조회(전체 ${all.length}개, kind=${kind}).`,
      data: { matches, total: all.length, nextOffset, kind },
    };
  },
};

export const CINEMATIC_TOOLS: readonly ToolDefinition[] = [getOpening, setOpening, removeOpening, listOpeningMedia];
