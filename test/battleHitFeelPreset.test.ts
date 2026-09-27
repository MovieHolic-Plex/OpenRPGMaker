/** @vitest-environment happy-dom */
/**
 * 타격감 프리셋(2026-09-27): system.battleHitFeel = impact(기본·생략) | light | calm.
 * 저장 계약(기본 생략·무효값 → 기본), 자료집 시스템 탭 선택, AI set_project_settings, 런타임 DOM 층(아군 피격 흔들림 바닥 ·
 * 히트스톱 진동 · 베기 궤적)을 묶는다. 화면 증거는 output/combat-qa/hitfeel-*(player.html 프로브).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderSystemTab } from "@/editor/panels/databaseSystemView";
import { runTool } from "@/editor/tools";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import { BATTLE_HIT_FEEL_IDS, resolveBattleHitFeel } from "@/project/battleHitFeel";
import { SWING_LEAD_MS, hurtShakeIntensity, spawnSlashTrail, vibrateStruck } from "@/player/battleHitFeelDom";

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

describe("자료집 시스템 탭 — 타격감 선택", () => {
  beforeEach(() => {
    store.replace(createBlankProject());
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  function renderSystem(): HTMLElement {
    const host = document.createElement("div");
    document.body.append(host);
    const rerender = (): void => {
      host.replaceChildren();
      renderSystemTab(host, rerender);
    };
    rerender();
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
