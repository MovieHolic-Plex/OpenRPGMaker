import { describe, expect, it, beforeEach } from "vitest";
import { ensureBundledBattleAnimations } from "@/project/defaults/defaultDatabase";
import { defaultBattleAnimationRecords, defaultItemRecords } from "@/project/defaults/defaultDatabaseStarterRecords";
import { createBlankProject } from "@/project/defaults";
import { collectProjectReferenceIssues } from "@/project/io/references";
import type { Project } from "@/project/types";
import { createBattleRuntime } from "@/battle/runtime";
import { installGeneratedBattleEffectPack } from "@/editor/databaseActions";
import { GENERATED_EFFECT_RESOURCE_IDS, GENERATED_EFFECT_SHEET, GENERATED_EFFECT_SHEETS, generatedEffectResourceId, generatedEffectSheetFileName } from "@/assets/generatedEffectSheets";
import { store } from "@/project/store";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { listDatabaseResourceOptionsForTest } from "@/editor/panels/databaseResourcePickerDialog";
import { battleAnimationDurationMs } from "@/player/battleAnimationPlayback";
import { effectSheetOutputPath, encodeEffectStrip, loadEffectCatalog, paintedEffectSlugs, renderEffectStrip, REPO_ROOT, type EffectStrip } from "../scripts/lib/effectSheet/render.mjs";
import { isolateTimers } from "./mergedTeardown";

// 번들 전투 애니메이션 수렴 계약.
//
// 왜 이 테스트가 필요한가(실측 회귀, 2026-08-28): 갓 만든 프로젝트에서 ▶테스트가
// 아무 반응도 없었다. 당시 openTestPlayModal 첫 줄의 fail-closed 게이트가
// fail-closed 인데, 참조 문제가 18건 잡혔기 때문이다. 전부
// "item item_gen_*: animationId does not exist."
//
// 원인: generatedBattleEffectBindings 가 스타터 아이템·스킬을 생성 이펙트 팩
// (anim_gen_*)에 묶었는데, 로드되는 마을 데모 픽스처의 battleAnimations 는 팩
// 도입 이전 스냅샷(12개)이라 anim_gen_* 레코드가 하나도 없다. 정의는 있고
// (defaultBattleAnimationRecords() 는 43개를 낸다) 프로젝트에만 안 실린 상태였다.
//
// 그래서 ensureBundledResourceProfiles 와 같은 수렴 함수를 둔다 — 이미 저장된
// 프로젝트도 로드 한 번으로 번들 애니메이션을 되찾는다.
describe("bundledBattleAnimations", () => {
  isolateTimers();
  /** 생성 이펙트 팩 도입 이전 스냅샷을 흉내낸다 — anim_gen_* 를 전부 걷어낸다. */
  function projectWithStaleAnimations(): Project {
    const project = createBlankProject();
    project.database.battleAnimations = project.database.battleAnimations.filter(
      (record) => !record.id.startsWith("anim_gen_")
    );
    return project;
  }
  describe("ensureBundledBattleAnimations", () => {
    it("팩 이전 스냅샷에 빠진 anim_gen_* 레코드를 되채운다", () => {
      const project = projectWithStaleAnimations();
      const before = project.database.battleAnimations.length;
      expect(project.database.battleAnimations.some((r) => r.id.startsWith("anim_gen_"))).toBe(false);

      expect(ensureBundledBattleAnimations(project)).toBe(true);

      const after = project.database.battleAnimations.length;
      expect(after).toBeGreaterThan(before);
      expect(after).toBe(defaultBattleAnimationRecords().length);
    });

    it("두 번째 호출은 아무것도 바꾸지 않는다(멱등)", () => {
      const project = projectWithStaleAnimations();
      expect(ensureBundledBattleAnimations(project)).toBe(true);
      expect(ensureBundledBattleAnimations(project)).toBe(false);
    });

    it("저자가 고친 같은 id 레코드는 덮어쓰지 않는다", () => {
      const project = projectWithStaleAnimations();
      const kept = project.database.battleAnimations[0];
      expect(kept).toBeDefined();
      kept!.name = "저자가 바꾼 이름";

      ensureBundledBattleAnimations(project);

      const still = project.database.battleAnimations.find((r) => r.id === kept!.id);
      expect(still?.name).toBe("저자가 바꾼 이름");
    });

    it("수렴 뒤에는 애니메이션 참조 문제가 남지 않는다 — 재생 게이트가 열린다", () => {
      const project = projectWithStaleAnimations();
      const blocked = collectProjectReferenceIssues(project).filter((issue) =>
        issue.includes("animationId does not exist")
      );
      expect(blocked.length).toBeGreaterThan(0);

      ensureBundledBattleAnimations(project);

      const remaining = collectProjectReferenceIssues(project).filter((issue) =>
        issue.includes("animationId does not exist")
      );
      expect(remaining).toEqual([]);
    });
  });
  describe("갓 만든 프로젝트", () => {
    it("애니메이션 참조 문제 없이 시작한다", () => {
      const issues = collectProjectReferenceIssues(createBlankProject()).filter((issue) =>
        issue.includes("animationId does not exist")
      );
      expect(issues).toEqual([]);
    });
  });
});

describe("generatedBattleEffectInstall", () => {
  isolateTimers();
  const EXPECTED_SKILL_ANIMATIONS = {
    skill_attack: "anim_gen_tackle_impact",
    skill_sword_slash: "anim_gen_slash_steel",
    skill_arcane_bolt: "anim_gen_projectile_shot",
    skill_fire: "anim_gen_fire_burst",
    skill_water: "anim_gen_water_column",
    skill_leaf: "anim_gen_leaf_volley",
    skill_heal: "anim_heal",
    skill_poison_sting: "anim_poison",
    skill_sleep_mist: "anim_gen_sleep_dust",
    skill_focus: "anim_gen_power_aura",
    skill_weaken: "anim_gen_shadow_pulse",
    skill_item_potion: "anim_heal",
    skill_item_hi_potion: "anim_heal",
    skill_item_ether: "anim_gen_psychic_wave",
    skill_item_elixir: "anim_gen_revive_rise",
    skill_throwing_knife: "anim_gen_projectile_shot",
    skill_item_poison_vial: "anim_poison",
    skill_item_antidote: "anim_gen_cleanse_sparkle",
    skill_item_wake: "anim_gen_cleanse_sparkle",
    skill_item_panacea: "anim_gen_cleanse_sparkle",
    skill_item_guard: "anim_gen_guard_barrier",
    skill_item_holy_water: "anim_gen_holy_beam",
    skill_item_thunder_stone: "anim_gen_thunder_strike",
    skill_item_frost_vial: "anim_gen_ice_shatter",
    skill_item_quake_stone: "anim_gen_earth_spike",
    skill_item_gale_fan: "anim_gen_wind_slice",
    skill_item_shadow_dust: "anim_gen_shadow_pulse",
  } as const;
  const EXPECTED_ITEM_ANIMATIONS = {
    item_capture_orb: "anim_gen_capture_seal",
    item_antidote: "anim_gen_cleanse_sparkle",
    item_wake_herb: "anim_gen_cleanse_sparkle",
    item_elixir: "anim_gen_revive_rise",
    item_panacea: "anim_gen_cleanse_sparkle",
    item_smelling_salts: "anim_gen_cleanse_sparkle",
    item_throwing_knife: "anim_gen_projectile_shot",
    item_guard_talisman: "anim_gen_guard_barrier",
    item_gen_fire_bomb: "anim_gen_fire_burst",
    item_gen_ice_shard: "anim_gen_ice_shatter",
    item_gen_thunder_rod: "anim_gen_thunder_strike",
    item_gen_smoke_ball: "anim_gen_smoke_vanish",
    item_gen_holy_water: "anim_gen_holy_beam",
    item_gen_capture_sphere: "anim_gen_capture_seal",
    item_gen_revive_feather: "anim_gen_revive_rise",
  } as const;
  const EXPECTED_CLASS_ANIMATIONS = {
    class_hero: "anim_gen_slash_steel",
    class_guardian: "anim_gen_tackle_impact",
    class_mage: "anim_magic",
    class_scout: "anim_gen_slash_steel",
    class_cleric: "anim_gen_holy_beam",
    class_ranger: "anim_gen_projectile_shot",
  } as const;
  function valuesById(records: readonly { readonly id: string; readonly animationId?: string }[]): Record<string, string | undefined> {
    return Object.fromEntries(records.map((record) => [record.id, record.animationId]));
  }
  describe("generated battle effect pack installation", () => {
    beforeEach(() => {
      store.replace(createBlankProject());
    });

    it("wires actual starter skills and representative battle items to purpose-specific generated effects", () => {
      const project = createBlankProject();
      const skillAnimations = valuesById(project.database.skills);
      const itemAnimations = valuesById(defaultItemRecords());
      const classAnimations = valuesById(project.database.classes);

      for (const [id, animationId] of Object.entries(EXPECTED_SKILL_ANIMATIONS)) {
        expect(skillAnimations[id], id).toBe(animationId);
      }
      for (const [id, animationId] of Object.entries(EXPECTED_ITEM_ANIMATIONS)) {
        expect(itemAnimations[id], id).toBe(animationId);
      }
      for (const [id, animationId] of Object.entries(EXPECTED_CLASS_ANIMATIONS)) {
        expect(classAnimations[id], id).toBe(animationId);
      }
      expect(project.database.actors.every((actor) => actor.unarmedAnimationId === "anim_gen_tackle_impact")).toBe(true);
    });

    it("exposes the generated weapon animation from an actual default Attack command", () => {
      const project = createBlankProject();
      const runtime = createBattleRuntime({
        project,
        troopId: project.system.initialTroopId,
        canEscape: true,
        canLose: true,
      });

      runtime.tick(10_000);
      expect(runtime.snapshot().phase).toBe("actorCommand");
      runtime.performActorCommand({ kind: "attack", targetEnemyId: runtime.snapshot().enemies[0]!.id });

      expect(runtime.snapshot().lastAnimation).toMatchObject({
        animationId: "anim_gen_slash_steel",
        resourceId: "generated-battle-anim-slash-steel",
        frameCount: 8,
      });
    });

    it("explicitly installs all 34 missing records into an existing project and applies the same bindings", () => {
      const project = createBlankProject();
      project.database.battleAnimations = project.database.battleAnimations.filter(
        (record) => !GENERATED_EFFECT_RESOURCE_IDS.includes(record.resourceId ?? ""),
      );
      for (const skill of project.database.skills) skill.animationId = undefined;
      for (const item of project.database.items) item.animationId = undefined;
      for (const actor of project.database.actors) actor.unarmedAnimationId = undefined;
      for (const klass of project.database.classes) klass.animationId = undefined;
      project.database.skills.push({
        ...project.database.skills[0]!,
        id: "skill_custom",
        name: "Custom",
        animationId: "anim_custom",
      });
      store.replace(project);

      const result = installGeneratedBattleEffectPack();
      const installed = store.getCurrent();

      // 34장 시트를 쓰는 기본 기록은 이제 37개다 — 옛 id(anim_hit·anim_sword·anim_arrow 등)도 생성 시트를 가리킨다(2026-10-03 EasyRPG 전투 시트 정리).
      const expectedRecords = createBlankProject().database.battleAnimations.filter((record) => GENERATED_EFFECT_RESOURCE_IDS.includes(record.resourceId ?? "")).length;
      expect(new Set(installed.database.battleAnimations.filter((record) => GENERATED_EFFECT_RESOURCE_IDS.includes(record.resourceId ?? "")).map((record) => record.resourceId)).size).toBe(34);
      expect(result.addedAnimations).toBe(expectedRecords);
      expect(result.updatedSkills).toBe(Object.keys(EXPECTED_SKILL_ANIMATIONS).length);
      expect(result.updatedActors).toBe(project.database.actors.length);
      expect(result.updatedClasses).toBe(Object.keys(EXPECTED_CLASS_ANIMATIONS).length);
      const installedResourceIds = new Set(installed.database.battleAnimations.map((record) => record.resourceId));
      for (const resourceId of GENERATED_EFFECT_RESOURCE_IDS) {
        expect(installedResourceIds.has(resourceId), resourceId).toBe(true);
      }
      for (const [id, animationId] of Object.entries(EXPECTED_SKILL_ANIMATIONS)) {
        expect(installed.database.skills.find((skill) => skill.id === id)?.animationId, id).toBe(animationId);
      }
      for (const [id, animationId] of Object.entries(EXPECTED_ITEM_ANIMATIONS)) {
        expect(installed.database.items.find((item) => item.id === id)?.animationId, id).toBe(animationId);
      }
      for (const [id, animationId] of Object.entries(EXPECTED_CLASS_ANIMATIONS)) {
        expect(installed.database.classes.find((klass) => klass.id === id)?.animationId, id).toBe(animationId);
      }
      expect(installed.database.actors.every((actor) => actor.unarmedAnimationId === "anim_gen_tackle_impact")).toBe(true);
      expect(installed.database.skills.find((skill) => skill.id === "skill_custom")?.animationId).toBe("anim_custom");

      expect(installGeneratedBattleEffectPack()).toMatchObject({
        addedAnimations: 0,
        updatedAnimations: 0,
        updatedSkills: 0,
        updatedItems: 0,
        updatedActors: 0,
        updatedClasses: 0,
      });
    });

    it("upgrades legacy alias art without overwriting custom animation resources", () => {
      const project = createBlankProject();
      const legacyAlias = project.database.battleAnimations.find((record) => record.id === "anim_magic")!;
      const customizedGenerated = project.database.battleAnimations.find((record) => record.id === "anim_gen_fire_burst")!;
      legacyAlias.resourceId = "easyrpg-battle-blow";
      customizedGenerated.resourceId = "custom-fire-animation";
      store.replace(project);

      const result = installGeneratedBattleEffectPack();
      const installed = store.getCurrent().database.battleAnimations;

      expect(result.updatedAnimations).toBe(1);
      expect(installed.find((record) => record.id === "anim_magic")?.resourceId).toBe("generated-battle-anim-arcane-nova");
      expect(installed.find((record) => record.id === "anim_gen_fire_burst")?.resourceId).toBe("custom-fire-animation");
    });
  });
});

/**
 * 절차 생성 전투 이펙트 시트 계약.
 *
 * 이 파이프라인은 세 조각이 서로를 참조한다: 카탈로그(JSON) · 페인터(scripts) · 커밋된 PNG.
 * 하나만 움직이면 에디터에서 빈 그래픽이 뜨거나 프로젝트 역직렬화가 던진다. 여기서 세 개를
 * 한 번에 묶는다 — 특히 "렌더 결과 == 커밋된 바이트" 는 생성기가 재현 가능한지의 유일한 증거다.
 */
describe("generatedEffectSheets", () => {
  isolateTimers();
  const catalog = loadEffectCatalog();
  /**
   * 384px 시트 한 장 렌더는 0.5~3초다(34종 약 35초). 예전 96px 시절처럼 단정마다 다시 그리면
   * 파일 하나가 몇 분이 되므로, slug 당 **한 번** 그려서 모든 단정이 같은 스트립을 본다.
   * 재현성은 "커밋된 바이트 == 이 프로세스의 렌더" 로 이미 증명된다(커밋은 다른 프로세스가 만들었다).
   */
  const stripCache = new Map<string, EffectStrip>();
  function stripOf(slug: string): EffectStrip {
    let strip = stripCache.get(slug);
    if (!strip) {
      strip = renderEffectStrip(slug, catalog);
      stripCache.set(slug, strip);
    }
    return strip;
  }
  const RENDER_TIMEOUT_MS = 60_000;
  const EXPECTED_FRAME_COUNTS = {
    "slash-steel": 8,
    "fire-burst": 10,
    "ice-shatter": 10,
    "thunder-strike": 10,
    "water-column": 10,
    "wind-slice": 10,
    "earth-spike": 10,
    "heal-bloom": 10,
    "poison-mist": 10,
    "arcane-nova": 12,
    "tackle-impact": 8,
    "claw-rake": 8,
    "bite-crunch": 8,
    "projectile-shot": 8,
    "leaf-volley": 10,
    "psychic-wave": 10,
    "shadow-pulse": 10,
    "holy-beam": 10,
    "sleep-dust": 10,
    "power-aura": 10,
    "guard-barrier": 10,
    "capture-seal": 12,
    "critical-burst": 8,
    "sonic-wave": 8,
    "drain-orbs": 10,
    "revive-rise": 10,
    "cleanse-sparkle": 10,
    "paralysis-bind": 10,
    "blind-veil": 10,
    "confusion-spiral": 10,
    "silence-lock": 10,
    "summon-portal": 12,
    "smoke-vanish": 8,
    "meteor-fall": 12,
  } as const;
  const EXPECTED_SOUND_TIMINGS = {
    "slash-steel": { frameIndex: 3, resourceId: "easyrpg-sound-attack2" },
    "fire-burst": { frameIndex: 4, resourceId: "easyrpg-sound-explosion1" },
    "ice-shatter": { frameIndex: 5, resourceId: "easyrpg-sound-ice2" },
    "thunder-strike": { frameIndex: 3, resourceId: "easyrpg-sound-flash1" },
    "water-column": { frameIndex: 5, resourceId: "easyrpg-sound-wave1" },
    "wind-slice": { frameIndex: 4, resourceId: "easyrpg-sound-wind8" },
    "earth-spike": { frameIndex: 5, resourceId: "easyrpg-sound-earth8" },
    "heal-bloom": { frameIndex: 2, resourceId: "easyrpg-sound-recovery5" },
    "poison-mist": { frameIndex: 4, resourceId: "easyrpg-sound-poison" },
    "arcane-nova": { frameIndex: 3, resourceId: "easyrpg-sound-magic1" },
    "tackle-impact": { frameIndex: 3, resourceId: "easyrpg-sound-blow4" },
    "claw-rake": { frameIndex: 3, resourceId: "easyrpg-sound-attack1" },
    "bite-crunch": { frameIndex: 4, resourceId: "easyrpg-sound-damage2" },
    "projectile-shot": { frameIndex: 5, resourceId: "easyrpg-sound-shot2" },
    "leaf-volley": { frameIndex: 5, resourceId: "easyrpg-sound-pollen" },
    "psychic-wave": { frameIndex: 4, resourceId: "easyrpg-sound-confusion" },
    "shadow-pulse": { frameIndex: 5, resourceId: "easyrpg-sound-darkness4" },
    "holy-beam": { frameIndex: 5, resourceId: "easyrpg-sound-holy5" },
    "sleep-dust": { frameIndex: 3, resourceId: "easyrpg-sound-sleep" },
    "power-aura": { frameIndex: 4, resourceId: "easyrpg-sound-buff" },
    "guard-barrier": { frameIndex: 4, resourceId: "easyrpg-sound-barrier2" },
    "capture-seal": { frameIndex: 7, resourceId: "easyrpg-sound-teleport2" },
    "critical-burst": { frameIndex: 3, resourceId: "easyrpg-sound-combat2" },
    "sonic-wave": { frameIndex: 4, resourceId: "easyrpg-sound-wave2" },
    "drain-orbs": { frameIndex: 5, resourceId: "easyrpg-sound-absorb1" },
    "revive-rise": { frameIndex: 5, resourceId: "easyrpg-sound-raise2" },
    "cleanse-sparkle": { frameIndex: 4, resourceId: "easyrpg-sound-recovery8" },
    "paralysis-bind": { frameIndex: 4, resourceId: "easyrpg-sound-flash3" },
    "blind-veil": { frameIndex: 4, resourceId: "easyrpg-sound-blind" },
    "confusion-spiral": { frameIndex: 4, resourceId: "easyrpg-sound-debuff" },
    "silence-lock": { frameIndex: 5, resourceId: "easyrpg-sound-silence" },
    "summon-portal": { frameIndex: 7, resourceId: "easyrpg-sound-magic2" },
    "smoke-vanish": { frameIndex: 3, resourceId: "easyrpg-sound-fog1" },
    "meteor-fall": { frameIndex: 7, resourceId: "easyrpg-sound-fall2" },
  } as const;
  /**
   * 프레임 밖에서 들어오거나 밖으로 나가도록 **의도한** 이펙트. 가장자리 잘림 검사에서 제외한다.
   * 이유를 적어 두어야 새 이펙트를 무심코 여기 넣지 않는다 — 나머지 25종은 잘림이 결함이다(실측 7종 수정).
   */
  const EDGE_ENTRY_EFFECTS: Readonly<Record<string, string>> = {
    "thunder-strike": "번개가 프레임 위에서 떨어져 들어온다",
    "holy-beam": "빛기둥이 프레임 위에서 내려온다",
    "projectile-shot": "투사체가 왼쪽 밖에서 날아온다",
    "leaf-volley": "잎이 좌상단 밖에서 날아온다",
    "meteor-fall": "운석이 우상단 밖에서 떨어진다",
    "wind-slice": "칼바람이 왼쪽에서 들어와 오른쪽으로 빠져나간다",
    "sonic-wave": "음파가 오른쪽으로 퍼져 나간다",
    "tackle-impact": "돌진 잔상(속도선)이 왼쪽에서 들어온다",
    "drain-orbs": "흡수한 구슬이 시전자 쪽(좌상단)으로 빠져나간다",
  };
  function expectedFrameCount(slug: string): number {
    const count = EXPECTED_FRAME_COUNTS[slug as keyof typeof EXPECTED_FRAME_COUNTS];
    if (count === undefined) throw new Error(`예상 프레임 수가 없다: ${slug}`);
    return count;
  }
  /** PNG IHDR 에서 실제 이미지 크기를 집는다 — 런타임은 이 크기 안에서 프레임을 자른다. */
  function pngSize(filePath: string): { width: number; height: number } {
    const bytes = readFileSync(filePath);
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  function frameHasPixels(strip: { width: number; height: number; data: Uint8Array }, frameIndex: number): boolean {
    const { frameWidth } = GENERATED_EFFECT_SHEET;
    const originX = frameIndex * frameWidth;
    for (let y = 0; y < strip.height; y += 1) {
      for (let x = originX; x < originX + frameWidth; x += 1) {
        if (strip.data[(y * strip.width + x) * 4 + 3] > 0) return true;
      }
    }
    return false;
  }
  function frameSignature(strip: { width: number; height: number; data: Uint8Array }, frameIndex: number): string {
    const { frameWidth } = GENERATED_EFFECT_SHEET;
    const originX = frameIndex * frameWidth;
    let hash = 0x811c9dc5;
    for (let y = 0; y < strip.height; y += 1) {
      for (let x = originX; x < originX + frameWidth; x += 1) {
        const index = (y * strip.width + x) * 4;
        for (let channel = 0; channel < 4; channel += 1) {
          hash = (Math.imul(hash ^ strip.data[index + channel], 0x01000193) >>> 0) >>> 0;
        }
      }
    }
    return hash.toString(16);
  }
  describe("생성 이펙트 카탈로그", () => {
    it("카탈로그 slug 와 페인터 목록이 정확히 일치한다", () => {
      const catalogSlugs = [...GENERATED_EFFECT_SHEETS.map((effect) => effect.slug)].sort();
      expect(paintedEffectSlugs().sort()).toEqual(catalogSlugs);
    });

    it("시트는 384x384 셀·assetScale 0.5(무대 192 논리 px)·75ms 재생 간격을 공유하고 종류별로 8~12장을 쓴다", () => {
      // 몬스터 배틀러 원본(384px)과 같은 해상도. 예전 96px 은 48 격자 2배 복제라 밀도가 몬스터의 1/10 이었다.
      expect(GENERATED_EFFECT_SHEET.frameWidth).toBe(384);
      expect(GENERATED_EFFECT_SHEET.frameHeight).toBe(384);
      expect(GENERATED_EFFECT_SHEET.assetScale).toBe(0.5);
      expect(GENERATED_EFFECT_SHEET.frameWidth * GENERATED_EFFECT_SHEET.assetScale).toBe(192);
      expect((catalog.sheet as unknown as { frameDurationMs?: number }).frameDurationMs).toBe(75);
      expect(
        Object.fromEntries(GENERATED_EFFECT_SHEETS.map((effect) => [
          effect.slug,
          (effect as typeof effect & { readonly frameCount?: number }).frameCount,
        ]))
      ).toEqual(EXPECTED_FRAME_COUNTS);
    });

    it("리소스 id 는 중복 없이 slug 마다 하나씩 나온다", () => {
      expect(GENERATED_EFFECT_RESOURCE_IDS).toHaveLength(GENERATED_EFFECT_SHEETS.length);
      expect(new Set(GENERATED_EFFECT_RESOURCE_IDS).size).toBe(GENERATED_EFFECT_SHEETS.length);
    });
    it("에디터 리소스 피커가 battle 종리로 전부 노출한다", () => {
      const options = listDatabaseResourceOptionsForTest("battle", createBlankProject());
      for (const id of GENERATED_EFFECT_RESOURCE_IDS) {
        expect(options.some((option) => option.id === id)).toBe(true);
      }
    });
  });
  describe.each(GENERATED_EFFECT_SHEETS.map((effect) => effect.slug))("이펙트 시트 %s", (slug) => {
    const frameCount = expectedFrameCount(slug);

    it("커밋된 PNG 가 있고 렌더 결과와 바이트가 같다", { timeout: RENDER_TIMEOUT_MS }, () => {
      const outputPath = effectSheetOutputPath(slug);
      expect(existsSync(outputPath)).toBe(true);
      const committed = readFileSync(outputPath);
      const rendered = Buffer.from(encodeEffectStrip(stripOf(slug)));
      expect(rendered.equals(committed)).toBe(true);
    });

    it("용도별 프레임이 모두 그려지고 서로 다르다", { timeout: RENDER_TIMEOUT_MS }, () => {
      const strip = stripOf(slug);
      expect(strip.width).toBe(GENERATED_EFFECT_SHEET.frameWidth * frameCount);
      expect(strip.height).toBe(GENERATED_EFFECT_SHEET.frameHeight);
      const signatures: string[] = [];
      for (let index = 0; index < frameCount; index += 1) {
        expect(frameHasPixels(strip, index), `프레임 ${index} 가 완전히 비었다`).toBe(true);
        signatures.push(frameSignature(strip, index));
      }
      expect(new Set(signatures).size).toBe(frameCount);
    });

    it.skipIf(slug in EDGE_ENTRY_EFFECTS)("그림이 프레임 가장자리에 잘리지 않는다 — 바깥 2px 띠는 거의 투명하다", { timeout: RENDER_TIMEOUT_MS }, () => {
      // 무대에서 셀은 192 논리 px 상자 안에 그대로 놓이므로, 가장자리까지 그린 그림은 그 자리에서 뚝 잘린다.
      // 넓은 글로우의 미미한 꼬리는 허용한다(알파 < 8/255).
      const strip = stripOf(slug);
      const { frameWidth, frameHeight } = GENERATED_EFFECT_SHEET;
      for (let index = 0; index < frameCount; index += 1) {
        const originX = index * frameWidth;
        let worst = 0;
        for (let y = 0; y < frameHeight; y += 1) {
          for (let x = originX; x < originX + frameWidth; x += 1) {
            const edge = x - originX < 2 || x - originX >= frameWidth - 2 || y < 2 || y >= frameHeight - 2;
            if (!edge) continue;
            worst = Math.max(worst, strip.data[(y * strip.width + x) * 4 + 3]!);
          }
        }
        expect(worst, `프레임 ${index} 가장자리 알파 ${worst}`).toBeLessThan(8);
      }
    });

    it("자를 프레임 사각이 시트 밖을 넘지 않는다", () => {
      // 런타임(battleAnimationDom.animationCell)은 pattern 을 column/row 로 톴서 자른다.
      // 시트가 짧거나 columns 가 틀리면 마지막 프레임이 바가지를 자려서 화면이 보이지 않는다.
      const { frameWidth, frameHeight } = GENERATED_EFFECT_SHEET;
      const columns = frameCount;
      const size = pngSize(effectSheetOutputPath(slug));
      const record = defaultBattleAnimationRecords().find(
        (entry) => entry.resourceId === generatedEffectResourceId(slug)
      );
      expect(record).toBeDefined();
      for (const frame of record?.frames ?? []) {
        for (const cell of frame.cells) {
          const right = (cell.pattern % columns) * frameWidth + frameWidth;
          const bottom = Math.floor(cell.pattern / columns) * frameHeight + frameHeight;
          expect(right).toBeLessThanOrEqual(size.width);
          expect(bottom).toBeLessThanOrEqual(size.height);
        }
      }
    });

    it("리소스 id 가 public 경로로 해석된다", () => {
      const url = resolveAssetResourceUrl(generatedEffectResourceId(slug));
      expect(url).toBe(`/assets/generated/effects/${generatedEffectSheetFileName(slug)}`);
      expect(existsSync(path.join(REPO_ROOT, "public", url!.slice(1)))).toBe(true);
    });
  });

  describe("기본 데이터베이스 배선", () => {
    const records = defaultBattleAnimationRecords();

    it("생성 시트마다 애니메이션 레코드가 있다", () => {
      for (const id of GENERATED_EFFECT_RESOURCE_IDS) {
        expect(records.some((record) => record.resourceId === id)).toBe(true);
      }
    });

    it("생성 레코드의 시트는 assetScale 0.5 를 실어 384px 프레임이 192 논리 px 로 그려진다", () => {
      for (const record of records.filter((entry) => GENERATED_EFFECT_RESOURCE_IDS.includes(entry.resourceId ?? ""))) {
        expect(record.sheet?.assetScale, record.id).toBe(0.5);
        expect(record.sheet?.frameWidth, record.id).toBe(384);
      }
    });

    it("전체화면 이펙트 셀만 zoom 200 으로 무대 384 논리 px 를 덮고, 나머지는 100 이다", () => {
      const zoomOf = (slug: string): number[] => {
        const record = records.find((entry) => entry.resourceId === generatedEffectResourceId(slug));
        return [...new Set((record?.frames ?? []).flatMap((frame) => frame.cells.map((cell) => cell.zoom)))];
      };
      for (const slug of ["arcane-nova", "summon-portal", "meteor-fall"]) expect(zoomOf(slug), slug).toEqual([200]);
      for (const slug of ["fire-burst", "slash-steel", "heal-bloom", "sonic-wave"]) expect(zoomOf(slug), slug).toEqual([100]);
    });

    it("생성 레코드는 용도별 8~12프레임 전부를 순서대로 재생한다", () => {
      const generated = records.filter((record) => GENERATED_EFFECT_RESOURCE_IDS.includes(record.resourceId ?? ""));
      // 2026-10-03 EasyRPG 전투 시트를 걷어 내며 기본 anim_hit·anim_sword·anim_heal 등 옛 id 기록도 생성 시트를 가리킨다
      // (DEPRECATED_EASYRPG_BATTLE_SHEETS) — 기록 수가 아니라 「시트마다 기록이 있다」를 본다.
      expect(new Set(generated.map((record) => record.resourceId)).size).toBe(GENERATED_EFFECT_SHEETS.length);
      for (const record of generated) {
        const slug = record.resourceId!.replace("generated-battle-anim-", "");
        const frameCount = expectedFrameCount(slug);
        expect(record.sheet?.columns).toBe(frameCount);
        expect(record.frames?.map((frame) => frame.cells[0]?.pattern)).toEqual(
          Array.from({ length: frameCount }, (_unused, index) => index)
        );
      }
    });

    it("생성 레코드는 장수가 늘어도 0.6~0.9초 안에서 재생된다", () => {
      const expectedDurations = {
        "slash-steel": 600,
        "fire-burst": 750,
        "ice-shatter": 750,
        "thunder-strike": 750,
        "water-column": 750,
        "wind-slice": 750,
        "earth-spike": 750,
        "heal-bloom": 750,
        "poison-mist": 750,
        "arcane-nova": 900,
        "tackle-impact": 600,
        "claw-rake": 600,
        "bite-crunch": 600,
        "projectile-shot": 600,
        "leaf-volley": 750,
        "psychic-wave": 750,
        "shadow-pulse": 750,
        "holy-beam": 750,
        "sleep-dust": 750,
        "power-aura": 750,
        "guard-barrier": 750,
        "capture-seal": 900,
        "critical-burst": 600,
        "sonic-wave": 600,
        "drain-orbs": 750,
        "revive-rise": 750,
        "cleanse-sparkle": 750,
        "paralysis-bind": 750,
        "blind-veil": 750,
        "confusion-spiral": 750,
        "silence-lock": 750,
        "summon-portal": 900,
        "smoke-vanish": 600,
        "meteor-fall": 900,
      } as const;
      for (const record of records.filter((entry) => GENERATED_EFFECT_RESOURCE_IDS.includes(entry.resourceId ?? ""))) {
        const slug = record.resourceId!.replace("generated-battle-anim-", "") as keyof typeof expectedDurations;
        expect(battleAnimationDurationMs(record), slug).toBe(expectedDurations[slug]);
      }
    });

    it("생성 이펙트 34종은 각각 한 개의 기본 효과음을 충격 프레임에 재생한다", () => {
      const generated = records.filter((record) => GENERATED_EFFECT_RESOURCE_IDS.includes(record.resourceId ?? ""));
      for (const record of generated) {
        const slug = record.resourceId!.replace("generated-battle-anim-", "") as keyof typeof EXPECTED_SOUND_TIMINGS;
        const expected = EXPECTED_SOUND_TIMINGS[slug];
        const soundTimings = record.timings?.filter((timing) => timing.soundResourceId !== undefined) ?? [];

        expect(soundTimings, slug).toHaveLength(1);
        expect(soundTimings[0]?.frameIndex, slug).toBe(expected.frameIndex);
        expect(soundTimings[0]?.soundResourceId, slug).toBe(expected.resourceId);
        expect(expected.frameIndex, slug).toBeLessThan(record.frames?.length ?? 0);
      }
    });

    it("같은 충격 프레임의 플래시·흔들림·효과음은 하나의 타이밍으로 합쳐진다", () => {
      const slash = records.find((record) => record.resourceId === "generated-battle-anim-slash-steel");
      const impactTimings = slash?.timings?.filter((timing) => timing.frameIndex === 3) ?? [];

      expect(impactTimings).toHaveLength(1);
      expect(impactTimings[0]?.flash).toBeDefined();
      expect(impactTimings[0]?.screenShake).toBeDefined();
      expect(impactTimings[0]?.soundResourceId).toBe("easyrpg-sound-attack2");
    });

    it("회복·마법·독은 근접 타격 아트를 더 이상 돌려쓰지 않는다", () => {
      for (const [animationId, slug] of [
        ["anim_heal", "heal-bloom"],
        ["anim_magic", "arcane-nova"],
        ["anim_poison", "poison-mist"],
      ] as const) {
        const record = records.find((entry) => entry.id === animationId);
        expect(record?.resourceId).toBe(generatedEffectResourceId(slug));
      }
    });

    it("애니메이션 id 는 중복되지 않는다", () => {
      const ids = records.map((record) => record.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
