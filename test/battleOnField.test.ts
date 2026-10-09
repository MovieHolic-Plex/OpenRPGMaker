/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import {
  computeOnFieldAnchors, hideOnFieldSprites, instantBattleTransition, onFieldEnemyPoint, onFieldPartyPoint, onFieldPointToAuthored,
} from "@/player/battleOnField";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import { deserialize, serialize } from "@/project/io";

function sprite(x: number, y: number, alpha = 1) {
  return { x, y, alpha, active: true, setAlpha(value: number) { this.alpha = value; return this; } };
}

function rectOf(left: number, top: number, width: number, height: number): () => DOMRect {
  return () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
}

const camera = { main: { worldView: { x: 100, y: 50, width: 320, height: 240 } } };

describe("battleOnField", () => {
  it("anchors the enemy on the owner symbol and the party on the field sprites (canvas fractions)", () => {
    const player = sprite(260, 170);
    const follower = sprite(260, 186);
    const bat = sprite(260, 122);
    const canvas = document.createElement("canvas");
    const anchors = computeOnFieldAnchors(
      { player, followerSprites: new Map([["f", follower]]), eventSprites: new Map([["ev_bat", bat]]), cameras: camera, facing: "up" },
      canvas, "ev_bat", 16,
    )!;
    expect(anchors.enemy).toEqual({ fx: 0.5, fy: 72 / 240 });
    expect(anchors.party).toEqual([{ fx: 0.5, fy: 0.5 }, { fx: 0.5, fy: 136 / 240 }]);
    expect(anchors.tileFx).toBe(16 / 320);
    // 적 여럿은 심볼을 중심으로 한 칸 간격, 모자란 아군 자리는 주인공 옆으로.
    expect(onFieldEnemyPoint(anchors, 0, 2).fx).toBeCloseTo(0.5 - 8 / 320);
    expect(onFieldEnemyPoint(anchors, 1, 2).fx).toBeCloseTo(0.5 + 8 / 320);
    expect(onFieldPartyPoint(anchors, 3)).toEqual({ fx: 0.5 + 3 * 16 / 320, fy: 0.5 });
  });

  it("falls back to three tiles in front of the hero when no symbol sprite exists", () => {
    const anchors = computeOnFieldAnchors({ player: sprite(260, 170), cameras: camera, facing: "left" }, document.createElement("canvas"), undefined, 16)!;
    expect(anchors.enemy).toEqual({ fx: (260 - 48 - 100) / 320, fy: 0.5 });
  });

  it("maps canvas fractions into the battler group's 320x160 authored space regardless of stage scale", () => {
    const canvas = document.createElement("canvas");
    canvas.getBoundingClientRect = rectOf(32, 24, 960, 720);
    const group = document.createElement("div");
    group.getBoundingClientRect = rectOf(32, 72, 960, 480);
    expect(onFieldPointToAuthored({ fx: 0.5, fy: 0.5 }, canvas, group)).toEqual({ x: 160, y: ((24 + 360 - 72) / 480) * 160 });
    group.getBoundingClientRect = rectOf(0, 0, 0, 0);
    expect(onFieldPointToAuthored({ fx: 0.5, fy: 0.5 }, canvas, group)).toBeUndefined();
  });

  it("hides hero, followers and the symbol during battle and restores the original alpha once", () => {
    const player = sprite(0, 0, 1);
    const follower = sprite(0, 0, 0.8);
    const bat = sprite(0, 0, 1);
    const other = sprite(0, 0, 1);
    const restore = hideOnFieldSprites({ player, followerSprites: new Map([["f", follower]]), eventSprites: new Map([["ev_bat", bat], ["ev_other", other]]) }, "ev_bat");
    expect([player.alpha, follower.alpha, bat.alpha, other.alpha]).toEqual([0, 0, 0, 1]);
    bat.active = false; // 이긴 뒤 지워진 심볼은 되살리지 않는다
    restore();
    restore();
    expect([player.alpha, follower.alpha, bat.alpha]).toEqual([1, 0.8, 0]);
  });

  it("uses an instant transition", async () => {
    const transition = instantBattleTransition();
    await expect(Promise.all([transition.cover(), transition.reveal(), transition.exit()])).resolves.toBeDefined();
  });

  it("set_project_settings battle.presentation toggles system.battlePresentation and survives serialize", () => {
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, "set_project_settings", { battle: { presentation: "onField" } }).ok).toBe(true);
    expect(deserialize(serialize(ctx.project)).system.battlePresentation).toBe("onField");
    expect(runTool(ctx, "set_project_settings", { battle: { presentation: "default" } }).ok).toBe(true);
    expect(ctx.project.system.battlePresentation).toBeUndefined();
  });
});
