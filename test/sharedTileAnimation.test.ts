import { EventEmitter } from "node:events";
import type Phaser from "phaser";
import { describe, expect, it } from "vitest";
import { createSharedAnimatedTile } from "@/editor/sharedTileAnimation";

class Tile extends EventEmitter {
  texture: { key: string };
  frame: { name: string };
  visible = true;
  active = true;
  destroyed = false;
  animation = "";
  constructor(readonly x: number, readonly y: number, texture: string, frame: string) {
    super();
    this.texture = { key: texture };
    this.frame = { name: frame };
  }
  setVisible(value: boolean) { this.visible = value; return this; }
  setTexture(texture: string, frame: string) {
    this.texture = { key: texture };
    this.frame = { name: frame };
    return this;
  }
  play(animation: string) { this.animation = animation; return this; }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.emit("destroy");
    this.removeAllListeners();
  }
}

function fixture() {
  const drivers: Tile[] = [];
  const scene = { add: {
    sprite: (x: number, y: number, texture: string, frame: string) => {
      const tile = new Tile(x, y, texture, frame);
      drivers.push(tile);
      return tile;
    },
    image: (x: number, y: number, texture: string, frame: string) => new Tile(x, y, texture, frame),
  } } as unknown as Phaser.Scene;
  const create = (animation = "water", texture = "atlas") =>
    createSharedAnimatedTile(scene, 8, 16, texture, "first", animation) as unknown as Tile;
  return { drivers, create };
}

describe("shared editor tile animations", () => {
  it("shares a clock, synchronizes newly added tiles, and releases it after the last tile", () => {
    const { drivers, create } = fixture();
    const images = Array.from({ length: 1000 }, () => create());
    expect(drivers).toHaveLength(1);
    const driver = drivers[0]!;
    expect(driver.visible).toBe(false);
    expect(images[0]).toMatchObject({ x: 8, y: 16, visible: true });
    driver.setTexture("atlas", "next");
    driver.emit("animationupdate");
    expect(images.every(image => image.frame.name === "next")).toBe(true);
    const added = create();
    expect(added.frame.name).toBe("next");
    for (const image of images) image.destroy();
    expect(driver.destroyed).toBe(false);
    added.destroy();
    expect(driver.destroyed).toBe(true);
    create();
    expect(drivers).toHaveLength(2);
  });

  it("isolates different strips and scenes, and tolerates driver-first scene shutdown", () => {
    const first = fixture();
    const second = fixture();
    const a = first.create();
    const b = first.create("uploaded-water", "uploaded-atlas");
    const c = second.create();
    first.drivers[0]!.destroy();
    a.destroy();
    expect(first.drivers[1]!.destroyed).toBe(false);
    expect(second.drivers[0]!.destroyed).toBe(false);
    b.destroy();
    c.destroy();
    expect(first.drivers[1]!.destroyed).toBe(true);
    expect(second.drivers[0]!.destroyed).toBe(true);
  });
});
