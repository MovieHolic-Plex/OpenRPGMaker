import { describe, expect, it } from "vitest";
import { enemyIsClosing, shouldApplyContactDamage } from "@/battle/action/contact";

const PLAYER_TILES = [{ x: 5, y: 5 }] as const;

describe("enemyIsClosing", () => {
  it("counts a mover that is stepping this frame", () => {
    expect(enemyIsClosing({ mode: "combat", moving: true })).toBe(true);
  });

  it("counts a dash", () => {
    expect(enemyIsClosing({ mode: "dash", moving: false })).toBe(true);
  });

  it("does not count a telegraphing or recovering enemy", () => {
    expect(enemyIsClosing({ mode: "windup", moving: true })).toBe(false);
    expect(enemyIsClosing({ mode: "recover", moving: true })).toBe(false);
  });

  it("does not count an idle adjacent enemy", () => {
    expect(enemyIsClosing({ mode: "combat", moving: false })).toBe(false);
  });
});

describe("shouldApplyContactDamage", () => {
  it("a moving enemy adjacent to the player deals contact damage", () => {
    expect(shouldApplyContactDamage({
      enemyTile: { x: 6, y: 5 },
      playerTiles: PLAYER_TILES,
      mode: "combat",
      moving: true,
    })).toBe(true);
  });

  it("diagonal adjacency counts, distance 2 does not", () => {
    expect(shouldApplyContactDamage({ enemyTile: { x: 6, y: 6 }, playerTiles: PLAYER_TILES, mode: "combat", moving: true })).toBe(true);
    expect(shouldApplyContactDamage({ enemyTile: { x: 7, y: 5 }, playerTiles: PLAYER_TILES, mode: "combat", moving: true })).toBe(false);
  });

  it("a windup enemy touching the player deals no contact damage", () => {
    expect(shouldApplyContactDamage({ enemyTile: { x: 6, y: 5 }, playerTiles: PLAYER_TILES, mode: "windup", moving: true })).toBe(false);
  });

  it("a recovering enemy touching the player deals no contact damage", () => {
    expect(shouldApplyContactDamage({ enemyTile: { x: 5, y: 4 }, playerTiles: PLAYER_TILES, mode: "recover", moving: false })).toBe(false);
  });

  it("a dashing enemy adjacent to the player deals contact damage", () => {
    expect(shouldApplyContactDamage({ enemyTile: { x: 5, y: 6 }, playerTiles: PLAYER_TILES, mode: "dash", moving: false })).toBe(true);
  });

  it("checks the tile the player is stepping into as well", () => {
    expect(shouldApplyContactDamage({
      enemyTile: { x: 9, y: 5 },
      playerTiles: [{ x: 5, y: 5 }, { x: 8, y: 5 }],
      mode: "combat",
      moving: true,
    })).toBe(true);
  });

  it("an idle enemy standing next to the player deals no contact damage", () => {
    expect(shouldApplyContactDamage({ enemyTile: { x: 6, y: 5 }, playerTiles: PLAYER_TILES, mode: "combat", moving: false })).toBe(false);
  });
});
