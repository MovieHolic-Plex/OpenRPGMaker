import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { validateProjectReferences } from "@/project/io/references";
import {
  MAP_BACKGROUND_SCROLL_LIMIT,
  normalizeMapBackground,
  normalizeMapBackgroundScroll,
} from "@/project/mapBackground";

/**
 * 맵 배경(파노라마)의 **저작 경계** 계약.
 *
 * 렌더가 붙기 전에는 이 필드를 아무도 읽지 않아 아무 값이나 통과했다. 이제는 없는 그림 id 가
 * 플레이에서 조용히 아무것도 안 그리므로, 로드가 그 사실을 소리 내야 한다. 여기서 잠그는 것은
 * 셋이다: (1) 범위 밖 스크롤은 클램프, (2) 타입이 틀리면 로드 거절, (3) 없는 리소스는 참조 검증
 * 실패 — 단 **빈 imageId 는 참조가 아니다**(「맵 배경 사용」 을 켜고 아직 안 고른 상태).
 */

/** 배경 저작만 얹은 원시 프로젝트 JSON. 로드 게이트를 재려면 타입이 아니라 JSON 이 필요하다. */
function projectJsonWithBackground(background: unknown): string {
  const raw = JSON.parse(serialize(createBlankProject())) as { maps: Record<string, Record<string, unknown>> };
  const mapId = Object.keys(raw.maps)[0]!;
  raw.maps[mapId]!.background = background;
  return JSON.stringify(raw);
}

function backgroundOf(json: string) {
  const project = deserialize(json);
  return project.maps[project.startMapId]?.background;
}

describe("맵 배경 저작 규칙", () => {
  it("스크롤 속도는 상한으로 클램프하고, 수가 아니면 키를 지운다", () => {
    expect(normalizeMapBackgroundScroll(999)).toBe(MAP_BACKGROUND_SCROLL_LIMIT);
    expect(normalizeMapBackgroundScroll(-999)).toBe(-MAP_BACKGROUND_SCROLL_LIMIT);
    expect(normalizeMapBackgroundScroll(2.5)).toBe(2.5);
    // 0 은 저작값(정지)이다 — 지우면 옛 JSON 이 바이트 그대로 유지되지 않는다.
    expect(normalizeMapBackgroundScroll(0)).toBe(0);
    expect(normalizeMapBackgroundScroll(Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(normalizeMapBackgroundScroll(Number.NaN)).toBeUndefined();
    expect(normalizeMapBackgroundScroll("2")).toBeUndefined();
    expect(normalizeMapBackgroundScroll(undefined)).toBeUndefined();
  });

  it("빈 imageId 는 «켜 두고 아직 안 고른» 저작 상태다 — 지우지 않는다", () => {
    expect(normalizeMapBackground({ imageId: "  ", scrollX: 0, scrollY: 0 })).toEqual({
      imageId: "",
      scrollX: 0,
      scrollY: 0,
    });
    // 반대로 imageId 자체가 없거나 타입이 틀리면 저작이 아니다.
    expect(normalizeMapBackground({ scrollX: 1 })).toBeUndefined();
    expect(normalizeMapBackground({ imageId: 5 })).toBeUndefined();
    expect(normalizeMapBackground(null)).toBeUndefined();
    expect(normalizeMapBackground([{ imageId: "x" }])).toBeUndefined();
  });

  it("모르는 키는 버리고 아는 키만 남긴다", () => {
    expect(normalizeMapBackground({ imageId: "bg", scrollX: 4, scrollY: -1, opacity: 0.5 })).toEqual({
      imageId: "bg",
      scrollX: 4,
      scrollY: -1,
    });
  });
});

describe("맵 배경 로드 게이트", () => {
  it("범위 밖 스크롤은 로드에서 잘린다", () => {
    expect(backgroundOf(projectJsonWithBackground({ imageId: "easyrpg-backdrop-sky1", scrollX: 999, scrollY: -0.5 })))
      .toEqual({ imageId: "easyrpg-backdrop-sky1", scrollX: MAP_BACKGROUND_SCROLL_LIMIT, scrollY: -0.5 });
  });

  it("imageId 가 문자열이 아니면 로드를 거절한다", () => {
    expect(() => deserialize(projectJsonWithBackground({ imageId: 5 }))).toThrow();
  });

  it("스크롤 속도가 수가 아니면 로드를 거절한다", () => {
    expect(() => deserialize(projectJsonWithBackground({ imageId: "easyrpg-backdrop-sky1", scrollX: "2" }))).toThrow();
  });

  it("빈 상태의 바이트는 그대로 유지된다(스키마 버전 상승 없이 자란다)", () => {
    const raw = projectJsonWithBackground({ imageId: "", scrollX: 0, scrollY: 0 });
    expect(serialize(deserialize(raw))).toBe(raw);
  });
});

describe("맵 배경 참조 검증", () => {
  it("없는 배경 리소스는 로드에서 걸린다", () => {
    // 참조 검증은 `deserialize` 안에서 돈다(validateProjectV4 → validateProjectReferences).
    expect(() => deserialize(projectJsonWithBackground({ imageId: "no-such-backdrop" })))
      .toThrow(/background\.imageId/);
  });

  it("빈 imageId 는 참조가 아니라서 통과한다", () => {
    expect(() => deserialize(projectJsonWithBackground({ imageId: "", scrollX: 0, scrollY: 0 }))).not.toThrow();
  });

  it("실재하는 배경 id 는 통과한다", () => {
    const project = deserialize(projectJsonWithBackground({ imageId: "easyrpg-backdrop-sky1" }));
    expect(() => validateProjectReferences(project)).not.toThrow();
  });
});
