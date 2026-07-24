import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderBattlerAnimationsTab } from "@/editor/panels/databaseUtilityRecordViews";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  store.replace(createBlankProject());
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

describe("애니메이션 2 탭 런타임 미연결 고지", () => {
  it("포즈 데이터가 전투 런타임에 소비되지 않음을 탭에 명시한다", () => {
    const host = new FakeElement("div");
    renderBattlerAnimationsTab(host as unknown as HTMLElement);
    const note = findByTestId(host, "db-battler-animations-runtime-note");
    expect(note, "런타임 미연결 고지가 렌더되어야 한다").not.toBeNull();
    expect(note?.textContent ?? "").toContain("미연결");
  });
});
