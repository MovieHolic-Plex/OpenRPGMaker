// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderBattleScreenTab } from "@/editor/panels/databaseBattleScreenTab";
import { runTool } from "@/editor/tools";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import { BATTLE_HIT_FEEL_IDS, resolveBattleHitFeel } from "@/project/battleHitFeel";
import { SWING_LEAD_MS, hurtShakeIntensity, spawnSlashTrail, vibrateStruck } from "@/player/battleHitFeelDom";
import { BATTLE_LOOK_PRESET_IDS, BATTLE_LOOK_PRESETS, normalizeBattleLook, patchBattleLook, resolveBattleLook } from "@/project/battleLook";
import { resolveFontStack } from "@/project/fontRegistry";
import { isolateTimers } from "./mergedTeardown";

/**
 * 타격감 프리셋(2026-09-27): system.battleHitFeel = impact(기본·생략) | light | calm.
 * 저장 계약(기본 생략·무효값 → 기본), 자료집 시스템 탭 선택, AI set_project_settings, 런타임 DOM 층(아군 피격 흔들림 바닥 ·
 * 히트스톱 진동 · 베기 궤적)을 묶는다. 화면 증거는 output/combat-qa/hitfeel-*(player.html 프로브).
 */
describe("battleHitFeelPreset", () => {
  isolateTimers();
  describe("system.battleHitFeel — 저장 계약", () => {
    it("새 프로젝트는 묵직하게(impact)로 열리고 JSON 에 키가 없다", () => {
      const project = createBlankProject();
      expect(resolveBattleHitFeel(project.system.battleHitFeel)).toBe("impact");
      expect(serialize(project)).not.toContain("battleHitFeel");
    });

    it("light · calm 은 왕복을 보존하고 impact 는 생략된다", () => {
      for (const feel of ["light", "calm"] as const) {
        const project = createBlankProject();
        project.system.battleHitFeel = feel;
        const wire = serialize(project);
        expect(wire).toContain(`"battleHitFeel":"${feel}"`);
        expect(deserialize(wire).system.battleHitFeel).toBe(feel);
      }
      const base = createBlankProject();
      expect(normalizeSystemRecords({ ...base.system, battleHitFeel: "impact" }).battleHitFeel).toBeUndefined();
    });

    it("모르는 값은 기본으로 풀린다", () => {
      const obj = JSON.parse(serialize(createBlankProject()));
      obj.system.battleHitFeel = "wobbly";
      const restored = deserialize(JSON.stringify(obj));
      expect(restored.system.battleHitFeel).toBeUndefined();
      expect(resolveBattleHitFeel(restored.system.battleHitFeel)).toBe("impact");
    });
  });
  // 타격감 선택은 시스템 탭에서 자료집 「전투 화면」 탭의 타격감 카드로 옮겨졌다(databaseBattleScreenTab.ts).
  describe("자료집 전투 화면 탭 — 타격감 선택", () => {
    beforeEach(() => {
      store.replace(createBlankProject());
    });
    afterEach(() => {
      document.body.innerHTML = "";
    });

    function renderSystem(): HTMLElement {
      const host = document.createElement("div");
      document.body.append(host);
      renderBattleScreenTab(host);
      return host;
    }

    function hitFeelSelect(host: HTMLElement): HTMLSelectElement {
      const select = host.querySelector<HTMLSelectElement>('[data-testid="db-field-system-battle-hit-feel"]');
      if (!select) throw new Error("타격감 선택이 없다");
      return select;
    }

    it("세 프리셋을 내놓고 기본은 묵직하게다", () => {
      const select = hitFeelSelect(renderSystem());
      expect([...select.options].map((option) => option.value)).toEqual([...BATTLE_HIT_FEEL_IDS]);
      expect(select.value).toBe("impact");
    });

    it("고르면 프로젝트에 저장되고, 기본으로 돌리면 키가 사라진다", () => {
      const host = renderSystem();
      const select = hitFeelSelect(host);
      select.value = "calm";
      select.dispatchEvent(new Event("change"));
      expect(store.getCurrent().system.battleHitFeel).toBe("calm");
      const again = hitFeelSelect(host);
      again.value = "impact";
      again.dispatchEvent(new Event("change"));
      expect("battleHitFeel" in store.getCurrent().system).toBe(false);
    });
  });
  describe("AI set_project_settings battle.hitFeel", () => {
    it("light 를 저장하고 impact 로 되돌리면 지운다", () => {
      const context = { project: createBlankProject() };
      expect(runTool(context, "set_project_settings", { battle: { hitFeel: "light" } }).ok).toBe(true);
      expect(context.project.system.battleHitFeel).toBe("light");
      expect(runTool(context, "set_project_settings", { battle: { hitFeel: "impact" } }).ok).toBe(true);
      expect(context.project.system.battleHitFeel).toBeUndefined();
    });
  });
  describe("런타임 타격감 층", () => {
    afterEach(() => {
      document.body.innerHTML = "";
    });

    it("묵직하게는 아군 피격 흔들림을 최소 heavy 로 올리고, 다른 프리셋은 피해 비율 그대로 둔다", () => {
      expect(hurtShakeIntensity("impact", "graze")).toBe("heavy");
      expect(hurtShakeIntensity("impact", "normal")).toBe("heavy");
      expect(hurtShakeIntensity("impact", "crushing")).toBe("crushing");
      expect(hurtShakeIntensity("impact", undefined)).toBeUndefined();
      expect(hurtShakeIntensity("light", "graze")).toBe("graze");
      expect(hurtShakeIntensity("calm", "normal")).toBe("normal");
    });

    it("진동은 translate 로만 떨고 잦아들어 제자리로 돌아온다", () => {
      const sprite = document.createElement("img");
      const calls: { frames: Keyframe[]; options: KeyframeAnimationOptions }[] = [];
      sprite.animate = ((frames: Keyframe[], options: KeyframeAnimationOptions) => {
        calls.push({ frames, options });
        return {} as Animation;
      }) as typeof sprite.animate;
      vibrateStruck(sprite, "normal");
      expect(calls).toHaveLength(1);
      const offsets = calls[0]!.frames.map((frame) => Number.parseFloat(String(frame.translate)));
      expect(offsets[0]).toBe(0);
      expect(offsets.at(-1)).toBe(0);
      expect(Math.abs(offsets[1]!)).toBeGreaterThan(Math.abs(offsets[offsets.length - 2]!));
      expect(offsets.some((value) => value < 0)).toBe(true);
      expect(calls[0]!.frames.every((frame) => frame.transform === undefined)).toBe(true);
    });

    it("베기 궤적은 적 노드에 붙었다가 스스로 사라진다", async () => {
      const enemy = document.createElement("button");
      enemy.className = "battle-enemy";
      document.body.append(enemy);
      spawnSlashTrail(enemy);
      expect(enemy.querySelector('[data-testid="battle-slash-trail"]')).not.toBeNull();
      await new Promise((resolve) => setTimeout(resolve, SWING_LEAD_MS + 260));
      expect(enemy.querySelector('[data-testid="battle-slash-trail"]')).toBeNull();
    });
  });
});

/**
 * 전투 화면 꾸미기(2026-10-01): system.battleLook = { preset?, 칸별 덮어쓰기 } (project/battleLook.ts).
 * 저장 계약(pixel 프리셋 그대로면 생략·프리셋과 같은 칸은 지움·무효값 버림), 자료집 전투 화면 탭(2026-10-02 시스템 탭에서 옮김), AI set_project_settings battle.look 을 묶는다.
 * 화면 증거는 verify-shots/battle-look/<프리셋>/(player.html 프로브).
 */
describe("battleLook", () => {
  isolateTimers();
  describe("system.battleLook — 저장 계약", () => {
    it("새 프로젝트는 도트 창 프리셋이고 JSON 에 키가 없다", () => {
      const project = createBlankProject();
      expect(resolveBattleLook(project.system.battleLook).preset).toBe("pixel");
      expect(serialize(project)).not.toContain("battleLook");
    });

    it("프리셋과 바꾼 칸만 왕복을 보존한다", () => {
      const project = createBlankProject();
      project.system.battleLook = { preset: "gold", window: "parch", accent: "#E8A0B8", light: 2 };
      const restored = deserialize(serialize(project)).system.battleLook;
      // light 2 는 gold 프리셋 값이라 저장하지 않는다.
      expect(restored).toEqual({ preset: "gold", window: "parch", accent: "#e8a0b8" });
      const base = createBlankProject();
      expect(normalizeSystemRecords({ ...base.system, battleLook: { preset: "pixel" } }).battleLook).toBeUndefined();
    });

    it("모르는 프리셋·칸 값은 버린다", () => {
      expect(normalizeBattleLook({ preset: "chrome", party: "floating", light: 5, accent: "gold", font: "comic-sans" })).toBeUndefined();
      expect(normalizeBattleLook({ preset: "pop", command: "nowhere" })).toEqual({ preset: "pop" });
    });

    it("프리셋 12종은 모두 풀리고 칸을 바꾸면 사용자 설정이 된다", () => {
      expect(BATTLE_LOOK_PRESET_IDS).toHaveLength(12);
      for (const id of BATTLE_LOOK_PRESET_IDS) {
        const look = resolveBattleLook({ preset: id });
        expect(look.preset).toBe(id);
        expect(look.customized).toBe(false);
        expect(look.window).toBe(BATTLE_LOOK_PRESETS[id].axes.window);
      }
      const custom = resolveBattleLook(patchBattleLook({ preset: "ink" }, { party: "cards" }));
      expect(custom).toMatchObject({ preset: "ink", party: "cards", customized: true });
    });

    it("글꼴: 고르지 않으면 창 꾸밈 기본, 고르면 그 글꼴, 고전 창은 프로젝트 픽셀 글꼴", () => {
      expect(resolveBattleLook({ preset: "ink" }).fontStack).toBe(resolveFontStack("myeongjo"));
      expect(resolveBattleLook({ preset: "ink", font: "neodgm" }).fontStack).toBe(resolveFontStack("neodgm"));
      expect(resolveBattleLook({ preset: "line" }).fontStack).toBeUndefined();
      expect(resolveBattleLook({ preset: "line" }).retroWindow).toBe(true);
      expect(resolveBattleLook({ preset: "veil" }).retroWindow).toBe(false);
    });
  });
  describe("자료집 전투 화면 탭 — 전투 화면 꾸미기", () => {
    beforeEach(() => {
      store.replace(createBlankProject());
    });
    afterEach(() => {
      document.body.innerHTML = "";
    });

    function renderSystem(): HTMLElement {
      const host = document.createElement("div");
      document.body.append(host);
      renderBattleScreenTab(host);
      return host;
    }

    it("프리셋 카드 12장, 고르면 저장되고 pixel 로 돌리면 키가 빠진다", () => {
      const host = renderSystem();
      expect(host.querySelectorAll('[data-testid^="db-battle-look-preset-"]')).toHaveLength(12);
      expect(host.querySelector('[data-testid="db-battle-look-preset-pixel"]')?.getAttribute("aria-pressed")).toBe("true");
      host.querySelector<HTMLButtonElement>('[data-testid="db-battle-look-preset-gold"]')!.click();
      expect(store.getCurrent().system.battleLook).toEqual({ preset: "gold" });
      expect(host.querySelector('[data-testid="db-battle-look-preset-gold"]')?.getAttribute("aria-pressed")).toBe("true");
      host.querySelector<HTMLButtonElement>('[data-testid="db-battle-look-preset-pixel"]')!.click();
      expect(store.getCurrent().system.battleLook).toBeUndefined();
    });

    it("칸을 바꾸면 그 칸만 저장되고 「사용자 설정」·되돌리기가 뜬다", () => {
      const host = renderSystem();
      host.querySelector<HTMLButtonElement>('[data-testid="db-battle-look-preset-ink"]')!.click();
      const party = host.querySelector<HTMLSelectElement>('[data-testid="db-battle-look-party"]')!;
      party.value = "cards";
      party.dispatchEvent(new Event("change"));
      expect(store.getCurrent().system.battleLook).toEqual({ preset: "ink", party: "cards" });
      expect(host.querySelector('[data-testid="db-battle-look-status"]')?.textContent).toContain("사용자 설정");
      host.querySelector<HTMLButtonElement>('[data-testid="db-battle-look-reset"]')!.click();
      expect(store.getCurrent().system.battleLook).toEqual({ preset: "ink" });
    });

    it("강조색은 「꾸밈 기본」을 끄면 저장되고 켜면 지워진다", () => {
      const host = renderSystem();
      const usesDefault = (): HTMLInputElement => host.querySelector<HTMLInputElement>('[data-testid="db-battle-look-accent-default"]')!;
      const color = (): HTMLInputElement => host.querySelector<HTMLInputElement>('[data-testid="db-battle-look-accent"]')!;
      expect(usesDefault().checked).toBe(true);
      color().value = "#88ccff";
      usesDefault().checked = false;
      usesDefault().dispatchEvent(new Event("change"));
      expect(store.getCurrent().system.battleLook).toEqual({ accent: "#88ccff" });
      usesDefault().checked = true;
      usesDefault().dispatchEvent(new Event("change"));
      expect(store.getCurrent().system.battleLook).toBeUndefined();
    });
  });
  describe("AI set_project_settings — battle.look", () => {
    it("프리셋으로 갈아타면 바꾼 칸을 버리고, 칸만 주면 프리셋 위에 덮는다", () => {
      const context = { project: createBlankProject() };
      expect(runTool(context, "set_project_settings", { battle: { look: { preset: "ink", party: "cards", accent: "#D9B86C" } } }).ok).toBe(true);
      expect(context.project.system.battleLook).toEqual({ preset: "ink", party: "cards", accent: "#d9b86c" });
      expect(runTool(context, "set_project_settings", { battle: { look: { turnOrder: true, accent: "" } } }).ok).toBe(true);
      expect(context.project.system.battleLook).toEqual({ preset: "ink", party: "cards", turnOrder: true });
      expect(runTool(context, "set_project_settings", { battle: { look: { preset: "pixel" } } }).ok).toBe(true);
      expect(context.project.system.battleLook).toBeUndefined();
    });

    it("모르는 프리셋·칸·글꼴·색·스킨은 거절한다", () => {
      const context = { project: createBlankProject() };
      expect(runTool(context, "set_project_settings", { battle: { look: { preset: "chrome" } } }).ok).toBe(false);
      expect(runTool(context, "set_project_settings", { battle: { look: { party: "floating" } } }).ok).toBe(false);
      expect(runTool(context, "set_project_settings", { battle: { look: { light: 3 } } }).ok).toBe(false);
      expect(runTool(context, "set_project_settings", { battle: { look: { font: "comic-sans" } } }).ok).toBe(false);
      expect(runTool(context, "set_project_settings", { battle: { look: { accent: "gold" } } }).ok).toBe(false);
      expect(runTool(context, "set_project_settings", { battle: { uiStyle: "octopath-2" } }).ok).toBe(false);
    });
  });
});
