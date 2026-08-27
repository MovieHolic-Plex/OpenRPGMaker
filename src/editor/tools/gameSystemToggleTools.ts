// editor/tools/gameSystemToggleTools.ts
// 시스템 옵트인 저작(전투 모델/선물/보상 정책/몬스터 케어/스킬 시스템/장르).
// 2026-08-27 커버리지 감사(.omo/evidence/ai-editor-reach-20260827/coverage-audit.md)에서
// 에디터 UI 는 쓰는데 어떤 툴도 쓰지 못하던 저작 필드를 담당한다.
// UI 패리티: editor/panels/databaseSystemView.ts(배틀 모델/선물/보상 체크박스, 옵트인 섹션).
import { GENRE_PACK_IDS, isGenrePackId } from "@/project/genrePackId";
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
  if (!participationOnly && !levelGapPenalty) return undefined;
  return {
    ...(participationOnly ? { participationOnly: true } : {}),
    ...(levelGapPenalty ? { levelGapPenalty: true } : {}),
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
      // rm2k3 은 기본값이므로 저장하지 않는다(normalizeSystemRecords·UI 와 같은 계약).
      if (model === "gen1") system.battleModel = "gen1";
      else delete system.battleModel;
      return `배틀 모델 ${model}`;
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
      return `보상 정책 참전만=${next?.participationOnly === true} 레벨격차=${next?.levelGapPenalty === true}`;
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
        description: "전투 규칙 엔진. rm2k3(기본·필드 삭제) 또는 gen1(포켓몬 레드 스타일, 구현 중).",
      },
      giftSystem: { type: "boolean", description: "선물 시스템 on/off. false 면 필드를 지운다." },
      rewardPolicy: {
        type: "object",
        description: "전투 보상 정책 부분 패치. 주지 않은 축은 유지하고, 둘 다 false 면 필드를 지운다.",
        properties: {
          participationOnly: { type: "boolean", description: "참전한 액터만 보상." },
          levelGapPenalty: { type: "boolean", description: "레벨 격차 경험치 패널티." },
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

export const GAME_SYSTEM_TOGGLE_TOOLS: readonly ToolDefinition[] = [configureGameSystems, setProjectGenre];
