/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { loadBundledAssets, rawCharsetTextureKey } from "@/assets/bundled";
import { createBlankProject } from "@/project/defaults";

describe("play boot asset selection", () => {
  it("does not preload catalog chipsets and charsets the starting map never uses", () => {
    // Given a blank project whose tileset catalog and resource profiles list unused art.
    const project = createBlankProject();
    // 2026-10-07 저작권 정리 뒤 시작 맵은 버들항이고 배·숲마을 시트는 지워졌다. 기본 DB 의 「쪽배」 배우가 탈것 칩을 실제로
    // 쓰므로(actor_skiff) 탈것 대신 아무도 쓰지 않는 상자 칩·일본 도시 시트를 목록 전용 그림으로 둔다.
    project.resourceProfiles = [
      ...project.resourceProfiles,
      { kind: "chipset", name: "일본 도시", assetId: "tex_jp_city" },
      { kind: "charset", name: "상자", assetId: "tex_easyrpg_charset_object1" },
    ];
    const keys = new Set<string>();

    // When the play preloader queues images.
    loadBundledAssets({
      load: {
        image(key: string) {
          keys.add(key);
        },
        on() {
          return undefined;
        },
      },
    }, project);

    // Then the start map's chipset and the hero charset load, and catalog-only art does not.
    expect(keys.has("tex_beodeul_city")).toBe(true);
    expect(keys.has(rawCharsetTextureKey("tex_easyrpg_charset_actor1"))).toBe(true);
    expect(keys.has("tex_jp_city")).toBe(false);
    expect(keys.has(rawCharsetTextureKey("tex_easyrpg_charset_object1"))).toBe(false);
  });

  it("does not preload field sprites for enemies that are only in the catalog", () => {
    // Given the blank database, whose enemy and species rows name every starter monster.
    const project = createBlankProject();
    const keys = new Set<string>();

    // When the play preloader queues images.
    loadBundledAssets({
      load: {
        image(key: string) {
          keys.add(key);
        },
        on() {
          return undefined;
        },
      },
    }, project);

    // Then no generated field sprite is queued. The blank map has no field spawn.
    expect([...keys].some((key) => key.startsWith("generated-enemy-"))).toBe(false);
  });
});
