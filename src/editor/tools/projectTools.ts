import { TOUCH_STICK_MODES, isTouchStickMode, normalizeTouchControls, resolveTouchControls } from "@/project/touchControls";
import { ensureHighResFullbodyPlayResolution } from "@/project/playResolution";
import { isCatalogBgmAvailable } from '@/assets/audioResourceCatalog';
import { createBlankProject } from "@/project/defaults";
import { retitlePlaceholderOpening } from "@/project/defaults/defaultOpeningSequence";
import { CAMERA_ZOOM_LIMITS, pixelZoomWarning, resolveCameraZoom, storeCameraZoom } from "@/project/cameraZoom";
import { applyGenrePreset, type GenrePresetId } from "@/project/genrePresets";
import { replaceProjectContents } from "./historyTools";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import type { Project, Terms } from "@/project/types";
import { BATTLE_HIT_FEEL_IDS, DEFAULT_BATTLE_HIT_FEEL, isBattleHitFeel } from "@/project/battleHitFeel";
import { BATTLE_FANFARE_STYLES, isBattleFanfareStyle, normalizeBattleFanfare, resolveBattleFanfare } from "@/project/battleFanfare";
import { BATTLE_COMBO_CUT_INS, BATTLE_COMBO_FXS, BATTLE_ENEMY_LUNGES, BATTLE_REVEAL_WEAKNESSES, BATTLE_SKILL_HINTS, normalizeBattleStaging, resolveBattleStaging } from "@/project/battleStaging";
import { DISPLAY_FILTER_LABELS, DISPLAY_FILTERS, isDisplayFilterName, normalizeDisplayFilter } from "@/project/displayFilter";
import { BATTLE_SKINS, isRetiredBattleSkinId, listActiveBattleSkinIds } from "@/battle/skins/registry";
import { applyBattleMethod } from "@/project/battleMethod";
import { FIELD_HUD_THEMES, HUD_ANCHORS, HUD_CONDITIONS, HUD_KINDS, HUD_MENUS, HUD_PANELS, HUD_SHAPES, HUD_SOURCES, HUD_WIDGET_LIMIT, normalizeHudWidget } from "@/project/fieldHud";
import {
  BATTLE_LOOK_COMMAND_IDS,
  BATTLE_LOOK_COMMAND_LABELS,
  BATTLE_LOOK_FIELD_IDS,
  BATTLE_LOOK_PARTY_IDS,
  BATTLE_LOOK_PARTY_LABELS,
  BATTLE_LOOK_PRESET_IDS,
  BATTLE_LOOK_WINDOW_IDS,
  BATTLE_LOOK_WINDOW_LABELS,
  battleLookForPreset,
  battleLookMoodGuide,
  isBattleAccentColor,
  isBattleLookPresetId,
  patchBattleLook,
  type BattleLookSettings,
} from "@/project/battleLook";
import { MAX_BATTLE_TEAMS, isTeamSwapCost, normalizeBattleTeams } from "@/project/battleTeamModel";
import { DEFAULT_TEAM_SWAP_COST } from "@/battle/battleTeams";
import { DEFAULT_DIALOGUE_STYLE_ID, DIALOGUE_FULL_PORTRAIT_DEFAULTS, DIALOGUE_FULL_PORTRAIT_LIMITS, DIALOGUE_PROJECT_SPEED_LIMITS, DIALOGUE_STYLE_IDS, DIALOGUE_STYLES, dialogueStyleGuideLines, isDialogueStyleId, normalizeDialogueFullPortraitSettings, recommendedDialogueStyleForPreset } from "@/project/dialogueStyles";
import { FONT_REGISTRY, FONT_ROLES, fontOptionsForRole, isFontFamilyId, normalizeSystemFontConfig } from "@/project/fontRegistry";
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

/** set_project_settings battle.look — preset 은 칸을 비우고 갈아타며, 나머지 칸은 검사 후 덮는다. 틀린 값은 조용히 버리지 않고 거절한다. */
function applyBattleLookArgs(current: BattleLookSettings | undefined, raw: unknown): BattleLookSettings | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ToolError("battle.look 은 객체여야 합니다.", { code: "invalid-args" });
  const look = raw as Record<string, unknown>;
  if (look.preset !== undefined && !isBattleLookPresetId(look.preset)) {
    throw new ToolError(`알 수 없는 전투 화면 프리셋입니다: ${String(look.preset)}. 가능: ${BATTLE_LOOK_PRESET_IDS.join(", ")}`, { code: "invalid-args" });
  }
  const base = isBattleLookPresetId(look.preset) ? battleLookForPreset(look.preset) : current;
  const patch: Record<string, unknown> = {};
  const oneOf = (key: string, ids: readonly string[]): void => {
    if (look[key] === undefined) return;
    if (!ids.includes(String(look[key]))) throw new ToolError(`battle.look.${key} 값이 틀렸습니다: ${String(look[key])}. 가능: ${ids.join(", ")}`, { code: "invalid-args" });
    patch[key] = look[key];
  };
  oneOf("party", BATTLE_LOOK_PARTY_IDS);
  oneOf("command", BATTLE_LOOK_COMMAND_IDS);
  oneOf("field", BATTLE_LOOK_FIELD_IDS);
  oneOf("window", BATTLE_LOOK_WINDOW_IDS);
  for (const key of ["turnOrder", "enemyNames", "enemyHp", "letterbox", "grade"] as const) {
    if (look[key] === undefined) continue;
    if (typeof look[key] !== "boolean") throw new ToolError(`battle.look.${key} 는 true/false 여야 합니다.`, { code: "invalid-args" });
    patch[key] = look[key];
  }
  for (const key of ["light", "dust", "vignette", "blur"] as const) {
    if (look[key] === undefined) continue;
    if (look[key] !== 0 && look[key] !== 1 && look[key] !== 2) throw new ToolError(`battle.look.${key} 는 0·1·2 중 하나여야 합니다.`, { code: "invalid-args" });
    patch[key] = look[key];
  }
  if (look.font !== undefined) {
    if (look.font === null || look.font === "") patch.font = undefined;
    else if (!isFontFamilyId(look.font)) throw new ToolError(`알 수 없는 글꼴입니다: ${String(look.font)}. 가능: ${FONT_REGISTRY.map((entry) => entry.id).join(", ")}`, { code: "invalid-args" });
    else patch.font = look.font;
  }
  if (look.accent !== undefined) {
    if (look.accent === null || look.accent === "") patch.accent = undefined;
    else if (!isBattleAccentColor(look.accent)) throw new ToolError(`battle.look.accent 는 #rrggbb 여야 합니다(받은 값 ${JSON.stringify(look.accent)}).`, { code: "invalid-args" });
    else patch.accent = look.accent.toLowerCase();
  }
  return patchBattleLook(base, patch as Partial<BattleLookSettings>);
}

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
      if (dialogueStyle === "dual-fullbody-veil") ensureHighResFullbodyPlayResolution(seed.system);
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
  description: "프로젝트 설정(project settings): 제목(title)·저자(author)·용어(terms)·화면 해상도(playResolution)·기본 음악/시스템 리소스·초기 파티·전투 기본값·휴대폰 조작(touchControls — 맵 탭 걷기·조이스틱·진동·달리기 단추)·전투 화면 꾸미기(battle.look — 전투창 디자인·전투 UI 를 소박하게/화려하게: 창 모양·파티/명령 배치·빛 연출 프리셋 12종)·전투 결과 팡파레(battle.fanfare — 레벨 업 배너·「새 기술 습득!」·「새 연계기!」 카드 켜기/끄기·연출 세기·소리)·전투 연출(battle.staging — 적 달려들기 속도·연계기 얼굴 교차 컷인·연계기 화려함·기술 한 줄 도움말·적 약점 표시 battle.revealWeakness)·공통 글꼴(fonts)·대화창 스타일(dialogue.style)·강하게 다시 하기(newGamePlus)·장 표시(chapter)를 한 번에 설정한다. 해상도는 픽셀 밀도이고 시야는 카메라 배율이 정한다 — 둘을 같이 맞춰야 한다.",
  mode: "write",
  domains: ["system", "database"],
  parameters: {
    type: "object",
    properties: {
      title: { type: "string" },
      author: { type: "string" },
      fonts: {
        type: "object",
        description: "게임 공통 글꼴: ui=메뉴·일반 UI, pixel=도트 UI, mono=고정폭 숫자/기록. 대사(dialogue.font)와 전투(battle.look.font)의 개별 선택이 우선한다. 지정한 역할만 바꾸며 빈 문자열은 그 역할을 기본값으로 되돌린다. 조선 도트 RPG에는 galmuri9/galmuri11, 고전 둥근 도트에는 neodgm이 어울린다.",
        properties: Object.fromEntries(FONT_ROLES.map((role) => [role, {
          type: "string" as const,
          // Gemini rejects empty strings inside enum, even when this tool is unused.
          // The execution boundary below validates IDs and preserves the reset value.
          description: `글꼴 ID: ${fontOptionsForRole(role).map((font) => font.id).join(", ")}. 빈 문자열은 기본값으로 되돌린다.`,
        }])),
        additionalProperties: false,
      },
      terms: { type: "object", properties: termSchema, additionalProperties: false },
      touchControls: {
        type: "object",
        description: "휴대폰·태블릿에서 플레이할 때의 조작(데스크톱엔 영향 없음). 지정한 칸만 바꾼다. 기본은 모두 켬·조이스틱 auto 라 보통 건드릴 필요가 없다 — 퍼즐처럼 맵 탭이 다른 뜻이면 tapToMove:false.",
        properties: {
          tapToMove: { type: "boolean", description: "맵을 탭하면 그 칸까지 걷고, 사람·물건을 탭하면 곁으로 가서 말을 건다(기본 true)." },
          stick: { type: "string", enum: ["auto", "fixed", "floating"], description: "조이스틱: auto(판 곁은 바로 방향, 먼 곳은 엄지 밑으로 — 기본), fixed(판 고정), floating(누른 자리가 중심)." },
          haptics: { type: "boolean", description: "단추·방향 전환 때 짧은 진동(지원 기기만, 기본 true)." },
          runButton: { type: "boolean", description: "패드에 따로 달리기 단추를 둔다(기본 false — 조이스틱을 끝까지 밀면 달리고, 맵 탭으로 먼 곳에 가면 달린다)." },
        },
        additionalProperties: false,
      },
      displayFilter: {
        type: "string",
        enum: ["none", "scanlines", "crt"],
        description: "화면 표시 필터 — 맵·전투·대화를 덮는 옛 TV 느낌. scanlines 가로줄만, crt 가로줄+색 결+가장자리 어둡게. 레트로 감성 게임에만 켠다(생략 = 그대로).",
      },
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
          titleResourceId: { type: "string" }, systemResourceId: { type: "string" },
          defaultBgmResourceId: { type: "string" }, battleBgmResourceId: { type: "string" },
          battleVictoryMeResourceId: { type: "string" }, battleDefeatSeResourceId: { type: "string" }, battleEscapeSeResourceId: { type: "string" },
        },
        additionalProperties: false,
      },
      battle: {
        type: "object",
        properties: {
          flow: { type: "string", enum: ["gauge", "strict"] },
          teams: {
            type: "array",
            maxItems: 4,
            description: "FF6 식 팀 교대 전투(교대 묶음). 2~4팀이며 한 번에 한 팀만 싸우고 나머지는 대기한다 — 동시 행동은 없다. 팀 구성원은 서로 겹칠 수 없다. 빈 배열 [] = 해제(기존 한 파티 전투). 파티 밖 배우를 팀에 넣어도 되고, 파티에 있으나 어느 팀에도 없는 배우는 첫 팀에 붙는다. 맵을 나눠 걷는 FF6 식 파티 분할은 별개다(recipe party-split).",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "팀 id(예: team_a)" },
                name: { type: "string", description: "전투 버튼에 보이는 이름(예: 티나 팀)" },
                actorIds: { type: "array", items: { type: "string" }, description: "이 팀의 배우 id. 파티에 있는 배우만 전투에 선다" },
              },
              required: ["id", "actorIds"],
              additionalProperties: false,
            },
          },
          teamSwapCost: { type: "string", enum: ["free", "gauge", "turn"], description: "팀 교대 비용(teams 가 있을 때). free = 들어온 팀이 바로 행동 · gauge = 들어온 팀 게이지 0 에서 시작(기본) · turn = 들어온 팀은 적이 한 번 행동할 때까지 쉼. 적 그룹별 덮어쓰기는 upsert_troop.teamSwapCost" },
          uiStyle: {
            type: "string",
            description: `전투 방식. 화면과 규칙을 같이 정한다 — retro2003 = 도트 측면(RM식 규칙, 기본), pokemon = 몬스터 대치(Gen1 규칙). 창 색·배치·글꼴·연출은 look 으로 고른다. 가능: ${listActiveBattleSkinIds().map((id) => `${id}(${BATTLE_SKINS[id].label})`).join(", ")}`,
          },
          hitFeel: { type: "string", enum: [...BATTLE_HIT_FEEL_IDS], description: "타격감. impact(묵직하게, 기본) · light(가볍게) · calm(차분하게 — 화면 흔들림·번쩍임 없음)" },
          look: {
            type: "object",
            description: "전투 화면 꾸미기(도트 측면 스킨). preset 을 주면 그 프리셋으로 바꾸고 이전에 바꾼 칸은 버린다. 나머지 칸은 프리셋 위에 덮어쓴다(프리셋과 같은 값은 저장하지 않는다). 칸만 주면 지금 프리셋을 두고 그 칸만 바꾼다.",
            properties: {
              preset: {
                type: "string",
                enum: [...BATTLE_LOOK_PRESET_IDS],
                description: `게임 분위기에 맞춰 고른다. ${battleLookMoodGuide()}`,
              },
              party: { type: "string", enum: [...BATTLE_LOOK_PARTY_IDS], description: `파티 상태 배치. ${BATTLE_LOOK_PARTY_IDS.map((id) => `${id}=${BATTLE_LOOK_PARTY_LABELS[id]}`).join(" · ")}` },
              command: { type: "string", enum: [...BATTLE_LOOK_COMMAND_IDS], description: `명령 배치. ${BATTLE_LOOK_COMMAND_IDS.map((id) => `${id}=${BATTLE_LOOK_COMMAND_LABELS[id]}`).join(" · ")}` },
              field: { type: "string", enum: [...BATTLE_LOOK_FIELD_IDS], description: "band = 전장이 아래 창 위에서 끝남 · full = 전장을 화면 끝까지(창이 무대 위에 뜬다)" },
              window: { type: "string", enum: [...BATTLE_LOOK_WINDOW_IDS], description: `창 꾸밈. ${BATTLE_LOOK_WINDOW_IDS.map((id) => `${id}=${BATTLE_LOOK_WINDOW_LABELS[id]}`).join(" · ")}` },
              font: { type: "string", description: `전투 글꼴 id. 빈 문자열 = 프리셋·창 꾸밈 기본. 가능: ${FONT_REGISTRY.map((entry) => entry.id).join(", ")}` },
              accent: { type: "string", description: "강조색 #rrggbb(커서·선택·테두리). 빈 문자열 = 창 꾸밈 기본" },
              turnOrder: { type: "boolean", description: "왼쪽 위 차례 순서 줄" },
              enemyNames: { type: "boolean", description: "적 발밑 이름표" },
              enemyHp: { type: "boolean", description: "적 머리 위 체력 막대(보스전에 남은 체력을 보여 줄 때)" },
              letterbox: { type: "boolean", description: "위아래 영화 띠" },
              light: { type: "integer", enum: [0, 1, 2], description: "빛내림 0 끔 · 1 약하게 · 2 강하게" },
              dust: { type: "integer", enum: [0, 1, 2], description: "떠다니는 먼지 0~2" },
              vignette: { type: "integer", enum: [0, 1, 2], description: "가장자리 어둡게 0~2" },
              blur: { type: "integer", enum: [0, 1, 2], description: "위아래 흐림(피사계 심도) 0~2" },
              grade: { type: "boolean", description: "색보정(채도·대비를 조금 올림)" },
            },
            additionalProperties: false,
          },
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
          allowAutoBattle: { type: "boolean", description: "false = 플레이어 자동 전투 없음(F 키 토글·자동 표시가 사라지고 명령을 늘 직접 고른다). true/생략 = 켤 수 있다" },
          clearStatesAfterBattle: { type: "boolean", description: "true = 전투가 끝나면 파티의 상태 이상(독·수면·마비…)이 모두 풀린다. 상태 하나만 남기려면 upsert_state clearOnBattleEnd:false. false = 상태별 규칙만" },
          emotionCycle: {
            type: "array",
            description: "감정 상성표. 상태의 emotion.family 끼리 공격자→대상 피해 배율. 빈 배열이면 해제",
            items: { type: "object", properties: { attackerFamily: { type: "string" }, targetFamily: { type: "string" }, multiplier: { type: "number" } }, required: ["attackerFamily", "targetFamily", "multiplier"], additionalProperties: false },
          },
          rollingHp: { type: "boolean", description: "true = 마더식 롤링 HP 미터: 표시 HP 가 서서히 실제 HP 로 흐르고, 치명타를 받아도 미터가 0 에 닿기 전에 이기면 살아남는다. false = 즉시 표시(기본)" },
          rollingHpPerSecond: { type: "integer", minimum: 1, maximum: 999, description: "롤링 HP 속도(HP/초). 생략 = 40" },
          fanfare: {
            type: "object",
            description: "전투 결과 팡파레(도트 측면 결과 화면). 레벨 업 배너+능력치 판, 「새 기술 습득!」 카드, 「새 연계기!」 카드, 효과음. 생략한 칸은 그대로 둔다. 기본은 전부 켜기·burst",
            properties: {
              levelUp: { type: "boolean", description: "레벨 업 배너·능력치 판" },
              skillLearned: { type: "boolean", description: "레벨 업으로 배운 기술마다 「새 기술 습득!」 카드(이름·속성·설명·꼬리표)" },
              comboUnlocked: { type: "boolean", description: "배운 기술로 연계기 해금 조건(comboRequires)이 채워지면 「새 연계기!」 카드" },
              style: { type: "string", enum: [...BATTLE_FANFARE_STYLES], description: "burst = 빛줄기·파티클·흔들림 · classic = 창만 크게 · minimal = 창만(연출 없음)" },
              sound: { type: "boolean", description: "팡파레 효과음" },
            },
            additionalProperties: false,
          },
          staging: {
            type: "object",
            description: "전투 연출. 생략한 칸은 그대로 둔다. 기본 = enemyLunge fast · comboCutIn faces · comboFx spectacular · skillHint line. 적 하나의 속도는 upsert_enemy lungeSpeedPercent, 연계기 하나의 색·흔들림은 upsert_combo_tech staging",
            properties: {
              enemyLunge: { type: "string", enum: [...BATTLE_ENEMY_LUNGES], description: "도트 적이 아군에게 달려드는 속도. fast = 사람 적 걸음 기준·짐승은 더 빠르게 · normal · classic = 예전 느긋한 도트 괴물" },
              comboCutIn: { type: "string", enum: [...BATTLE_COMBO_CUT_INS], description: "연계기 컷인. faces = 참가자 흉상이 양쪽에서 미끄러져 들어와 대각선으로 엇갈림 · band = 이름 띠만 · off" },
              comboFx: { type: "string", enum: [...BATTLE_COMBO_FXS], description: "연계기 화려함. spectacular = 번쩍임·확대·흔들림·참가자별 빛 → 합쳐진 마무리·착탄 느린 화면·피해 숫자 폭발 · simple = 번쩍임만" },
              skillHint: { type: "string", enum: [...BATTLE_SKILL_HINTS], description: "전투 기술 도움말. line = 「○○은 무엇을 할까?」 자리에 한 줄(MP6 · 적 전체 · 냉기 · 둔화) · window = 긴 도움말 창" },
              revealWeakness: { type: "string", enum: [...BATTLE_REVEAL_WEAKNESSES], description: "battle.revealWeakness 와 같다" },
            },
            additionalProperties: false,
          },
          revealWeakness: {
            type: "string",
            enum: [...BATTLE_REVEAL_WEAKNESSES],
            description: "적 약점·저항을 대상 고르기에서 보이는가. 약점은 플레이어가 알아 가는 재미다 — 처음 맞힌 타격에 「약점 발견!」이 뜨고 적 종류별로 세이브에 남는다. never = 대상 고를 때 안 보임 · afterDiscovery(기본) = 알아낸 것만 · always = 처음부터. 기술 설명에 「○○ 약점」처럼 적 이름을 쓰지 말 것",
          },
        },
        additionalProperties: false,
      },
      startActorIds: { type: "array", items: { type: "string" } },
      fieldGuides: { type: "string", enum: ["on", "arrows", "off"], description: "arrows = 출구 앞에 맵 밖을 가리키는 화살표만(목적지 이름 글자 없음), 목표 빛무리·화살표와 ▼ 는 끈다 — 「화살표만 남겨도 충분히 친절」. off = 필드 자동 안내(목표 빛무리·화면 밖 목표 화살표, 인물·조사 대상 위 ▼, 출구 앞 「→ 목적지」 글자)를 끈다. 장면·대사가 갈 곳을 스스로 보여 주는 이야기 게임용 — 끄면 그만큼 장면에서 길이 보여야 한다. 저자가 단 page.glow·nearSparkle 은 남는다. on(기본) = 켜기" },
      saveAccess: { type: "string", enum: ["anywhere", "savePoints"], description: "savePoints = 메뉴 「저장」을 없애고 세이브 포인트에서만 저장(place_savepoint 로 마을·쉼터·던전에 둔다). anywhere(기본) = 메뉴에서 언제든" },
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
          keepActorsVisible: { type: "boolean", description: "대화창·선택지가 떠 있는 동안 카메라를 내려 말하는 두 사람을 창 위 빈 화면에 보이게 한다(기본 false). 맵 위 인물끼리 마주 보는 장면이 많은 연애·일상·추리 게임이면 true." },
          fullPortraitHeight: {
            type: "integer",
            minimum: DIALOGUE_FULL_PORTRAIT_LIMITS.height.min,
            maximum: DIALOGUE_FULL_PORTRAIT_LIMITS.height.max,
            description: `하단 대사창 뒤 전신 초상의 높이 = 화면 높이의 %(기본 ${DIALOGUE_FULL_PORTRAIT_DEFAULTS.height}). 장면마다는 changeFace.fullScale(%)로 더 곱한다.`,
          },
          fullPortraitDrop: {
            type: "integer",
            minimum: DIALOGUE_FULL_PORTRAIT_LIMITS.drop.min,
            maximum: DIALOGUE_FULL_PORTRAIT_LIMITS.drop.max,
            description: `전신 초상 아래쪽을 화면 밖으로 내려 자르는 비율 %(기본 ${DIALOGUE_FULL_PORTRAIT_DEFAULTS.drop}). 클수록 다리가 덜 보인다.`,
          },
        },
        additionalProperties: false,
      },
      fieldHud: {
        type: "object",
        description: "탐색 화면 HUD(상시 표시 판). 장르 기본 HUD(연애 호감 하트·체력 하트 등)가 게임에 안 맞으면 이 게임의 목표를 읽는 위젯으로 바꾸거나 widgets:[] 로 끈다."
          + " 예: 소원 등롱 셋을 모으는 이야기 = {widgets:[{id:\"lanterns\",kind:\"gauge\",source:\"variable\",variableId:\"모은 수 변수\",max:3,shape:\"number\",label:\"소원 등롱\",anchor:\"top-left\",panel:\"paper\",condition:\"nonzero\"}]}."
          + " widgets 를 주면 기존 위젯을 통째로 바꾼다.",
        properties: {
          theme: { type: "string", enum: Object.keys(FIELD_HUD_THEMES) },
          menuStyle: { type: "string", enum: Object.keys(HUD_MENUS), description: "ESC 메뉴 모양. project = 프로젝트 메뉴 설정을 따른다." },
          objective: { type: "boolean", description: "화면 오른쪽 위 「현재 목표」 줄. 이벤트의 목표 칩(UI 명령 surface objectiveChip)이 바꾸는 글이 여기에 뜬다 — 목표 칩을 쓰면 켠다. widgets 를 줘도 이 값은 따로 지킨다." },
          widgets: {
            type: "array", maxItems: HUD_WIDGET_LIMIT,
            items: {
              type: "object",
              properties: {
                id: { type: "string" }, label: { type: "string" },
                kind: { type: "string", enum: Object.keys(HUD_KINDS) }, source: { type: "string", enum: Object.keys(HUD_SOURCES) },
                shape: { type: "string", enum: Object.keys(HUD_SHAPES) }, anchor: { type: "string", enum: Object.keys(HUD_ANCHORS) },
                panel: { type: "string", enum: Object.keys(HUD_PANELS) }, condition: { type: "string", enum: Object.keys(HUD_CONDITIONS) },
                x: { type: "integer" }, y: { type: "integer" }, width: { type: "integer" }, height: { type: "integer" },
                color: { type: "string" }, showValue: { type: "boolean" }, max: { type: "integer" }, slots: { type: "integer" },
                variableId: { type: "string" }, npcKey: { type: "string" }, switchId: { type: "string" }, resourceId: { type: "string" },
              },
              required: ["kind", "source"],
              additionalProperties: false,
            },
          },
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
          carry: { type: "array", items: { type: "string", enum: [...NEW_GAME_PLUS_CARRY_FIELDS] }, description: "넘길 것: levels(레벨·경험치), skills, equipment, inventory, gold, techPoints(기술 포인트 TP), party(파티 구성). CT 식이면 levels·skills·techPoints·party 를 함께 고른다." },
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
    const teamWarnings: string[] = [];
    let zoomWarningArg = false;
    if (args.fonts !== undefined) {
      if (!args.fonts || typeof args.fonts !== "object" || Array.isArray(args.fonts)) {
        throw new ToolError("fonts는 역할별 글꼴 객체여야 합니다.", { code: "invalid-args" });
      }
      const next: Record<string, unknown> = { ...draft.system.fonts };
      for (const [role, font] of Object.entries(args.fonts)) {
        const knownRole = FONT_ROLES.find((candidate) => candidate === role);
        if (!knownRole) throw new ToolError(`알 수 없는 글꼴 역할입니다: ${role}`, { code: "invalid-args" });
        if (font === "") delete next[role];
        else if (!fontOptionsForRole(knownRole).some((candidate) => candidate.id === font)) {
          throw new ToolError(`fonts.${role} 에 사용할 수 없는 글꼴입니다: ${String(font)}`, { code: "invalid-args" });
        } else next[role] = font;
      }
      const normalized = normalizeSystemFontConfig(next);
      if (normalized) draft.system.fonts = normalized;
      else delete draft.system.fonts;
      changed.push("공통 글꼴");
    }
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
    if (args.fieldHud !== undefined) {
      const hud = args.fieldHud as { theme?: string; menuStyle?: string; objective?: unknown; widgets?: unknown[] };
      const prev = draft.system.fieldHud;
      const next = { theme: "minimal", vitals: false, clock: false, tools: false, objective: false, hideEmpty: true, ...(prev ?? {}) } as NonNullable<typeof prev>;
      if (hud.theme !== undefined) { if (!Object.hasOwn(FIELD_HUD_THEMES, hud.theme)) throw new ToolError(`알 수 없는 HUD 테마: ${hud.theme}`, { code: "invalid-args" }); next.theme = hud.theme as typeof next.theme; }
      if (hud.menuStyle !== undefined) { if (!Object.hasOwn(HUD_MENUS, hud.menuStyle)) throw new ToolError(`알 수 없는 메뉴 모양: ${hud.menuStyle}`, { code: "invalid-args" }); next.menuStyle = hud.menuStyle as typeof next.menuStyle; }
      if (hud.widgets !== undefined) {
        if (!Array.isArray(hud.widgets)) throw new ToolError("fieldHud.widgets 는 배열입니다.", { code: "invalid-args" });
        next.widgets = hud.widgets.slice(0, HUD_WIDGET_LIMIT).map((raw, i) => {
          const w = normalizeHudWidget(raw, i);
          if (w.source === "variable" && (!w.variableId || !draft.variables.some((v) => v.id === w.variableId))) throw new ToolError(`HUD 위젯 ${w.id}: 변수 ${w.variableId ?? "(없음)"} 가 없습니다.`, { code: "invalid-args" });
          return w;
        });
        // 위젯을 직접 정했으면 테마 기본 위젯(체력·시계·도구)은 끈다.
        next.vitals = false; next.clock = false; next.tools = false;
      }
      if (hud.objective !== undefined) {
        if (typeof hud.objective !== "boolean") throw new ToolError("fieldHud.objective 는 true/false 입니다.", { code: "invalid-args" });
        next.objective = hud.objective;
      }
      draft.system.fieldHud = next;
      changed.push(next.widgets?.length === 0 ? "HUD=끔" : `HUD 위젯 ${next.widgets?.length ?? "기본"}개`);
      if (hud.objective !== undefined) changed.push(`현재 목표 줄 ${next.objective ? "켬" : "끔"}`);
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
    if (args.fieldGuides === "off" || args.fieldGuides === "arrows" || args.fieldGuides === "on") {
      if (args.fieldGuides === "on") delete draft.system.fieldGuides; else draft.system.fieldGuides = args.fieldGuides;
      changed.push(args.fieldGuides === "off" ? "필드 안내 표시 끔" : args.fieldGuides === "arrows" ? "필드 안내 표시 출구 화살표만" : "필드 안내 표시 켬");
    }
    if (args.saveAccess === "savePoints" || args.saveAccess === "anywhere") {
      if (args.saveAccess === "savePoints") draft.system.saveAccess = "savePoints"; else delete draft.system.saveAccess;
      changed.push(args.saveAccess === "savePoints" ? "저장은 세이브 포인트에서만" : "어디서나 저장");
    }
    if (typeof args.title === "string" && args.title.trim()) {
      const previousTitles = [draft.meta.title, draft.system.titleScreen?.title ?? ""];
      draft.meta.title = args.title.trim();
      if (draft.system.titleScreen) draft.system.titleScreen.title = draft.meta.title;
      const retitled = retitlePlaceholderOpening(draft.system.opening, previousTitles, draft.meta.title);
      if (retitled) draft.system.opening = retitled;
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
    if (args.touchControls && typeof args.touchControls === "object" && !Array.isArray(args.touchControls)) {
      const input = args.touchControls as Record<string, unknown>;
      if (input.stick !== undefined && !isTouchStickMode(input.stick)) {
        throw new ToolError(`touchControls.stick 는 ${TOUCH_STICK_MODES.join(", ")} 중 하나입니다(받은 값 ${JSON.stringify(input.stick)}).`, { code: "invalid-args" });
      }
      const merged = normalizeTouchControls({ ...resolveTouchControls(draft.system.touchControls), ...input });
      if (merged) draft.system.touchControls = merged;
      else delete draft.system.touchControls;
      const resolved = resolveTouchControls(draft.system.touchControls);
      changed.push(`휴대폰 조작(탭 걷기 ${resolved.tapToMove ? "켬" : "끔"}·조이스틱 ${resolved.stick}·진동 ${resolved.haptics ? "켬" : "끔"}·달리기 단추 ${resolved.runButton ? "켬" : "끔"})`);
    }
    if (args.displayFilter !== undefined) {
      if (!isDisplayFilterName(args.displayFilter)) {
        throw new ToolError(`displayFilter 는 ${DISPLAY_FILTERS.join(", ")} 중 하나입니다(받은 값 ${JSON.stringify(args.displayFilter)}).`, { code: "invalid-args" });
      }
      const next = normalizeDisplayFilter(args.displayFilter);
      if (next) draft.system.displayFilter = next;
      else delete draft.system.displayFilter;
      changed.push(`화면 필터=${DISPLAY_FILTER_LABELS[args.displayFilter]}`);
    }
    if (typeof args.cameraZoom === "number") {
      storeCameraZoom(draft.system, args.cameraZoom);
      changed.push(`카메라 배율=${resolveCameraZoom(draft.system)}`);
      zoomWarningArg = true;
    }
    if (args.playResolution && typeof args.playResolution === "object" && !Array.isArray(args.playResolution)) {
      const resolution = args.playResolution as { width: number; height: number };
      draft.system.playResolution = { width: resolution.width, height: resolution.height };
      changed.push("화면");
    }
    if (args.resources && typeof args.resources === "object" && !Array.isArray(args.resources)) {
      const resources = args.resources as Record<string, unknown>;
      for (const key of ["titleResourceId", "systemResourceId", "defaultBgmResourceId", "battleBgmResourceId", "battleVictoryMeResourceId", "battleDefeatSeResourceId", "battleEscapeSeResourceId"] as const) {
        if (typeof resources[key] === "string") {
          if (!isCatalogBgmAvailable(resources[key])) throw new ToolError(`미설치 BGM '${resources[key]}'는 지정할 수 없습니다. recommend_bgm으로 현재 사용 가능한 곡을 고르세요.`, { code: 'resource-not-found' });
          draft.system[key] = resources[key];
        }
      }
      changed.push("리소스");
    }
    if (args.battle && typeof args.battle === "object" && !Array.isArray(args.battle)) {
      const battle = args.battle as Record<string, unknown>;
      if (battle.flow === "gauge" || battle.flow === "strict") draft.system.battleFlow = battle.flow;
      if (typeof battle.uiStyle === "string") {
        if (!(listActiveBattleSkinIds() as readonly string[]).includes(battle.uiStyle)) {
          const retired = isRetiredBattleSkinId(battle.uiStyle) ? " 지운 옛 스킨이다 — 도트 측면은 retro2003 이고 창 색은 look.window 로 고른다." : "";
          throw new ToolError(`알 수 없는 전투 스킨입니다: ${battle.uiStyle}. 가능: ${listActiveBattleSkinIds().join(", ")}.${retired}`, { code: "invalid-args" });
        }
        // 방식 하나가 화면과 규칙을 같이 정한다(자료집 「전투 방식」과 같은 규칙, project/battleMethod.ts).
        applyBattleMethod(draft, battle.uiStyle === "pokemon" ? "monster" : "side");
      }
      if (battle.fanfare !== undefined) {
        if (!battle.fanfare || typeof battle.fanfare !== "object" || Array.isArray(battle.fanfare)) {
          throw new ToolError("battle.fanfare 는 {levelUp?, skillLearned?, comboUnlocked?, style?, sound?} 객체여야 합니다.", { code: "invalid-args" });
        }
        const patch = battle.fanfare as Record<string, unknown>;
        if (patch.style !== undefined && !isBattleFanfareStyle(patch.style)) {
          throw new ToolError(`battle.fanfare.style 은 ${BATTLE_FANFARE_STYLES.join(" · ")} 중 하나입니다(받은 값 ${JSON.stringify(patch.style)}).`, { code: "invalid-args" });
        }
        const next = normalizeBattleFanfare({ ...resolveBattleFanfare(draft.system.battleFanfare), ...patch });
        if (next) draft.system.battleFanfare = next;
        else delete draft.system.battleFanfare;
      }
      if (battle.staging !== undefined || battle.revealWeakness !== undefined) {
        if (battle.staging !== undefined && (!battle.staging || typeof battle.staging !== "object" || Array.isArray(battle.staging))) {
          throw new ToolError("battle.staging 은 {enemyLunge?, comboCutIn?, comboFx?, skillHint?, revealWeakness?} 객체여야 합니다.", { code: "invalid-args" });
        }
        const patch: Record<string, unknown> = { ...(battle.staging as Record<string, unknown> | undefined), ...(battle.revealWeakness !== undefined ? { revealWeakness: battle.revealWeakness } : {}) };
        const lists: Record<string, readonly string[]> = { enemyLunge: BATTLE_ENEMY_LUNGES, comboCutIn: BATTLE_COMBO_CUT_INS, comboFx: BATTLE_COMBO_FXS, skillHint: BATTLE_SKILL_HINTS, revealWeakness: BATTLE_REVEAL_WEAKNESSES };
        for (const [key, list] of Object.entries(lists)) {
          if (patch[key] !== undefined && !list.includes(String(patch[key]))) {
            throw new ToolError(`battle.staging.${key} 는 ${list.join(" · ")} 중 하나입니다(받은 값 ${JSON.stringify(patch[key])}).`, { code: "invalid-args" });
          }
        }
        const next = normalizeBattleStaging({ ...resolveBattleStaging(draft.system.battleStaging), ...patch });
        if (next) draft.system.battleStaging = next;
        else delete draft.system.battleStaging;
      }
      if (isBattleHitFeel(battle.hitFeel)) {
        if (battle.hitFeel === DEFAULT_BATTLE_HIT_FEEL) delete draft.system.battleHitFeel;
        else draft.system.battleHitFeel = battle.hitFeel;
      }
      if (battle.look !== undefined) {
        const next = applyBattleLookArgs(draft.system.battleLook, battle.look);
        if (next) draft.system.battleLook = next;
        else delete draft.system.battleLook;
      }
      if (typeof battle.activeSlots === "number") draft.system.activeSlots = Math.trunc(battle.activeSlots);
      if (battle.teams !== undefined) teamWarnings.push(...applyBattleTeams(draft, battle.teams));
      if (battle.teamSwapCost !== undefined) {
        if (!isTeamSwapCost(battle.teamSwapCost)) throw new ToolError(`battle.teamSwapCost 는 free · gauge · turn 중 하나여야 합니다(받은 값 ${JSON.stringify(battle.teamSwapCost)}).`, { code: "invalid-args" });
        if (battle.teamSwapCost === DEFAULT_TEAM_SWAP_COST) delete draft.system.teamSwapCost;
        else draft.system.teamSwapCost = battle.teamSwapCost;
        if (!draft.system.battleTeams?.length) teamWarnings.push("teamSwapCost 를 저장했지만 battle.teams 가 없어 아직 효과가 없습니다. battle.teams 로 팀을 먼저 만드세요.");
      }
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
      if (battle.allowAutoBattle === false) { draft.system.allowAutoBattle = false; changed.push("자동 전투 없음"); }
      else if (battle.allowAutoBattle === true) { delete draft.system.allowAutoBattle; changed.push("자동 전투 켤 수 있음"); }
      if (battle.clearStatesAfterBattle === true) { draft.system.clearStatesAfterBattle = true; changed.push("전투 뒤 상태 이상 해제"); }
      else if (battle.clearStatesAfterBattle === false) delete draft.system.clearStatesAfterBattle;
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
        else {
          draft.system.dialogueStyle = style;
          if (style === "dual-fullbody-veil" && !args.playResolution && (!draft.system.playResolution || (draft.system.playResolution.width <= 480 && draft.system.playResolution.height <= 320))) {
            draft.system.playResolution = { width: 1024, height: 768 };
            if (draft.system.cameraZoom === undefined) draft.system.cameraZoom = 3.2;
            changed.push("화면=1024x768");
          }
        }
        changed.push(`대화창=${DIALOGUE_STYLES[style].label}`);
      }
      const { font, speed, punctuationPause, keepActorsVisible, fullPortraitHeight, fullPortraitDrop } = args.dialogue as Record<string, unknown>;
      if (typeof keepActorsVisible === "boolean") {
        // false 도 남긴다 — 연애 기본값(applyRomanceDefaults)이 저작자가 끈 값을 다시 켜지 않게.
        draft.system.dialogueKeepActorsVisible = keepActorsVisible;
        changed.push(`대화 중 인물 보이기=${keepActorsVisible ? "켬" : "끔"}`);
      }
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
      if (fullPortraitHeight !== undefined || fullPortraitDrop !== undefined) {
        const current = draft.system.dialogueFullPortrait ?? {};
        const next = normalizeDialogueFullPortraitSettings({
          ...DIALOGUE_FULL_PORTRAIT_DEFAULTS,
          ...current,
          ...(typeof fullPortraitHeight === "number" ? { height: fullPortraitHeight } : {}),
          ...(typeof fullPortraitDrop === "number" ? { drop: fullPortraitDrop } : {}),
        });
        if (next) draft.system.dialogueFullPortrait = next;
        else delete draft.system.dialogueFullPortrait;
        const layout = { ...DIALOGUE_FULL_PORTRAIT_DEFAULTS, ...next };
        changed.push(`전신 초상=높이 ${layout.height}%·내림 ${layout.drop}%`);
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
    // 해상도와 배율을 함께 바꿀 수 있으니 경고는 최종 system 으로 판정한다. 저장값은 그대로 둔다(옛 프로젝트 호환).
    const zoomWarning = zoomWarningArg ? pixelZoomWarning(resolveCameraZoom(draft.system), draft.system, "프로젝트 카메라 배율") : null;
    const settingWarnings = zoomWarning ? [zoomWarning, ...teamWarnings] : teamWarnings;
    const summary = `프로젝트 설정 변경 — ${changed.join(", ")}${zoomWarning ? ` (경고: ${zoomWarning})` : ""}`;
    return { summary, data: { changed }, ...(settingWarnings.length > 0 ? { warnings: settingWarnings } : {}) };
  },
};

const setParty: ToolDefinition = {
  name: "set_party",
  description: "파티 구성만 바꾼다. scope=start는 새 게임 시작 파티와 세션 파티를 함께 설정하고, scope=session은 현재 세션 파티만 설정한다. scope 를 생략하면 start 다. actorIds는 실제 actors id 목록이며 빈 배열도 허용한다. 호출 예시: {\"actorIds\":[\"actor_hero\",\"actor_mage\"]}",
  mode: "write",
  domains: ["database", "system"],
  parameters: {
    type: "object",
    properties: {
      scope: { type: "string", enum: ["start", "session"], description: "start=새 게임 정본 + 현재 세션, session=현재 세션만" },
      actorIds: { type: "array", items: { type: "string" }, description: "파티 순서대로 나열한 실제 actor id" },
    },
    required: ["actorIds"],
    additionalProperties: false,
  },
  invalidArgsExample: { actorIds: ["actor_hero", "actor_mage"] },
  run(draft, args): ToolExecResult {
    const scope = args.scope === undefined ? "start" : args.scope === "start" || args.scope === "session" ? args.scope : undefined;
    if (!scope || !Array.isArray(args.actorIds)) throw new ToolError("scope(start/session, 생략하면 start)와 actorIds 배열이 필요합니다. 예시: {\"actorIds\":[\"actor_hero\"]}", { code: "invalid-args" });
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
      ...(args.scope === undefined ? { warnings: ["scope 를 생략해 start(새 게임 시작 파티 + 현재 세션 파티)로 설정했습니다. 현재 세션 파티만 바꾸려면 scope:\"session\" 을 쓰세요."] } : {}),
    };
  },
};

/** battle.teams 를 검증해 system.battleTeams 에 쓴다. 빈 배열 = 해제. 반환 = 경고. */
function applyBattleTeams(draft: Project, value: unknown): string[] {
  if (!Array.isArray(value)) throw new ToolError("battle.teams 는 배열이어야 합니다. 예: [{\"id\":\"team_a\",\"name\":\"티나 팀\",\"actorIds\":[\"actor_terra\"]},{\"id\":\"team_b\",\"name\":\"로크 팀\",\"actorIds\":[\"actor_locke\"]}]. 해제는 [].", { code: "invalid-args" });
  if (value.length === 0) {
    delete draft.system.battleTeams;
    delete draft.system.teamSwapCost;
    return [];
  }
  if (value.length < 2) throw new ToolError("팀 교대 전투는 팀이 2개 이상이어야 합니다. 팀이 하나면 battle.teams 를 [] 로 비우세요.", { code: "invalid-args" });
  if (value.length > MAX_BATTLE_TEAMS) throw new ToolError(`팀은 최대 ${MAX_BATTLE_TEAMS}개입니다(받은 ${value.length}개).`, { code: "invalid-args" });
  const ids = new Set<string>();
  const claimed = new Map<string, string>();
  for (const [index, raw] of value.entries()) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ToolError(`battle.teams[${index}] 는 {id, name, actorIds} 객체여야 합니다.`, { code: "invalid-args" });
    const team = raw as Record<string, unknown>;
    const unknownKeys = Object.keys(team).filter((key) => key !== "id" && key !== "name" && key !== "actorIds");
    if (unknownKeys.length > 0) throw new ToolError(`battle.teams[${index}] 에 알 수 없는 키: ${unknownKeys.join(", ")}. 가능: id, name, actorIds.`, { code: "invalid-args" });
    if (typeof team.id !== "string" || !team.id.trim()) throw new ToolError(`battle.teams[${index}].id 가 필요합니다.`, { code: "invalid-args" });
    if (ids.has(team.id)) throw new ToolError(`팀 id 가 겹칩니다: ${team.id}`, { code: "duplicate-id" });
    ids.add(team.id);
    if (!Array.isArray(team.actorIds) || team.actorIds.length === 0) throw new ToolError(`팀 ${team.id} 의 actorIds 가 비어 있습니다. 팀마다 배우가 1명 이상 필요합니다.`, { code: "invalid-args" });
    for (const actorId of team.actorIds.map(String)) {
      if (!draft.database.actors.some((actor) => actor.id === actorId)) throw new ToolError(`팀 ${team.id} 의 배우를 찾을 수 없습니다: ${actorId}. upsert_actor 로 먼저 만드세요.`, { code: "actor-not-found" });
      const other = claimed.get(actorId);
      if (other) throw new ToolError(`배우 ${actorId} 가 팀 ${other} 와 ${team.id} 에 모두 들어 있습니다. 한 배우는 한 팀에만 둡니다.`, { code: "duplicate-actor" });
      claimed.set(actorId, team.id);
    }
  }
  const teams = normalizeBattleTeams(value);
  if (!teams || teams.length < 2) throw new ToolError("정규화 뒤 팀이 2개 미만입니다. 각 팀의 actorIds 를 확인하세요.", { code: "invalid-args" });
  draft.system.battleTeams = teams;
  const warnings: string[] = [];
  const party = draft.system.startActorIds ?? draft.session.partyActorIds;
  const loose = party.filter((id) => !claimed.has(id));
  if (loose.length > 0) warnings.push(`시작 파티의 ${loose.join(", ")} 는 어느 팀에도 없어 첫 팀(${teams[0]!.name})에 붙습니다.`);
  const inParty = teams.filter((team) => !team.actorIds.some((id) => party.includes(id)));
  if (inParty.length > 0) warnings.push(`팀 ${inParty.map((team) => team.id).join(", ")} 에는 시작 파티 배우가 없습니다. 전투 중에는 파티에 있는 배우만 서므로, 이 팀은 나중에 파티가 갖춰질 때까지 교대할 수 없습니다.`);
  if (draft.system.battleFlow === "strict") warnings.push("strict(엄격 턴제)에서는 팀 교대가 한 라운드 전체를 씁니다 — free · gauge · turn 이 같은 결과입니다.");
  return warnings;
}

export const PROJECT_TOOLS: readonly ToolDefinition[] = [resetProject, setProjectSettings, setParty];
