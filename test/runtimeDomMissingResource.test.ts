// 누락 리소스 알림의 DOM 계약.
//
// 이 알림은 실패가 아니라 경고다 — renderEvents 는 못 푼 스프라이트를 기본 charset 으로
// 대체해 계속 그린다. 그래서 (1) 집합이 비면 노드가 남지 않아야 하고, (2) 저작자가 붙인
// 자원 이름을 보여주되 원본 id 를 폴백으로 유지해야 한다(QA/e2e 가 id 를 단정한다).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const project = {
  resourceProfiles: [{ assetId: "upl_elder_charset", name: "고향 촌장" }],
};

vi.mock("@/project/store", () => ({ store: { getCurrent: () => project } }));

const { RuntimeDomOverlay } = await import("@/player/runtimeDom");

let restore: (() => void) | null = null;

beforeEach(() => {
  restore = installFakeDom();
});

afterEach(() => {
  restore?.();
  restore = null;
});

function overlayWithHost(): { host: FakeElement; overlay: InstanceType<typeof RuntimeDomOverlay> } {
  const host = new FakeElement("div");
  const overlay = new RuntimeDomOverlay(() => host as unknown as HTMLElement, {
    playResolution: { width: 320, height: 240 },
  });
  return { host, overlay };
}

describe("RuntimeDomOverlay missing resource notice", () => {
  it("renders the authored resource name and keeps the raw id as fallback", () => {
    const { host, overlay } = overlayWithHost();

    overlay.syncMissingResourceError(new Set(["upl_elder_charset", "tex_easyrpg_chipset_interior"]));

    const node = findByTestId(host, "missing-resource-error");
    expect(node).not.toBeNull();
    expect(node?.textContent).toBe("누락된 리소스: 고향 촌장, tex_easyrpg_chipset_interior");
    expect(node?.className).toBe("runtime-missing-resource");
  });

  it("removes the notice once nothing is missing", () => {
    const { host, overlay } = overlayWithHost();

    overlay.syncMissingResourceError(new Set(["upl_elder_charset"]));
    expect(findByTestId(host, "missing-resource-error")).not.toBeNull();

    overlay.syncMissingResourceError(new Set());
    expect(findByTestId(host, "missing-resource-error")).toBeNull();
  });

  it("does not stack notices across repeated syncs", () => {
    const { host, overlay } = overlayWithHost();

    overlay.syncMissingResourceError(new Set(["a"]));
    overlay.syncMissingResourceError(new Set(["a"]));
    overlay.syncMissingResourceError(new Set(["a", "b"]));

    expect(host.children.filter((child) => child.dataset.testid === "missing-resource-error")).toHaveLength(1);
  });
});
