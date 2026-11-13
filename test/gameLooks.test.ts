// 이 기기의 다른 게임 겉모습 기록(src/ai/piAgent/gameLooks.ts) — 새 게임이 «이미 만든 게임들이 덜 쓴» 겉모습을 먼저 고르게 하는 재료.
// 기록이 없거나 저장소를 못 쓰면 빈 목록이다(고르기는 게임 열쇠 해시로 돌아간다).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { otherGameLooks, rememberGameLooks } from "@/ai/piAgent/gameLooks";
import type { Project, TilesetLook } from "@/project/types";

const lookOf = (stand: string): TilesetLook => ({ textureKey: "tex_beodeul_looks", stand, standKey: "tex_beodeul_stands" });
const projectWith = (looks: Record<string, TilesetLook | undefined>): Pick<Project, "tilesets"> =>
  ({ tilesets: Object.fromEntries(Object.entries(looks).map(([id, look]) => [id, { id, ...(look ? { look } : {}) }])) } as unknown as Pick<Project, "tilesets">);

describe("game looks — 이 기기의 다른 게임 겉모습 기록", () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("적은 게임의 겉모습은 다른 게임에게만 보인다 — 제 것은 빠지고, 다시 적으면 바뀐다", () => {
    rememberGameLooks("game-a", projectWith({ beodeul_city: lookOf("oakwood") }));
    rememberGameLooks("game-b", projectWith({ beodeul_city: lookOf("pinewood"), other: undefined }));
    expect(otherGameLooks("game-a")).toEqual([lookOf("pinewood")]);
    expect(otherGameLooks("game-b")).toEqual([lookOf("oakwood")]);
    expect(otherGameLooks("game-c").map((look) => look.stand).sort()).toEqual(["oakwood", "pinewood"]);
    rememberGameLooks("game-a", projectWith({ beodeul_city: lookOf("citrus") }));
    expect(otherGameLooks("game-b")).toEqual([lookOf("citrus")]);
  });

  it("겉모습이 없는 프로젝트는 적지 않고(전에 적은 것은 남는다), 열쇠가 없으면 아무것도 하지 않는다", () => {
    rememberGameLooks("game-a", projectWith({ beodeul_city: lookOf("oakwood") }));
    rememberGameLooks("game-a", projectWith({ beodeul_city: undefined }));
    rememberGameLooks(undefined, projectWith({ beodeul_city: lookOf("pinewood") }));
    rememberGameLooks("  ", projectWith({ beodeul_city: lookOf("pinewood") }));
    expect(otherGameLooks("game-z")).toEqual([lookOf("oakwood")]);
    expect(otherGameLooks(undefined)).toEqual([]);
  });

  it("스물넷까지만 기억한다 — 가장 오래된 게임부터 잊는다", () => {
    for (let n = 0; n < 30; n += 1) rememberGameLooks(`game-${n}`, projectWith({ beodeul_city: lookOf(`stand-${n}`) }));
    const stands = otherGameLooks("someone-else").map((look) => look.stand);
    expect(stands.length).toBe(24);
    expect(stands).not.toContain("stand-0");
    expect(stands).toContain("stand-29");
  });

  it("저장소가 없거나 깨진 값이면 빈 목록이다", () => {
    store.set("oprn-game-looks-v1", "{not json");
    expect(otherGameLooks("game-a")).toEqual([]);
    vi.stubGlobal("localStorage", undefined);
    expect(() => rememberGameLooks("game-a", projectWith({ beodeul_city: lookOf("oakwood") }))).not.toThrow();
    expect(otherGameLooks("game-b")).toEqual([]);
  });
});
