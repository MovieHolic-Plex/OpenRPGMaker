// editor/tools/gameSystemToggleTools.ts
// 시스템 옵트인 저작(전투 모델/선물/보상 정책/몬스터 케어/스킬 시스템/장르).
// 2026-08-27 커버리지 감사(.omo/evidence/ai-editor-reach-20260827/coverage-audit.md)에서
// 에디터 UI 는 쓰는데 어떤 툴도 쓰지 못하던 저작 필드를 담당한다.
// UI 패리티: editor/panels/databaseSystemView.ts(배틀 모델/선물/보상 체크박스, 옵트인 섹션).
import { applyBattleMethod } from "@/project/battleMethod";
import { GENRE_PACK_IDS, isGenrePackId } from "@/project/genrePackId";
import { applyRomanceDefaults } from "@/project/romancePreset";
import type { MonsterCareConfig, RewardPolicy, SystemRecords } from "@/project/types";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const BATTLE_MODELS = ["rm2k3", "gen1"] as const;
type BattleModel = (typeof BATTLE_MODELS)[number];

const SECTIONS = ["battleModel", "giftSystem", "rewardPolicy", "monsterCare", "skillSystem"] as const;

const MONSTER_CARE_DEFAULTS: MonsterCareConfig = {
  stepsPerTick: 50,
  walkFriendship: 1,
  walkExp: 1,
  dailyCareCap: 30,
};

// databaseRecordModel.normalizeMonsterCare 와 같은 경계값. 저장 시 정규화가 다시 클램프하므로
// 여기서 미리 맞춰 두면 툴이 돌려주는 값과 저장된 값이 어긋나지 않는다.
const MONSTER_CARE_LIMITS = {
  walkFriendship: 1000,
  walkExp: 999999,
  dailyCareCap: 999999,
} as const;

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ToolError(`${label}은 객체여야 합니다.`, { code: "invalid-args" });
  }
  return value as Record<string, unknown>;
}

function optionalBoolean(record: Record<string, unknown>, key: string, label: string): boolean | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new ToolError(`${label}.${key}는 true/false 여야 합니다.`, { code: "invalid-args" });
  return value;
}

function optionalCount(record: Record<string, unknown>, key: string, label: string, max: number): number | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ToolError(`${label}.${key}는 숫자여야 합니다.`, { code: "invalid-args" });
  }
  return Math.max(0, Math.min(max, Math.trunc(value)));
}

function parseBattleModel(value: unknown): BattleModel {
  if (typeof value !== "string" || !BATTLE_MODELS.includes(value as BattleModel)) {
    throw new ToolError(`battleModel은 ${BATTLE_MODELS.join("/")} 중 하나여야 합니다.`, { code: "invalid-args" });
  }
  return value as BattleModel;
}

/** UI 의 nextRewardPolicy 와 같은 부분 패치: 두 축 모두 꺼지면 필드를 지운다. */
function nextRewardPolicy(current: RewardPolicy | undefined, patch: Record<string, unknown>): RewardPolicy | undefined {
  const participationOnly = optionalBoolean(patch, "participationOnly", "rewardPolicy")
    ?? current?.participationOnly === true;
  const levelGapPenalty = optionalBoolean(patch, "levelGapPenalty", "rewardPolicy")
    ?? current?.levelGapPenalty === true;
  const expShare = optionalBoolean(patch, "expShare", "rewardPolicy") ?? current?.expShare === true;
  const expSplitAlive = optionalBoolean(patch, "expSplitAlive", "rewardPolicy") ?? current?.expSplitAlive === true;
  const prize = optionalCount(patch, "trainerPrizePerLevel", "rewardPolicy", 9999) ?? current?.trainerPrizePerLevel ?? 0;
  if (!participationOnly && !levelGapPenalty && !expShare && !expSplitAlive && prize <= 0) return undefined;
  return {
    ...(participationOnly ? { participationOnly: true } : {}),
    ...(levelGapPenalty ? { levelGapPenalty: true } : {}),
    ...(expShare ? { expShare: true } : {}),
    ...(expSplitAlive ? { expSplitAlive: true } : {}),
    ...(prize > 0 ? { trainerPrizePerLevel: prize } : {}),
  };
}

/** enabled:false 는 케어를 끈다(필드 삭제). 그 외엔 현재값 → 기본값 순으로 병합한다. */
function nextMonsterCare(current: MonsterCareConfig | undefined, patch: Record<string, unknown>): MonsterCareConfig | undefined {
  if (optionalBoolean(patch, "enabled", "monsterCare") === false) return undefined;
  const base = current ?? MONSTER_CARE_DEFAULTS;
  const stepsPerTick = optionalCount(patch, "stepsPerTick", "monsterCare", MONSTER_CARE_LIMITS.walkExp)
    ?? base.stepsPerTick;
  return {
    stepsPerTick: stepsPerTick > 0 ? stepsPerTick : MONSTER_CARE_DEFAULTS.stepsPerTick,
    walkFriendship: optionalCount(patch, "walkFriendship", "monsterCare", MONSTER_CARE_LIMITS.walkFriendship)
      ?? base.walkFriendship,
    walkExp: optionalCount(patch, "walkExp", "monsterCare", MONSTER_CARE_LIMITS.walkExp) ?? base.walkExp,
    dailyCareCap: optionalCount(patch, "dailyCareCap", "monsterCare", MONSTER_CARE_LIMITS.dailyCareCap)
      ?? base.dailyCareCap,
  };
}

function applySection(system: SystemRecords, key: (typeof SECTIONS)[number], value: unknown): string {
  switch (key) {
    case "battleModel": {
      const model = parseBattleModel(value);
      // 규칙만 따로 바꾸면 화면과 어긋난다 — 자료집 「전투 방식」과 같이 화면까지 맞춘다(2026-10-02, project/battleMethod.ts).
      // gen1 = 몬스터 대치(pokemon), rm2k3 = 도트 측면(기본값이라 두 키 모두 지운다).
      applyBattleMethod({ system }, model === "gen1" ? "monster" : "side");
      return `배틀 모델 ${model} (전투 화면 ${model === "gen1" ? "몬스터 대치" : "도트 측면"})`;
    }
    case "giftSystem": {
      if (typeof value !== "boolean") throw new ToolError("giftSystem은 true/false 여야 합니다.", { code: "invalid-args" });
      if (value) system.giftSystem = true;
      else delete system.giftSystem;
      return `선물 시스템 ${value ? "on" : "off"}`;
    }
    case "rewardPolicy": {
      const next = nextRewardPolicy(system.rewardPolicy, requireObject(value, "rewardPolicy"));
      if (next) system.rewardPolicy = next;
      else delete system.rewardPolicy;
      return `보상 정책 참전만=${next?.participationOnly === true} 레벨격차=${next?.levelGapPenalty === true} 경험치분배=${next?.expSplitAlive === true}`;
    }
    case "monsterCare": {
      const next = nextMonsterCare(system.monsterCare, requireObject(value, "monsterCare"));
      if (next) system.monsterCare = next;
      else delete system.monsterCare;
      return next ? `몬스터 케어 ${next.stepsPerTick}걸음/tick` : "몬스터 케어 off";
    }
    case "skillSystem": {
      const record = requireObject(value, "skillSystem");
      const enabled = optionalBoolean(record, "enabled", "skillSystem");
      if (enabled === undefined) throw new ToolError("skillSystem.enabled가 필요합니다.", { code: "invalid-args" });
      system.skillSystem = { enabled };
      return `생활 스킬 레벨링 ${enabled ? "on" : "off"}`;
    }
  }
}

const configureGameSystems: ToolDefinition = {
  name: "configure_game_systems",
  description:
    "시스템 옵트인 저작 데이터를 켠다/끈다: system.battleModel(전투 규칙 엔진)·system.giftSystem(선물)·"
    + "system.rewardPolicy(참전 보상/레벨 격차 패널티)·system.monsterCare(산책 돌봄 수치)·"
    + "system.skillSystem(생활 스킬 레벨링). Database 시스템 탭의 같은 토글이며 섹션은 전부 독립이다 — "
    + "준 섹션만 바뀌고 나머지는 그대로 유지된다. 프로젝트를 초기화하지 않는다.",
  mode: "write",
  domains: ["system", "database"],
  parameters: {
    type: "object",
    properties: {
      battleModel: {
        type: "string",
        enum: [...BATTLE_MODELS],
        description: "전투 방식. rm2k3 = 도트 측면 RM식 규칙(기본·필드 삭제), gen1 = 몬스터 대치(포켓몬식). 전투 화면(battleUiStyle)도 같이 맞춘다 — set_project_settings battle.uiStyle 과 같은 효과.",
      },
      giftSystem: { type: "boolean", description: "선물 시스템 on/off. false 면 필드를 지운다." },
      rewardPolicy: {
        type: "object",
        description: "전투 보상 정책 부분 패치. 주지 않은 축은 유지하고, 모든 축이 꺼지면 필드를 지운다.",
        properties: {
          participationOnly: { type: "boolean", description: "참전한 액터만 보상." },
          levelGapPenalty: { type: "boolean", description: "레벨 격차 경험치 패널티." },
          expShare: { type: "boolean", description: "경험치 나누기(몬스터 파티 전투): 나서지 않은 살아 있는 파티 몬스터도 경험치의 절반을 받는다." },
          expSplitAlive: { type: "boolean", description: "3세대식 경험치 분배(몬스터 파티 전투): 참전해 쓰러지지 않은 몬스터만 경험치를 받고 총량을 그 수로 나눈다(쓰러진 참전자는 0). 끄면 참전자 전원 전액." },
          trainerPrizePerLevel: { type: "integer", minimum: 0, maximum: 9999, description: "트레이너 상금 = 상대 마지막 몬스터 레벨 × 이 값(3세대 공식, 보통 16~60). 0 이면 끄고 적 레코드의 rewards.gold 를 쓴다." },
        },
        additionalProperties: false,
      },
      monsterCare: {
        type: "object",
        description: "파티 몬스터 산책 돌봄. enabled:false 면 필드를 지우고, 나머지는 현재값/기본값 위 부분 패치.",
        properties: {
          enabled: { type: "boolean", description: "false 면 monsterCare 를 제거한다." },
          stepsPerTick: { type: "integer", description: "돌봄 tick 당 걸음 수(기본 50)." },
          walkFriendship: { type: "integer", description: "tick 당 호감도(기본 1)." },
          walkExp: { type: "integer", description: "tick 당 경험치(기본 1)." },
          dailyCareCap: { type: "integer", description: "하루 호감도 상한(기본 30)." },
        },
        additionalProperties: false,
      },
      skillSystem: {
        type: "object",
        description: "생활 스킬(농사/채광/채집/낚시/전투) 레벨링 on/off.",
        properties: { enabled: { type: "boolean" } },
        required: ["enabled"],
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const changes = SECTIONS.filter((key) => args[key] !== undefined);
    if (changes.length === 0) {
      throw new ToolError(`설정할 섹션이 없습니다. ${SECTIONS.join(", ")} 중 하나 이상을 주세요.`, { code: "invalid-args" });
    }
    const notes = changes.map((key) => applySection(draft.system, key, args[key]));
    return {
      summary: `시스템 옵트인 ${changes.length}개 설정 · ${notes.join(" · ")}`,
      data: {
        battleModel: draft.system.battleModel,
        giftSystem: draft.system.giftSystem,
        rewardPolicy: draft.system.rewardPolicy,
        monsterCare: draft.system.monsterCare,
        skillSystem: draft.system.skillSystem,
      },
    };
  },
};

const setProjectGenre: ToolDefinition = {
  name: "set_project_genre",
  description:
    "현재 프로젝트의 선언 장르(system.genre)를 바꾼다. 프로젝트 lint 가 이 선언을 기준으로 옵트인 정합성을 "
    + "검사한다(project/lint/projectLint.ts: 장르가 monster-collect 면 monsterCollection, farm-life 면 시간 시스템·작물). "
    + "reset_project(genrePreset)와 달리 맵·이벤트·데이터베이스를 지우지 않고 system.genre 만 쓴다.",
  mode: "write",
  domains: ["system", "database"],
  parameters: {
    type: "object",
    properties: {
      genre: {
        type: "string",
        enum: [...GENRE_PACK_IDS],
        description: "선언할 장르 팩 id.",
      },
    },
    required: ["genre"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const genre = args.genre;
    if (!isGenrePackId(genre)) {
      throw new ToolError(`genre는 ${GENRE_PACK_IDS.join(", ")} 중 하나여야 합니다.`, { code: "invalid-args" });
    }
    const previous = draft.system.genre;
    draft.system.genre = genre;
    return {
      summary: previous && previous !== genre ? `장르를 ${previous} → ${genre} 로 변경` : `장르 ${genre} 선언`,
      data: { genre, previous },
    };
  },
};

const applyRomancePreset: ToolDefinition = {
  name: "apply_romance_preset",
  description:
    "연애·관계 게임 기본값을 한 번에 깐다: 체력 하트 대신 호감 하트 HUD(값이 바뀐 뒤 잠깐), ESC 관계 메뉴(장르 잠금), 대사 읽기 보조(기록·오토·스킵), "
    + "엔딩 목록·갤러리, 시작 맵 BGM(비었을 때). 저작자가 이미 정한 값(대화창 스타일·HUD 위젯·타이틀 그림)은 덮지 않는다. "
    + "dayLoop:true(기본) = 하루 루프(시간이 흐르고 대화 칸 3개, 14일째 누적 호감 기한 엔딩). "
    + "dayLoop:false = 이야기형(정해진 장면 순서로 흐르는 연애 데모·비주얼 노벨) — 시계·대화 칸·기한 엔딩 없이 호감 하트만. "
    + "전투가 없는 연애 게임에 「514/514」 같은 체력 하트가 떠 있으면 이 도구로 바꾼다.",
  mode: "write",
  domains: ["system"],
  parameters: {
    type: "object",
    properties: {
      dayLoop: { type: "boolean", description: "하루 루프(시간·대화 칸·기한 엔딩)를 켠다. 기본 true. 이야기형 연애는 false" },
    },
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const dayLoop = args.dayLoop !== false;
    const applied = applyRomanceDefaults(draft, { force: true, dayLoop });
    return {
      summary: applied.length ? `연애 기본값(${dayLoop ? "하루 루프" : "이야기형"}): ${applied.join(", ")}` : "연애 기본값이 이미 모두 깔려 있다(바꾼 것 없음)",
      data: { applied, dayLoop },
    };
  },
};

export const GAME_SYSTEM_TOGGLE_TOOLS: readonly ToolDefinition[] = [configureGameSystems, setProjectGenre, applyRomancePreset];
