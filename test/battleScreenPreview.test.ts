/** @vitest-environment happy-dom */
/**
 * 자료집 「전투 화면」 탭의 실시간 미리보기(qa1124 항목 6): 프로젝트를 쓰지 않고, 풀면 전투 부품을 남기지 않는다.
 * 화면 증거(500ms 안 갱신·390 접이식·가로 넘침 0)는 /tmp/fix1124-battle-screen-qa 의 실제 앱 측정이 맡는다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMapEditHistoryDepth } from "@/editor/mapEditHistory";
import { createBattleScreenPreview } from "@/editor/panels/battleScreenPreview";
import { BATTLE_PREVIEW_COMBO_SKILL_ID, BATTLE_PREVIEW_SCENES, BATTLE_PREVIEW_TROOP_ID, prepareBattleScreenDemo } from "@/editor/panels/battleScreenPreviewDemo";
import { createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";
import { store } from "@/project/store";

const settle = (): Promise<void> => new Promise((resolve) => queueMicrotask(resolve));

describe("전투 화면 미리보기 — 프로젝트를 쓰지 않는다", () => {
  beforeEach(() => {
    store.replace(createBlankProject());
  });
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("데모 부대·연계기·적 값은 복제본에만 들어가고 저장소 프로젝트는 그대로다", () => {
    const source = store.getCurrent();
    const before = serialize(source);
    for (const scene of BATTLE_PREVIEW_SCENES) {
      const demo = prepareBattleScreenDemo(source, scene);
      expect(demo, scene).toBeDefined();
      expect(demo!.project).not.toBe(source);
      expect(demo!.project.database.troops.some((troop) => troop.id === BATTLE_PREVIEW_TROOP_ID)).toBe(true);
    }
    const combo = prepareBattleScreenDemo(source, "combo")!;
    expect(combo.project.database.skills.some((skill) => skill.id === BATTLE_PREVIEW_COMBO_SKILL_ID)).toBe(true);
    expect(source.database.troops.some((troop) => troop.id === BATTLE_PREVIEW_TROOP_ID)).toBe(false);
    expect(source.database.skills.some((skill) => skill.id === BATTLE_PREVIEW_COMBO_SKILL_ID)).toBe(false);
    expect(serialize(source)).toBe(before);
  });

  it("마운트·장면 바꾸기·해제 뒤에도 직렬화 해시와 되돌리기 기록이 같고, 풀면 전투 부품·타이머·창 키 리스너가 없다", async () => {
    const before = serialize(store.getCurrent());
    const depth = getMapEditHistoryDepth();
    const intervals = new Set<number>();
    const realSet = window.setInterval.bind(window);
    const realClear = window.clearInterval.bind(window);
    vi.spyOn(window, "setInterval").mockImplementation(((...args: Parameters<typeof window.setInterval>) => {
      const id = realSet(...args);
      intervals.add(id);
      return id;
    }) as typeof window.setInterval);
    vi.spyOn(window, "clearInterval").mockImplementation(((id?: number) => {
      if (id !== undefined) intervals.delete(id);
      realClear(id);
    }) as typeof window.clearInterval);
    const windowKeys = vi.spyOn(window, "addEventListener");

    const preview = createBattleScreenPreview("attack");
    document.body.append(preview.element);
    await settle();
    expect(preview.isMounted()).toBe(true);
    expect(preview.element.querySelectorAll(".battle-scene")).toHaveLength(1);

    preview.replay("hit");
    expect(preview.element.querySelectorAll(".battle-scene")).toHaveLength(1);
    expect(preview.element.dataset.previewScene).toBe("hit");
    // 창 단위 키 입력은 받지 않는다 — 편집기의 타이핑·단축키가 보이지 않는 전투를 움직이면 안 된다.
    expect(windowKeys.mock.calls.filter(([type]) => type === "keydown" || type === "keyup")).toHaveLength(0);

    preview.dispose();
    expect(preview.isMounted()).toBe(false);
    expect(preview.isDisposed()).toBe(true);
    expect(preview.element.querySelectorAll(".battle-scene")).toHaveLength(0);
    expect([...intervals]).toEqual([]);
    expect(serialize(store.getCurrent())).toBe(before);
    expect(getMapEditHistoryDepth()).toBe(depth);
  });
});
