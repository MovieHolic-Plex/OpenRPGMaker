import { describe, expect, it } from "vitest";

import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";

/**
 * PR #298 병합 시 고친 차단 결함 2건의 계약.
 *
 * 1) `validateProjectV4` 가 사용자 저작 마을 배열을 전혀 검증하지 않았다. 잘못된 값이 조용히
 *    로드된 뒤 「마을」탭을 열거나 시공기가 읽는 순간 TypeError 로 죽는다 — 사용자는 "저장은
 *    됐는데 열면 죽는 프로젝트" 를 갖게 되고 어디가 문제인지 알 수 없다.
 * 2) 프리셋 + 명시 templateId 조합이 하드 실패였다. 문서는 "명시 인자 > 프리셋" 이라 적어 두고
 *    코드는 반대로 굴었다.
 */

function withVillage(patch: Record<string, unknown>): string {
  const project = createBlankProject() as unknown as Record<string, unknown>;
  Object.assign(project, patch);
  return JSON.stringify(JSON.parse(serialize(project as never)));
}

const OK_TEMPLATE = {
  id: "vt_cottage",
  name: "오두막",
  w: 6,
  h: 5,
  wings: [{ x: 0, y: 0, w: 6, h: 5 }],
};

describe("저작된 마을 형태는 로드 경계에서 검사된다", () => {
  it("정상 형태와 프리셋은 통과한다", () => {
    const raw = withVillage({
      villageTemplates: [OK_TEMPLATE],
      villagePresets: [{ id: "vp_a", name: "강변", houseCount: 8, templateIds: ["vt_cottage"] }],
    });
    expect(() => deserialize(raw)).not.toThrow();
  });

  // w/h 가 0 이거나 음수면 후보 슬롯 필터가 영원히 못 찾거나 음수 폭으로 맵 밖을 쓴다.
  it("폭이 0 인 형태를 막는다", () => {
    expect(() => deserialize(withVillage({ villageTemplates: [{ ...OK_TEMPLATE, w: 0 }] }))).toThrow(
      /villageTemplates\[0\]\.w/,
    );
  });

  it("정수가 아닌 높이를 막는다", () => {
    expect(() => deserialize(withVillage({ villageTemplates: [{ ...OK_TEMPLATE, h: 3.5 }] }))).toThrow(
      /villageTemplates\[0\]\.h/,
    );
  });

  // 날개가 비면 집이 아니다 — 전개 함수가 빈 사각형 목록으로 문 판정을 하다 죽는다.
  it("날개가 빈 형태를 막는다", () => {
    expect(() => deserialize(withVillage({ villageTemplates: [{ ...OK_TEMPLATE, wings: [] }] }))).toThrow(
      /villageTemplates\[0\]\.wings/,
    );
  });

  it("날개 사각형의 폭이 0 이면 막는다", () => {
    const bad = { ...OK_TEMPLATE, wings: [{ x: 0, y: 0, w: 0, h: 5 }] };
    expect(() => deserialize(withVillage({ villageTemplates: [bad] }))).toThrow(/wings\[0\]\.w/);
  });

  it("층수가 유니온 밖이면 막는다", () => {
    expect(() => deserialize(withVillage({ villageTemplates: [{ ...OK_TEMPLATE, stories: 7 }] }))).toThrow(
      /stories/,
    );
  });

  it("이름이 문자열이 아니면 막는다", () => {
    expect(() => deserialize(withVillage({ villageTemplates: [{ ...OK_TEMPLATE, name: 42 }] }))).toThrow(
      /villageTemplates\[0\]\.name/,
    );
  });

  it("형태 자체가 객체가 아니면 막는다", () => {
    expect(() => deserialize(withVillage({ villageTemplates: ["cottage"] }))).toThrow(/villageTemplates\[0\]/);
  });
});

describe("저작된 마을 프리셋은 로드 경계에서 검사된다", () => {
  it("집 수가 범위를 벗어나면 막는다", () => {
    const raw = withVillage({ villagePresets: [{ id: "vp_a", name: "강변", houseCount: 0 }] });
    expect(() => deserialize(raw)).toThrow(/houseCount/);
  });

  it("도로 폭이 범위를 벗어나면 막는다", () => {
    const raw = withVillage({ villagePresets: [{ id: "vp_a", name: "강변", roadWidth: 9 }] });
    expect(() => deserialize(raw)).toThrow(/roadWidth/);
  });

  // 없는 형태를 가리키면 카탈로그가 통째로 걸러져 후보가 0 이 되고 시공기가 이유 없이 중단한다.
  it("없는 형태 id 를 가리키면 막는다", () => {
    const raw = withVillage({
      villageTemplates: [OK_TEMPLATE],
      villagePresets: [{ id: "vp_a", name: "강변", templateIds: ["vt_missing"] }],
    });
    expect(() => deserialize(raw)).toThrow(/vt_missing/);
  });

  it("문자열 자리에 숫자가 오면 막는다", () => {
    const raw = withVillage({ villagePresets: [{ id: "vp_a", name: "강변", pathStyle: 3 }] });
    expect(() => deserialize(raw)).toThrow(/pathStyle/);
  });
});
