import { describe, expect, it } from "vitest";
import {
  CLOUD_SHADOW_BLOB_COUNT,
  CLOUD_SHADOW_DEFAULTS,
  CLOUD_SHADOW_OPACITY_RANGE,
  CLOUD_SHADOW_SCALE_RANGE,
  CLOUD_SHADOW_SPEED_RANGE,
  cloudShadowAnchors,
  cloudShadowBlobs,
  cloudShadowDrift,
  cloudShadowPeriod,
  normalizeCloudShadowParams,
  type CloudShadowBlob,
  type CloudShadowParams,
} from "@/player/cloudShadows";

const VIEW = { x: 0, y: 0, width: 960, height: 720 };

function params(overrides: Partial<CloudShadowParams> = {}): CloudShadowParams {
  return { ...normalizeCloudShadowParams({ enabled: true }), ...overrides };
}

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function positionKey(x: number, y: number): string {
  return `${Math.round(x * 100) / 100}|${Math.round(y * 100) / 100}`;
}
describe("normalizeCloudShadowParams", () => {
  it("설정이 없으면 기본값 + 꺼짐", () => {
    expect(normalizeCloudShadowParams(undefined)).toEqual({ enabled: false, ...CLOUD_SHADOW_DEFAULTS });
  });

  it("enabled 만 있으면 나머지는 기본값", () => {
    expect(normalizeCloudShadowParams({ enabled: true })).toEqual({ enabled: true, ...CLOUD_SHADOW_DEFAULTS });
  });

  it("범위 밖 수치는 범위로 접는다", () => {
    const wild = normalizeCloudShadowParams({
      enabled: true,
      opacity: 5,
      speed: -20,
      angleDeg: 400,
      scale: 99,
    });
    expect(wild.opacity).toBe(CLOUD_SHADOW_OPACITY_RANGE.max);
    expect(wild.speed).toBe(CLOUD_SHADOW_SPEED_RANGE.min);
    expect(wild.angleDeg).toBe(40);
    expect(wild.scale).toBe(CLOUD_SHADOW_SCALE_RANGE.max);

    const floor = normalizeCloudShadowParams({ enabled: true, opacity: -3, speed: 900, scale: 0 });
    expect(floor.opacity).toBe(CLOUD_SHADOW_OPACITY_RANGE.min);
    expect(floor.speed).toBe(CLOUD_SHADOW_SPEED_RANGE.max);
    expect(floor.scale).toBe(CLOUD_SHADOW_SCALE_RANGE.min);
  });

  it("각도는 360도로 접고 NaN/무한대는 기본값으로 되돌린다", () => {
    expect(normalizeCloudShadowParams({ enabled: true, angleDeg: -90 }).angleDeg).toBe(270);
    expect(normalizeCloudShadowParams({ enabled: true, angleDeg: Number.NaN }).angleDeg).toBe(CLOUD_SHADOW_DEFAULTS.angleDeg);
    expect(normalizeCloudShadowParams({ enabled: true, speed: Number.POSITIVE_INFINITY }).speed).toBe(CLOUD_SHADOW_SPEED_RANGE.max);
  });
});

describe("cloudShadowDrift", () => {
  it("꺼져 있으면 흐르지 않는다", () => {
    expect(cloudShadowDrift(normalizeCloudShadowParams(undefined), 5000)).toEqual({ dx: 0, dy: 0 });
  });

  it("방향 0도 = 오른쪽, 90도 = 아래, 속도는 px/초", () => {
    expect(cloudShadowDrift(params({ speed: 40, angleDeg: 0 }), 1000)).toEqual({ dx: 40, dy: 0 });
    const down = cloudShadowDrift(params({ speed: 40, angleDeg: 90 }), 1000);
    expect(down.dx).toBeCloseTo(0, 6);
    expect(down.dy).toBeCloseTo(40, 6);
    const left = cloudShadowDrift(params({ speed: 30, angleDeg: 180 }), 1000);
    expect(left.dx).toBeCloseTo(-30, 6);
    expect(left.dy).toBeCloseTo(0, 6);
  });

  it("경과 시간에 비례한다", () => {
    const half = cloudShadowDrift(params({ speed: 40, angleDeg: 0 }), 500);
    const full = cloudShadowDrift(params({ speed: 40, angleDeg: 0 }), 1000);
    expect(half.dx).toBeCloseTo(full.dx / 2, 6);
    expect(cloudShadowDrift(params({ speed: 40, angleDeg: 0 }), 0)).toEqual({ dx: 0, dy: 0 });
  });
});

describe("cloudShadowPeriod", () => {
  it("화면을 덮고, 크기 배율에 비례한다", () => {
    const base = cloudShadowPeriod(VIEW, 1);
    expect(base).toBeGreaterThanOrEqual(VIEW.width);
    expect(cloudShadowPeriod(VIEW, 2)).toBe(base * 2);
    expect(cloudShadowPeriod(VIEW, 0.5)).toBe(Math.round(base * 0.5));
  });
});

describe("cloudShadowBlobs", () => {
  it("꺼져 있거나 진하기가 0이면 덩어리가 없다", () => {
    expect(cloudShadowBlobs(normalizeCloudShadowParams(undefined), 0, VIEW)).toEqual([]);
    expect(cloudShadowBlobs(params({ opacity: 0 }), 0, VIEW)).toEqual([]);
  });

  it("화면을 덮는 덩어리를 만들고 전부 화면과 겹친다", () => {
    const blobs = cloudShadowBlobs(params(), 0, VIEW);
    // 배치(12개) 중 일부는 화면 밖이라 보이는 덩어리는 그보다 적다 — 0이 아닌 «덮임» 이 계약이다.
    expect(blobs.length).toBeGreaterThanOrEqual(4);
    for (const blob of blobs) {
      expect(blob.x + blob.radius).toBeGreaterThanOrEqual(VIEW.x);
      expect(blob.x - blob.radius).toBeLessThanOrEqual(VIEW.x + VIEW.width);
      expect(blob.y + blob.radius).toBeGreaterThanOrEqual(VIEW.y);
      expect(blob.y - blob.radius).toBeLessThanOrEqual(VIEW.y + VIEW.height);
    }
  });

  it("덩어리 모양·알파는 계약 범위 안이다", () => {
    const setting = params({ opacity: 0.4 });
    for (const blob of cloudShadowBlobs(setting, 0, VIEW)) {
      expect(blob.radius).toBeGreaterThan(0);
      expect(blob.alpha).toBeGreaterThan(0);
      expect(blob.alpha).toBeLessThanOrEqual(setting.opacity);
      expect(blob.squash).toBeGreaterThan(0);
      expect(blob.squash).toBeLessThanOrEqual(1);
      expect(blob.rotationDeg).toBeGreaterThanOrEqual(0);
      expect(blob.rotationDeg).toBeLessThan(360);
    }
  });

  it("같은 입력은 언제나 같은 그림자를 만든다", () => {
    const first = JSON.stringify(cloudShadowBlobs(params({ scale: 1.5 }), 4321, VIEW, 11));
    const second = JSON.stringify(cloudShadowBlobs(params({ scale: 1.5 }), 4321, VIEW, 11));
    expect(second).toBe(first);
  });

  it("시드가 다르면 배치가 다르다", () => {
    const a = JSON.stringify(cloudShadowBlobs(params(), 0, VIEW, 1));
    const b = JSON.stringify(cloudShadowBlobs(params(), 0, VIEW, 2));
    expect(a).not.toBe(b);
  });

  it("1초 뒤 모든 구름 위상이 설정한 방향·속도만큼 정확히 이동한다(주기 접힘 포함)", () => {
    const setting = params({ speed: 40, angleDeg: 90, scale: 1 });
    const period = cloudShadowPeriod(VIEW, setting.scale);
    const drift = cloudShadowDrift(setting, 1000);
    const before = cloudShadowAnchors(setting, 0, period, 7);
    const after = cloudShadowAnchors(setting, 1000, period, 7);

    expect(before).toHaveLength(CLOUD_SHADOW_BLOB_COUNT);
    expect(after).toHaveLength(before.length);
    for (let index = 0; index < before.length; index += 1) {
      expect(after[index]!.x).toBeCloseTo(mod(before[index]!.x + drift.dx, period), 3);
      expect(after[index]!.y).toBeCloseTo(mod(before[index]!.y + drift.dy, period), 3);
    }
  });

  it("보이는 덩어리는 전부 위상 위에 있다", () => {
    const setting = params({ speed: 40, angleDeg: 90, scale: 1 });
    const period = cloudShadowPeriod(VIEW, setting.scale);
    const phases = new Set(cloudShadowAnchors(setting, 1000, period, 7).map((anchor) => positionKey(anchor.x, anchor.y)));
    const blobs = cloudShadowBlobs(setting, 1000, VIEW, 7);
    expect(blobs.length).toBeGreaterThan(0);
    for (const blob of blobs) {
      expect(phases.has(positionKey(mod(blob.x, period), mod(blob.y, period)))).toBe(true);
    }
  });

  it("속도 0이면 1초 뒤에도 제자리다", () => {
    const setting = params({ speed: 0 });
    const period = cloudShadowPeriod(VIEW, setting.scale);
    expect(cloudShadowAnchors(setting, 1000, period, 3)).toEqual(cloudShadowAnchors(setting, 0, period, 3));
  });

  it("카메라가 움직여도 그림자는 땅에 붙어 있다 — 월드 위상이 카메라와 무관하다", () => {
    const setting = params({ speed: 24, angleDeg: 28, scale: 1 });
    const span = { x: 0, y: 0, width: 2200, height: 2200 };
    const period = cloudShadowPeriod(span, setting.scale);
    const origin = cloudShadowBlobs(setting, 0, span, 5);
    // 카메라를 정확히 한 주기(가로 1·세로 3) 옮기면 «같은 구름» 이 보여야 한다.
    const shifted = cloudShadowBlobs(setting, 0, { ...span, x: period, y: period * 3 }, 5);
    const unwrap = new Set(shifted.map((blob) => positionKey(blob.x - period, blob.y - period * 3)));
    expect(origin.length).toBeGreaterThan(0);
    expect(shifted.length).toBe(origin.length);
    expect(unwrap).toEqual(new Set(origin.map((blob) => positionKey(blob.x, blob.y))));
  });

  it("크기 배율을 키우면 덩어리가 커진다", () => {
    const small = cloudShadowBlobs(params({ scale: 0.5 }), 0, VIEW, 9);
    const large = cloudShadowBlobs(params({ scale: 2.5 }), 0, VIEW, 9);
    const maxRadius = (blobs: readonly CloudShadowBlob[]): number => Math.max(...blobs.map((blob) => blob.radius));
    expect(maxRadius(large)).toBeGreaterThan(maxRadius(small));
  });
});
