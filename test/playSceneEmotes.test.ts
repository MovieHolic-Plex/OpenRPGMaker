import { describe, expect, it, vi } from "vitest";
vi.mock("phaser", () => ({ default: {} }));
import { clearAllSceneEmotes, describeSceneEmotes, showSceneEmote, syncSceneEmotes } from "@/player/playSceneEmotes";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { EMOTE_ASSET_PATH, EMOTE_TEXTURE_KEY } from "@/project/emotes";
import { createBlankProject } from "@/project/defaults";
import { collectWebExportAssets } from "@/project/webExportAssets";

function harness() {
  const hosts = new Map([["npc", { x: 48, y: 80, displayHeight: 24, originY: 1, active: true }]]);
  const timers: { fire: () => void; remove: ReturnType<typeof vi.fn> }[] = [];
  const sprites: any[] = [];
  const scene = {
    player: { x: 16, y: 32, displayHeight: 24, originY: 1, active: true },
    eventSprites: hosts,
    textures: { exists: (key: string) => key === EMOTE_TEXTURE_KEY },
    add: { sprite: (x: number, y: number, _key: string, frame: number) => {
      const s = { x, y, frame: { name: frame }, alpha: 1, active: true,
        setDepth: vi.fn(), setScrollFactor: vi.fn(), setScale: vi.fn(), setAlpha: vi.fn(), destroy: vi.fn() };
      sprites.push(s); return s;
    } },
    tweens: { add: vi.fn(), killTweensOf: vi.fn() },
    time: { delayedCall: (_ms: number, fire: () => void) => {
      const timer = { fire, remove: vi.fn() }; timers.push(timer); return timer;
    } },
  } as unknown as PlaySceneContext;
  return { scene, hosts, timers, sprites };
}

describe("scene emote lifecycle", () => {
  it("tracks the actual rendered head including hop origin lift", () => {
    const { scene, hosts } = harness();
    showSceneEmote(scene, "npc", "question");
    expect(describeSceneEmotes(scene)[0]).toMatchObject({ target: "npc", frame: "4", x: 48, y: 52 });
    Object.assign(hosts.get("npc")!, { x: 64, originY: 2 });
    syncSceneEmotes(scene);
    expect(describeSceneEmotes(scene)[0]).toMatchObject({ x: 64, y: 28 });
  });
  it("replaces a target's previous sprite, timer and tweens", () => {
    const { scene, timers, sprites } = harness();
    showSceneEmote(scene, "npc", "heart");
    showSceneEmote(scene, "npc", "anger");
    expect(timers[0].remove).toHaveBeenCalledWith(false);
    expect(sprites[0].destroy).toHaveBeenCalledOnce();
    expect(scene.tweens.killTweensOf).toHaveBeenCalledTimes(2);
    expect(describeSceneEmotes(scene)).toHaveLength(1);
    expect(describeSceneEmotes(scene)[0].frame).toBe("7");
  });
  it("expires cleanly and removes emotes when their host vanishes", () => {
    const { scene, hosts, timers, sprites } = harness();
    showSceneEmote(scene, "player", "music");
    timers[0].fire();
    expect(describeSceneEmotes(scene)).toEqual([]);
    expect(sprites[0].destroy).toHaveBeenCalledOnce();
    showSceneEmote(scene, "npc", "heart");
    hosts.delete("npc");
    syncSceneEmotes(scene);
    expect(describeSceneEmotes(scene)).toEqual([]);
    expect(timers[1].remove).toHaveBeenCalledOnce();
  });
  it("ignores missing hosts and clears every target on map/scene teardown", () => {
    const { scene } = harness();
    showSceneEmote(scene, "missing", "heart");
    expect(describeSceneEmotes(scene)).toEqual([]);
    showSceneEmote(scene, "npc", "heart");
    showSceneEmote(scene, "player", "smile");
    clearAllSceneEmotes(scene);
    clearAllSceneEmotes(scene);
    expect(describeSceneEmotes(scene)).toEqual([]);
  });
  it("ships the sprite sheet even when emotes come from automatic gift feedback", () => {
    expect(collectWebExportAssets(createBlankProject()).some((asset) => asset.zipPath === EMOTE_ASSET_PATH)).toBe(true);
  });
});
