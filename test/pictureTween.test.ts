import { describe, it, expect } from "vitest";
import {
  DEFAULT_PICTURE_TRANSFORM,
  interpolatePictureTransform,
  pictureCssOpacity,
  pictureCssTransform,
  pictureTransformFromState,
  pictureTransformsEqual,
  pictureZIndex,
  tweenProgress,
} from "@/player/pictures/pictureTween";
import type { PictureState } from "@/project/session";

function state(partial: Partial<PictureState>): PictureState {
  return { pictureId: "pic1", resourceId: "res", x: 0, y: 0, ...partial };
}

describe("pictureTransformFromState", () => {
  it("선택 필드 미지정 시 RM2K3 기본값으로 채운다", () => {
    expect(pictureTransformFromState(state({ x: 10, y: 20 }))).toEqual({
      x: 10,
      y: 20,
      scale: 100,
      opacity: 255,
      rotation: 0,
    });
  });

  it("선택 필드를 반영하고 opacity/scale 을 안전 범위로 클램프한다", () => {
    expect(pictureTransformFromState(state({ scale: -50, opacity: 999, rotation: 45 }))).toEqual({
      x: 0,
      y: 0,
      scale: 0,
      opacity: 255,
      rotation: 45,
    });
  });
});

describe("tweenProgress", () => {
  it("duration<=0 이면 즉시 완료(1)", () => {
    expect(tweenProgress(0, 0)).toBe(1);
    expect(tweenProgress(50, -10)).toBe(1);
  });

  it("경과/지속 비율을 0~1 로 클램프한다", () => {
    expect(tweenProgress(0, 100)).toBe(0);
    expect(tweenProgress(50, 100)).toBe(0.5);
    expect(tweenProgress(200, 100)).toBe(1);
  });
});

describe("interpolatePictureTransform", () => {
  const from = DEFAULT_PICTURE_TRANSFORM;
  const to = { x: 100, y: 200, scale: 200, opacity: 0, rotation: 90 };

  it("t=0 이면 시작값, t=1 이면 목표값", () => {
    expect(interpolatePictureTransform(from, to, 0)).toEqual(from);
    expect(interpolatePictureTransform(from, to, 1)).toEqual(to);
  });

  it("t=0.5 이면 중간값", () => {
    expect(interpolatePictureTransform(from, to, 0.5)).toEqual({
      x: 50,
      y: 100,
      scale: 150,
      opacity: 127.5,
      rotation: 45,
    });
  });

  it("t 범위를 벗어나면 클램프", () => {
    expect(interpolatePictureTransform(from, to, 2)).toEqual(to);
    expect(interpolatePictureTransform(from, to, -1)).toEqual(from);
  });
});

describe("pictureTransformsEqual", () => {
  it("미세 오차는 동일로 취급", () => {
    expect(pictureTransformsEqual(DEFAULT_PICTURE_TRANSFORM, { ...DEFAULT_PICTURE_TRANSFORM, x: 0.0001 })).toBe(true);
    expect(pictureTransformsEqual(DEFAULT_PICTURE_TRANSFORM, { ...DEFAULT_PICTURE_TRANSFORM, x: 5 })).toBe(false);
  });
});

describe("pictureZIndex", () => {
  it("pictureId 끝의 숫자를 z-order 로 사용", () => {
    expect(pictureZIndex("pic1")).toBe(1);
    expect(pictureZIndex("picture_10")).toBe(10);
    expect(pictureZIndex("bg")).toBe(0);
  });
});

describe("CSS 변환", () => {
  it("scale 은 %→배율, rotation 은 deg", () => {
    expect(pictureCssTransform({ x: 0, y: 0, scale: 150, opacity: 255, rotation: 30 })).toBe("scale(1.5) rotate(30deg)");
  });

  it("opacity 는 0~1 로 정규화", () => {
    expect(pictureCssOpacity({ x: 0, y: 0, scale: 100, opacity: 255, rotation: 0 })).toBe(1);
    expect(pictureCssOpacity({ x: 0, y: 0, scale: 100, opacity: 0, rotation: 0 })).toBe(0);
  });
});
