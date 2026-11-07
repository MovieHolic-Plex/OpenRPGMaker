/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults/blankProject";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import {
  ENEMY_STILL_MOTION_DEFAULT,
  framedArt,
  normalizeEnemyStillMotion,
  resolveEnemyStillMotion,
  stageOwnsFilters,
  stillMotionLevel,
} from "@/project/enemyStillMotion";
import { enemyDeath, enemyHit, enemyIdle } from "@/player/battleEnemyStillMotion";

function node(markup: string, extra: (element: HTMLElement) => void = () => {}): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = markup;
  const root = host.firstElementChild as HTMLElement;
  extra(root);
  return root;
}

function imageOf(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>(".battle-enemy-image");
}

const STILL = `<button class="battle-enemy"><img class="battle-enemy-image"></button>`;

describe("적 그림 움직임 설정", () => {
  it("기본은 all 이고, 바꾸는 프로젝트만 값을 남긴다", () => {
    expect(ENEMY_STILL_MOTION_DEFAULT).toBe("all");
    expect(normalizeEnemyStillMotion("stillOnly")).toBe("stillOnly");
    expect(normalizeEnemyStillMotion("off")).toBe("off");
    expect(normalizeEnemyStillMotion(true)).toBeUndefined();
    const base = { startActorIds: ["actor_hero"] };
    expect(normalizeSystemRecords(base).enemyStillMotion).toBeUndefined();
    expect(normalizeSystemRecords({ ...base, enemyStillMotion: "all" }).enemyStillMotion).toBeUndefined();
    expect(normalizeSystemRecords({ ...base, enemyStillMotion: "stillOnly" }).enemyStillMotion).toBe("stillOnly");
    expect(normalizeSystemRecords({ ...base, enemyStillMotion: "off" }).enemyStillMotion).toBe("off");
    expect(resolveEnemyStillMotion({ system: {} })).toBe("all");
    expect(resolveEnemyStillMotion({ system: { enemyStillMotion: "off" } })).toBe("off");
  });

  it("조수 도구가 모드를 바꾸고 기본값으로 되돌린다", () => {
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, "set_project_settings", { battle: { enemyStillMotion: "stillOnly" } }).ok).toBe(true);
    expect(ctx.project.system.enemyStillMotion).toBe("stillOnly");
    expect(runTool(ctx, "set_project_settings", { battle: { enemyStillMotion: "off" } }).ok).toBe(true);
    expect(ctx.project.system.enemyStillMotion).toBe("off");
    expect(runTool(ctx, "set_project_settings", { battle: { enemyStillMotion: "all" } }).ok).toBe(true);
    expect("enemyStillMotion" in ctx.project.system).toBe(false);
    expect(runTool(ctx, "set_project_settings", { battle: { enemyStillMotion: true } }).ok).toBe(false);
  });
});

describe("엔진 연출 단계", () => {
  it("칸이 없는 정지 그림은 full, 칸 있는 그림은 all 에서 translate", () => {
    const still = node(STILL);
    expect(framedArt(still, imageOf(still))).toBe(false);
    expect(stillMotionLevel(still, imageOf(still), "all")).toBe("full");

    for (const attr of ["data-pixel-enemy", "data-pixel-party", "data-charset-enemy"]) {
      const framed = node(STILL, (element) => { element.setAttribute(attr, "dash"); });
      expect(framedArt(framed, imageOf(framed)), attr).toBe(true);
      expect(stillMotionLevel(framed, imageOf(framed), "all"), attr).toBe("translate");
    }

    const extended = node(STILL, (element) => { element.dataset.battlerExtended = "true"; });
    expect(stillMotionLevel(extended, imageOf(extended), "all")).toBe("translate");

    const strip = node(STILL, (element) => {
      element.querySelector<HTMLElement>(".battle-enemy-image")!.dataset.battlerAnim = "generated-enemy-slime-01";
    });
    expect(stillMotionLevel(strip, imageOf(strip), "all")).toBe("translate");
  });

  it("stillOnly 는 칸 있는 그림을 그대로 두고, off 는 아무 데도 걸지 않는다", () => {
    const still = node(STILL);
    expect(stillMotionLevel(still, imageOf(still), "stillOnly")).toBe("full");
    const sheet = node(STILL, (element) => { element.dataset.pixelEnemy = "dash"; });
    expect(stillMotionLevel(sheet, imageOf(sheet), "stillOnly")).toBe("off");
    expect(stillMotionLevel(sheet, imageOf(sheet), "all")).toBe("translate");
    expect(stillMotionLevel(still, imageOf(still), "off")).toBe("off");
    expect(stillMotionLevel(still, null, "all")).toBe("off");
  });

  it("보스 무대·보스 입장은 filter·scale 을 스스로 쓴다", () => {
    const scene = (step: string, bigBoss: boolean) => {
      const host = document.createElement("div");
      host.innerHTML = `<div class="battle-scene" data-battle-director-step="${step}" ${bigBoss ? 'data-battle-big-boss="true"' : ""}><button class="battle-enemy"><img class="battle-enemy-image"></button></div>`;
      return host.querySelector<HTMLElement>(".battle-enemy")!;
    };
    expect(stageOwnsFilters(scene("intro", false))).toBe(true);
    expect(stageOwnsFilters(scene("action", false))).toBe(false);
    expect(stageOwnsFilters(scene("action", true))).toBe(true);
    const sink = node(`<button class="battle-enemy" data-collapse="bossSink"><img class="battle-enemy-image"></button>`);
    expect(stageOwnsFilters(sink)).toBe(true);
  });

  it("WAAPI 가 없는 환경에서는 조용히 건너뛴다", () => {
    const still = node(STILL);
    Object.defineProperty(imageOf(still)!, "animate", { value: undefined });
    const opts = { level: "full" as const, staged: false };
    expect(() => { enemyHit(still, opts); enemyDeath(still, opts); enemyIdle(still, opts); }).not.toThrow();
    expect(imageOf(still)!.hasAttribute("data-enemy-anim")).toBe(false);
  });
});
