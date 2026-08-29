// 발자국 필드의 로드 시점 검증 — 2차 스펙 §6.
//
// 왕복(serialize/deserialize)은 JSON.stringify 전체 직렬화라 이미 보존됐다. 빠져 있던 것은
// **검증**이다. `footprint: {width: -5}` 가 로드 검증을 통과해 런타임 정규화만이 막고 있었고,
// 그래서 작성자는 자기 프로젝트가 왜 1x1 로 보이는지 알 방법이 없었다.

import { describe, expect, it } from "vitest";
import { ProjectFormatError, deserialize, serialize } from "@/project/io";
import { createBlankProject } from "@/project/defaults";
import type { EventPage, Project } from "@/project/types";

function projectWithPage(overrides: Partial<EventPage>): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  map.events = [
    {
      id: "ev_golem",
      x: 5,
      y: 7,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: "p1",
          name: "골렘",
          conditions: [],
          graphic: {},
          trigger: { kind: "action" },
          priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [],
          ...overrides,
        },
      ],
    },
  ];
  return project;
}

/** 타입을 우회해 손으로 고친 JSON 을 흉내낸다 — 로드 검증이 막아야 하는 입력이다. */
function loadWithRawPage(raw: Record<string, unknown>): Project {
  const project = projectWithPage({});
  const text = serialize(project);
  const parsed = JSON.parse(text) as {
    maps: Record<string, { events: { pages: Record<string, unknown>[] }[] }>;
  };
  const page = parsed.maps[project.startMapId]!.events[0]!.pages[0]!;
  Object.assign(page, raw);
  return deserialize(JSON.stringify(parsed));
}

describe("발자국 왕복", () => {
  it("몸 크기·통행 행·배율이 그대로 복원된다", () => {
    const project = projectWithPage({
      footprint: { width: 3, height: 3 },
      passRows: 1,
      graphic: { scale: 3 },
    });
    const page = deserialize(serialize(project)).maps[project.startMapId]!.events[0]!.pages![0]!;
    expect(page.footprint).toEqual({ width: 3, height: 3 });
    expect(page.passRows).toBe(1);
    expect(page.graphic.scale).toBe(3);
  });

  it("발자국 없는 페이지는 필드가 생기지 않는다(항등)", () => {
    const project = projectWithPage({});
    const page = deserialize(serialize(project)).maps[project.startMapId]!.events[0]!.pages![0]!;
    expect(page.footprint).toBeUndefined();
    expect(page.passRows).toBeUndefined();
    expect(page.graphic.scale).toBeUndefined();
  });
});

describe("로드 검증 — 몸 크기", () => {
  it("음수 축을 거부한다 — 예전에는 통과해서 런타임 정규화만이 막았다", () => {
    expect(() => loadWithRawPage({ footprint: { width: -5, height: 3 } })).toThrow(ProjectFormatError);
  });

  it("0 과 8 초과를 거부한다", () => {
    expect(() => loadWithRawPage({ footprint: { width: 0, height: 1 } })).toThrow(ProjectFormatError);
    expect(() => loadWithRawPage({ footprint: { width: 9, height: 1 } })).toThrow(ProjectFormatError);
  });

  it("정수가 아닌 축을 거부한다", () => {
    expect(() => loadWithRawPage({ footprint: { width: 2.5, height: 1 } })).toThrow(ProjectFormatError);
  });

  it("축이 문자열이면 거부한다", () => {
    expect(() => loadWithRawPage({ footprint: { width: "3", height: 3 } })).toThrow(ProjectFormatError);
  });

  it("1..8 경계는 받는다", () => {
    expect(() => loadWithRawPage({ footprint: { width: 1, height: 1 } })).not.toThrow();
    expect(() => loadWithRawPage({ footprint: { width: 8, height: 8 } })).not.toThrow();
  });
});

describe("로드 검증 — 통행 행", () => {
  it("몸 높이를 넘는 통행 행을 거부한다", () => {
    expect(() => loadWithRawPage({ footprint: { width: 3, height: 2 }, passRows: 3 }))
      .toThrow(ProjectFormatError);
  });

  it("0 이하를 거부한다", () => {
    expect(() => loadWithRawPage({ footprint: { width: 3, height: 3 }, passRows: 0 }))
      .toThrow(ProjectFormatError);
    expect(() => loadWithRawPage({ footprint: { width: 3, height: 3 }, passRows: -1 }))
      .toThrow(ProjectFormatError);
  });

  it("몸 크기 없이 통행 행만 있으면 1 만 허용한다 — 몸 높이가 1 이므로", () => {
    expect(() => loadWithRawPage({ passRows: 1 })).not.toThrow();
    expect(() => loadWithRawPage({ passRows: 2 })).toThrow(ProjectFormatError);
  });

  it("1..몸 높이 경계는 받는다", () => {
    expect(() => loadWithRawPage({ footprint: { width: 1, height: 3 }, passRows: 1 })).not.toThrow();
    expect(() => loadWithRawPage({ footprint: { width: 1, height: 3 }, passRows: 3 })).not.toThrow();
  });
});

describe("로드 검증 — 배율", () => {
  it("0 과 음수를 거부한다", () => {
    expect(() => loadWithRawPage({ graphic: { scale: 0 } })).toThrow(ProjectFormatError);
    expect(() => loadWithRawPage({ graphic: { scale: -2 } })).toThrow(ProjectFormatError);
  });

  it("범위를 넘는 배율을 거부한다 — 조용히 8 로 잘리면 저장값과 화면이 어긋난다", () => {
    expect(() => loadWithRawPage({ graphic: { scale: 500 } })).toThrow(ProjectFormatError);
    expect(() => loadWithRawPage({ graphic: { scale: 0.1 } })).toThrow(ProjectFormatError);
  });

  it("0.25..8 경계는 받는다", () => {
    expect(() => loadWithRawPage({ graphic: { scale: 0.25 } })).not.toThrow();
    expect(() => loadWithRawPage({ graphic: { scale: 8 } })).not.toThrow();
  });

  it("배율 없는 그림은 그대로 통과한다(항등)", () => {
    expect(() => loadWithRawPage({ graphic: { pattern: 4 } })).not.toThrow();
  });
});
