import { validateGameOverSettings } from "@/project/io/shapeDatabaseFields";
// editor/tools/cinematicTools.ts
// 오프닝 시네마틱(system.opening)의 AI 저작면. DB 「오프닝」 탭과 같은 레코드를 쓰므로
// 런타임(새 게임 시작 전 재생)이 그대로 소비한다.
import {
  CINEMATIC_DURATION_MAX_MS,
  CINEMATIC_SCENE_LIMIT,
  normalizeCinematicSequence,
  normalizeGameOverSettings,
  type CinematicMotion,
  type CinematicScene,
  type CinematicSequence,
  type GameOverSettings,
} from "@/project/cinematicSettings";
import { listDatabaseResourceOptions, type DatabaseResourcePickerKind } from "@/editor/resourceOptions";
import { findOpeningStillMood } from "@/assets/openingStillMoods";
import type { Project } from "@/project/types";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";

const OPENING_MEDIA_KINDS = ["image", "movie", "sound", "music"] as const;
type OpeningMediaKind = (typeof OPENING_MEDIA_KINDS)[number];

const MEDIA_KIND_LABEL: Record<OpeningMediaKind, string> = {
  image: "이미지",
  movie: "영상",
  sound: "내레이션 음성",
  music: "배경음악",
};

/**
 * 모델이 보는 kind 와 피커 카탈로그의 대응. 그림은 시네마틱 스틸 카탈로그(배경화·타이틀 아트가 앞,
 * 아이템 아이콘은 호환용 꼬리)를 쓴다 — DB 「오프닝」 탭이 보는 목록과 같아야 한다.
 */
const PICKER_KIND: Record<OpeningMediaKind, DatabaseResourcePickerKind> = {
  image: "still",
  movie: "movie",
  sound: "sound",
  music: "music",
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
  return listDatabaseResourceOptions(PICKER_KIND[kind], project).map(entry => entry.id);
}

/** 스틸 후보의 성격 표시 — 모델이 전체화면 연출에 아이템 아이콘을 고르지 않게 한다. */
function stillGrouper(project: Project): (id: string) => string {
  const backdrops = new Set(listDatabaseResourceOptions("backdrop", project).map(entry => entry.id));
  const titles = new Set(listDatabaseResourceOptions("title", project).map(entry => entry.id));
  const icons = new Set(listDatabaseResourceOptions("image", project).map(entry => entry.id));
  return id => findOpeningStillMood(id)?.suitableForOpening === false ? "참고 이미지(오프닝 부적합)"
    : findOpeningStillMood(id) || backdrops.has(id) ? "배경화"
    : titles.has(id) ? "타이틀 아트"
      : icons.has(id) ? "아이콘(작음·전체화면 부적합)" : "그림";
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
  // 모델이 줄바꿈을 한 번 더 이스케이프해 「\\n」 두 글자로 보냈다 — 오프닝에 「밤.\n불의의」 가 그대로 떴다
  // (추리 도그푸딩 gen). 오프닝 서술에 글자 그대로의 백슬래시-n 을 쓸 이유는 없다.
  return value.replace(/\\r\\n|\\n/gu, "\n");
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
    if (key !== "enabled" && key !== "skippable" && key !== "scenes" && key !== "musicResourceId") {
      throw new ToolError(`set_opening의 ${key}는 지원하지 않는 인자입니다.`, { code: "invalid-args" });
    }
  }

  const warnings: string[] = [];
  const isKnown = catalogLookup(project);
  const musicResourceId = resolveMusicId(project, args.musicResourceId, isKnown);
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

  // 인자를 생략하면 기존 배경음악을 유지하고, 빈 문자열이면 지운다(enabled/skippable 과 같은 규칙).
  const music = musicResourceId === undefined ? existing?.musicResourceId : musicResourceId;
  const sequence = normalizeCinematicSequence({
    enabled,
    skippable,
    ...(music ? { musicResourceId: music } : {}),
    scenes,
  });
  if (!sequence.enabled && sequence.scenes.length > 0) {
    warnings.push("오프닝 사용이 꺼져 있어 실제 게임에서는 재생되지 않습니다. 재생하려면 enabled:true로 다시 저장하세요.");
  }
  return { sequence, warnings };
}

/**
 * 배경음악 id 검사. undefined 는 "건드리지 않음", 빈 문자열은 "비우기" — 둘을 구분해야
 * edit_opening(settings) 로 음악만 지울 수 있다.
 */
function resolveMusicId(
  project: Project,
  raw: unknown,
  isKnown: (kind: OpeningMediaKind, id: string) => boolean,
): string | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== "string") {
    throw new ToolError("musicResourceId는 문자열이어야 합니다(빈 문자열은 배경음악 제거).", { code: "invalid-args" });
  }
  const id = raw.trim();
  if (!id) return "";
  if (!isKnown("music", id)) {
    const candidates = catalogIds(project, "music").slice(0, 10).join(", ");
    throw new ToolError(
      `musicResourceId를 배경음악 목록에서 찾을 수 없습니다: ${id}. `
      + `list_opening_media(kind:"music")로 확인하세요(효과음·영상 id는 배경음악이 아닙니다).`
      + (candidates ? ` 현재 후보: ${candidates}` : ""),
      { code: "resource-not-found" },
    );
  }
  return id;
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
    if (opening.musicResourceId && !isKnown("music", opening.musicResourceId)) missing.push(opening.musicResourceId);
    if (missing.length > 0) warnings.push(`프로젝트에서 찾을 수 없는 미디어 참조가 있습니다: ${[...new Set(missing)].join(", ")}`);
    return {
      summary: `오프닝 장면 ${opening.scenes.length}개(${countByKind(opening)}), 사용 ${opening.enabled ? "켜짐" : "꺼짐"}, 건너뛰기 ${opening.skippable ? "가능" : "불가"}`
        + `${opening.musicResourceId ? `, 배경음악 ${opening.musicResourceId}` : ", 배경음악 없음"}.`,
      data: {
        opening,
        sceneCount: opening.scenes.length,
        enabled: opening.enabled,
        skippable: opening.skippable,
        musicResourceId: opening.musicResourceId ?? null,
      },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

const setOpening: ToolDefinition = {
  name: "set_opening",
  description:
    "새 게임 시작 전에 재생되는 오프닝(system.opening) 장면 목록을 통째로 저장한다. "
    + "장면: kind text/image/video, image·video 는 resourceId 필수, motion 은 image 전용, "
    + "durationMs 0 은 확인 입력(영상은 재생 끝)까지 기다린다. 장면 하나만 고치거나 순서만 바꿀 땐 edit_opening 을 쓴다. "
    + "musicResourceId 는 시퀀스 전체에 반복 재생되는 배경음악(생략 시 기존 유지, 빈 문자열은 제거). "
    + "미디어 id 는 list_opening_media 로 확인하고, 재생되게 하려면 enabled:true.",
  mode: "write",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["scenes"],
    properties: {
      enabled: { type: "boolean" },
      skippable: { type: "boolean" },
      musicResourceId: { type: "string", description: "시퀀스 배경음악(list_opening_media kind:music). 빈 문자열은 제거." },
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
  invalidArgsHint: "미디어 id는 list_opening_media(kind:\"image\"|\"movie\"|\"sound\"|\"music\") 결과에서 고르세요.",
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
    + "kind image(그림)/movie(영상)/sound(내레이션 음성)/music(배경음악) — 결과에 없는 id 는 저장이 거부된다. "
    + "그림은 group 으로 성격을 알려준다 — 전체화면은 배경화·타이틀 아트를 고르고(아이콘은 피함), 없으면 generate_opening_image. "
    + "스틸은 description(실제 그림), mood(분위기), useCases(서사 용도), series(같은 세계관), cautions(그림에 포함된 제약)를 반환한다. "
    + "query는 공백으로 나눈 단어를 모두 검색한다. 같은 series의 그림을 조합하고 설명과 맞는 내레이션을 작성한다.",
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

    const needles = (rawQuery ?? "").trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const all = listDatabaseResourceOptions(PICKER_KIND[kind], project)
      .filter(entry => {
        const text = [entry.id, entry.name, ...(entry.searchTerms ?? [])].join(" ").toLocaleLowerCase();
        return needles.every(needle => text.includes(needle));
      });
    const group = kind === "image" ? stillGrouper(project) : undefined;
    const matches = all.slice(offset, offset + limit).map(entry => {
      const still = kind === "image" ? findOpeningStillMood(entry.id) : undefined;
      return {
        id: entry.id,
        name: entry.name,
        ...(group ? { group: group(entry.id) } : {}),
        ...(still ? { description: still.description, tags: still.tags, mood: still.mood,
          useCases: still.useCases, series: still.series, cautions: still.cautions,
          suitableForOpening: still.suitableForOpening } : {}),
      };
    });
    const nextOffset = offset + matches.length < all.length ? offset + matches.length : null;
    return {
      summary: `${MEDIA_KIND_LABEL[kind]} 후보 ${matches.length}개 조회(전체 ${all.length}개, kind=${kind}).`,
      data: { matches, total: all.length, nextOffset, kind },
    };
  },
};

const OPENING_EDIT_OPS = ["append", "insert", "update", "remove", "move", "settings"] as const;
type OpeningEditOp = (typeof OPENING_EDIT_OPS)[number];
const OPENING_EDIT_ARG_NAMES = ["op", "index", "sceneId", "scene", "enabled", "skippable", "musicResourceId"] as const;

function editOp(value: unknown): OpeningEditOp {
  const op = OPENING_EDIT_OPS.find(entry => entry === value);
  if (!op) {
    throw new ToolError(
      `op은 ${OPENING_EDIT_OPS.join("/")} 중 하나여야 합니다: ${JSON.stringify(value)}`,
      { code: "invalid-args" },
    );
  }
  return op;
}

function editIndex(value: unknown, max: number, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > max) {
    throw new ToolError(`index는 0~${max} 사이의 정수여야 합니다(${label}). 받은 값: ${JSON.stringify(value)}`, { code: "invalid-args" });
  }
  return value;
}

function requireSceneId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ToolError("sceneId가 필요합니다. get_opening 으로 현재 장면 id 를 확인하세요.", { code: "invalid-args" });
  }
  return value.trim();
}

function sceneIndexById(scenes: readonly CinematicScene[], sceneId: string): number {
  const index = scenes.findIndex(scene => scene.id === sceneId);
  if (index < 0) {
    throw new ToolError(
      `오프닝 장면 ${sceneId}를 찾을 수 없습니다. 현재 장면: ${scenes.map(scene => scene.id).join(", ") || "없음"}`,
      { code: "scene-not-found" },
    );
  }
  return index;
}

const editOpening: ToolDefinition = {
  name: "edit_opening",
  description:
    "오프닝 장면 하나만 고친다(전체 재작성 불필요). op: append/insert(index)/update(sceneId)/remove(sceneId)/"
    + "move(sceneId,index)/settings(enabled·skippable·musicResourceId). 장면 규칙은 set_opening 과 같다.",
  mode: "write",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["op"],
    properties: {
      op: { type: "string", enum: OPENING_EDIT_OPS },
      index: { type: "integer", minimum: 0 },
      sceneId: { type: "string" },
      scene: OPENING_SCENE_SCHEMA,
      enabled: { type: "boolean" },
      skippable: { type: "boolean" },
      musicResourceId: { type: "string" },
    },
  },
  invalidArgsExample: { op: "append", scene: { kind: "text", narration: "그날 밤의 일이었다.", durationMs: 0 } },
  run(draft, args): ToolExecResult {
    for (const key of Object.keys(args)) {
      if (!(OPENING_EDIT_ARG_NAMES as readonly string[]).includes(key)) {
        throw new ToolError(`edit_opening의 ${key}는 지원하지 않는 인자입니다.`, { code: "invalid-args" });
      }
    }
    const op = editOp(args.op);
    const isKnown = catalogLookup(draft);
    const existing = draft.system.opening;
    if (!existing && op !== "append" && op !== "insert") {
      throw new ToolError(
        "오프닝 시퀀스가 아직 없습니다. edit_opening(op:\"append\") 또는 set_opening 으로 먼저 장면을 만드세요.",
        { code: "opening-missing" },
      );
    }
    const scenes: CinematicScene[] = existing ? [...existing.scenes] : [];
    const enabled = args.enabled === undefined ? existing?.enabled ?? true : args.enabled;
    if (typeof enabled !== "boolean") throw new ToolError("enabled는 true/false여야 합니다.", { code: "invalid-args" });
    const skippable = args.skippable === undefined ? existing?.skippable ?? true : args.skippable;
    if (typeof skippable !== "boolean") throw new ToolError("skippable은 true/false여야 합니다.", { code: "invalid-args" });
    const requestedMusic = resolveMusicId(draft, args.musicResourceId, isKnown);
    const music = requestedMusic === undefined ? existing?.musicResourceId : requestedMusic;

    if (op !== "settings" && op !== "remove" && op !== "move" && args.scene === undefined) {
      throw new ToolError(`op:"${op}"에는 scene 이 필요합니다.`, { code: "invalid-args" });
    }
    if ((op === "settings" || op === "remove" || op === "move") && args.scene !== undefined) {
      throw new ToolError(`op:"${op}"은 scene 을 받지 않습니다.`, { code: "invalid-args" });
    }

    let summary: string;
    switch (op) {
      case "settings": {
        summary = `오프닝 설정을 바꿨습니다(사용 ${enabled ? "켜짐" : "꺼짐"}, 건너뛰기 ${skippable ? "가능" : "불가"}, 배경음악 ${music || "없음"}).`;
        break;
      }
      case "append":
      case "insert": {
        if (scenes.length >= CINEMATIC_SCENE_LIMIT) {
          throw new ToolError(`장면은 최대 ${CINEMATIC_SCENE_LIMIT}개까지입니다. 먼저 뺄 장면을 지우세요.`, { code: "too-many-scenes" });
        }
        const at = op === "append" ? scenes.length : editIndex(args.index, scenes.length, "insert");
        const scene = normalizeScene(draft, args.scene, at, isKnown);
        if (scenes.some(entry => entry.id === scene.id)) {
          throw new ToolError(`이미 쓰고 있는 장면 id 입니다: ${scene.id}`, { code: "duplicate-scene-id" });
        }
        scenes.splice(at, 0, scene);
        summary = `장면 ${scene.id}를 ${at + 1}번째로 추가했습니다(총 ${scenes.length}개).`;
        break;
      }
      case "update": {
        const sceneId = requireSceneId(args.sceneId);
        const at = sceneIndexById(scenes, sceneId);
        const raw = { ...(args.scene as Record<string, unknown>) };
        if (raw.id === undefined) raw.id = sceneId;
        const scene = normalizeScene(draft, raw, at, isKnown);
        if (scenes.some((entry, entryIndex) => entryIndex !== at && entry.id === scene.id)) {
          throw new ToolError(`이미 쓰고 있는 장면 id 입니다: ${scene.id}`, { code: "duplicate-scene-id" });
        }
        scenes[at] = scene;
        summary = `장면 ${sceneId}를 ${scene.kind} 장면으로 교체했습니다.`;
        break;
      }
      case "remove": {
        const sceneId = requireSceneId(args.sceneId);
        const at = sceneIndexById(scenes, sceneId);
        scenes.splice(at, 1);
        summary = `장면 ${sceneId}를 지웠습니다(남은 ${scenes.length}개).`;
        break;
      }
      case "move": {
        const sceneId = requireSceneId(args.sceneId);
        const from = sceneIndexById(scenes, sceneId);
        const to = editIndex(args.index, Math.max(scenes.length - 1, 0), "move");
        const [scene] = scenes.splice(from, 1);
        scenes.splice(to, 0, scene);
        summary = `장면 ${sceneId}를 ${to + 1}번째로 옮겼습니다.`;
        break;
      }
    }

    const sequence = normalizeCinematicSequence({
      enabled,
      skippable,
      ...(music ? { musicResourceId: music } : {}),
      scenes,
    });
    draft.system.opening = sequence;
    const warnings = !sequence.enabled && sequence.scenes.length > 0
      ? ["오프닝 사용이 꺼져 있어 실제 게임에서는 재생되지 않습니다. edit_opening(op:\"settings\", enabled:true)로 켜세요."]
      : [];
    return {
      summary,
      data: { opening: sequence, sceneCount: sequence.scenes.length, sceneIds: sequence.scenes.map(scene => scene.id) },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

export const OPENING_IMAGE_TOOL = "generate_opening_image";
export const GAME_OVER_IMAGE_TOOL = "generate_game_over_image";

const OPENING_PROMPT_MIN_LENGTH = 4;

/** 툴·편집기 핸드오프가 같은 검사를 쓰게 하는 순수 준비 함수. */
export function prepareOpeningImageRequest(args: Record<string, unknown>): { readonly prompt: string; readonly name: string } {
  const raw = args.prompt;
  if (typeof raw !== "string" || raw.trim().length < OPENING_PROMPT_MIN_LENGTH) {
    throw new ToolError(
      `prompt는 만들 그림을 설명하는 ${OPENING_PROMPT_MIN_LENGTH}자 이상의 문장이어야 합니다(예: "폭풍우 치는 밤의 성문 앞").`,
      { code: "invalid-args" },
    );
  }
  const rawName = args.name;
  if (rawName !== undefined && typeof rawName !== "string") {
    throw new ToolError("name은 문자열이어야 합니다.", { code: "invalid-args" });
  }
  const prompt = raw.trim();
  const name = rawName?.trim() || `오프닝 그림: ${prompt.slice(0, 24)}`;
  return { prompt, name };
}

/** 게임오버 배경 생성도 같은 프롬프트 계약을 쓰되 기본 리소스 이름을 구분한다. */
export function prepareGameOverImageRequest(args: Record<string, unknown>): { readonly prompt: string; readonly name: string } {
  const raw = args.prompt;
  if (typeof raw !== "string" || raw.trim().length < OPENING_PROMPT_MIN_LENGTH) {
    throw new ToolError(
      `prompt는 만들 그림을 설명하는 ${OPENING_PROMPT_MIN_LENGTH}자 이상의 문장이어야 합니다(예: "패배한 성문 앞의 폭풍우").`,
      { code: "invalid-args" },
    );
  }
  const rawName = args.name;
  if (rawName !== undefined && typeof rawName !== "string") {
    throw new ToolError("name은 문자열이어야 합니다.", { code: "invalid-args" });
  }
  const prompt = raw.trim();
  const name = rawName?.trim() || `게임오버 그림: ${prompt.slice(0, 24)}`;
  return { prompt, name };
}

const generateOpeningImage: ToolDefinition = {
  name: "generate_opening_image",
  description:
    "오프닝용 전체화면 그림을 이미지 모델로 만들어 리소스로 등록하고 resourceId 를 돌려준다(image 장면에 바로 쓴다). "
    + "기존 배경화로 충분하면 list_opening_media 를 먼저 본다. 장면당 한 장.",
  mode: "read",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["prompt"],
    properties: {
      prompt: { type: "string", minLength: OPENING_PROMPT_MIN_LENGTH, description: "장면 설명(분위기·시간대·장소). 글자는 넣지 않는다." },
      name: { type: "string" },
    },
  },
  run(_project, args): ToolExecResult {
    const { prompt, name } = prepareOpeningImageRequest(args);
    return {
      summary: "그림 생성 요청을 준비했습니다. 생성에는 편집기가 필요하며 아직 만들어지지 않았습니다.",
      data: { status: "ui-required", prompt, name },
    };
  },
};

const generateGameOverImage: ToolDefinition = {
  name: GAME_OVER_IMAGE_TOOL,
  description:
    "게임오버 화면용 전체화면 그림을 이미지 모델로 만들어 리소스로 등록하고 resourceId를 돌려준다. "
    + "생성 뒤 set_game_over({backgroundResourceId})로 게임오버 배경에 연결한다. 글자·버튼·UI는 그림에 넣지 않는다.",
  mode: "read",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["prompt"],
    properties: {
      prompt: { type: "string", minLength: OPENING_PROMPT_MIN_LENGTH, description: "패배·절망·종료 분위기의 배경 설명. 글자는 넣지 않는다." },
      name: { type: "string" },
    },
  },
  run(_project, args): ToolExecResult {
    const { prompt, name } = prepareGameOverImageRequest(args);
    return {
      summary: "게임오버 그림 생성 요청을 준비했습니다. 생성에는 편집기가 필요하며 아직 만들어지지 않았습니다.",
      data: { status: "ui-required", prompt, name },
    };
  },
};

const getGameOver: ToolDefinition = {
  name: "get_game_over",
  description: "현재 게임오버 화면 설정(system.gameOver)을 반환한다. 없으면 gameOver:null이며 기본값을 만들지 않는다.",
  mode: "read",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  run(project): ToolExecResult {
    const gameOver = project.system.gameOver;
    if (!gameOver) return { summary: "게임오버 화면 설정이 아직 없습니다.", data: { gameOver: null } };
    const warnings: string[] = [];
    if (gameOver.backgroundResourceId && !listDatabaseResourceOptions("still", project).some(entry => entry.id === gameOver.backgroundResourceId)) {
      warnings.push(`게임오버 배경 리소스를 찾을 수 없습니다: ${gameOver.backgroundResourceId}`);
    }
    return {
      summary: `게임오버 화면 설정을 읽었습니다${gameOver.backgroundResourceId ? `(배경 ${gameOver.backgroundResourceId})` : "(배경 없음)"}.`,
      data: { gameOver },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

const setGameOver: ToolDefinition = {
  name: "set_game_over",
  description: "패배 흐름(classic/horror/blackout), 귀환 좌표, 제목·본문·버튼·배경을 설정한다. blackout은 진행을 유지하고 파티를 회복해 귀환한다. 배경 id는 list_opening_media(kind:\"image\") 또는 list_resources 결과에서 고르고, 빈 문자열은 해당 값을 지운다.",
  mode: "write",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      presentation: { type: "string", enum: ["classic", "horror", "blackout"] },
      recovery: { type: "object", additionalProperties: false, required: ["mapId", "x", "y"], properties: { mapId: { type: "string" }, x: { type: "integer", minimum: 0 }, y: { type: "integer", minimum: 0 } } },
      title: { type: "string", description: "게임오버 제목. 빈 문자열은 지움" },
      message: { type: "string", description: "게임오버 본문. 빈 문자열은 지움" },
      retryLabel: { type: "string", description: "재시도 버튼 문구. 빈 문자열은 기본 문구 사용" },
      titleLabel: { type: "string", description: "타이틀 버튼 문구. 빈 문자열은 기본 문구 사용" },
      backgroundResourceId: { type: "string", description: "전체화면 배경 그림 id. 빈 문자열은 제거" },
    },
  },
  run(draft, args): ToolExecResult {
    const allowed = ["title", "message", "retryLabel", "titleLabel", "backgroundResourceId", "presentation", "recovery"] as const;
    if (!allowed.some(key => Object.hasOwn(args, key))) {
      throw new ToolError("게임오버에서 바꿀 값을 하나 이상 지정하세요.", { code: "invalid-args" });
    }
    const current = draft.system.gameOver ?? {};
    const next: GameOverSettings = { ...current };
    for (const key of ["title", "message", "retryLabel", "titleLabel"] as const) {
      if (!Object.hasOwn(args, key)) continue;
      if (typeof args[key] !== "string") throw new ToolError(`${key}는 문자열이어야 합니다.`, { code: "invalid-args" });
      const value = args[key].trim();
      if (value) next[key] = value;
      else delete next[key];
    }
    if (Object.hasOwn(args, "backgroundResourceId")) {
      if (typeof args.backgroundResourceId !== "string") throw new ToolError("backgroundResourceId는 문자열이어야 합니다.", { code: "invalid-args" });
      const id = args.backgroundResourceId.trim();
      if (id && !listDatabaseResourceOptions("still", draft).some(entry => entry.id === id)) {
        throw new ToolError(`게임오버 배경 리소스를 찾을 수 없습니다: ${id}. list_opening_media(kind:"image")로 후보를 확인하세요.`, { code: "resource-not-found" });
      }
      if (id) next.backgroundResourceId = id;
      else delete next.backgroundResourceId;
    }
    if (Object.hasOwn(args, "presentation")) next.presentation = args.presentation as GameOverSettings["presentation"];
    if (Object.hasOwn(args, "recovery")) next.recovery = args.recovery as GameOverSettings["recovery"];
    try { validateGameOverSettings(next); } catch (error) { throw new ToolError(String(error), { code: "invalid-args" }); }
    if (next.recovery) {
      const map = draft.maps[next.recovery.mapId];
      if (!map || next.recovery.x >= map.width || next.recovery.y >= map.height) throw new ToolError("귀환 좌표가 맵 범위 밖입니다.", { code: "invalid-args" });
    }
    const normalized = normalizeGameOverSettings(next);
    if (Object.keys(normalized).length === 0) delete draft.system.gameOver;
    else draft.system.gameOver = normalized;
    return { summary: "게임오버 화면 설정을 저장했습니다.", data: { gameOver: draft.system.gameOver ?? null } };
  },
};

export const CINEMATIC_TOOLS: readonly ToolDefinition[] = [
  getOpening,
  setOpening,
  editOpening,
  removeOpening,
  listOpeningMedia,
  generateOpeningImage,
  getGameOver,
  setGameOver,
  generateGameOverImage,
];
