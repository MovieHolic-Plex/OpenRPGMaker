// 렌더된 그림을 실제로 보고 판정한 사실만 단정한다.
//
// 왜 이 테스트가 존재하는가: 이 시트들의 라벨은 두 번 틀렸고, 두 번 다 기존 게이트를 통과했다.
//
// 1차 오류(PR #81) — 판독자가 타일을 볼 수 없었다. 샤드 shard-retro_exterior-08-11 은
//   카테고리 unspecified-low 로 갔고 그 1순위 모델(cliproxy/deepseek-v4-flash-0731)은 비전이 없다.
//   그 샤드는 완료 보고에 "the model couldn't render them as images" 라 적고 픽셀 통계로
//   119칸을 추론했다. audit-tile-semantics-grounding.mts 는 색·통행성 모순만 보므로
//   "가구를 벽이라 부르는" 종류를 원리적으로 못 잡고 위반 2/2856 으로 통과시켰다.
//
// 2차 오류(PR #86) — 교정하던 내가 3x2 크롭만 보고 아래 행을 잘라냈다. retro_house 12-17 을
//   "나무 침대"+role=furniture 로 바꿨는데, 10배 확대 + 아래 4행 맥락으로 보면 그 여섯 칸은
//   건물 벽 상단 목재 머리보이고 아래로 42-44/72-74=분홍 조석 벽판, 45-47/75-77=크림 회벽판이
//   아치로 이어진다. 침대가 아니다. #86 의 "roof slot now resolves to 42-44" 도 같은 이유로 틀렸다.
//   증거: .omo/evidence/tile-reaudit/vision-probe/house-cols10-19-rows0-4.png
//
// 그래서 이 테스트는 "라벨 문구"가 아니라 **그림이 반증한 주장**만 못 박는다. 문구 자체를
// 고정하면 저작 자유를 죽이고 동어반복이 된다. 반증 가능한 명제만 단정한다.

import { describe, expect, it } from "vitest";
import { RETRO_EXTERIOR_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsRetroExterior";
import { RETRO_HOUSE_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsRetroHouse";

interface Entry {
  readonly index: number;
  readonly label: string;
  readonly role: string;
  readonly passage: "passable" | "solid";
  readonly tags: readonly string[];
}

function at(table: readonly Entry[], index: number): Entry {
  const found = table.find((entry) => entry.index === index);
  expect(found, `인덱스 ${index} 엔트리가 있어야 한다`).toBeDefined();
  return found!;
}

describe("retro_house 12-17 — 벽 상단 머리보이고 침대가 아니다", () => {
  const BEAM_SLOTS = [12, 13, 14, 15, 16, 17] as const;

  it.each(BEAM_SLOTS)("타일 %i 를 가구로 부르지 않는다", (index) => {
    const entry = at(RETRO_HOUSE_TILE_SEMANTICS, index);
    // 아래로 벽판이 이어지므로 이 칸은 벽 구조의 일부다. 독립 가구가 아니다.
    expect(entry.role).not.toBe("furniture");
  });

  it.each(BEAM_SLOTS)("타일 %i 라벨이 침대를 주장하지 않는다", (index) => {
    const entry = at(RETRO_HOUSE_TILE_SEMANTICS, index);
    expect(entry.label).not.toContain("침대");
    expect(entry.tags.join(" ")).not.toContain("침대");
  });

  it("42-44 는 지붕이 아니라 벽판이다 — #86 의 roof 재배정도 틀렸다", () => {
    for (const index of [42, 43, 44]) {
      const entry = at(RETRO_HOUSE_TILE_SEMANTICS, index);
      expect(entry.role, `타일 ${index} 는 분홍 조석 벽판이다`).not.toBe("roof");
    }
  });
});

describe("retro_exterior 179 — 금빛 문장 든 붉은 깃발이고 지붕이 아니다", () => {
  it("179 를 지붕으로 부르지 않는다", () => {
    const entry = at(RETRO_EXTERIOR_TILE_SEMANTICS, 179);
    // 179 는 5행 29열(맨 오른쪽 끝)이라 180·181 은 다음 행으로 넘어가 이웃이 아니다.
    // 아래 209 와 이어져 제비꼬리 하단이 드러난다 = 깃발/페넌트.
    expect(entry.role).not.toBe("roof");
    expect(entry.label).not.toContain("지붕");
    expect(entry.label).not.toContain("처마");
  });

  it("179 와 209 가 같은 깃발의 위아래로 읽힌다", () => {
    const top = at(RETRO_EXTERIOR_TILE_SEMANTICS, 179);
    const bottom = at(RETRO_EXTERIOR_TILE_SEMANTICS, 209);
    expect(`${top.label} ${top.tags.join(" ")}`).toContain("깃발");
    expect(`${bottom.label} ${bottom.tags.join(" ")}`).toContain("깃발");
  });
});
