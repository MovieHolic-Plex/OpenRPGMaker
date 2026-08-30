import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderVillageTab } from "@/editor/panels/databaseVillageView";
import { templateFromRecord, villageTemplateCatalog } from "@/editor/tools/village/authoringData";
import { createBlankProject } from "@/project/defaults";
import { HOUSE_TEMPLATE_DEFS } from "@/project/defaults/houseTemplateCatalog";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

// 이 탭이 사슬의 입력단이다 — 여기서 만든 레코드가 그대로 하네스로 흘러간다.
// 그래서 "화면에서 만들 수 있는 값은 규약을 통과한다" 를 계약으로 못 박는다.

let cleanupDom: (() => void) | undefined;
let previousWindow: typeof globalThis.window | undefined;

beforeEach(() => {
  cleanupDom = installFakeDom();
  previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      setTimeout: (callback: TimerHandler): number => { if (typeof callback === "function") callback(); return 0; },
      clearTimeout,
    },
  });
  store.replace(createBlankProject());
});

afterEach(() => {
  cleanupDom?.();
  cleanupDom = undefined;
  if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
  else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
});

// 분류 칩 선택은 모듈 상태다(모달을 다시 열어도 있던 자리로 돌아온다) — 테스트마다
// 원하는 분류를 명시적으로 눌러 이전 테스트의 선택이 새 나오지 않게 한다.
function renderView(kind: "template" | "preset" = "template"): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  const rerender = (): void => {
    host.replaceChildren();
    renderVillageTab(host as unknown as HTMLElement, rerender);
  };
  rerender();
  findByTestId(host, `db-village-kind-${kind}`)?.click();
  return host;
}

/** select/input 변경을 브라우저처럼 흉내낸다 — 값을 넣고 change 를 쏜다. */
function change(node: FakeElement | null, value: string): void {
  if (!node) throw new Error("node not found");
  node.value = value;
  node.dispatchEvent(new Event("change"));
}

function toggle(node: FakeElement | null, checked: boolean): void {
  if (!node) throw new Error("node not found");
  node.checked = checked;
  node.dispatchEvent(new Event("change"));
}

describe("데이터베이스 「마을」탭 — 뼈대", () => {
  it("공용 워크스페이스 빌더를 쓰고 두 분류 칩을 낸다", () => {
    const host = renderView();
    expect(host.querySelectorAll(".db-record-workspace")).toHaveLength(1);
    expect(host.querySelectorAll(".db-list-pane")).toHaveLength(1);
    expect(findByTestId(host, "db-village-search")?.getAttribute("type")).toBe("search");
    expect(findByTestId(host, "db-village-kind-template")).not.toBeNull();
    expect(findByTestId(host, "db-village-kind-preset")).not.toBeNull();
  });

  it("레코드가 없으면 빈 상태를 보여주고 삭제를 막는다", () => {
    const host = renderView();
    expect(findByTestId(host, "db-village-delete")?.getAttribute("disabled")).toBe("true");
    expect(findByTestId(host, "db-village-duplicate")?.getAttribute("disabled")).toBe("true");
    expect(findByTestId(host, "db-village-template-blank")).not.toBeNull();
    // 부트스트랩 없음 — 탭을 열기만 해서는 프로젝트에 아무 것도 안 생긴다.
    expect(store.getCurrent().villageTemplates).toBeUndefined();
    expect(store.getCurrent().villagePresets).toBeUndefined();
  });
});

describe("데이터베이스 「마을」탭 — 집 형태", () => {
  it("추가한 형태는 곧바로 규약을 통과한다", () => {
    const host = renderView();
    findByTestId(host, "db-village-create")?.click();

    const records = store.getCurrent().villageTemplates ?? [];
    expect(records).toHaveLength(1);
    const resolved = templateFromRecord(records[0]!);
    expect("template" in resolved, "reason" in resolved ? resolved.reason : "").toBe(true);
    expect(findByTestId(host, "db-village-template-validity")?.textContent).toContain("통과");
  });

  it("내장 형태 복제는 값을 굽고 시공 후보에 더해진다", () => {
    const host = renderView();
    findByTestId(host, "db-village-clone-builtin")?.click();

    const record = (store.getCurrent().villageTemplates ?? [])[0]!;
    const def = HOUSE_TEMPLATE_DEFS.find((entry) => entry.id === "rect-large")!;
    expect(record.clonedFrom).toBe("rect-large");
    expect(record.w).toBe(def.w);
    expect(record.wings).toEqual(def.wings.map((wing) => ({ ...wing })));
    expect(villageTemplateCatalog(store.getCurrent()).templates).toHaveLength(HOUSE_TEMPLATE_DEFS.length + 1);
  });

  it("크기·날개 편집이 프로젝트에 남고 규약 위반은 경고로 보인다", () => {
    const host = renderView();
    findByTestId(host, "db-village-create")?.click();

    change(findByTestId(host, "db-village-template-w"), "8");
    change(findByTestId(host, "db-village-template-h"), "7");
    expect(store.getCurrent().villageTemplates?.[0]).toMatchObject({ w: 8, h: 7 });

    // 날개가 바운딩 박스를 넘게 만들면 시공에서 건너뛴다 — 화면이 그걸 말해줘야 한다.
    change(findByTestId(host, "db-village-wing-0-w"), "8");
    change(findByTestId(host, "db-village-wing-0-x"), "4");
    expect(findByTestId(host, "db-village-template-warning")?.textContent).toContain("바운딩 박스");
    expect(findByTestId(host, "db-village-template-validity")?.textContent).toContain("위반");
  });

  it("날개를 더하고 박스 맞추기로 빈 줄을 없앤다", () => {
    const host = renderView();
    findByTestId(host, "db-village-create")?.click();
    change(findByTestId(host, "db-village-wing-0-w"), "3");
    change(findByTestId(host, "db-village-wing-0-h"), "5");

    // 새 날개는 규약을 통과하는 크기(1층이면 3×5)로 들어와야 한다.
    findByTestId(host, "db-village-wing-add")?.click();
    const wings = store.getCurrent().villageTemplates?.[0]?.wings ?? [];
    expect(wings).toHaveLength(2);
    expect(wings[1]).toEqual({ x: 0, y: 0, w: 3, h: 5 });

    findByTestId(host, "db-village-wing-tighten")?.click();
    const tight = store.getCurrent().villageTemplates?.[0]!;
    expect(tight.w).toBe(3);
    expect(tight.h).toBe(5);
    expect(templateFromRecord(tight)).toHaveProperty("template");
  });

  // 화면이 "통과" 라고 했는데 시공은 한 채도 못 세우던 형태 — 위 4행만 폭 8, 아래 4행은
  // 왼쪽 4칸인 ㅜ 자. 오른쪽 열이 4행뿐이라 벽 3 + 지붕 2 를 못 채운다.
  it("열이 짧아 지붕이 안 들어가는 형태는 위반으로 잡는다", () => {
    const host = renderView();
    findByTestId(host, "db-village-create")?.click();
    change(findByTestId(host, "db-village-template-w"), "8");
    change(findByTestId(host, "db-village-template-h"), "8");
    change(findByTestId(host, "db-village-wing-0-w"), "8");
    change(findByTestId(host, "db-village-wing-0-h"), "4");
    findByTestId(host, "db-village-wing-add")?.click();
    change(findByTestId(host, "db-village-wing-1-y"), "4");
    change(findByTestId(host, "db-village-wing-1-w"), "4");
    change(findByTestId(host, "db-village-wing-1-h"), "4");

    expect(findByTestId(host, "db-village-template-validity")?.textContent).toContain("위반");
    expect(findByTestId(host, "db-village-template-warning")?.textContent).toContain("5칸 이상");
  });

  it("재료 킷을 「지정 안 함」으로 되돌리면 키가 사라진다", () => {
    const host = renderView();
    findByTestId(host, "db-village-create")?.click();

    change(findByTestId(host, "db-village-template-kit"), "timber-hall");
    expect(store.getCurrent().villageTemplates?.[0]?.kitId).toBe("timber-hall");

    change(findByTestId(host, "db-village-template-kit"), "");
    expect(store.getCurrent().villageTemplates?.[0]).not.toHaveProperty("kitId");
  });
});

describe("데이터베이스 「마을」탭 — 배치 프리셋", () => {
  function withTemplateAndPreset(): FakeElement {
    const host = renderView();
    findByTestId(host, "db-village-create")?.click();
    findByTestId(host, "db-village-kind-preset")?.click();
    findByTestId(host, "db-village-create")?.click();
    return host;
  }

  it("프리셋 값은 전부 「지정 안 함」에서 시작한다", () => {
    const host = withTemplateAndPreset();
    expect(store.getCurrent().villagePresets).toEqual([{ id: "vpreset", name: "새 배치 프리셋" }]);
    expect(findByTestId(host, "db-village-preset-stats")?.textContent).toContain("0");
  });

  it("고른 값만 저장하고 되돌리면 키를 지운다", () => {
    const host = withTemplateAndPreset();

    change(findByTestId(host, "db-village-preset-path-style"), "dirt");
    change(findByTestId(host, "db-village-preset-road-width"), "3");
    change(findByTestId(host, "db-village-preset-layout"), "street-grid");
    change(findByTestId(host, "db-village-preset-house-count"), "5");
    expect(store.getCurrent().villagePresets?.[0]).toMatchObject({
      pathStyle: "dirt",
      roadWidth: 3,
      settlementLayout: "street-grid",
      houseCount: 5,
    });

    change(findByTestId(host, "db-village-preset-house-count"), "");
    expect(store.getCurrent().villagePresets?.[0]).not.toHaveProperty("houseCount");
  });

  it("범위를 벗어난 숫자는 입력 단계에서 조여진다", () => {
    const host = withTemplateAndPreset();
    change(findByTestId(host, "db-village-preset-road-width"), "9");
    expect(store.getCurrent().villagePresets?.[0]?.roadWidth).toBe(3);
    change(findByTestId(host, "db-village-preset-npc-count"), "-4");
    expect(store.getCurrent().villagePresets?.[0]?.npcCount).toBe(0);
  });

  it("형태 화이트리스트는 카탈로그 전체를 내주고 고른 것만 저장한다", () => {
    const host = withTemplateAndPreset();
    const picker = findByTestId(host, "db-village-preset-template-picker");
    expect(picker?.querySelectorAll("input")).toHaveLength(HOUSE_TEMPLATE_DEFS.length + 1);

    toggle(findByTestId(host, "db-village-preset-template-my-house"), true);
    toggle(findByTestId(host, "db-village-preset-template-rect-small"), true);
    expect(store.getCurrent().villagePresets?.[0]?.templateIds?.sort()).toEqual(["my-house", "rect-small"]);

    findByTestId(host, "db-village-preset-clear-templates")?.click();
    expect(store.getCurrent().villagePresets?.[0]).not.toHaveProperty("templateIds");
  });

  it("「내 형태만 고르기」는 사용자 형태 id 만 넣는다", () => {
    const host = withTemplateAndPreset();
    findByTestId(host, "db-village-preset-pick-user")?.click();
    expect(store.getCurrent().villagePresets?.[0]?.templateIds).toEqual(["my-house"]);
  });
});

describe("데이터베이스 「마을」탭 — 참조 정리", () => {
  it("형태를 지우면 프리셋 화이트리스트에서도 빠진다", () => {
    const host = renderView();
    findByTestId(host, "db-village-create")?.click();
    findByTestId(host, "db-village-kind-preset")?.click();
    findByTestId(host, "db-village-create")?.click();
    toggle(findByTestId(host, "db-village-preset-template-my-house"), true);
    toggle(findByTestId(host, "db-village-preset-template-rect-small"), true);

    findByTestId(host, "db-village-kind-template")?.click();
    findByTestId(host, "db-village-delete")?.click();

    expect(store.getCurrent().villageTemplates).toEqual([]);
    expect(store.getCurrent().villagePresets?.[0]?.templateIds).toEqual(["rect-small"]);
  });

  it("형태 id 를 바꾸면 프리셋이 새 id 를 가리킨다", () => {
    const host = renderView();
    findByTestId(host, "db-village-create")?.click();
    findByTestId(host, "db-village-kind-preset")?.click();
    findByTestId(host, "db-village-create")?.click();
    toggle(findByTestId(host, "db-village-preset-template-my-house"), true);

    findByTestId(host, "db-village-kind-template")?.click();
    change(findByTestId(host, "db-village-template-id"), "chief-hall");

    expect(store.getCurrent().villageTemplates?.[0]?.id).toBe("chief-hall");
    expect(store.getCurrent().villagePresets?.[0]?.templateIds).toEqual(["chief-hall"]);
  });

  it("같은 id 를 두 번 쓰려 하면 되돌린다", () => {
    const host = renderView();
    findByTestId(host, "db-village-create")?.click();
    findByTestId(host, "db-village-duplicate")?.click();
    const ids = (store.getCurrent().villageTemplates ?? []).map((entry) => entry.id);
    expect(ids).toEqual(["my-house", "my-house_2"]);

    change(findByTestId(host, "db-village-template-id"), "my-house");
    expect((store.getCurrent().villageTemplates ?? []).map((entry) => entry.id)).toEqual(ids);
  });
});
