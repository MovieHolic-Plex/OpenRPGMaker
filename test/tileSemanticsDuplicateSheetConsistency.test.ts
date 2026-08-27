// 픽셀이 거의 같은 칩셋끼리는 라벨도 거의 같아야 한다.
//
// 왜 이 테스트가 존재하는가 (실측): 번들 칩셋 PNG 를 전수 대조해 보니
// easyrpg-chipset-retro-exterior-transparent.png 와 retro-house-transparent.png 는
// **RGB 차이가 0.4%** 다. 사실상 같은 그림이다. 그런데 출하되던 두 시맨틱 테이블은
// 공통 478칸에서 **role 일치 24.5%, label 일치 0.0%** 였다.
// 같은 그림을 설명하는 두 표가 4분의 3이 어긋난다는 건 최소 하나가 그림을 안 보고 쓰였다는 뜻이다.
// 실제로 같은 픽셀(12~17)을 한쪽은 "갈아엎은 흙밭", 다른 쪽은 "나무 침대 머리"라고 적어 놨고,
// 그림에서는 조석 벽판 위 목조 머리보였다.
//
// 이 불일치는 색·통행성만 보던 기존 감사로는 잡히지 않았다. 두 표를 서로 비교해야만 드러난다.
// 그래서 "중복 시트 간 role 합치도" 를 불변식으로 고정한다. 다시 24% 로 주저앉으면 빨간불이다.
//
// 임계값 70%: 재감사 후 실측 82.0%(출하 24.5%). 100% 를 요구하지 않는 이유가 둘 있다.
//   1) 두 시트가 완전히 같은 그림은 아니다 — 0.4% 픽셀은 실제로 다른 타일이다.
//   2) 판독이 갈린 688칸은 지어내지 않고 기존 라벨을 그대로 두는데, 기존 라벨이 두 표에서
//      서로 다르므로 그만큼은 구조적으로 어긋난 채 남는다.
// 이 테스트가 잡아야 하는 건 미세한 변동이 아니라 24% 수준으로 되돌아가는 붕괴다.
// 그래서 실측값에 딱 붙이지 않고 여유를 둔다.

import fs from "node:fs";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { RETRO_EXTERIOR_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsRetroExterior";
import { RETRO_HOUSE_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsRetroHouse";

const EXTERIOR_PNG = "public/assets/easyrpg-chipset-retro-exterior-transparent.png";
const HOUSE_PNG = "public/assets/easyrpg-chipset-retro-house-transparent.png";

/** 두 시트에서 불투명 픽셀의 RGB 가 다른 비율. 알파만 다른 건 세지 않는다(투명 처리 차이). */
function rgbDifferenceRatio(aPath: string, bPath: string): number {
  const a = PNG.sync.read(fs.readFileSync(aPath));
  const b = PNG.sync.read(fs.readFileSync(bPath));
  expect(a.width).toBe(b.width);
  expect(a.height).toBe(b.height);
  let differing = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    const bothClear = a.data[i + 3]! <= 8 && b.data[i + 3]! <= 8;
    if (bothClear) continue;
    if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) differing += 1;
  }
  return differing / (a.width * a.height);
}

describe("중복 칩셋 시트의 라벨 합치도", () => {
  it("retro_exterior 와 retro_house 는 사실상 같은 그림이다 (전제 확인)", () => {
    const ratio = rgbDifferenceRatio(EXTERIOR_PNG, HOUSE_PNG);
    // 이 전제가 깨지면(시트를 실제로 교체했다면) 아래 합치도 요구는 무효다. 그때는 이 테스트를 다시 설계할 것.
    expect(ratio).toBeLessThan(0.02);
  });

  it("같은 그림이므로 두 테이블의 role 이 70% 이상 일치한다", () => {
    const house = new Map(RETRO_HOUSE_TILE_SEMANTICS.map((e) => [e.index, e]));
    let shared = 0;
    let sameRole = 0;
    const drift: string[] = [];
    for (const ext of RETRO_EXTERIOR_TILE_SEMANTICS) {
      const hou = house.get(ext.index);
      if (!hou) continue;
      shared += 1;
      if (ext.role === hou.role) sameRole += 1;
      else if (drift.length < 12) drift.push(`${ext.index}: exterior=${ext.label}(${ext.role}) house=${hou.label}(${hou.role})`);
    }
    expect(shared).toBeGreaterThan(400);
    const ratio = sameRole / shared;
    expect(
      ratio,
      `같은 그림인데 role 이 ${(100 * ratio).toFixed(1)}% 만 일치한다. 한쪽 표가 그림을 안 보고 쓰였을 수 있다.\n` +
        `어긋난 칸 예시:\n  ${drift.join("\n  ")}`,
    ).toBeGreaterThanOrEqual(0.7);
  });

  it("두 테이블 모두 12~17 을 침대나 흙밭이 아니라 벽으로 본다", () => {
    // 실측 회귀 지점: 이 여섯 칸은 조석/회벽 벽판 위의 목조 머리보다.
    // 3x2 크롭만 보면 2단 침대로 읽히고(PR #86 이 그렇게 읽었다), 아래 4행까지 붙여 보면 벽이다.
    for (const table of [RETRO_EXTERIOR_TILE_SEMANTICS, RETRO_HOUSE_TILE_SEMANTICS]) {
      const byIndex = new Map(table.map((e) => [e.index, e]));
      for (const index of [12, 13, 14, 15, 16, 17]) {
        const entry = byIndex.get(index);
        expect(entry, `${index} 칸이 표에 없다`).toBeDefined();
        expect(entry!.role, `${index} 은 "${entry!.label}"(${entry!.role}) 로 적혀 있다`).toBe("wall");
      }
    }
  });
});
