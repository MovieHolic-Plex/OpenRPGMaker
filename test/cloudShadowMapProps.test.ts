import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderMapProps, resetMapPropsTabForTests } from "@/editor/panels/mapProps";
import { deserialize, serialize } from "@/project/io/serialize";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

describe("map cloud shadows (맵 설정)", () => {
  let restoreDom: () => void;
  let mapId: string;

  beforeEach(() => {
    restoreDom = installFakeDom();
    const project = createBlankProject();
    store.replace(project);
    mapId = project.startMapId;
    editorState.set({ currentMapId: mapId });
    resetMapPropsTabForTests();
  });

  afterEach(() => {
    restoreDom();
  });

  function render(): FakeElement {
    const container = new FakeElement("div");
    renderMapProps(container as unknown as HTMLElement);
    return container;
  }

  function control(container: FakeElement, testid: string): FakeElement {
    const node = findByTestId(container, testid);
    if (!node) throw new Error(`맵 설정에 ${testid} 컨트롤이 없습니다`);
    return node;
  }

  function toggle(container: FakeElement, testid: string, checked: boolean): void {
    const node = control(container, testid) as unknown as HTMLInputElement;
    node.checked = checked;
    node.dispatchEvent(new Event("change"));
  }

  function type(container: FakeElement, testid: string, value: string): void {
    const node = control(container, testid) as unknown as HTMLInputElement;
    node.value = value;
    node.dispatchEvent(new Event("change"));
  }

  it("「구름 그림자」 섹션과 켬 스위치를 내놓는다", () => {
    const container = render();
    expect(findByTestId(container, "map-props-section-clouds")).not.toBeNull();
    const enable = control(container, "map-cloud-shadows-enable") as unknown as HTMLInputElement;
    expect(enable.checked).toBe(false);
    expect(store.getCurrent().maps[mapId]?.cloudShadows).toBeUndefined();
  });

  it("켜면 맵에 설정을 쓰고, 끄면 필드를 지운다", () => {
    toggle(render(), "map-cloud-shadows-enable", true);
    expect(store.getCurrent().maps[mapId]?.cloudShadows?.enabled).toBe(true);

    toggle(render(), "map-cloud-shadows-enable", false);
    expect(store.getCurrent().maps[mapId]?.cloudShadows).toBeUndefined();
  });

  it("켜면 세부 슬라이더가 나타나고 범위 밖 값은 범위로 접힌다", () => {
    toggle(render(), "map-cloud-shadows-enable", true);
    const enabled = render();

    type(enabled, "map-cloud-shadows-opacity-number", "90");
    expect(store.getCurrent().maps[mapId]?.cloudShadows?.opacity).toBe(0.6);

    type(enabled, "map-cloud-shadows-speed-number", "-40");
    expect(store.getCurrent().maps[mapId]?.cloudShadows?.speed).toBe(0);

    type(enabled, "map-cloud-shadows-angle-number", "400");
    expect(store.getCurrent().maps[mapId]?.cloudShadows?.angleDeg).toBe(40);

    type(enabled, "map-cloud-shadows-scale-number", "20");
    expect(store.getCurrent().maps[mapId]?.cloudShadows?.scale).toBe(0.5);
  });

  it("꺼져 있으면 세부 슬라이더를 숨긴다", () => {
    toggle(render(), "map-cloud-shadows-enable", true);
    toggle(render(), "map-cloud-shadows-enable", false);
    expect(findByTestId(render(), "map-cloud-shadows-opacity")).toBeNull();
  });

  it("저장/로드 왕복에서 구름 그림자 설정이 살아남는다", () => {
    toggle(render(), "map-cloud-shadows-enable", true);
    const enabled = render();
    type(enabled, "map-cloud-shadows-opacity-number", "40");
    type(enabled, "map-cloud-shadows-speed-number", "52");
    type(enabled, "map-cloud-shadows-angle-number", "200");
    type(enabled, "map-cloud-shadows-scale-number", "150");

    const reloaded = deserialize(serialize(store.getCurrent()));
    expect(reloaded.maps[mapId]?.cloudShadows).toEqual({
      enabled: true,
      opacity: 0.4,
      speed: 52,
      angleDeg: 200,
      scale: 1.5,
    });
  });
});
