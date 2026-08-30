import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import nodePath from "node:path";

import { loadFrames } from "../scripts/asset-gen/select-battler-idle-window.mjs";
import {
  CONTRACT,
  cellChange,
  colorShares,
  frameChange,
  relativeDeviation,
  scoreStrip,
  subjectBox,
} from "../scripts/asset-gen/battlerIdleMetrics.mjs";

/**
 * 지표 정본(`scripts/asset-gen/battlerIdleMetrics.mjs`)의 회귀 계약.
 *
 * 왜 필요한가 — 창 선택기가 프레임 비교를 자체 구현했다가 버그를 냈다. 두 프레임을 폭 2배
 * 이미지에 붙이면서 행 스트라이드를 어긋나게 해, 사전 필터가 **모든 창을 모션 만점**으로 봤다
 * (1509개 후보 중 모션 탈락 0개). 실제 패커로 재채점해서야 0.00% 로 드러났다. 위키 함정
 * 목록에 적는 것만으로는 재발을 막지 못한다 — 그건 래칫이 아니다.
 */

/** 단색 프레임. */
function solid(width: number, height: number, rgba: [number, number, number, number]): PNG {
  const png = new PNG({ width, height });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = rgba[0];
    png.data[i + 1] = rgba[1];
    png.data[i + 2] = rgba[2];
    png.data[i + 3] = rgba[3];
  }
  return png;
}

/**
 * **행마다 다른** 그림. 행 스트라이드 버그를 잡으려면 이런 픽스처여야 한다.
 *
 * 실측 교훈: 처음엔 "왼쪽 절반만 칠한" 픽스처를 썼는데 **모든 행이 같아서**, 행 스트라이드가
 * 어긋나도 같은 그림끼리는 여전히 0 이 나올 수 있었다. 행 불변 이미지로는 행 오프셋 오류를
 * 못 잡는다 — 대각선으로 값이 바뀌게 만든다.
 */
function diagonal(width: number, height: number): PNG {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      // 행과 열이 모두 값에 들어가야 행이 밀렸을 때 값이 달라진다.
      png.data[i] = (x * 7 + y * 53) % 256;
      png.data[i + 1] = (y * 31) % 256;
      png.data[i + 2] = (x * 13) % 256;
      png.data[i + 3] = 255;
    }
  }
  return png;
}

/** 왼쪽 절반만 칠한 프레임 — 알려진 비율의 차이를 만들기 위해. */
function halfFilled(width: number, height: number, rgba: [number, number, number, number]): PNG {
  const png = solid(width, height, [0, 0, 0, 0]);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width / 2; x += 1) {
      const i = (y * width + x) * 4;
      png.data[i] = rgba[0];
      png.data[i + 1] = rgba[1];
      png.data[i + 2] = rgba[2];
      png.data[i + 3] = rgba[3];
    }
  }
  return png;
}

describe("배틀러 idle 지표 정본", () => {
  it("같은 그림끼리는 변화가 0 이다 (sanity — 이 테스트만으로는 밀림을 못 잡는다)", () => {
    // `frameChange` 는 두 버퍼를 `i += 4` 로 나란히 훑는다. 그래서 **같은 그림 두 장**은
    // 픽스처 모양과 무관하게 항상 0 이고, 양쪽에 같은 오프셋을 넣는 대칭 버그도 0 이다.
    // 즉 이건 밀림 래칫이 아니라 선형 비교의 sanity 다 — 밀림을 실제로 잡는 것은 아래
    // "행이 한 줄 밀린 그림" 과 "frameChange 와 cellChange 가 같은 임계값" 두 개다.
    expect(frameChange(diagonal(40, 30), diagonal(40, 30))).toBe(0);
  });

  it("행이 한 줄 밀린 그림은 변화가 0 이 아니다 — 밀림을 실제로 감지한다", () => {
    const base = diagonal(40, 30);
    const shifted = new PNG({ width: 40, height: 30 });
    // base 의 행 1..29 를 0..28 로 올려 붙인다 = 한 행 밀림.
    for (let y = 0; y < 29; y += 1) {
      base.data.copy(shifted.data, y * 40 * 4, (y + 1) * 40 * 4, (y + 2) * 40 * 4);
    }
    base.data.copy(shifted.data, 29 * 40 * 4, 0, 40 * 4);
    expect(frameChange(base, shifted)).toBeGreaterThan(0.5);
  });

  it("전체가 바뀌면 변화가 1 이다 — 비율이 실제 픽셀 수와 맞는다", () => {
    const before = solid(40, 30, [0, 0, 0, 255]);
    const after = halfFilled(40, 30, [255, 255, 255, 255]);
    // 왼쪽 절반은 검정→흰색(채널합 차 765 > 임계 24), 오른쪽 절반은 알파 255→0.
    // 양쪽 모두 임계를 넘으므로 1 이다 — 제목과 단언이 어긋나지 않게 적는다.
    expect(frameChange(before, after)).toBe(1);
  });

  it("크기가 다른 프레임을 비교하려 하면 조용히 넘기지 않고 던진다", () => {
    expect(() => frameChange(solid(10, 10, [0, 0, 0, 255]), solid(10, 12, [0, 0, 0, 255]))).toThrow(
      /프레임 크기가 다르다/
    );
  });

  it("frameChange 와 cellChange 가 같은 값을 낸다 — 스트립 주소가 칸 폭으로 밀리면 깨진다", () => {
    // 같은 두 그림을 (a) 두 장으로, (b) 한 스트립의 두 칸으로 주면 같은 값이 나와야 한다.
    const left = diagonal(20, 20);
    const right = solid(20, 20, [10, 200, 10, 255]);
    const strip = new PNG({ width: 40, height: 20 });
    PNG.bitblt(left, strip, 0, 0, 20, 20, 0, 0);
    PNG.bitblt(right, strip, 0, 0, 20, 20, 20, 0);
    expect(frameChange(left, right)).toBeCloseTo(cellChange(strip, 0, 1, 20, 20), 10);
  });

  it("상대편차는 원본에서 지분이 작은 성분을 제외한다 — 0 나눗셈을 만들지 않는다", () => {
    const reference = [0.5, 0.001, 0, 0, 0, 0, 0.4];
    const frame = [0.5, 0.9, 0, 0, 0, 0, 0.4];
    // 두 번째 성분은 원본 지분 0.1% 로 presenceFloor 아래라 무시된다.
    expect(relativeDeviation(frame, reference)).toBe(0);
    expect(CONTRACT.presenceFloor).toBeGreaterThan(0.001);
  });

  it("투명한 칸은 지분이 전부 0 이다 — 빈 칸이 통과 점수를 받지 않는다", () => {
    const empty = solid(20, 20, [0, 0, 0, 0]);
    expect(colorShares(empty, 0, 20, 20).every((share) => share === 0)).toBe(true);
    expect(subjectBox(empty, 0, 20, 20).bottom).toBe(-1);
  });

  it("scoreStrip 이 정지 화면을 모션 위반으로 잡는다", () => {
    // 8칸이 전부 같은 그림인 스트립. 색·머리·이음매는 완벽하지만 숨을 쉬지 않는다.
    const cell = halfFilled(20, 20, [10, 200, 10, 255]);
    const strip = new PNG({ width: 20 * 8, height: 20 });
    for (let i = 0; i < 8; i += 1) PNG.bitblt(cell, strip, 0, 0, 20, 20, i * 20, 0);
    const score = scoreStrip(strip, cell, 20, 20, 8);
    expect(score.passes).toBe(false);
    expect(score.failures.join(" ")).toMatch(/모션/);
    expect(score.minStep).toBe(0);
  });

  it("프레임 인덱스는 파일명의 마지막 숫자 묶음이다 — 슬러그의 숫자를 이어 붙이지 않는다", () => {
    // 실측 버그: 숫자를 전부 이어 붙여 `hero-04-f091.png` 가 4091 이 됐다. 그러면 창 탐색이
    // 존재하지 않는 인덱스를 찾아 아무 후보도 못 만든다.
    const dir = mkdtempSync(nodePath.join(tmpdir(), "frames-"));
    try {
      const png = new PNG({ width: 4, height: 4 });
      for (const name of ["hero-04-f091.png", "hero-04-f092.png"]) {
        writeFileSync(nodePath.join(dir, name), PNG.sync.write(png));
      }
      expect([...loadFrames(dir).keys()].sort((a, b) => a - b)).toEqual([91, 92]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
