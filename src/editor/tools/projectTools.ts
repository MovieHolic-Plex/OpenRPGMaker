import { createBlankProject } from "@/project/defaults";
import { CAMERA_ZOOM_LIMITS, resolveCameraZoom, storeCameraZoom } from "@/project/cameraZoom";
import { applyGenrePreset, type GenrePresetId } from "@/project/genrePresets";
import { replaceProjectContents } from "./historyTools";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import type { BattleUiStyle, Terms } from "@/project/types";
import { BATTLE_HIT_FEEL_IDS, DEFAULT_BATTLE_HIT_FEEL, isBattleHitFeel } from "@/project/battleHitFeel";
import { DEFAULT_DIALOGUE_STYLE_ID, DIALOGUE_PROJECT_SPEED_LIMITS, DIALOGUE_STYLE_IDS, DIALOGUE_STYLES, dialogueStyleGuideLines, isDialogueStyleId, recommendedDialogueStyleForPreset } from "@/project/dialogueStyles";
import { FONT_REGISTRY, isFontFamilyId } from "@/project/fontRegistry";
import {
  CHAPTER_LABEL_MAX,
  DEFAULT_NEW_GAME_PLUS_LABEL,
  NEW_GAME_PLUS_CARRY_FIELDS,
  NEW_GAME_PLUS_LABEL_MAX,
  isNewGamePlusCarryField,
  normalizeChapterSettings,
  normalizeNewGamePlusSettings,
} from "@/project/newGamePlus";

const TERM_KEYS = ["attack", "skill", "item", "defend", "escape", "capture", "back", "target", "shopGreeting", "shopBuy", "shopSell", "shopCancel", "shopSellPrompt", "innTitle", "yes", "no", "notEnoughGold", "gold", "goldPrefix", "level", "hp", "mp"] as const;
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
  // 프로젝트 전체를 빈 프로젝트로 갈아 끼운다 — 같은 맵 id(map_blank_start)가 기본 칩셋으로 돌아가는 것이 정상이다.
  allowsTilesetChange: true,
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
  description: "프로젝트 설정(project settings): 제목(title)·저자(author)·용어(terms)·화면 해상도(playResolution)·기본 음악/시스템 리소스·초기 파티·전투 기본값·대화창 스타일(dialogue.style)·강하게 다시 하기(newGamePlus)·장 표시(chapter)를 한 번에 설정한다. 해상도는 픽셀 밀도이고 시야는 카메라 배율이 정한다 — 둘을 같이 맞춰야 한다.",
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
          hitFeel: { type: "string", enum: [...BATTLE_HIT_FEEL_IDS], description: "타격감. impact(묵직하게, 기본) · light(가볍게) · calm(차분하게 — 화면 흔들림·번쩍임 없음)" },
          activeSlots: { type: "integer", minimum: 1 },
          initialTroopId: { type: "string" },
          atbMode: { type: "string", enum: ["active", "wait"], description: "gauge 흐름 전용. active = 명령 메뉴가 열려 있어도 적이 행동한다(크로노 트리거 Active). 기본 wait" },
          atbSpeed: { type: "integer", minimum: 1, maximum: 8, description: "ATB 속도 1(빠름)~8(느림), 4 = 기존 속도" },
          backdrop: { type: "string", enum: ["field", "default"], description: "field = 전투 배경을 주인공 주변 필드 화면으로(제자리 페이드 진입). default = 트룹/지형 배경" },
          presentation: { type: "string", enum: ["onField", "default"], description: "onField = 크로노식 필드 위 전투: 전환 없이 적은 부딪힌 심볼 자리, 아군은 파티 자리에 서고 끝나면 그 자리로 돌아온다(배경은 필드 그대로). default = 전환 후 전투장" },
          formationRoll: { type: "boolean", description: "true = 전투마다 선제·기습·백어택·협공을 민첩으로 굴리고 심볼 인카운트는 접촉 방향으로 정한다. false = 항상 보통 개시" },
          escapeBonusPercent: { type: "integer", minimum: 0, maximum: 100, description: "도주 실패 1회마다 다음 도주 확률에 더하는 %p(생략·0 = 가산 없음, 예전 식 그대로. 명작식으로 쓰려면 10 정도)" },
          limitGauge: {
            type: "object",
            description: "배우별 리미트 게이지(0~100). 맞으면 차고, limitSkill 스킬은 가득 찼을 때만 쓴다",
            properties: { enabled: { type: "boolean" }, label: { type: "string" }, takenRate: { type: "number", description: "최대 HP 만큼 맞았을 때 차는 %(기본 100)" }, dealtGain: { type: "number", description: "명중 1회당(기본 5)" } },
            required: ["enabled"], additionalProperties: false,
          },
          resource2: {
            type: "object",
            description: "제2 기술 자원 「기력」. 스킬 resource2Cost 로 소모, 주고받는 피해로 찬다. 기술 습득 TP 와 별개",
            properties: { enabled: { type: "boolean" }, label: { type: "string" }, max: { type: "integer" }, start: { type: "number" }, dealtGain: { type: "number" }, takenGain: { type: "number" } },
            required: ["enabled"], additionalProperties: false,
          },
          partyGauge: {
            type: "object",
            description: "파티 공용 게이지. 아군 명중마다 차고, 스킬 partyGaugeCost 로 추격 연계기를 쓴다",
            properties: { enabled: { type: "boolean" }, label: { type: "string" }, max: { type: "integer" }, gainPerHit: { type: "number" } },
            required: ["enabled"], additionalProperties: false,
          },
          weaknessExtraAction: { type: "boolean", description: "약점(속성 배율 > 1)을 찌르면 한 번 더 행동(페르소나식)" },
          emotionCycle: {
            type: "array",
            description: "감정 상성표. 상태의 emotion.family 끼리 공격자→대상 피해 배율. 빈 배열이면 해제",
            items: { type: "object", properties: { attackerFamily: { type: "string" }, targetFamily: { type: "string" }, multiplier: { type: "number" } }, required: ["attackerFamily", "targetFamily", "multiplier"], additionalProperties: false },
          },
          rollingHp: { type: "boolean", description: "true = 마더식 롤링 HP 미터: 표시 HP 가 서서히 실제 HP 로 흐르고, 치명타를 받아도 미터가 0 에 닿기 전에 이기면 살아남는다. false = 즉시 표시(기본)" },
          rollingHpPerSecond: { type: "integer", minimum: 1, maximum: 999, description: "롤링 HP 속도(HP/초). 생략 = 40" },
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
      newGamePlus: {
        type: "object",
        description:
          "강하게 다시 하기(New Game+, 크로노 트리거 식). 엔딩을 한 번 본 뒤 타이틀에 항목이 생기고, 고르면 carry 로 고른 것만 들고 처음부터 시작한다."
          + " 스위치·변수·상자·맵 상태는 넘어가지 않는다. 새 회차는 session.flags.ngplus=true 이고 엔딩 조건 {kind:\"newGamePlus\",value:true} 로 가를 수 있다.",
        properties: {
          enabled: { type: "boolean" },
          label: { type: "string", maxLength: NEW_GAME_PLUS_LABEL_MAX, description: `타이틀 항목 이름. 생략 = 「${DEFAULT_NEW_GAME_PLUS_LABEL}」` },
          carry: { type: "array", items: { type: "string", enum: [...NEW_GAME_PLUS_CARRY_FIELDS] }, description: "넘길 것: levels(레벨·경험치), skills, equipment, inventory, gold" },
        },
        additionalProperties: false,
      },
      chapter: {
        type: "object",
        description: "장(시대) 표시. variableId 의 현재 값에 맞는 이름이 ESC 메뉴 머리와 저장 칸에 보인다. 이야기가 진행되면 이벤트에서 그 변수를 올린다.",
        properties: {
          variableId: { type: "string", description: "이미 있는 변수 id" },
          labels: { type: "object", description: `변수 값(정수 문자열) → 이름(최대 ${CHAPTER_LABEL_MAX}자). 예 {"1":"1장 · 서기 1000년","2":"2장 · 종말의 날"}` },
        },
        required: ["variableId", "labels"],
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const changed: string[] = [];
    if (args.newGamePlus !== undefined) {
      if (typeof args.newGamePlus !== "object" || args.newGamePlus === null || Array.isArray(args.newGamePlus)) {
        throw new ToolError("newGamePlus는 객체여야 합니다.", { code: "invalid-args" });
      }
      const input = args.newGamePlus as Record<string, unknown>;
      const carry = input.carry ?? draft.system.newGamePlus?.carry ?? [];
      if (!Array.isArray(carry)) throw new ToolError("newGamePlus.carry는 배열이어야 합니다.", { code: "invalid-args" });
      const unknownCarry = carry.filter((field) => !isNewGamePlusCarryField(field));
      if (unknownCarry.length > 0) {
        throw new ToolError(`newGamePlus.carry 에 알 수 없는 값: ${unknownCarry.map(String).join(", ")}. 가능: ${NEW_GAME_PLUS_CARRY_FIELDS.join(", ")}`, { code: "invalid-args" });
      }
      const next = normalizeNewGamePlusSettings({
        enabled: input.enabled ?? draft.system.newGamePlus?.enabled,
        label: input.label ?? draft.system.newGamePlus?.label,
        carry,
      });
      if (next) draft.system.newGamePlus = next;
      else delete draft.system.newGamePlus;
      changed.push(`강하게 다시 하기=${next?.enabled ? "켬" : "끔"}`);
    }
    if (args.chapter !== undefined) {
      if (typeof args.chapter !== "object" || args.chapter === null || Array.isArray(args.chapter)) {
        throw new ToolError("chapter는 객체여야 합니다.", { code: "invalid-args" });
      }
      const input = args.chapter as Record<string, unknown>;
      const variableId = typeof input.variableId === "string" ? input.variableId.trim() : "";
      if (!draft.variables.some((variable) => variable.id === variableId)) {
        throw new ToolError(`chapter.variableId 변수를 찾을 수 없습니다: ${variableId || "(비어 있음)"}. 먼저 manage_flag_slot 으로 변수를 만드세요.`, { code: "variable-not-found" });
      }
      const next = normalizeChapterSettings({ variableId, labels: input.labels });
      if (!next) throw new ToolError("chapter.labels 에 정수 값 → 이름이 하나 이상 있어야 합니다.", { code: "invalid-args" });
      draft.system.chapter = next;
      changed.push(`장 표시=${Object.keys(next.labels).length}개`);
    }
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
      if (isBattleHitFeel(battle.hitFeel)) {
        if (battle.hitFeel === DEFAULT_BATTLE_HIT_FEEL) delete draft.system.battleHitFeel;
        else draft.system.battleHitFeel = battle.hitFeel;
      }
      if (typeof battle.activeSlots === "number") draft.system.activeSlots = Math.trunc(battle.activeSlots);
      // 기본값은 저장하지 않는다 — normalizeSystemRecords 와 같은 계약.
      if (battle.atbMode === "active") draft.system.atbMode = "active";
      else if (battle.atbMode === "wait") delete draft.system.atbMode;
      if (battle.atbSpeed !== undefined) {
        if (typeof battle.atbSpeed !== "number" || !Number.isInteger(battle.atbSpeed) || battle.atbSpeed < 1 || battle.atbSpeed > 8) {
          throw new ToolError(`battle.atbSpeed 는 1~8 정수여야 합니다(받은 값 ${JSON.stringify(battle.atbSpeed)}).`, { code: "invalid-args" });
        }
        if (battle.atbSpeed === 4) delete draft.system.atbSpeed;
        else draft.system.atbSpeed = battle.atbSpeed;
      }
      if (battle.backdrop === "field") draft.system.battleBackdrop = "field";
      else if (battle.backdrop === "default") delete draft.system.battleBackdrop;
      if (battle.presentation === "onField") draft.system.battlePresentation = "onField";
      else if (battle.presentation === "default") delete draft.system.battlePresentation;
      if (battle.formationRoll === true) draft.system.battleFormationRoll = true;
      else if (battle.formationRoll === false) delete draft.system.battleFormationRoll;
      if (battle.escapeBonusPercent !== undefined) {
        if (typeof battle.escapeBonusPercent !== "number" || !Number.isInteger(battle.escapeBonusPercent) || battle.escapeBonusPercent < 0 || battle.escapeBonusPercent > 100) {
          throw new ToolError(`battle.escapeBonusPercent 는 0~100 정수여야 합니다(받은 값 ${JSON.stringify(battle.escapeBonusPercent)}).`, { code: "invalid-args" });
        }
        if (battle.escapeBonusPercent === 0) delete draft.system.escapeBonusPercent;
        else draft.system.escapeBonusPercent = battle.escapeBonusPercent;
      }
      // 전투 자원·감정 — 저장 계약(생략 = 없음)은 normalizeSystemRecords 가 정규화한다.
      if (battle.limitGauge && typeof battle.limitGauge === "object") draft.system.limitGauge = battle.limitGauge as NonNullable<typeof draft.system.limitGauge>;
      if (battle.resource2 && typeof battle.resource2 === "object") draft.system.resource2 = battle.resource2 as NonNullable<typeof draft.system.resource2>;
      if (battle.partyGauge && typeof battle.partyGauge === "object") draft.system.partyGauge = battle.partyGauge as NonNullable<typeof draft.system.partyGauge>;
      if (battle.weaknessExtraAction === true) draft.system.weaknessExtraAction = true;
      else if (battle.weaknessExtraAction === false) delete draft.system.weaknessExtraAction;
      if (Array.isArray(battle.emotionCycle)) {
        if (battle.emotionCycle.length > 0) draft.system.emotionCycle = battle.emotionCycle as NonNullable<typeof draft.system.emotionCycle>;
        else delete draft.system.emotionCycle;
      }
      if (battle.rollingHp === true) draft.system.battleRollingHp = true;
      else if (battle.rollingHp === false) delete draft.system.battleRollingHp;
      if (battle.rollingHpPerSecond !== undefined) {
        if (typeof battle.rollingHpPerSecond !== "number" || !Number.isInteger(battle.rollingHpPerSecond) || battle.rollingHpPerSecond < 1 || battle.rollingHpPerSecond > 999) {
          throw new ToolError(`battle.rollingHpPerSecond 는 1~999 정수여야 합니다(받은 값 ${JSON.stringify(battle.rollingHpPerSecond)}).`, { code: "invalid-args" });
        }
        draft.system.battleRollingHpPerSecond = battle.rollingHpPerSecond;
      }
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
