import { describe, expect, it } from "vitest";
import { DEFAULT_SKILL_CRIT_MULT, DEFAULT_SKILL_CRIT_RATE, MIN_DAMAGE_RATIO, applySkillLike } from "@/battle/battleDamage";
import { planActionBeats, weightForFeedback, type BattleActionWeight } from "@/player/battleActionBeats";
import { BATTLE_ACTING_MS, BATTLE_HITSTOP_MS, BATTLE_IMPACT_MS, BATTLE_LOG_MS, type DamageFeedback } from "@/player/battleSequencer";
import { TERM_KEYS, formatBattleCommandPrompt, resolveTermOverrides } from "@/project/terms";
import { defaultTerms, defaultSystem, defaultDatabase, ensureRetroRosterRecords, defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import { battleCommandKindLabel } from "@/player/battleCommandDom";
import type { RuntimeBattleCommand } from "@/battle/battleCommands";
import type { MutableBattler } from "@/battle/battleBattlers";
import { existsSync } from "node:fs";
import { BATTLE_SKINS, DEFAULT_BATTLE_SKIN_ID, battleSkinFamily, getBattleSkin, isRetiredBattleSkinId, listActiveBattleSkinIds, listBattleSkinIds, resolveSkinId, retiredSkinLookWindow } from "@/battle/skins/registry";
import { builtinGeneratedResourceIds, resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { createBlankProject } from "@/project/defaults";
import { BATTLER_PLACEMENTS } from "@/battle/battlerPlacements";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { stateBadgeLabel } from "@/player/battleStatusLabel";
import { resolve } from "node:path";
import { CC0_AUDIO_ASSETS, isBrowserPlayableAudioPath } from "@/assets/cc0AudioAssets";
import { EASYRPG_RTP_ASSETS } from "@/assets/easyrpgRtp";
import { findBgmRuntimeEntry } from "@/assets/bgmCatalogRuntime";
import { bgmTrackUrl } from "@/assets/bgmCdn";
import type { DatabaseElementRecord, ProjectDatabaseRecords, TitleScreenSettings } from "@/project/types";
import { clampTitleMenuIndex, focusSelectedTitleOption, listTitleMenuOptions, renderTitleScreen, titleMenuHeight, titleMenuTop, updateTitleSelection } from "@/player/titleScreen";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { createScarloxyDemoProject } from "../src/project/defaults/defaultProject";
import { isolateTimers } from "./mergedTeardown";

// 전투 재미 감사(2026-08-29) 후속 수정의 회귀 가드.
// 각 단정은 감사에서 실측한 결함 하나에 1:1 로 대응한다.
describe("battleFeelFixes", () => {
  isolateTimers();
  function battler(overrides: Partial<MutableBattler> = {}): MutableBattler {
    return {
      id: "b1",
      recordId: "r1",
      name: "테스트",
      side: "enemy",
      hp: 500,
      maxHp: 500,
      mp: 10,
      maxMp: 10,
      attackPower: 10,
      defense: 0,
      mind: 0,
      agility: 10,
      level: 1,
      defending: false,
      defeated: false,
      stateIds: [],
      stateTurns: {},
      gauge: 0,
      pose: "idle",
      ...overrides,
    } as unknown as MutableBattler;
  }
  describe("F16: 뺄셈식 방어가 0 으로 붕괴하지 않는다", () => {
    it("방어력이 공격력을 압도해도 방어 적용 전 위력의 하한만큼은 깎인다", () => {
      // 감사 실측: Lv1 주인공(방어 72) 상대로 기본 적 24종 중 12종이 정확히 0 을 줬다.
      const user = battler({ attackPower: 12 });
      const target = battler({ defense: 200, hp: 500 });
      const result = applySkillLike(user, target, {
        power: 12,
        statistic: "attack",
        effect: "damage",
        variance: 0,
        criticalRate: 0,
        rng: () => 0.5,
      });
      expect(result.hit).toBe(true);
      expect(result.amount).toBeGreaterThan(0);
      // 방어 전 위력 = power(12) + floor(12/2) = 18 → 하한 floor(18 × 0.125) = 2.
      expect(result.amount).toBe(Math.max(1, Math.floor(18 * MIN_DAMAGE_RATIO)));
    });

    it("방어를 뚫는 공격의 데미지는 손대지 않는다", () => {
      const user = battler({ attackPower: 100 });
      const target = battler({ defense: 10, hp: 500 });
      const result = applySkillLike(user, target, {
        power: 40,
        statistic: "attack",
        effect: "damage",
        variance: 0,
        criticalRate: 0,
        rng: () => 0.5,
      });
      // 40 + floor(100/2) - floor(10/2) = 85. 하한(11)보다 크므로 그대로다.
      expect(result.amount).toBe(85);
    });
  });
  describe("F14: 크리티컬이 실제로 보일 만큼 자주 터진다", () => {
    it("기본 확률은 10% 이상이고 배율은 과하지 않다", () => {
      expect(DEFAULT_SKILL_CRIT_RATE).toBeGreaterThanOrEqual(10);
      expect(DEFAULT_SKILL_CRIT_MULT).toBeGreaterThan(1);
      expect(DEFAULT_SKILL_CRIT_MULT).toBeLessThan(1.5);
    });
  });
  describe("F04: 행동의 무게에 따라 케이던스가 달라진다", () => {
    const feedback = (over: Partial<DamageFeedback> = {}): DamageFeedback => ({
      targetId: "b1",
      amount: 30,
      critical: false,
      healing: false,
      ...over,
    });

    function total(weight: BattleActionWeight): number {
      return planActionBeats({
        userId: "u",
        targetId: "b1",
        feedback: feedback({ critical: weight === "heavy" }),
        actingMs: BATTLE_ACTING_MS,
        hitStopMs: BATTLE_HITSTOP_MS,
        impactMs: BATTLE_IMPACT_MS,
        weight,
      }).reduce((sum, beat) => sum + beat.durationMs, 0);
    }

    it("light < normal < heavy 순으로 길어진다", () => {
      expect(total("light")).toBeLessThan(total("normal"));
      expect(total("normal")).toBeLessThan(total("heavy"));
    });

    it("normal 은 시퀀서 기준 상수를 그대로 쓴다", () => {
      const beats = planActionBeats({
        userId: "u",
        targetId: "b1",
        feedback: feedback(),
        actingMs: BATTLE_ACTING_MS,
        hitStopMs: BATTLE_HITSTOP_MS,
        impactMs: BATTLE_IMPACT_MS,
        weight: "normal",
      });
      expect(beats.map((beat) => beat.durationMs)).toEqual([
        BATTLE_ACTING_MS,
        BATTLE_HITSTOP_MS,
        BATTLE_IMPACT_MS,
      ]);
    });

    it("무게는 피드백에서 유도된다 — 급소·막타는 heavy, 빗나감·0 피해는 light", () => {
      expect(weightForFeedback(feedback({ critical: true }))).toBe("heavy");
      expect(weightForFeedback(feedback(), true)).toBe("heavy");
      expect(weightForFeedback(feedback({ miss: true, amount: 0 }))).toBe("light");
      expect(weightForFeedback(feedback({ blocked: true, amount: 0 }))).toBe("light");
      expect(weightForFeedback(feedback())).toBe("normal");
      expect(weightForFeedback(undefined)).toBe("light");
    });
  });
  describe("F06: 죽은 시간이 줄었다", () => {
    it("임팩트 여운이 접근 모션보다 길지 않다", () => {
      // 예전: 접근 550 / 여운 750 — 절정(히트스톱)은 1프레임인데 여운이 900ms 넘게 흘렀다.
      expect(BATTLE_IMPACT_MS).toBeLessThanOrEqual(BATTLE_ACTING_MS);
    });

    it("시각 효과 없는 로그도 읽을 시간을 받는다", () => {
      expect(BATTLE_LOG_MS).toBeGreaterThan(0);
    });
  });
  describe("F12: 방어·도주 라벨도 용어 사전에 들어간다", () => {
    it("TERM_KEYS 와 기본 용어에 defend/escape 가 있다", () => {
      expect(TERM_KEYS).toContain("defend");
      expect(TERM_KEYS).toContain("escape");
      expect(defaultTerms().defend).toBe("방어");
      expect(defaultTerms().escape).toBe("도주");
    });

    it("표준 커맨드는 클래스 이름이 영어여도 용어를 따른다", () => {
      const terms = defaultTerms();
      const command = (kind: RuntimeBattleCommand["kind"], name: string, id: string): RuntimeBattleCommand => ({
        id,
        name,
        kind,
      });
      expect(battleCommandKindLabel(command("attack", "Hit", "cmd_attack"), terms)).toBe("공격");
      expect(battleCommandKindLabel(command("skill", "기술", "cmd_skill"), terms)).toBe("스킬");
      expect(battleCommandKindLabel(command("item", "Bag", "cmd_item"), terms)).toBe("아이템");
      expect(battleCommandKindLabel(command("defend", "Guard", "cmd_defend"), terms)).toBe("방어");
      expect(battleCommandKindLabel(command("escape", "Run", "cmd_escape"), terms)).toBe("도주");
      expect(battleCommandKindLabel(command("capture", "Catch", "cmd_capture"), terms)).toBe("포획");
      expect(battleCommandKindLabel(command("skill", "검격", "cmd_slash"), terms)).toBe("검격");
    });
  });
});

describe("battleSkinRegistry", () => {
  isolateTimers();
  describe("battle skin registry", () => {
    it("도트 측면(retro2003)과 포켓몬, 정확히 2개 스킨만 남는다(2026-10-02 RM2003 식만 남기는 정리)", () => {
      expect([...listBattleSkinIds()].sort()).toEqual(["pokemon", "retro2003"]);
      expect(listActiveBattleSkinIds()).toEqual(["retro2003", "pokemon"]);
    });

    it("남은 스킨의 구도·묶음 계약", () => {
      for (const id of listBattleSkinIds()) {
        if (id === "pokemon") {
          expect(battleSkinFamily(id)).toBe("pokemon");
          expect(getBattleSkin(id).layout).toBe("frontview");
          continue;
        }
        const skin = getBattleSkin(id);
        expect(battleSkinFamily(id), id).toBe("glass");
        expect(skin.layout, id).toBe("sideview");
        expect(skin.showAllySprites, id).toBe(true);
        expect(skin.hudTemplate, id).toBe("rows");
      }
    });

    it("측면 스킨은 모두 도트 측면 뼈대(retro2003)의 배치를 공유한다", () => {
      for (const id of listBattleSkinIds()) {
        if (id === "pokemon") continue;
        expect(BATTLER_PLACEMENTS[id], id).toBe(BATTLER_PLACEMENTS.retro2003);
      }
      expect(Object.keys(BATTLER_PLACEMENTS).sort()).toEqual([...listBattleSkinIds()].sort());
    });

    it("측면 스킨은 모두 도트 측면 전투 뼈대 위의 창 모양이다(2026-10-01)", () => {
      for (const id of listBattleSkinIds()) {
        const skin = getBattleSkin(id);
        if (skin.layout !== "sideview") continue;
        expect(skin, id).toMatchObject({ motionStyle: "retro", scenery: "layered", hudTemplate: "rows" });
      }
    });

    it("retro2003은 측면 아군·유리 계열·레트로 모션·겹 배경 계약을 가진다", () => {
      expect(resolveSkinId("retro2003")).toBe("retro2003");
      expect(battleSkinFamily("retro2003")).toBe("glass");
      expect(getBattleSkin("retro2003")).toMatchObject({
        layout: "sideview", showAllySprites: true, motionStyle: "retro", scenery: "layered",
      });
    });

    it("HUD 변형: 측면 스킨은 줄(rows)만, 박스는 포켓몬만 쓴다", () => {
      const huds = new Set(listBattleSkinIds().filter((id) => id !== "pokemon").map((id) => getBattleSkin(id).hudTemplate));
      expect([...huds]).toEqual(["rows"]);
      expect(getBattleSkin("pokemon").hudTemplate).toBe("boxes");
    });

    it("지운 정면 스킨 다섯은 등록되어 있지 않고 저장값은 retro2003 으로 풀린다", () => {
      const ids = listBattleSkinIds() as string[];
      for (const id of ["rm2000", "dragonquest", "mother", "mv", "vxace", "classic"]) {
        expect(ids, id).not.toContain(id);
        expect(resolveSkinId(id), id).toBe("retro2003");
        expect(isRetiredBattleSkinId(id), id).toBe(true);
      }
      expect(isRetiredBattleSkinId("retro2003")).toBe(false);
      expect(isRetiredBattleSkinId("pokemon")).toBe(false);
    });

    it("창 색만 다르던 측면 스킨 여섯도 지웠다 — 저장값은 retro2003 으로 풀리고 창 색은 꾸밈 창으로 옮길 곳을 준다", () => {
      const ids = listBattleSkinIds() as string[];
      for (const id of ["rm2003", "octopath", "chrono", "bravely", "ff", "goldensun"]) {
        expect(ids, id).not.toContain(id);
        expect(resolveSkinId(id), id).toBe("retro2003");
        expect(isRetiredBattleSkinId(id), id).toBe(true);
      }
      expect(retiredSkinLookWindow("octopath")).toBe("ink");
      expect(retiredSkinLookWindow("chrono")).toBe("teal");
      expect(retiredSkinLookWindow("bravely")).toBe("parch");
      expect(retiredSkinLookWindow("goldensun")).toBe("gold");
      expect(retiredSkinLookWindow("rm2003")).toBe("veil");
      expect(retiredSkinLookWindow("ff")).toBeUndefined();
      expect(retiredSkinLookWindow("retro2003")).toBeUndefined();
    });

    it("새 프로젝트는 retro2003 으로 열리고, 기본값이라 직렬화에서는 생략된다", () => {
      const project = createBlankProject();
      expect(project.system.battleUiStyle).toBe("retro2003");
      expect(normalizeSystemRecords(project.system).battleUiStyle).toBeUndefined();
    });

    it("미설정 기존 프로젝트는 retro2003 으로 열린다", () => {
      expect(DEFAULT_BATTLE_SKIN_ID).toBe("retro2003");
      expect(resolveSkinId(undefined)).toBe("retro2003");
      expect(defaultSystem().battleUiStyle).toBeUndefined();
      expect(getBattleSkin("retro2003").showAllySprites).toBe(true);
    });

    it("모든 스킨은 label·layout·themeVars를 갖는다", () => {
      for (const id of listBattleSkinIds()) {
        const skin = getBattleSkin(id);
        expect(skin.id).toBe(id);
        expect(skin.label.length).toBeGreaterThan(0);
        expect(["sideview", "frontview", "active", "firstperson"]).toContain(skin.layout);
        expect(Object.keys(skin.themeVars).length).toBeGreaterThan(0);
      }
    });

    it("legacy 값을 매핑한다(back-compat)", () => {
      // 미설정/미지의 값·지운 스킨 → 기본 스킨(retro2003).
      expect(resolveSkinId(undefined)).toBe("retro2003");
      expect(resolveSkinId("classic")).toBe("retro2003");
      expect(resolveSkinId("rm2000")).toBe("retro2003");
      expect(resolveSkinId("rm2003")).toBe("retro2003");
      expect(resolveSkinId("pokemon")).toBe("pokemon");
      expect(resolveSkinId("octopath")).toBe("retro2003");
      expect(resolveSkinId("bogus")).toBe("retro2003");
    });

    it("BATTLE_SKINS 키와 id가 일치한다", () => {
      for (const [key, skin] of Object.entries(BATTLE_SKINS)) expect(skin.id).toBe(key);
    });

    it("측면 스킨은 모두 같은 themeVars 키 집합을 쓴다", () => {
      const baseKeys = Object.keys(getBattleSkin("retro2003").themeVars).sort();
      for (const id of listBattleSkinIds()) {
        if (id === "pokemon") continue;
        expect(Object.keys(getBattleSkin(id).themeVars).sort(), id).toEqual(baseKeys);
      }
    });
  });
  describe("skin dataset wiring", () => {
    it("resolveSkinId는 dataset에 넣기 안전한 문자열만 반환한다", () => {
      for (const v of [undefined, "classic", "pokemon", "mother", "zzz"]) {
        expect(resolveSkinId(v)).toMatch(/^[a-z0-9]+$/);
      }
    });
  });
  describe("battle skin assets", () => {
    it("모든 스킨은 DB에 등록된(해석 가능한) 기본 배경을 가진다", () => {
      const ids = new Set(builtinGeneratedResourceIds());
      for (const id of listBattleSkinIds()) {
        const skin = getBattleSkin(id);
        expect(skin.defaultBackdropResourceId, `${id} missing backdrop`).toBeTruthy();
        expect(ids.has(skin.defaultBackdropResourceId!), `${id} backdrop not in DB feed`).toBe(true);
        // 옛 스킨 배경 그림은 2026-10-03 deprecated/ 로 옮겼고 id 는 지금 그림(도트 겹 배경 미리보기·Scarloxy 숲)으로 돌린다
        // (generatedAssetResourceResolver.ts) — battle-skins/ 경로가 아니라 실제로 출하되는 PNG 를 가리키면 된다.
        const url = resolveAssetResourceUrl(skin.defaultBackdropResourceId);
        expect(url).toMatch(/^\/assets\/.*\.png$/);
        expect(existsSync(`public${url}`), `${id} backdrop file ${url}`).toBe(true);
      }
    });

    it("데모 배틀러(크로마키 처리본)가 DB에 등록되어 해석된다", () => {
      expect(builtinGeneratedResourceIds()).toContain("battle-skin-demo-battler");
      expect(resolveAssetResourceUrl("battle-skin-demo-battler")).toBe("/assets/generated/battle-skins/demo-battler-alpha.png");
    });
  });
  describe("battleUiStyle serialization", () => {
    it("비-기본 스킨 pokemon 은 그대로 보존한다", () => {
      const project = createBlankProject();
      project.system.battleUiStyle = "pokemon";
      const out = normalizeSystemRecords(project.system) as { battleUiStyle?: string };
      expect(out.battleUiStyle).toBe("pokemon");
    });

    it("기본 스킨(retro2003)과 지운 스킨은 생략한다", () => {
      const project = createBlankProject();
      project.system.battleUiStyle = "retro2003";
      expect((normalizeSystemRecords(project.system) as { battleUiStyle?: string }).battleUiStyle).toBeUndefined();
      for (const id of ["vxace", "rm2003", "octopath"]) {
        (project.system as { battleUiStyle?: string }).battleUiStyle = id;
        expect((normalizeSystemRecords(project.system) as { battleUiStyle?: string }).battleUiStyle, id).toBeUndefined();
      }
    });

    it("지운 측면 스킨의 창 색은 꾸밈을 안 건드린 프로젝트에서만 꾸밈 창으로 옮긴다", () => {
      const project = createBlankProject();
      const system = project.system as { battleUiStyle?: string; battleLook?: unknown };
      system.battleUiStyle = "octopath";
      delete system.battleLook;
      expect(normalizeSystemRecords(project.system).battleLook).toEqual({ window: "ink" });
      system.battleUiStyle = "chrono";
      system.battleLook = { accent: "#ff0000" };
      expect(normalizeSystemRecords(project.system).battleLook).toEqual({ window: "teal", accent: "#ff0000" });
      // 꾸밈 프리셋·창을 이미 고른 프로젝트는 그 꾸밈이 보이고 있었다 — 그대로 둔다.
      system.battleUiStyle = "goldensun";
      system.battleLook = { preset: "parch" };
      expect(normalizeSystemRecords(project.system).battleLook).toEqual({ preset: "parch" });
      system.battleUiStyle = "ff";
      delete system.battleLook;
      expect(normalizeSystemRecords(project.system).battleLook).toBeUndefined();
    });
  });
});

describe("battleTermsAndStatusLabels", () => {
  isolateTimers();
  describe("battle terms", () => {
    it("default command prompt matches the old hard-coded line", () => {
      const template = defaultTerms().battleCommandPrompt;
      expect(formatBattleCommandPrompt(template, "카엘")).toBe("카엘은 무엇을 할까?");
      expect(formatBattleCommandPrompt(template, "루나")).toBe("루나는 무엇을 할까?");
      expect(formatBattleCommandPrompt(template, "루나", true)).toBe("루나는\n무엇을 할까?");
    });

    it("custom templates fill plain and particle placeholders", () => {
      expect(formatBattleCommandPrompt("{name}, 어떻게 할까?", "카엘")).toBe("카엘, 어떻게 할까?");
      expect(formatBattleCommandPrompt("{name이} 명령을 기다린다", "루나")).toBe("루나가 명령을 기다린다");
      expect(formatBattleCommandPrompt("What will {name} do?", "Kael")).toBe("What will Kael do?");
    });

    it("victory banner defaults to 승리! and is overridable", () => {
      expect(resolveTermOverrides(undefined).battleVictory).toBe("승리!");
      expect(resolveTermOverrides({ battleVictory: "VICTORY" }).battleVictory).toBe("VICTORY");
    });
  });
  describe("stateBadgeLabel", () => {
    it("uses the authored state name in the game's language", () => {
      expect(stateBadgeLabel("마비")).toBe("마비");
      expect(stateBadgeLabel("독")).toBe("독");
      expect(stateBadgeLabel("마비 상태")).toBe("마비");
      expect(stateBadgeLabel("麻痺")).toBe("麻痺");
    });

    it("leaves long latin names to the CSS abbreviation", () => {
      expect(stateBadgeLabel("Paralysis")).toBeNull();
      expect(stateBadgeLabel("state_paralysis")).toBeNull();
      expect(stateBadgeLabel("  ")).toBeNull();
    });
  });
});

// "게임을 켜면 소리가 난다" 를 지키는 가드.
//
// 실측 배경(2026-07-26): 등록된 음악 리소스 30곡이 전부 .mid 였고 기본 전투 BGM 도 그중 하나였다.
// 브라우저 HTMLAudioElement 는 MIDI 를 재생하지 못하므로 게임은 완전 무음으로 돌아갔다.
// 이 테스트는 기본값이 다시 재생 불가 리소스로 돌아가는 것을 막는다.
describe("defaultProjectAudible", () => {
  isolateTimers();
  /**
   * resourceId → 번들 자산 경로(public/ 기준 상대 경로).
   *
   * BGM 카탈로그(281곡)는 CDN 에서 오지만, 기본값으로 쓰는 스타터 곡만은 레포에 함께 커밋돼
   * CDN 없이도 들려야 한다. 그래서 카탈로그 곡은 **환경변수를 명시적으로 비워** 로컬 폴백 경로로
   * 해석한다 — 개발자의 .env.local 에 VITE_BGM_CDN_BASE 가 있어도 이 테스트가 흔들리지 않게.
   */
  function bundledPathFor(resourceId: string): string | null {
    const catalog = findBgmRuntimeEntry(resourceId);
    if (catalog) {
      const url = bgmTrackUrl(catalog.fileName, {});
      return url === null ? null : decodeURIComponent(url.replace(/^\//, ""));
    }
    const cc0 = CC0_AUDIO_ASSETS.find((asset) => asset.id === resourceId);
    if (cc0) return cc0.path;
    const rtp = EASYRPG_RTP_ASSETS.find((asset) => asset.id === resourceId);
    return rtp ? rtp.path : null;
  }
  describe("기본 프로젝트 오디오", () => {
    const system = defaultSystem();

    it("전투 BGM 과 기본 BGM 이 모두 지정돼 있다", () => {
      expect(system.battleBgmResourceId?.trim()).toBeTruthy();
      expect(system.defaultBgmResourceId?.trim()).toBeTruthy();
    });

    for (const field of ["battleBgmResourceId", "defaultBgmResourceId"] as const) {
      it(`${field} 은 브라우저에서 재생 가능한 포맷이다(MIDI 금지)`, () => {
        const id = system[field];
        const path = id ? bundledPathFor(id) : null;
        expect(path, `${id} 를 번들 자산에서 찾지 못했다`).not.toBeNull();
        expect(isBrowserPlayableAudioPath(path!), `${path} 는 브라우저 재생 불가(MIDI 등)`).toBe(true);
      });

      it(`${field} 의 파일이 실제로 존재한다`, () => {
        const path = bundledPathFor(system[field]!)!;
        expect(existsSync(resolve("public", path)), `${path} 없음`).toBe(true);
      });
    }

    it("defaultBgmResourceId 가 정규화 왕복에서 살아남는다", () => {
      // normalizeSystemRecords 는 화이트리스트 방식이라 필드를 빠뜨리면 저장/로드 1회에 조용히 사라진다.
      // 실제로 이 함정에 걸렸다 — 값이 사라져 게임이 계속 무음이었다(2026-07-26).
      const round = normalizeSystemRecords(defaultSystem());
      expect(round.defaultBgmResourceId).toBe(system.defaultBgmResourceId);
      expect(normalizeSystemRecords(round).defaultBgmResourceId).toBe(system.defaultBgmResourceId);
    });

    it("EasyRPG RTP 음악은 전부 MIDI 이므로 BGM 기본값 후보가 아니다", () => {
      // 이 사실이 바뀌면(누군가 ogg 를 넣었다면) 위 규칙을 다시 판단해야 하므로 명시적으로 못박는다.
      const playable = EASYRPG_RTP_ASSETS.filter(
        (asset) => asset.category === "music" && isBrowserPlayableAudioPath(asset.path),
      );
      expect(playable.map((a) => a.path)).toEqual([]);
    });
  });
});

describe("defaultTitleScreenRoundtrip", () => {
  isolateTimers();
  describe("default title screen wire contract", () => {
    it("keeps the emitted settings byte-identical when normalized for loading", () => {
      // Given: a fresh system carries the factory's title screen settings.
      const system = defaultSystem();
      const original = JSON.stringify(system.titleScreen);

      // When: loading applies the real system normalizer.
      const restored = normalizeSystemRecords(system);

      // Then: the factory already emits the canonical title screen representation.
      expect(JSON.stringify(restored.titleScreen)).toBe(original);
    });
  });
});

// 적이 8속성 전부로 공격할 수 있어야 적마다 저작된 11개 속성 저항이 의미를 갖는다.
// 기존에는 fire/water/grass 3종뿐이었고 나머지는 "뇌전석 효과" 같은 아이템 효과
// 스킬로만 존재해 적 기술 이름으로 쓰면 어색했다.
describe("enemyElementalSkills", () => {
  isolateTimers();
  describe("적 속성 공격 스킬", () => {
    it("8속성 각각에 아이템 효과가 아닌 공격 스킬이 있다", () => {
      const skills = (defaultDatabase() as any).skills as any[];
      const combat = skills.filter((s) => !String(s.id).startsWith("skill_item_"));
      for (const element of ["fire", "ice", "thunder", "water", "earth", "wind", "dark", "holy"]) {
        const match = combat.filter((s) => s.elementId === element && s.scope === "enemy" && (s.power ?? 0) > 0);
        expect(match.length, `${element} 속성 공격 스킬이 없다`).toBeGreaterThan(0);
      }
    });

    it("신규 6종은 MP 4 이고 적 MP(10)로 2회 쓸 수 있다", () => {
      const skills = (defaultDatabase() as any).skills as any[];
      for (const id of ["skill_ice", "skill_thunder", "skill_earth", "skill_wind", "skill_dark", "skill_holy"]) {
        const s = skills.find((x) => x.id === id);
        expect(s, `${id} 없음`).toBeDefined();
        expect(s.mpCost.flat).toBe(4);
        expect(s.scope).toBe("enemy");
      }
    });

    it("신규 6종은 플레이어 직업에 배정되지 않는다", () => {
      const db = defaultDatabase() as any;
      const assigned = new Set(db.classes.flatMap((c: any) => c.skillIds ?? []));
      for (const id of ["skill_ice", "skill_thunder", "skill_earth", "skill_wind", "skill_dark", "skill_holy"]) {
        expect(assigned.has(id), `${id} 가 직업에 배정됐다`).toBe(false);
      }
    });
  });
});

describe("retroRosterElementDependencies", () => {
  isolateTimers();
  function customDatabase(): { database: ProjectDatabaseRecords & { elements: DatabaseElementRecord[] } } {
    return { database: { ...defaultDatabase(), actors: [], classes: [], skills: [], equipment: [], states: [], battleAnimations: [], elements: [] } };
  }
  describe("retro roster element dependencies", () => {
    it("fills every appended skill element in a custom database and converges", () => {
      const project = customDatabase();
      expect(ensureRetroRosterRecords(project)).toBe(true);
      const elements = new Set(project.database.elements.map(row => row.id));
      for (const skill of project.database.skills) if (skill.elementId) expect(elements.has(skill.elementId)).toBe(true);
      expect(elements.has("grass")).toBe(true);
      expect(ensureRetroRosterRecords(project)).toBe(false);
    });

    it("keeps an existing author grass definition", () => {
      const project = customDatabase();
      const grass = { ...defaultDatabase().elements!.find(row => row.id === "grass")!, name: "저자 풀 속성" };
      project.database.elements.push(grass);
      ensureRetroRosterRecords(project);
      expect(project.database.elements.filter(row => row.id === "grass")).toEqual([grass]);
    });
  });
});

describe("titleScreen", () => {
  isolateTimers();
  function fullVisibilitySettings(partial: Omit<TitleScreenSettings, "menuVisibility"> & {
    readonly menuVisibility?: TitleScreenSettings["menuVisibility"];
  }): TitleScreenSettings {
    return {
      ...partial,
      menuVisibility: partial.menuVisibility ?? {
        newGame: true,
        continueGame: true,
        quit: true,
      },
    };
  }
  describe("title screen", () => {
    it("moves focus and selection without replacing the title or its animated children", () => {
      const restoreDom = installFakeDom();
      try {
        const screen = renderWithFakeDom(() => renderTitleScreen(createBlankProject(), {
          onNewGame: () => undefined,
          onResume: () => undefined,
          onContinue: () => undefined,
          onCredits: () => undefined,
          onQuit: () => undefined,
        }));
        const children = [...screen.childNodes];
        const options = Array.from(screen.querySelectorAll(".rm-title-menu-button"));
        for (const index of [1, 0, options.length - 1]) {
          updateTitleSelection(screen, index);
          expect(screen.childNodes).toEqual(children);
          expect(Array.from(screen.querySelectorAll(".rm-title-menu-button"))).toEqual(options);
          expect(document.activeElement).toBe(options[index]);
          options.forEach((option, i) => {
            expect(option.getAttribute("tabindex")).toBe(i === index ? "0" : "-1");
            expect(option.getAttribute("aria-selected")).toBe(String(i === index));
            expect(option.classList.contains("selected")).toBe(i === index);
            expect(option.getAttribute("aria-current")).toBe(i === index ? "true" : null);
          });
          expect(findByTestId(screen, "title-selection-json")?.textContent)
            .toBe(JSON.stringify({ selectedIndex: index }));
        }
      } finally {
        restoreDom();
      }
    });

    it("renders the redesigned editorial title composition instead of legacy window chrome", () => {
      const restoreDom = installFakeDom();
      try {
        const project = createBlankProject();
        const screen = renderWithFakeDom(() =>
          renderTitleScreen(project, {
            onNewGame: () => undefined,
            onResume: () => undefined,
            onContinue: () => undefined,
            onCredits: () => undefined,
            onQuit: () => undefined,
          }),
        );

        expect(screen.classList.contains("rm-title-screen-editorial")).toBe(true);
        expect(findByTestId(screen, "title-kicker")?.textContent).toBe("A NEW ADVENTURE");
        expect(findByTestId(screen, "title-subtitle")?.textContent).toBe("이야기가 시작되는 곳");
        expect(screen.querySelector(".rm-title-menu")?.classList.contains("rm-title-menu-open")).toBe(true);
      } finally {
        restoreDom();
      }
    });

    it("does not draw the fixed tagline under an authored title that has no subtitle", () => {
      const restoreDom = installFakeDom();
      try {
        const project = createBlankProject();
        project.system.titleScreen = fullVisibilitySettings({ ...defaultTitleScreenSettings(), title: "붉은 달의 여관" });
        const screen = renderWithFakeDom(() =>
          renderTitleScreen(project, {
            onNewGame: () => undefined,
            onResume: () => undefined,
            onContinue: () => undefined,
            onCredits: () => undefined,
            onQuit: () => undefined,
          }),
        );
        expect(findByTestId(screen, "title-kicker")).toBeNull();
        expect(findByTestId(screen, "title-subtitle")).toBeNull();
        expect(findByTestId(screen, "title-logo-subtitle")).toBeNull();
      } finally {
        restoreDom();
      }
    });

    it("replaces the stock tagline with an authored subtitle even when the logo style is unset", () => {
      const restoreDom = installFakeDom();
      try {
        const project = createBlankProject();
        project.system.titleScreen = fullVisibilitySettings({
          ...defaultTitleScreenSettings(),
          title: "첫사랑",
          logoSubtitle: "10년 만에, 사수가 됐다",
        });
        const screen = renderWithFakeDom(() =>
          renderTitleScreen(project, {
            onNewGame: () => undefined,
            onResume: () => undefined,
            onContinue: () => undefined,
            onCredits: () => undefined,
            onQuit: () => undefined,
          }),
        );

        expect(findByTestId(screen, "title-kicker")).toBeNull();
        expect(findByTestId(screen, "title-subtitle")).toBeNull();
        const subtitle = findByTestId(screen, "title-logo-subtitle");
        expect(subtitle?.textContent).toBe("10년 만에, 사수가 됐다");
        expect(subtitle?.dataset.logoStyle).toBe("plain");
      } finally {
        restoreDom();
      }
    });

    it("renders database-configured title text, menu labels, and positions", () => {
      const restoreDom = installFakeDom();
      try {
        const project = createBlankProject();
        project.system.titleScreen = fullVisibilitySettings({
          title: "용사의 밤",
          backgroundResourceId: "oprn-title-blue",
          layout: {
            titleX: 144,
            titleY: 64,
            menuX: 88,
            menuY: 132,
          },
          menuLabels: {
            newGame: "처음부터",
            continueGame: "이어하기",
            quit: "끝내기",
          },
        });

        const screen = renderWithFakeDom(() =>
          renderTitleScreen(project, {
            onNewGame: () => undefined,
            onResume: () => undefined,
            onContinue: () => undefined,
            onCredits: () => undefined,
            onQuit: () => undefined,
          }),
        );

        const newGame = findByTestId(screen, "title-new-game");
        const continueGame = findByTestId(screen, "title-load-game");
        const quit = findByTestId(screen, "title-quit-game");
        const credits = findByTestId(screen, "title-credits");
        expect(screen.textContent).toContain("용사의 밤");
        expect(newGame?.textContent).toBe("처음부터");
        expect(continueGame?.textContent).toBe("이어하기");
        expect(quit?.textContent).toBe("끝내기");
        expect(credits?.textContent).toBe("크레딧");
        // 조작 안내 줄과 하단 라이선스 한 줄은 더 이상 그리지 않는다(크레딧 항목이 대신한다).
        expect(findByTestId(screen, "title-input-hint")).toBeNull();
        expect(findByTestId(screen, "title-license-notice")).toBeNull();
        expect(newGame?.attrs["aria-current"]).toBe("true");
        expect(continueGame?.attrs["aria-current"]).toBeUndefined();
        expect(screen.style.backgroundImage).toContain("default-title-blue.png");
        const title = screen.childNodes[0];
        const menu = screen.childNodes[1];
        if (!(title instanceof FakeElement) || !(menu instanceof FakeElement)) {
          throw new Error("expected title screen children");
        }
        expect(title.style.left).toBe("45%");
        expect(title.style.top).toBe("26.6667%");
        expect(menu.style.left).toBe("27.5%");
        // 저작값 menuY=132 는 그대로 쓰이지 않는다. 크레딧까지 항목 4개(108px)면 무대 아래(240)를
        // 넘으므로 titleMenuTop 이 아래 여백 8px 을 남기고 124 로 끌어올린다(=51.6667%).
        expect(menu.style.top).toBe("51.6667%");
      } finally {
        restoreDom();
      }
    });

    it("keeps the title artwork visible while exposing windowskin chrome to child menus", () => {
      const restoreDom = installFakeDom();
      try {
        const project = createBlankProject();
        project.system.titleScreen = fullVisibilitySettings({
          ...defaultTitleScreenSettings(),
          backgroundResourceId: "oprn-title-blue",
        });
        const screen = renderWithFakeDom(() =>
          renderTitleScreen(project, {
            onNewGame: () => undefined,
            onResume: () => undefined,
            onContinue: () => undefined,
            onCredits: () => undefined,
            onQuit: () => undefined,
          }),
        );
        expect(screen.style.backgroundImage).toContain("default-title-blue.png");
        expect(screen.style.borderImageSource).toBeUndefined();
        // 저작 기본 윈도우스킨은 따뜻한 갈색이다(windowskin-warm).
        expect(screen.style["--runtime-window-skin"]).toContain("windowskin-warm.png");
      } finally {
        restoreDom();
      }
    });

    it("clamps the menu above the input hint only when it would overlap", () => {
      // 회귀 방지: 이 규칙에 단위 커버리지가 없어서 위 레이아웃 테스트가 조용히 낡았다.
      const optionCount = 3;
      // 안내 창이 없고 무대 안에 들어가면 저작값을 그대로 존중한다.
      expect(titleMenuTop(132, optionCount, false)).toBe(132);
      // 들어갈 자리가 있으면 저작값을 그대로 존중한다.
      expect(titleMenuTop(60, optionCount, true)).toBe(60);
      // 겹치면 메뉴 아래끝이 안내 영역 위에서 끝나도록 끌어올린다.
      expect(titleMenuTop(132, optionCount, true)).toBe(240 - 40 - titleMenuHeight(optionCount));
      expect(titleMenuTop(132, optionCount, true)).toBe(116);
      // 안내 창이 없어도 무대 밖으로는 못 나간다(크레딧까지 4~5 항목).
      expect(titleMenuTop(148, 5, false)).toBe(240 - 8 - titleMenuHeight(5));
    });

    it("always lists credits before quit and uses the authored label", () => {
      const settings = { ...defaultTitleScreenSettings(), menuVisibility: { newGame: true, continueGame: false, quit: true } };
      expect(listTitleMenuOptions(settings).map((option) => option.id)).toEqual(["newGame", "credits", "quit"]);
      const labelled = { ...settings, menuLabels: { ...settings.menuLabels, credits: "만든 사람들" } };
      expect(listTitleMenuOptions(labelled).find((option) => option.id === "credits")?.label).toBe("만든 사람들");
    });

    it("uses the legacy title resource when the new title-screen background is unset", () => {
      const restoreDom = installFakeDom();
      try {
        const project = createBlankProject();
        // 옛 필드(system.titleResourceId)에는 지금도 번들에 있는 타이틀 그림을 둔다 — EasyRPG 타이틀 그림(easyrpg-title-*)은 2026-10-07 저작권 정리로
        // 지워져 주소가 풀리지 않는다(retiredAssets.ts). 기본 타이틀 그림(oprn-title-field)과 다른 것을 골라 «옛 필드에서 왔다» 를 가른다.
        project.system.titleResourceId = "oprn-title-blue";
        project.system.titleScreen = fullVisibilitySettings({
          title: "레거시 타이틀",
          layout: {
            titleX: 160,
            titleY: 70,
            menuX: 122,
            menuY: 118,
          },
          menuLabels: {
            newGame: "새 게임",
            continueGame: "계속",
            quit: "게임 중지",
          },
        });

        const screen = renderWithFakeDom(() =>
          renderTitleScreen(project, {
            onNewGame: () => undefined,
            onResume: () => undefined,
            onContinue: () => undefined,
            onCredits: () => undefined,
            onQuit: () => undefined,
          }),
        );

        expect(project.system.titleScreen?.backgroundResourceId).toBeUndefined();
        expect(screen.style.backgroundImage).toContain("default-title-blue.png");
      } finally {
        restoreDom();
      }
    });

    it("uses the 320x240 title background and left-aligned editorial composition by default", () => {
      const restoreDom = installFakeDom();
      try {
        const project = createBlankProject();

        const screen = renderWithFakeDom(() =>
          renderTitleScreen(project, {
            onNewGame: () => undefined,
            onResume: () => undefined,
            onContinue: () => undefined,
            onCredits: () => undefined,
            onQuit: () => undefined,
          }),
        );

        const title = screen.childNodes[0];
        const menu = screen.childNodes[1];
        if (!(title instanceof FakeElement) || !(menu instanceof FakeElement)) {
          throw new Error("expected title screen children");
        }
        expect(screen.style.backgroundImage).toContain("oprn-title-field.png");
        expect(title.style.left).toBe("10%");
        expect(menu.style.left).toBe("10.625%");
        expect(findByTestId(screen, "title-input-hint")).toBeNull();
      } finally {
        restoreDom();
      }
    });

    it("activates the clicked title option through its explicit play-ui owner", () => {
      const restoreDom = installFakeDom();
      try {
        let activated: string | null = null;
        const project = createBlankProject();
        const screen = renderWithFakeDom(() =>
          renderTitleScreen(project, {
            onNewGame: () => {
              activated = "new";
            },
            onResume: () => {
              activated = "resume";
            },
            onContinue: () => {
              activated = "continue";
            },
            onCredits: () => { activated = "credits"; },
            onQuit: () => {
              activated = "quit";
            },
          }),
        );
        const newGame = findByTestId(screen, "title-new-game");
        expect(String(newGame?.tagName ?? "").toLowerCase()).not.toBe("button");
        newGame?.dispatchEvent?.(new Event("click", { bubbles: true }));
        expect(newGame?.attrs["data-play-input-owner"]).toBe("play-ui");
        expect(activated).toBe("new");
        expect(findByTestId(screen, "title-input-hint")).toBeNull();
      } finally {
        restoreDom();
      }
    });

    it("gives exactly one stable title option the roving tab stop and focuses it", () => {
      const restoreDom = installFakeDom();
      try {
        const project = createBlankProject();
        const screen = renderWithFakeDom(() =>
          renderTitleScreen(project, {
            onNewGame: () => undefined,
            onResume: () => undefined,
            onContinue: () => undefined,
            onCredits: () => undefined,
            onQuit: () => undefined,
          }, 1),
        );

        const newGame = findByTestId(screen, "title-new-game");
        const load = findByTestId(screen, "title-load-game");
        const quit = findByTestId(screen, "title-quit-game");
        expect([newGame, load, quit].filter((option) => option?.attrs.tabindex === "0")).toHaveLength(1);
        expect(newGame?.attrs.id).toBe("title-option-new-game");
        expect(load?.attrs.id).toBe("title-option-load-game");
        expect(quit?.attrs.id).toBe("title-option-quit-game");
        expect(newGame?.attrs.tabindex).toBe("-1");
        expect(load?.attrs.tabindex).toBe("0");
        expect(load?.attrs["aria-selected"]).toBe("true");
        expect(quit?.attrs["aria-selected"]).toBe("false");

        focusSelectedTitleOption(screen);
        expect(document.activeElement).toBe(load);
      } finally {
        restoreDom();
      }
    });

    it("lists visible options New→Continue→Credits→Quit with stable ids/testIds", () => {
      const defaults = defaultTitleScreenSettings();
      expect(listTitleMenuOptions(defaults).map((option) => option.id)).toEqual([
        "newGame",
        "continueGame",
        "credits",
        "quit",
      ]);
      expect(listTitleMenuOptions(defaults).map((option) => option.testId)).toEqual([
        "title-new-game",
        "title-load-game",
        "title-credits",
        "title-quit-game",
      ]);

      const hideContinue = fullVisibilitySettings({
        ...defaults,
        menuVisibility: { newGame: true, continueGame: false, quit: true },
      });
      expect(listTitleMenuOptions(hideContinue).map((option) => option.id)).toEqual([
        "newGame",
        "credits",
        "quit",
      ]);

      const onlyNew = fullVisibilitySettings({
        ...defaults,
        menuVisibility: { newGame: true, continueGame: false, quit: false },
      });
      expect(listTitleMenuOptions(onlyNew)).toEqual([
        {
          id: "newGame",
          testId: "title-new-game",
          elementId: "title-option-new-game",
          label: defaults.menuLabels.newGame,
        },
        {
          id: "credits",
          testId: "title-credits",
          elementId: "title-option-credits",
          label: "크레딧",
        },
      ]);
    });

    it("shows resume only when an autosave exists, ordered New→Resume→Continue→Credits→Quit", () => {
      const defaults = defaultTitleScreenSettings();
      // 컨텍스트 생략/오토세이브 없음 → resume 미노출(크레딧 포함 4항목).
      expect(listTitleMenuOptions(defaults).map((option) => option.id)).toEqual([
        "newGame",
        "continueGame",
        "credits",
        "quit",
      ]);
      expect(listTitleMenuOptions(defaults, { autosaveAvailable: false }).map((option) => option.id)).toEqual([
        "newGame",
        "continueGame",
        "credits",
        "quit",
      ]);

      const withAutosave = listTitleMenuOptions(defaults, { autosaveAvailable: true });
      expect(withAutosave.map((option) => option.id)).toEqual([
        "newGame",
        "resume",
        "continueGame",
        "credits",
        "quit",
      ]);
      const resume = withAutosave[1];
      expect(resume).toEqual({
        id: "resume",
        testId: "title-resume-game",
        elementId: "title-option-resume-game",
        label: "이어하기",
      });
    });

    it("respects menuVisibility.resume and the authored resume label", () => {
      const defaults = defaultTitleScreenSettings();
      const hidden = fullVisibilitySettings({
        ...defaults,
        menuVisibility: { newGame: true, continueGame: true, quit: true, resume: false },
      });
      expect(listTitleMenuOptions(hidden, { autosaveAvailable: true }).map((option) => option.id)).toEqual([
        "newGame",
        "continueGame",
        "credits",
        "quit",
      ]);

      const labeled = fullVisibilitySettings({
        ...defaults,
        menuLabels: { ...defaults.menuLabels, resume: "지난 모험 계속" },
      });
      const resume = listTitleMenuOptions(labeled, { autosaveAvailable: true })
        .find((option) => option.id === "resume");
      expect(resume?.label).toBe("지난 모험 계속");
    });

    it("keeps a 4-option menu above the input hint without overlap", () => {
      const optionCount = 4;
      // 기본 저작값 menuY=148 은 4항목이면 반드시 겹치므로 끌어올려진다.
      const top = titleMenuTop(148, optionCount, true);
      expect(top).toBe(240 - 40 - titleMenuHeight(optionCount));
      // 메뉴 아래끝이 안내 창 예약 영역(200) 위에서 끝난다.
      expect(top + titleMenuHeight(optionCount)).toBeLessThanOrEqual(200);
      // 안내 창이 없어도 메뉴 전체가 무대 안에 들어오며 아래 여백 8px을 남긴다.
      expect(titleMenuTop(148, optionCount, false)).toBe(124);
      expect(titleMenuTop(148, optionCount, false) + titleMenuHeight(optionCount)).toBe(232);
    });

    it("renders the resume option between new game and load when context says autosave exists", () => {
      const restoreDom = installFakeDom();
      try {
        let resumed = 0;
        const project = createBlankProject();
        const screen = renderWithFakeDom(() =>
          renderTitleScreen(
            project,
            {
              onNewGame: () => undefined,
              onResume: () => {
                resumed += 1;
              },
              onContinue: () => undefined,
              onCredits: () => undefined,
              onQuit: () => undefined,
            },
            1,
            { autosaveAvailable: true },
          ),
        );

        const resume = findByTestId(screen, "title-resume-game");
        expect(resume).toBeTruthy();
        expect(resume?.textContent).toBe("이어하기");
        expect(resume?.attrs.id).toBe("title-option-resume-game");
        // selectedIndex 1 은 이제 resume 을 가리킨다(new → resume → load → credits → quit).
        expect(resume?.attrs["aria-selected"]).toBe("true");
        resume?.dispatchEvent?.(new Event("click", { bubbles: true }));
        expect(resumed).toBe(1);
      } finally {
        restoreDom();
      }
    });

    it("clamps title menu index into the visible range", () => {
      expect(clampTitleMenuIndex(2, 2)).toBe(1);
      expect(clampTitleMenuIndex(2, 1)).toBe(0);
      expect(clampTitleMenuIndex(-3, 3)).toBe(0);
      expect(clampTitleMenuIndex(0, 0)).toBe(0);
    });

    it("hides continue/quit options and input hint based on settings", () => {
      const restoreDom = installFakeDom();
      try {
        const project = createBlankProject();
        project.system.titleScreen = fullVisibilitySettings({
          ...defaultTitleScreenSettings(),
          menuVisibility: { newGame: true, continueGame: false, quit: true },
          showInputHint: false,
        });

        const screen = renderWithFakeDom(() =>
          renderTitleScreen(
            project,
            {
              onNewGame: () => undefined,
              onResume: () => undefined,
              onContinue: () => undefined,
              onCredits: () => undefined,
              onQuit: () => undefined,
            },
            2,
          ),
        );

        expect(findByTestId(screen, "title-new-game")).toBeTruthy();
        expect(findByTestId(screen, "title-load-game")).toBeNull();
        expect(findByTestId(screen, "title-quit-game")).toBeTruthy();
        expect(findByTestId(screen, "title-input-hint")).toBeNull();
        expect(findByTestId(screen, "title-quit-game")?.attrs["aria-current"]).toBe("true");
        expect(findByTestId(screen, "title-selection-json")?.textContent).toBe(
          JSON.stringify({ selectedIndex: 2 }),
        );
      } finally {
        restoreDom();
      }
    });

    it("clamps selected index to the last visible option when quit is hidden", () => {
      const restoreDom = installFakeDom();
      try {
        const project = createBlankProject();
        project.system.titleScreen = fullVisibilitySettings({
          ...defaultTitleScreenSettings(),
          menuVisibility: { newGame: true, continueGame: true, quit: false },
        });

        const screen = renderWithFakeDom(() =>
          renderTitleScreen(
            project,
            {
              onNewGame: () => undefined,
              onResume: () => undefined,
              onContinue: () => undefined,
              onCredits: () => undefined,
              onQuit: () => undefined,
            },
            99,
          ),
        );

        expect(findByTestId(screen, "title-quit-game")).toBeNull();
        expect(findByTestId(screen, "title-credits")?.attrs["aria-current"]).toBe("true");
        expect(findByTestId(screen, "title-selection-json")?.textContent).toBe(
          JSON.stringify({ selectedIndex: 2 }),
        );
      } finally {
        restoreDom();
      }
    });

    it("renders background layers in authored order with injected scroll animations", () => {
      const restoreDom = installFakeDom();
      try {
        const project = createBlankProject();
        project.system.titleScreen = fullVisibilitySettings({
          ...defaultTitleScreenSettings(),
          backgroundLayers: [
            { resourceId: "oprn-title-field", scrollXPerSec: 16 },
            { resourceId: "easyrpg-title-title1", scrollYPerSec: -12, opacity: 0.5 },
          ],
        });

        const screen = renderWithFakeDom(() =>
          renderTitleScreen(project, {
            onNewGame: () => undefined,
            onResume: () => undefined,
            onContinue: () => undefined,
            onCredits: () => undefined,
            onQuit: () => undefined,
          }),
        );

        const fx = findByTestId(screen, "title-fx");
        expect(fx).toBeTruthy();
        const layers = screen.querySelectorAll("[data-testid='title-bg-layer']");
        expect(layers).toHaveLength(2);
        expect(layers[0]?.dataset.titleLayerResource).toBe("oprn-title-field");
        expect(layers[0]?.dataset.titleLayerIndex).toBe("0");
        // 320px 타일 / 16px/s = 20s 무한 스크롤 주기.
        expect(layers[0]?.style.animation).toBe("rm-title-layer-scroll-x 20s linear infinite");
        expect(layers[1]?.dataset.titleLayerResource).toBe("easyrpg-title-title1");
        // 240px / 12px/s = 20s, 음수 속도는 reverse.
        expect(layers[1]?.style.animation).toBe("rm-title-layer-scroll-y 20s linear infinite reverse");
        expect(layers[1]?.style.opacity).toBe("0.5");
        // 파티클 설정이 없으면 canvas 는 만들지 않는다.
        expect(findByTestId(screen, "title-particles")).toBeNull();
      } finally {
        restoreDom();
      }
    });

    it("keeps the legacy title DOM unchanged when no fx settings exist", () => {
      const restoreDom = installFakeDom();
      try {
        const project = createBlankProject();
        const screen = renderWithFakeDom(() =>
          renderTitleScreen(project, {
            onNewGame: () => undefined,
            onResume: () => undefined,
            onContinue: () => undefined,
            onCredits: () => undefined,
            onQuit: () => undefined,
          }),
        );
        expect(findByTestId(screen, "title-fx")).toBeNull();
        expect(findByTestId(screen, "title-particles")).toBeNull();
        expect(findByTestId(screen, "title-bg-layer")).toBeNull();
      } finally {
        restoreDom();
      }
    });

    it("mounts the particle canvas only when particles are configured", () => {
      const restoreDom = installFakeDom();
      try {
        const project = createBlankProject();
        project.system.titleScreen = fullVisibilitySettings({
          ...defaultTitleScreenSettings(),
          particles: { preset: "fireflies", density: 80 },
        });
        const screen = renderWithFakeDom(() =>
          renderTitleScreen(project, {
            onNewGame: () => undefined,
            onResume: () => undefined,
            onContinue: () => undefined,
            onCredits: () => undefined,
            onQuit: () => undefined,
          }),
        );
        const canvas = findByTestId(screen, "title-particles");
        expect(canvas).toBeTruthy();
        expect(canvas?.tagName).toBe("CANVAS");
        expect(canvas?.dataset.titleParticlePreset).toBe("fireflies");
        expect(canvas?.dataset.titleParticleDensity).toBe("80");
      } finally {
        restoreDom();
      }
    });

    it("applies intro classes with delays on first entry only", () => {
      const restoreDom = installFakeDom();
      try {
        const project = createBlankProject();
        project.system.titleScreen = fullVisibilitySettings({
          ...defaultTitleScreenSettings(),
          titleGraphic: undefined,
          intro: { logo: "fadeIn", menu: "slideUp", delayMs: 100, staggerMs: 50 },
        });
        const actions = {
          onNewGame: () => undefined,
          onResume: () => undefined,
          onContinue: () => undefined,
          onQuit: () => undefined,
        };

        // 최초 진입(playIntro 생략 = true): intro 클래스 + 지연 부여.
        const first = renderWithFakeDom(() => renderTitleScreen(project, actions));
        const title = first.querySelector(".rm-title-screen-title");
        expect(title?.classList.contains("rm-title-intro-fade-in")).toBe(true);
        expect(title?.style.animationDelay).toBe("100ms");
        const buttons = first.querySelectorAll(".rm-title-menu-button");
        expect(buttons.length).toBeGreaterThan(1);
        expect(buttons.every((button) => button.classList.contains("rm-title-intro-slide-up"))).toBe(true);
        expect(buttons[0]?.style.animationDelay).toBe("100ms");
        expect(buttons[1]?.style.animationDelay).toBe("150ms");

        // 방향키 재렌더(playIntro:false): intro 클래스가 다시 붙지 않는다.
        const rerendered = renderWithFakeDom(() =>
          renderTitleScreen(project, actions, 1, { playIntro: false }),
        );
        expect(rerendered.querySelector(".rm-title-intro-fade-in")).toBeNull();
        expect(rerendered.querySelector(".rm-title-intro-slide-up")).toBeNull();
      } finally {
        restoreDom();
      }
    });

    it("reuses the fx stack node across re-renders when the fx signature matches", () => {
      const restoreDom = installFakeDom();
      try {
        const project = createBlankProject();
        project.system.titleScreen = fullVisibilitySettings({
          ...defaultTitleScreenSettings(),
          backgroundLayers: [{ resourceId: "oprn-title-field", scrollXPerSec: 16 }],
          particles: { preset: "snow", density: 40 },
        });
        const actions = {
          onNewGame: () => undefined,
          onResume: () => undefined,
          onContinue: () => undefined,
          onQuit: () => undefined,
        };

        const first = renderWithFakeDom(() => renderTitleScreen(project, actions));
        const firstFx = findByTestId(first, "title-fx");
        expect(firstFx).toBeTruthy();

        // 서명이 같으면 같은 노드가 새 루트로 move 된다(canvas 상태 보존).
        const second = renderWithFakeDom(() =>
          renderTitleScreen(project, actions, 1, { playIntro: false, reuseFx: firstFx as unknown as HTMLElement }),
        );
        expect(findByTestId(second, "title-fx")).toBe(firstFx);

        // 설정이 바뀌면(서명 불일치) 새 노드를 만든다.
        project.system.titleScreen = fullVisibilitySettings({
          ...defaultTitleScreenSettings(),
          backgroundLayers: [{ resourceId: "oprn-title-field", scrollXPerSec: 32 }],
          particles: { preset: "snow", density: 40 },
        });
        const third = renderWithFakeDom(() =>
          renderTitleScreen(project, actions, 0, { playIntro: false, reuseFx: firstFx as unknown as HTMLElement }),
        );
        const thirdFx = findByTestId(third, "title-fx");
        expect(thirdFx).toBeTruthy();
        expect(thirdFx).not.toBe(firstFx);
      } finally {
        restoreDom();
      }
    });

    it("renders title graphic logo without using applyTitleGraphic", () => {
      const restoreDom = installFakeDom();
      try {
        const project = createBlankProject();
        project.system.titleResourceId = "easyrpg-title-title2";
        project.system.titleScreen = fullVisibilitySettings({
          ...defaultTitleScreenSettings(),
          title: "로고 타이틀",
          titleGraphic: {
            mode: "both",
            resourceId: "easyrpg-title-title1",
            x: 80,
            y: 40,
          },
        });

        const screen = renderWithFakeDom(() =>
          renderTitleScreen(project, {
            onNewGame: () => undefined,
            onResume: () => undefined,
            onContinue: () => undefined,
            onCredits: () => undefined,
            onQuit: () => undefined,
          }),
        );

        expect(screen.textContent).toContain("로고 타이틀");
        const logo = findByTestId(screen, "title-logo");
        expect(logo).toBeTruthy();
        expect(logo?.dataset.titleLogoResource).toBe("easyrpg-title-title1");
        // Background stays on the title-screen node; logo uses its own resource.
        expect(screen.style.backgroundImage).toContain("oprn-title-field.png");
      } finally {
        restoreDom();
      }
    });
  });
});

// 타이틀 메뉴 라벨 충돌 가드.
//
// resume(오토세이브 즉시 재개)과 continueGame(저장 슬롯 패널 열기)은 서로 다른 동작인데
// 기본 라벨이 둘 다 "이어하기"였다. resume 은 오토세이브가 있을 때만 노출되므로 새 프로젝트에서는
// 안 보이고, 저자가 한 번 저장한 뒤부터 타이틀에 같은 글자가 두 줄 뜬다 — 발견이 늦는 종류의 버그다.
// 동봉 샘플 게임들도 같은 함정을 밟아 "이어 하기"(공백 하나 차이)를 쓰고 있었다.
// 그래서 라벨 문자열을 하나씩 단정하는 대신, **충돌 없음**이라는 성질을 표로 고정한다.
describe("titleScreenMenuLabels", () => {
  isolateTimers();
  /** 저자가 눈으로 구별하지 못하는 차이(공백)는 같은 라벨로 취급한다. */
  function normalize(label: string): string {
    return label.replace(/\s+/gu, "");
  }
  const BUNDLED: readonly (readonly [string, TitleScreenSettings])[] = [
    ["기본 프로젝트", defaultTitleScreenSettings()],
    ["몬스터 초원", createScarloxyDemoProject().system.titleScreen!],
  ];
  describe("타이틀 메뉴 라벨", () => {
    it.each(BUNDLED)("%s — 오토세이브가 있어도 라벨이 겹치지 않는다", (_name, settings) => {
      const labels = listTitleMenuOptions(settings, { autosaveAvailable: true }).map((option) => normalize(option.label));
      expect(labels).toEqual([...new Set(labels)]);
    });

    it("오토세이브가 있으면 resume 과 continueGame 이 함께, 서로 다른 라벨로 노출된다", () => {
      const options = listTitleMenuOptions(defaultTitleScreenSettings(), { autosaveAvailable: true });
      const resume = options.find((option) => option.id === "resume");
      const continueGame = options.find((option) => option.id === "continueGame");
      expect(resume?.label).toBe("이어하기");
      // continueGame 이 여는 패널의 제목과 같은 낱말이어야 화면과 메뉴가 어긋나지 않는다.
      expect(continueGame?.label).toBe("불러오기");
    });

    it("오토세이브가 없으면 resume 이 빠지고 continueGame 만 남는다", () => {
      const ids = listTitleMenuOptions(defaultTitleScreenSettings(), { autosaveAvailable: false }).map((option) => option.id);
      // 크레딧은 언제나 종료 앞에 선다(titleScreen.test «always lists credits before quit») — 이 시험이 지키는 것은 «이어 하기 계열은 continueGame 하나뿐» 이다.
      expect(ids).toEqual(["newGame", "continueGame", "credits", "quit"]);
      expect(ids).not.toContain("resume");
    });
  });
});
