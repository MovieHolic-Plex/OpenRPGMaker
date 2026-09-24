import { createBlankProject } from "@/project/defaults";
import { CAMERA_ZOOM_LIMITS, resolveCameraZoom, storeCameraZoom } from "@/project/cameraZoom";
import { applyGenrePreset, type GenrePresetId } from "@/project/genrePresets";
import { replaceProjectContents } from "./historyTools";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import type { BattleUiStyle, Terms } from "@/project/types";
import { DEFAULT_DIALOGUE_STYLE_ID, DIALOGUE_PROJECT_SPEED_LIMITS, DIALOGUE_STYLE_IDS, DIALOGUE_STYLES, dialogueStyleGuideLines, isDialogueStyleId, recommendedDialogueStyleForPreset } from "@/project/dialogueStyles";
import { FONT_REGISTRY, isFontFamilyId } from "@/project/fontRegistry";

const TERM_KEYS = ["attack", "skill", "item", "capture", "back", "target", "shopGreeting", "shopBuy", "shopSell", "shopCancel", "shopSellPrompt", "innTitle", "yes", "no", "notEnoughGold", "gold", "goldPrefix", "level", "hp", "mp"] as const;
const termSchema = Object.fromEntries(TERM_KEYS.map((key) => [key, { type: "string" as const }])) as Record<(typeof TERM_KEYS)[number], { readonly type: "string" }>;

const MAX_PROMPT_LENGTH = 2000;
const MAX_TITLE_LENGTH = 120;
const GENRE_PRESETS: readonly GenrePresetId[] = ["monster-collect", "horror-chase", "farm-life"];

function boundedText(args: Record<string, unknown>, key: "prompt" | "title", maxLength: number): string {
  const value = args[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ToolError(`${key}는 비어 있지 않은 문자열이어야 합니다.`, { code: "invalid-args" });
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new ToolError(`${key}는 ${maxLength}자 이하여야 합니다.`, { code: "invalid-args" });
  }
  return trimmed;
}

const resetProject: ToolDefinition = {
  name: "reset_project",
  // 설명에서 "처음부터/초기화" 같은 낚싯말을 뺐다(2026-08-29 modify 진단 근본원인 12).
  // matchScore 는 요청 단어가 설명에 등장하면 점수를 주므로, "상점 재고를 초기화해줘"·"이 맵
  // 처음부터 다시 칠해줘" 같은 부분 재작업 요청이 프로젝트 전체 폐기 툴을 끌어올렸다.
  // 도메인에서 map 도 뺐다 — 맵 편집 도메인은 거의 매 턴 켜지므로 map 태그는 상시 노출과 같다.
  // 진짜 신규 프로젝트 요청은 INTENT_KEYWORDS.system("새 프로젝트/새 게임/new project"…)이
  // system 도메인을 열고 PINNED_TOOLS_BY_DOMAIN.system 이 노출을 보장한다.
  description: "프로젝트 전체를 버리고 빈 프로젝트로 교체한다 — 지금까지 만든 모든 맵·이벤트·데이터베이스가 사라지며 되돌릴 수 없다. 지금까지 만든 것을 전부 버리고 완전히 새로 시작하겠다고 사용자가 분명히 요청한 경우에만 호출한다. 일부만 비우거나 되돌리는 요청에는 절대 쓰지 않는다. 원시 Project JSON은 받지 않는다.",
  mode: "write",
  domains: ["system"],
  parameters: {
    type: "object",
    properties: {
      prompt: { type: "string", description: "새 프로젝트의 추상적 방향(최대 2000자). 원시 Project JSON 금지" },
      title: { type: "string", description: "프로젝트/타이틀 화면 제목(최대 120자)" },
      genrePreset: { type: "string", enum: GENRE_PRESETS, description: "선택 장르 프리셋" },
    },
    required: ["prompt", "title"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const prompt = boundedText(args, "prompt", MAX_PROMPT_LENGTH);
    const title = boundedText(args, "title", MAX_TITLE_LENGTH);
    if (Object.keys(args).some((key) => !["prompt", "title", "genrePreset"].includes(key))) {
      throw new ToolError("reset_project는 prompt, title, genrePreset만 받습니다. 원시 Project payload는 허용하지 않습니다.", { code: "invalid-args" });
    }
    const genrePreset = args.genrePreset as GenrePresetId | undefined;
    const seed = createBlankProject();
    seed.meta = { ...seed.meta, title };
    if (seed.system.titleScreen) seed.system.titleScreen.title = title;
    if (genrePreset) {
      applyGenrePreset(seed, genrePreset);
      // 장르에 어울리는 대화창을 먼저 깐다. 톤이 다르면 AI 가 set_project_settings 로 바꾼다.
      const dialogueStyle = recommendedDialogueStyleForPreset(genrePreset);
      if (dialogueStyle !== DEFAULT_DIALOGUE_STYLE_ID) seed.system.dialogueStyle = dialogueStyle;
    }
    replaceProjectContents(draft, seed);
    return {
      summary: `현재 프로젝트를 '${title}' 빈 프로젝트로 교체합니다${genrePreset ? ` · 장르 ${genrePreset}` : ""}`,
      data: { title, ...(genrePreset ? { genrePreset } : {}) },
      warnings: [`현재 프로젝트의 모든 맵·이벤트·DB 내용을 교체합니다. 요청 방향: ${prompt.slice(0, 120)}`],
    };
  },
};

const setProjectSettings: ToolDefinition = {
  name: "set_project_settings",
  description: "프로젝트 설정(project settings): 제목(title)·저자(author)·용어(terms)·화면 해상도(playResolution)·기본 음악/시스템 리소스·초기 파티·전투 기본값·대화창 스타일(dialogue.style)을 한 번에 설정한다. 해상도는 픽셀 밀도이고 시야는 카메라 배율이 정한다 — 둘을 같이 맞춰야 한다.",
  mode: "write",
  domains: ["system", "database"],
  parameters: {
    type: "object",
    properties: {
      title: { type: "string" },
      author: { type: "string" },
      terms: { type: "object", properties: termSchema, additionalProperties: false },
      cameraZoom: {
        type: "number",
        minimum: CAMERA_ZOOM_LIMITS.min,
        maximum: CAMERA_ZOOM_LIMITS.max,
        description:
          "프로젝트 기본 카메라 배율(0.25~6, 생략=1). 해상도는 픽셀 밀도이고 보이는 범위는 이 배율이 정한다."
          + " 1920x1080 배경 아트를 1:1로 쓰려면 playResolution 1440x1080 + cameraZoom 4.5."
          + " 이벤트 명령(m2-201)은 이 값을 일시적으로 덮어쓴다.",
      },
      playResolution: {
        type: "object",
        description:
          "게임 논리 해상도(픽셀 밀도). 올려도 보이는 범위는 안 늘고 도트만 선명해진다 — "
          + "범위는 카메라 배율(script_cutscene 의 camera.zoom, CAMERA_ZOOM_LIMITS 0.25~6)이 정한다. "
          + "1920x1080 배경 아트를 1:1로 쓰려면 1440x1080 + zoom 4.5(시야 20x15 타일 = 320x240 과 동일, 배경 배율 1.0).",
        properties: {
          width: { type: "integer", minimum: 160, maximum: 1920 },
          height: { type: "integer", minimum: 120, maximum: 1080 },
        },
        required: ["width", "height"],
        additionalProperties: false,
      },
      resources: {
        type: "object",
        properties: {
          titleResourceId: { type: "string" }, systemResourceId: { type: "string" }, battleSystemResourceId: { type: "string" },
          defaultBgmResourceId: { type: "string" }, battleBgmResourceId: { type: "string" },
          battleVictoryMeResourceId: { type: "string" }, battleDefeatSeResourceId: { type: "string" }, battleEscapeSeResourceId: { type: "string" },
        },
        additionalProperties: false,
      },
      battle: {
        type: "object",
        properties: {
          flow: { type: "string", enum: ["gauge", "strict"] },
          uiStyle: { type: "string" },
          activeSlots: { type: "integer", minimum: 1 },
          initialTroopId: { type: "string" },
        },
        additionalProperties: false,
      },
      startActorIds: { type: "array", items: { type: "string" } },
      dialogue: {
        type: "object",
        description: "게임 전체 NPC 대사창의 기본 모양·글꼴·글자 소리. 인물별 이름 색·목소리는 upsert_character_profile 의 dialogue 로 덮는다.",
        properties: {
          style: {
            type: "string",
            enum: [...DIALOGUE_STYLE_IDS],
            description: `게임 톤에 맞춰 하나 고른다:\n${dialogueStyleGuideLines().join("\n")}`,
          },
          font: { type: "string", enum: FONT_REGISTRY.map((font) => font.id), description: "대사창 글꼴(편집기 글꼴과 별개). 보통 생략 — 스타일이 어울리는 글꼴을 이미 고른다." },
          speed: { type: "number", minimum: DIALOGUE_PROJECT_SPEED_LIMITS.min, maximum: DIALOGUE_PROJECT_SPEED_LIMITS.max, description: "모든 대사의 기본 말 빠르기 배율(1=기본). 느긋한 이야기 0.8, 경쾌한 액션 1.2." },
          punctuationPause: { type: "boolean", description: "쉼표·마침표에서 잠깐 쉬기(기본 true). 기계·로봇 톤이면 false." },
        },
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const changed: string[] = [];
    if (typeof args.title === "string" && args.title.trim()) {
      draft.meta.title = args.title.trim();
      if (draft.system.titleScreen) draft.system.titleScreen.title = draft.meta.title;
      changed.push("제목");
    }
    if (typeof args.author === "string" && args.author.trim()) {
      draft.meta.author = args.author.trim();
      changed.push("저자");
    }
    if (args.terms && typeof args.terms === "object" && !Array.isArray(args.terms)) {
      const patch = Object.fromEntries(Object.entries(args.terms).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0));
      draft.meta.terms = { ...draft.meta.terms, ...patch } as Terms;
      changed.push("용어");
    }
    if (typeof args.cameraZoom === "number") {
      storeCameraZoom(draft.system, args.cameraZoom);
      changed.push(`카메라 배율=${resolveCameraZoom(draft.system)}`);
    }
    if (args.playResolution && typeof args.playResolution === "object" && !Array.isArray(args.playResolution)) {
      const resolution = args.playResolution as { width: number; height: number };
      draft.system.playResolution = { width: resolution.width, height: resolution.height };
      changed.push("화면");
    }
    if (args.resources && typeof args.resources === "object" && !Array.isArray(args.resources)) {
      const resources = args.resources as Record<string, unknown>;
      for (const key of ["titleResourceId", "systemResourceId", "battleSystemResourceId", "defaultBgmResourceId", "battleBgmResourceId", "battleVictoryMeResourceId", "battleDefeatSeResourceId", "battleEscapeSeResourceId"] as const) {
        if (typeof resources[key] === "string") draft.system[key] = resources[key];
      }
      changed.push("리소스");
    }
    if (args.battle && typeof args.battle === "object" && !Array.isArray(args.battle)) {
      const battle = args.battle as Record<string, unknown>;
      if (battle.flow === "gauge" || battle.flow === "strict") draft.system.battleFlow = battle.flow;
      if (typeof battle.uiStyle === "string") draft.system.battleUiStyle = battle.uiStyle as BattleUiStyle;
      if (typeof battle.activeSlots === "number") draft.system.activeSlots = Math.trunc(battle.activeSlots);
      if (typeof battle.initialTroopId === "string") {
        if (!draft.database.troops.some((troop) => troop.id === battle.initialTroopId)) throw new ToolError(`초기 적 그룹을 찾을 수 없습니다: ${battle.initialTroopId}`, { code: "troop-not-found" });
        draft.system.initialTroopId = battle.initialTroopId;
      }
      changed.push("전투");
    }
    if (args.dialogue && typeof args.dialogue === "object" && !Array.isArray(args.dialogue)) {
      const style = (args.dialogue as Record<string, unknown>).style;
      if (style !== undefined) {
        if (!isDialogueStyleId(style)) throw new ToolError(`알 수 없는 대화창 스타일입니다: ${String(style)}. 가능: ${DIALOGUE_STYLE_IDS.join(", ")}`, { code: "invalid-args" });
        // 기본값은 저장하지 않는다 — normalizeSystemRecords 와 같은 계약.
        if (style === DEFAULT_DIALOGUE_STYLE_ID) delete draft.system.dialogueStyle;
        else draft.system.dialogueStyle = style;
        changed.push(`대화창=${DIALOGUE_STYLES[style].label}`);
      }
      const { font, speed, punctuationPause } = args.dialogue as Record<string, unknown>;
      if (font !== undefined) {
        if (font === null || font === "") delete draft.system.dialogueFont;
        else if (!isFontFamilyId(font)) throw new ToolError(`알 수 없는 글꼴입니다: ${String(font)}`, { code: "invalid-args" });
        else draft.system.dialogueFont = font;
        changed.push("대화창 글꼴");
      }
      if (typeof speed === "number" && Number.isFinite(speed)) {
        const next = Math.round(Math.min(DIALOGUE_PROJECT_SPEED_LIMITS.max, Math.max(DIALOGUE_PROJECT_SPEED_LIMITS.min, speed)) * 100) / 100;
        if (next === 1) delete draft.system.dialogueSpeed;
        else draft.system.dialogueSpeed = next;
        changed.push(`말 빠르기=${next}`);
      }
      if (typeof punctuationPause === "boolean") {
        if (punctuationPause) delete draft.system.dialoguePunctuationPause;
        else draft.system.dialoguePunctuationPause = false;
        changed.push(`구두점 쉼=${punctuationPause ? "켬" : "끔"}`);
      }
    }
    if (Array.isArray(args.startActorIds)) {
      const ids = args.startActorIds.map(String);
      const missing = ids.filter((id) => !draft.database.actors.some((actor) => actor.id === id));
      if (missing.length > 0) throw new ToolError(`초기 파티 actor id를 찾을 수 없습니다: ${missing.join(", ")}`, { code: "actor-not-found" });
      draft.system.startActorIds = ids;
      draft.session.partyActorIds = [...ids];
      changed.push("초기 파티");
    }
    if (changed.length === 0) throw new ToolError("바꿀 프로젝트 설정이 없습니다.", { code: "invalid-args" });
    return { summary: `프로젝트 설정 변경 — ${changed.join(", ")}`, data: { changed } };
  },
};

const setParty: ToolDefinition = {
  name: "set_party",
  description: "파티 구성만 바꾼다. scope=start는 새 게임 시작 파티와 세션 파티를 함께 설정하고, scope=session은 현재 세션 파티만 설정한다. actorIds는 실제 actors id 목록이며 빈 배열도 허용한다.",
  mode: "write",
  domains: ["database", "system"],
  parameters: {
    type: "object",
    properties: {
      scope: { type: "string", enum: ["start", "session"], description: "start=새 게임 정본 + 현재 세션, session=현재 세션만" },
      actorIds: { type: "array", items: { type: "string" }, description: "파티 순서대로 나열한 실제 actor id" },
    },
    required: ["scope", "actorIds"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const scope = args.scope === "start" || args.scope === "session" ? args.scope : undefined;
    if (!scope || !Array.isArray(args.actorIds)) throw new ToolError("scope(start/session)와 actorIds 배열이 필요합니다.", { code: "invalid-args" });
    const actorIds = args.actorIds.map(String);
    const duplicates = actorIds.filter((id, index) => actorIds.indexOf(id) !== index);
    if (duplicates.length > 0) throw new ToolError(`파티에 같은 actor id를 중복으로 넣을 수 없습니다: ${[...new Set(duplicates)].join(", ")}`, { code: "duplicate-actor" });
    const missing = actorIds.filter((id) => !draft.database.actors.some((actor) => actor.id === id));
    if (missing.length > 0) throw new ToolError(`파티 actor id를 찾을 수 없습니다: ${missing.join(", ")}`, { code: "actor-not-found" });
    draft.session.partyActorIds = [...actorIds];
    if (scope === "start") draft.system.startActorIds = [...actorIds];
    return {
      summary: `${scope === "start" ? "시작 파티" : "현재 세션 파티"} 설정 — ${actorIds.length}명`,
      data: { scope, actorIds },
    };
  },
};

export const PROJECT_TOOLS: readonly ToolDefinition[] = [resetProject, setProjectSettings, setParty];
