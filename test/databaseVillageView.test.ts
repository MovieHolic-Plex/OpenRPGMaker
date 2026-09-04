import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderVillageTab } from "@/editor/panels/databaseVillageView";
import { HOUSE_SHAPE_PRESETS } from "@/editor/panels/databaseVillageModel";
import { VILLAGE_ARCHETYPES, templateFromRecord, villageTemplateCatalog } from "@/editor/tools/village/authoringData";
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

/** visualSelect 카드 클릭 — 빈 값은 `${testid}-unset`. */
function pick(host: FakeElement, testid: string, value: string): void {
  const card = findByTestId(host, value === "" ? `${testid}-unset` : `${testid}-${value}`);
  if (!card) throw new Error(`card not found: ${testid} ${JSON.stringify(value)}`);
  card.click();
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

  // 킷은 비움 카드가 하나, 층수는 필수라 비움 카드가 없다.
  it("빈 값 선택지가 중복되지 않는다", () => {
    const host = renderView();
    findByTestId(host, "db-village-create")?.click();
    const kitUnset = findByTestId(host, "db-village-template-kit")?.querySelectorAll("[data-testid='db-village-template-kit-unset']") ?? [];
    expect(kitUnset.length, "db-village-template-kit").toBe(1);
    const storiesUnset = findByTestId(host, "db-village-template-stories")?.querySelectorAll("[data-testid='db-village-template-stories-unset']") ?? [];
    expect(storiesUnset.length, "db-village-template-stories").toBe(0);
  });

  it("재료 킷을 「지정 안 함」으로 되돌리면 키가 사라진다", () => {
    const host = renderView();
    findByTestId(host, "db-village-create")?.click();

    pick(host, "db-village-template-kit", "timber-hall");
    expect(store.getCurrent().villageTemplates?.[0]?.kitId).toBe("timber-hall");

    pick(host, "db-village-template-kit", "");
    expect(store.getCurrent().villageTemplates?.[0]).not.toHaveProperty("kitId");
  });
});

// 이 탭이 오래 어려웠던 이유는 값이 아니라 그림이 없어서였다 — 1301 줄에 <canvas>/<img>
// 가 0개였다. 픽셀은 fakeDom 이 못 보므로(getContext()가 null) 여기서는 **그림 자리가
// 실제로 붙었는지**만 본다. 픽셀은 e2e(test/e2e/db-village-visual.spec.ts)가 본다.
describe("데이터베이스 「마을」탭 — 그림", () => {
  it("아무것도 없으면 예시 그림부터 보여준다", () => {
    const host = renderView();
    // 시작 화면은 빈 상태를 대체하는 게 아니라 감싼다 — 두 빈 판이 그대로 남는다.
    expect(findByTestId(host, "db-village-template-blank")).not.toBeNull();
    expect(findByTestId(host, "db-village-preset-blank")).not.toBeNull();
    expect(findByTestId(host, "db-village-start-hero")).not.toBeNull();
    // 원형 6장(구운 PNG) + 집 모양 10꼴(실시간 캔버스).
    expect(findByTestId(host, "db-village-archetype-shot-farm-rural")?.getAttribute("src"))
      .toBe("assets/village-preview/farm-rural.png");
    const palette = findByTestId(host, "db-village-start-shape-palette");
    expect(palette?.querySelectorAll("button")).toHaveLength(HOUSE_SHAPE_PRESETS.length);
  });

  it("시작 화면의 모양을 누르면 그 꼴로 레코드가 생긴다", () => {
    const host = renderView();
    findByTestId(host, "db-village-start-shape-l")?.click();
    const record = (store.getCurrent().villageTemplates ?? [])[0]!;
    const def = HOUSE_TEMPLATE_DEFS.find((entry) => entry.id === "l")!;
    expect(record.clonedFrom).toBe("l");
    expect(record.wings).toEqual(def.wings.map((wing) => ({ ...wing })));
    expect(templateFromRecord(record)).toHaveProperty("template");
  });

  it("상세·목록에 집 그림 캔버스가 붙는다", () => {
    const host = renderView();
    findByTestId(host, "db-village-create")?.click();
    const hero = findByTestId(host, "db-village-template-shot");
    expect(hero?.tagName).toBe("CANVAS");
    expect(hero?.className).toContain("is-hero");
    // 목록 행 썸네일과 히어로는 같은 형태를 그리지만 testid 는 자리마다 달라야 한다.
    const thumb = findByTestId(host, "db-village-template-thumb-my-house");
    expect(thumb?.tagName).toBe("CANVAS");
    expect(thumb?.dataset.previewKey).toBe(hero?.dataset.previewKey?.replace("hero", "card"));
  });

  it("모양 팔레트와 내장 갤러리가 그림 카드로 뜬다", () => {
    const host = renderView();
    findByTestId(host, "db-village-create")?.click();
    const palette = findByTestId(host, "db-village-shape-palette");
    expect(palette?.querySelectorAll("button")).toHaveLength(HOUSE_SHAPE_PRESETS.length);
    // 내장 34종 전부 카드로 — 예전 <select> 의 글자 목록을 대체한다.
    const gallery = findByTestId(host, "db-village-import-gallery");
    expect(gallery?.querySelectorAll("button")).toHaveLength(HOUSE_TEMPLATE_DEFS.length);
    for (const def of HOUSE_TEMPLATE_DEFS) {
      expect(findByTestId(host, `db-village-import-${def.id}-shot`)?.tagName, def.id).toBe("CANVAS");
    }
  });

  it("모양 카드를 누르면 값이 그 형태로 바뀐다", () => {
    const host = renderView();
    findByTestId(host, "db-village-create")?.click();
    findByTestId(host, "db-village-shape-u")?.click();

    const record = store.getCurrent().villageTemplates?.[0]!;
    const def = HOUSE_TEMPLATE_DEFS.find((entry) => entry.id === "u")!;
    expect(record.w).toBe(def.w);
    expect(record.wings).toEqual(def.wings.map((wing) => ({ ...wing })));
    // 이름·ID·메모는 사용자 것이므로 그대로 남는다.
    expect(record.id).toBe("my-house");
    expect(record.name).toBe("새 집 형태");
    expect(templateFromRecord(record)).toHaveProperty("template");
  });

  it("내장 갤러리에서 고른 형태가 규약을 통과한다", () => {
    const host = renderView();
    findByTestId(host, "db-village-create")?.click();
    const rejected = HOUSE_TEMPLATE_DEFS.flatMap((def) => {
      findByTestId(host, `db-village-import-${def.id}`)?.click();
      const record = store.getCurrent().villageTemplates?.[0]!;
      const resolved = templateFromRecord(record);
      return "reason" in resolved ? [`${def.id}: ${resolved.reason}`] : [];
    });
    expect(rejected).toEqual([]);
  });
});

describe("데이터베이스 「마을」탭 — 날개 격자", () => {
  it("격자 조작면과 날개 상자를 낸다", () => {
    const host = renderView();
    findByTestId(host, "db-village-create")?.click();
    // testid 는 그 요소의 상자를 가리켜야 한다 — 드래그 좌표를 여기서 재기 때문이다.
    const grid = findByTestId(host, "db-village-footprint-large");
    expect(grid?.className).toContain("db-village-grid");
    expect(grid?.style.getPropertyValue("--db-village-cols")).toBe("6");
    expect(grid?.style.getPropertyValue("--db-village-rows")).toBe("6");
    const box = findByTestId(host, "db-village-wing-box-0");
    expect(box?.getAttribute("tabindex")).toBe("0");
    expect(box?.getAttribute("aria-label")).toContain("화살표");
    // 손잡이 8개 — 변 4 + 모서리 4.
    for (const name of ["n", "s", "e", "w", "nw", "ne", "sw", "se"]) {
      expect(findByTestId(host, `db-village-wing-handle-0-${name}`), name).not.toBeNull();
    }
    expect(findByTestId(host, "db-village-grid-status")?.dataset.valid).toBe("true");
  });

  it("숫자칸은 접힘 안에 그대로 남는다", () => {
    const host = renderView();
    findByTestId(host, "db-village-create")?.click();
    const fold = findByTestId(host, "db-village-wing-numbers");
    expect(fold).not.toBeNull();
    // 닫혀 있어도 자식은 DOM 에 남아야 한다 — 정확한 값을 박는 길이 사라지면 안 된다.
    expect(findByTestId(host, "db-village-wing-0-x")).not.toBeNull();
    const body = fold?.querySelectorAll(".db-village-fold-body")[0];
    expect(body?.hidden).toBe(true);
    findByTestId(host, "db-village-wing-numbers-toggle")?.click();
    expect(body?.hidden).toBe(false);
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

    pick(host, "db-village-preset-path-style", "dirt");
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

  it("바닥을 고르면 저장하고 비움으로 되돌리면 키를 지운다", () => {
    const host = withTemplateAndPreset();
    const group = findByTestId(host, "db-village-preset-ground");
    expect(group?.dataset.value).toBe("");
    expect(findByTestId(host, "db-village-preset-ground-unset")).not.toBeNull();
    expect(findByTestId(host, "db-village-preset-ground-grass")).not.toBeNull();
    expect(findByTestId(host, "db-village-preset-ground-snow")).not.toBeNull();

    pick(host, "db-village-preset-ground", "grass");
    expect(store.getCurrent().villagePresets?.[0]?.groundTheme).toBe("grass");
    expect(findByTestId(host, "db-village-preset-ground")?.dataset.value).toBe("grass");

    pick(host, "db-village-preset-ground", "snow");
    expect(store.getCurrent().villagePresets?.[0]?.groundTheme).toBe("snow");

    pick(host, "db-village-preset-ground", "");
    expect(store.getCurrent().villagePresets?.[0]).not.toHaveProperty("groundTheme");
    expect(findByTestId(host, "db-village-preset-ground")?.dataset.value).toBe("");
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

    // 각 선택지에 집 그림 캔버스가 붙는다 — fakeDom 은 getContext()=null 이라
    // previewState 는 nocontext 가 된다. 픽셀은 e2e 가 보고, 여기서는 자리만 본다.
    const catalog = villageTemplateCatalog(store.getCurrent()).templates;
    expect(catalog).toHaveLength(HOUSE_TEMPLATE_DEFS.length + 1);
    for (const template of catalog) {
      const shot = findByTestId(host, `db-village-preset-template-${template.id}-shot`);
      expect(shot?.tagName, template.id).toBe("CANVAS");
      expect(findByTestId(host, `db-village-preset-template-${template.id}`), template.id).not.toBeNull();
    }

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

  // 프리셋 값은 서로 얽혀 있어서 항목별 설명을 읽어도 결과가 그려지지 않는다. 그래서
  // 진짜 시공기를 돌린다 — 버튼을 눌러야 도는 것이 계약이다(값 하나 고칠 때마다 40×40
  // 한 판을 돌리면 select 를 바꿀 때마다 화면이 멈춘다).
  it("미리보기는 눌러야 돌고 초안에서만 시공한다", () => {
    const host = withTemplateAndPreset();
    const stage = findByTestId(host, "db-village-preset-preview");
    expect(stage?.dataset.previewState).toBe("idle");
    expect(findByTestId(host, "db-village-preset-shot")).toBeNull();

    const before = Object.keys(store.getCurrent().maps).length;
    findByTestId(host, "db-village-preset-preview-run")?.click();

    expect(stage?.dataset.previewState).toBe("ready");
    expect(findByTestId(host, "db-village-preset-shot")?.tagName).toBe("CANVAS");
    expect(findByTestId(host, "db-village-preset-preview-note")?.textContent).toContain("집");
    // 초안에서만 돌았다 — 프로젝트에 맵이 생기지 않는다.
    expect(Object.keys(store.getCurrent().maps)).toHaveLength(before);
  });

  it("씨앗을 바꾸면 다시 시공하고 씨앗값을 알려준다", () => {
    const host = withTemplateAndPreset();
    findByTestId(host, "db-village-preset-preview-run")?.click();
    const first = findByTestId(host, "db-village-preset-preview-note")?.textContent ?? "";
    findByTestId(host, "db-village-preset-preview-reseed")?.click();
    const second = findByTestId(host, "db-village-preset-preview-note")?.textContent ?? "";
    expect(first).toContain("씨앗");
    expect(second).toContain("씨앗");
    expect(second).not.toBe(first);
  });
});

describe("데이터베이스 「마을」탭 — 마을 원형", () => {
  it("프리셋이 없으면 원형 6갈래를 갤러리로 낸다", () => {
    const host = renderView("preset");
    expect(findByTestId(host, "db-village-preset-blank")).not.toBeNull();
    const gallery = findByTestId(host, "db-village-archetypes");
    expect(gallery?.querySelectorAll("button")).toHaveLength(VILLAGE_ARCHETYPES.length);
    for (const archetype of VILLAGE_ARCHETYPES) {
      expect(findByTestId(host, `db-village-archetype-${archetype.id}`), archetype.id).not.toBeNull();
    }
  });

  it("원형을 누르면 그 값이 든 프리셋이 생기고 선택된다", () => {
    const host = renderView("preset");
    findByTestId(host, "db-village-archetype-harbor-coast")?.click();

    const records = store.getCurrent().villagePresets ?? [];
    expect(records).toHaveLength(1);
    const archetype = VILLAGE_ARCHETYPES.find((entry) => entry.id === "harbor-coast")!;
    expect(records[0]).toMatchObject({ id: "harbor-coast", name: archetype.name, ...archetype.values });
    // 만든 프리셋이 곧바로 상세로 열려야 한다 — 값을 확인·수정하는 게 원형을 굽는 이유다.
    expect(findByTestId(host, "db-village-preset-name")?.value).toBe(archetype.name);
    expect(findByTestId(host, "db-village-preset-path-style")?.dataset.value).toBe("sand");
  });

  it("프리셋이 생기면 갤러리 대신 상세의 「값 가져오기」로 옮겨간다", () => {
    const host = renderView("preset");
    findByTestId(host, "db-village-archetype-farm-rural")?.click();
    // 갤러리는 "무엇부터 만들지" 를 고르는 빈 상태 전용이다 — 상세에서는 자리를 차지하면 안 된다.
    expect(findByTestId(host, "db-village-archetypes")).toBeNull();
    const select = findByTestId(host, "db-village-archetype-source");
    expect(select?.querySelectorAll("button")).toHaveLength(VILLAGE_ARCHETYPES.length);
    expect(select?.dataset.value).toBe(VILLAGE_ARCHETYPES[0]!.id);
    expect(findByTestId(host, "db-village-archetype-apply")).not.toBeNull();
    for (const archetype of VILLAGE_ARCHETYPES) {
      expect(findByTestId(host, `db-village-archetype-source-${archetype.id}`), archetype.id).not.toBeNull();
    }
  });

  it("「값 가져오기」는 분위기만 덮고 규모는 남긴다", () => {
    const host = renderView("preset");
    findByTestId(host, "db-village-create")?.click();
    change(findByTestId(host, "db-village-preset-house-count"), "7");
    pick(host, "db-village-preset-plaza-layout", "north");
    pick(host, "db-village-preset-ground", "snow");

    pick(host, "db-village-archetype-source", "mine-mountain");
    findByTestId(host, "db-village-archetype-apply")?.click();

    const record = store.getCurrent().villagePresets?.[0]!;
    expect(record.houseCount).toBe(7);
    expect(record.groundTheme).toBe("snow");
    expect(record.pathStyle).toBe("dirt");
    expect(record.yardStyle).toBe("workshop");
    expect(record.kitMix).toBe("blue-stone");
    // 광산 원형은 광장 위치를 정하지 않는다 — 남겨 두면 두 원형이 섞인 값이 된다.
    expect(record).not.toHaveProperty("plazaLayout");
  });
});

describe("데이터베이스 「마을」탭 — 내장 덮음", () => {
  it("내장과 다른 id 면 「더함」으로 센다", () => {
    const host = renderView();
    findByTestId(host, "db-village-create")?.click();
    const stats = findByTestId(host, "db-village-template-stats")?.textContent ?? "";
    expect(stats).toContain("내장에 더함");
    expect(findByTestId(host, "db-village-template-override-count")?.textContent).toContain("0");
    expect(findByTestId(host, "db-village-template-row-my-house")?.textContent).not.toContain("내장 덮음");
    expect(findByTestId(host, "db-village-template-id-usage")?.textContent).toContain("더해집니다");
  });

  it("내장과 같은 id 로 바꾸면 목록·요약·안내가 덮음이라고 말한다", () => {
    const host = renderView();
    findByTestId(host, "db-village-create")?.click();
    change(findByTestId(host, "db-village-template-id"), "rect-small");

    expect(findByTestId(host, "db-village-template-row-rect-small")?.textContent).toContain("내장 덮음");
    expect(findByTestId(host, "db-village-template-override-count")?.textContent).toContain("1");
    expect(findByTestId(host, "db-village-template-hero")?.textContent).toContain("내장 덮음");
    expect(findByTestId(host, "db-village-template-id-usage")?.textContent).toContain("내장 대신 이 레코드가 시공됩니다");
    // 덮음이므로 후보 수는 늘지 않는다 — 이 숫자가 늘면 배지가 거짓말을 한 것이다.
    expect(villageTemplateCatalog(store.getCurrent()).templates).toHaveLength(HOUSE_TEMPLATE_DEFS.length);
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
