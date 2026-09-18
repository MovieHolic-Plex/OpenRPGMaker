import { createBlankProject } from "@/project/defaults";
import { applyGenrePreset, type GenrePresetId } from "@/project/genrePresets";
import { replaceProjectContents } from "./historyTools";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import type { BattleUiStyle, Terms } from "@/project/types";

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
    if (genrePreset) applyGenrePreset(seed, genrePreset);
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
  description: "프로젝트 설정(project settings): 제목(title)·저자(author)·용어(terms)·화면 해상도·기본 음악/시스템 리소스·초기 파티·전투 기본값을 한 번에 설정한다.",
  mode: "write",
  domains: ["system", "database"],
  parameters: {
    type: "object",
    properties: {
      title: { type: "string" },
      author: { type: "string" },
      terms: { type: "object", properties: termSchema, additionalProperties: false },
      playResolution: { type: "object", properties: { width: { type: "integer", minimum: 160, maximum: 1920 }, height: { type: "integer", minimum: 120, maximum: 1080 } }, required: ["width", "height"], additionalProperties: false },
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
