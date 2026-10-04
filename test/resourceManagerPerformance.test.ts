// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listAudioResources } from "@/assets/audioResourceCatalog";
import { listMonsterResources } from "@/assets/monsterResourceCatalog";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { ResourceKind, ResourceProfile, UploadedAsset } from "@/project/types";
import { disposeResourceWorkbench, renderResourceWorkbench, resourceManagerMonsterCount, RESOURCE_GALLERY_PAGE_SIZE } from "@/editor/panels/resourceManagerViews";
import { disposeResourceManager, renderResourceManager } from "@/editor/panels/resourceManager";
import { registerModal, resetModalStackForTest, unregisterModal } from "@/editor/ui/modalStack";

vi.mock("@/assets/monsterResourceCatalog", async importOriginal => {
  const actual = await importOriginal<typeof import("@/assets/monsterResourceCatalog")>();
  return { ...actual, listMonsterResources: vi.fn(actual.listMonsterResources) };
});
let root: HTMLElement;
beforeEach(() => {
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false });
  store.replaceProject(createBlankProject());
  vi.mocked(listMonsterResources).mockClear();
  root = document.createElement("div"); document.body.append(root);
});
afterEach(() => {
  disposeResourceManager(root); document.body.replaceChildren(); resetModalStackForTest();
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});
function uploaded(id: string, kind: "picture" | "monster" = "picture"): UploadedAsset {
  return { id, kind, name: id, dataUrl: "data:image/png;base64,AAAA", meta: {} };
}
function render(kind: ResourceKind, profiles: readonly ResourceProfile[] = store.getCurrent().resourceProfiles,
  uploads: readonly UploadedAsset[] = Object.values(store.getCurrent().assets.uploaded), recentAssetId?: string) {
  renderResourceWorkbench(root, {
    categories: [{ kind, label: kind }, ...(kind === "monster" ? [] : [{ kind: "monster" as const, label: "monster" }])],
    selectedKind: kind, profiles, uploaded: uploads,
    kindSelect: document.createElement("select"), fileInput: document.createElement("input"),
    actions: { addTileset() {}, applyTileset() {}, deleteAsset() {} }, onSelectKind() {}, onImport() {},
    ...(recentAssetId ? { recentAssetId } : {}),
  });
}
function inputSearch(query: string): void {
  const search = root.querySelector<HTMLInputElement>("input[type='search']")!;
  search.value = query; search.dispatchEvent(new Event("input"));
}

describe("resource workbench catalog and DOM boundaries", () => {
  it("keeps the raw-ID count equal to the authority with upload masking, retired/profile IDs and metadata orphans", () => {
    const project = createBlankProject();
    const builtin = listMonsterResources(project)[0]!.resourceId;
    project.assets.uploaded[builtin] = uploaded(builtin); // non-monster shadows bundled registration
    project.assets.uploaded["upload-key"] = uploaded("different-asset-id", "monster"); // dictionary key is authoritative
    project.resourceProfiles.push({ kind: "monster", name: "duplicate", assetId: "upload-key" },
      { kind: "monster", name: "profile registration", assetId: "generated-enemy-reference-cocoon" },
      { kind: "monster", name: "anonymous" }, { kind: "monster", name: "masked", assetId: builtin });
    project.monsterMetadata = { orphan: { name: "metadata cannot register a monster" } };
    expect(resourceManagerMonsterCount(project)).toBe(listMonsterResources(project).length);
    const next = structuredClone(project);
    delete next.assets.uploaded[builtin];
    expect(resourceManagerMonsterCount(next)).toBe(listMonsterResources(next).length);
  });

  it("does not build monster metadata for another pane; monster selections use one indexed catalog", () => {
    render("picture"); inputSearch("missing"); inputSearch("");
    expect(listMonsterResources).not.toHaveBeenCalled();
    disposeResourceWorkbench(root); root.replaceChildren(); render("monster");
    expect(listMonsterResources).toHaveBeenCalledTimes(1);
    const cards = root.querySelectorAll<HTMLElement>(".rm-asset-card");
    cards[1]!.click(); cards[2]!.click();
    expect(listMonsterResources).toHaveBeenCalledTimes(1);
    store.update(project => { project.audioDescriptions = { sound: { sentinel: "unrelated" } }; });
    disposeResourceWorkbench(root); root.replaceChildren(); render("monster");
    expect(listMonsterResources).toHaveBeenCalledTimes(1);
    store.update(project => { project.monsterMetadata = { "generated-enemy-slime-01": { name: "changed" } }; });
    disposeResourceWorkbench(root); root.replaceChildren(); render("monster");
    expect(listMonsterResources).toHaveBeenCalledTimes(2);
  });

  it("bounds both layouts and preserves gallery nodes/scroll on selection, including a late import", async () => {
    const uploads = Array.from({ length: 241 }, (_, i) => uploaded(`picture-${i}`));
    render("picture", [], uploads, "picture-240");
    expect(root.querySelector('[data-testid="resource-upload-picture-240"]')).not.toBeNull();
    root.querySelector<HTMLButtonElement>('[data-testid="resource-page-prev"]')!.click();
    const list = root.querySelector<HTMLElement>('[data-testid="resource-entry-list"]')!;
    const cards = [...root.querySelectorAll<HTMLElement>(".rm-asset-card")];
    expect(cards).toHaveLength(RESOURCE_GALLERY_PAGE_SIZE);
    for (const img of list.querySelectorAll("img")) {
      expect(img.getAttribute("loading")).toBe("lazy"); expect(img.getAttribute("decoding")).toBe("async");
    }
    const mutations: MutationRecord[] = [];
    const observer = new MutationObserver(batch => mutations.push(...batch));
    observer.observe(list, { childList: true, subtree: true });
    list.scrollTop = 123; cards[0]!.click(); cards[1]!.click(); await Promise.resolve();
    expect(mutations).toHaveLength(0); expect(list.scrollTop).toBe(123);
    expect([...root.querySelectorAll(".rm-asset-card")]).toEqual(cards);
    expect(cards[0]!.classList.contains("active")).toBe(false); expect(cards[1]!.classList.contains("active")).toBe(true);
    observer.disconnect();
    root.querySelector<HTMLButtonElement>('[aria-label="리스트 뷰"]')!.click();
    expect(list.querySelectorAll(".rm-asset-row")).toHaveLength(RESOURCE_GALLERY_PAGE_SIZE);
    inputSearch("picture-240"); expect(list.querySelectorAll(".rm-asset-row")).toHaveLength(1);
  });

  it.each(["music", "sound"] as const)("virtualizes %s while keeping shell/search/row nodes and dirty detail", async kind => {
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(320);
    renderResourceManager(root, kind); await Promise.resolve();
    const shell = root.querySelector(".rm-classic-shell");
    const search = root.querySelector<HTMLInputElement>('[data-testid="audio-description-search"]')!;
    const scroller = root.querySelector<HTMLElement>(".rm-audio-rows")!;
    const rows = [...root.querySelectorAll<HTMLButtonElement>('[data-testid="audio-resource-row"]')];
    expect(rows.length).toBeGreaterThan(1); expect(rows.length).toBeLessThanOrEqual(22);
    rows[1]!.click();
    expect(root.querySelector(".rm-classic-shell")).toBe(shell);
    expect([...root.querySelectorAll('[data-testid="audio-resource-row"]')]).toEqual(rows);
    const detail = root.querySelector<HTMLTextAreaElement>('[data-testid="audio-description-input"]')!;
    detail.value = "pending draft"; detail.setSelectionRange(2, 5);
    search.focus(); search.value = "no-such-track"; search.dispatchEvent(new Event("input"));
    expect(document.activeElement).toBe(search); expect(root.querySelector('[data-testid="audio-description-input"]')).toBe(detail);
    expect(detail.value).toBe("pending draft"); expect(root.textContent).toContain("선택한 음원은 필터 결과 밖에 있습니다.");
    search.value = ""; search.dispatchEvent(new Event("input"));
    scroller.scrollTop = 1600; scroller.dispatchEvent(new Event("scroll"));
    expect(root.querySelector('[data-testid="audio-resource-row"]')?.getAttribute("data-resource-id")).not.toBe(rows[0]!.dataset.resourceId);
    expect(root.querySelectorAll('[data-testid="audio-resource-row"]').length).toBeLessThanOrEqual(22);
    // Category navigation keeps the existing dirty-draft decision contract.
    root.querySelector<HTMLButtonElement>(`[aria-label="${kind === "music" ? "효과음 (SE)" : "음악 (BGM)"}"]`)!.click();
    // Dirty navigation prompts, not silent draft loss.
    expect(root.querySelector(".rm-classic-shell")).toBe(shell);
    expect(root.querySelector('[data-testid="audio-description-input"]')).toBe(detail);
    expect(document.querySelector('[data-testid="audio-description-dirty-dialog"]')).not.toBeNull();
    document.querySelector<HTMLButtonElement>('[data-testid="audio-description-dirty-discard"]')!.click();
    await Promise.resolve();
    renderResourceManager(root, kind); // original initialKind on a store-driven refresh
    expect(root.querySelector('[data-testid="audio-resource-row"]')?.getAttribute("data-resource-kind"))
      .toBe(kind === "music" ? "sound" : "music");
    expect(listMonsterResources).not.toHaveBeenCalled();
  });

  it.each(["music", "sound"] as const)("retains %s row focus on scroll and tabs across both window boundaries", async kind => {
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(320);
    renderResourceManager(root, kind); await Promise.resolve();
    const scroller = root.querySelector<HTMLElement>(".rm-audio-rows")!;
    const mountedRows = () => [...scroller.querySelectorAll<HTMLButtonElement>('[data-testid="audio-resource-row"]')];
    const initial = mountedRows();
    const selected = initial.find(row => row.getAttribute("aria-pressed") === "true")!.dataset.resourceId;
    const focused = initial[8]!;
    focused.focus();
    scroller.scrollTop = 224;
    scroller.dispatchEvent(new Event("scroll"));
    expect(mountedRows()).toContain(focused);
    expect(document.activeElement).toBe(focused);

    const beforeForward = mountedRows();
    const tail = beforeForward.at(-1)!;
    tail.focus();
    const detail = root.querySelector('[data-testid="audio-description-input"]');
    const forward = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    tail.dispatchEvent(forward);
    expect(forward.defaultPrevented).toBe(true);
    const next = document.activeElement as HTMLButtonElement;
    expect(next.dataset.testid).toBe("audio-resource-row");
    expect(next.dataset.resourceId).not.toBe(tail.dataset.resourceId);
    expect(initial).not.toContain(next);
    const backward = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true });
    next.dispatchEvent(backward);
    expect(backward.defaultPrevented).toBe(true);
    expect((document.activeElement as HTMLElement).dataset.resourceId).toBe(tail.dataset.resourceId);
    expect(root.querySelector('[data-testid="audio-description-input"]')).toBe(detail);

    const head = mountedRows()[0]!;
    const headIndex = beforeForward.findIndex(row => row.dataset.resourceId === head.dataset.resourceId);
    const previous = beforeForward[headIndex - 1]!;
    expect(previous).toBeDefined();
    head.focus();
    const reverseBoundary = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true });
    head.dispatchEvent(reverseBoundary);
    expect(reverseBoundary.defaultPrevented).toBe(true);
    expect((document.activeElement as HTMLElement).dataset.resourceId).toBe(previous.dataset.resourceId);

    // Shift+Tab at the catalog's first row must still leave the list natively.
    scroller.scrollTop = 0; scroller.dispatchEvent(new Event("scroll"));
    const first = mountedRows()[0]!;
    first.focus();
    const exit = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true });
    first.dispatchEvent(exit);
    expect(exit.defaultPrevented).toBe(false);
    expect(root.querySelector('[data-testid="audio-resource-row"][aria-pressed="true"]')?.getAttribute("data-resource-id")).toBe(selected);

    // Tab at the last resource also leaves natively, rather than trapping focus.
    const count = listAudioResources(kind, store.getCurrent()).length;
    scroller.scrollTop = (count - 10) * 32; scroller.dispatchEvent(new Event("scroll"));
    const last = mountedRows().at(-1)!;
    last.focus();
    const lastExit = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    last.dispatchEvent(lastExit);
    expect(lastExit.defaultPrevented).toBe(false);
    expect(root.querySelector('[data-testid="audio-description-input"]')).toBe(detail);
  });

  it.each(["picture", "music", "sound"] as const)("releases both audio row observers on repeated %s manager teardown", async kind => {
    const observers: { target?: Element; disconnect: ReturnType<typeof vi.fn>; callback: ResizeObserverCallback }[] = [];
    vi.stubGlobal("ResizeObserver", class {
      target?: Element;
      readonly disconnect = vi.fn();
      constructor(readonly callback: ResizeObserverCallback) { observers.push(this); }
      observe(target: Element): void { this.target = target; }
    });
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(320);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      renderResourceManager(root, kind); await Promise.resolve();
      const owned = observers.filter(observer => observer.target?.classList.contains("rm-audio-rows"));
      expect(owned).toHaveLength(2 * (attempt + 1));
      const scroller = owned.at(-1)!.target as HTMLElement;
      const removeListener = vi.spyOn(scroller, "removeEventListener");
      disposeResourceManager(root); root.replaceChildren();
      for (const observer of owned) {
        expect(observer.disconnect).toHaveBeenCalledTimes(1);
        observer.callback([], observer as unknown as ResizeObserver);
      }
      scroller.scrollTop = 1600; scroller.dispatchEvent(new Event("scroll"));
      expect(scroller.querySelectorAll('[data-testid="audio-resource-row"]')).toHaveLength(0);
      expect(removeListener).toHaveBeenCalledWith("scroll", expect.any(Function));
    }
  });
});

describe("charset viewport ticker ownership", () => {
  it("draws only intersecting cards, honors hidden/reduced/obscured states and disposes on replacement", () => {
    vi.useFakeTimers(); let hidden = false, reduced = false;
    vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
    vi.spyOn(window, "matchMedia").mockReturnValue({ get matches() { return reduced; } } as MediaQueryList);
    const intersections: Array<{ callback: IntersectionObserverCallback; node?: Element; root: Element | Document | null; disconnect: ReturnType<typeof vi.fn> }> = [];
    vi.stubGlobal("IntersectionObserver", class {
      private entry: (typeof intersections)[number];
      constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit) {
        this.entry = { callback, root: options.root ?? null, disconnect: vi.fn() }; intersections.push(this.entry);
      }
      observe(node: Element) { this.entry.node = node; }
      disconnect() { this.entry.disconnect(); }
    });
    vi.stubGlobal("Image", class { complete = true; naturalWidth = 288; crossOrigin = ""; src = ""; });
    const draws = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ clearRect() {}, drawImage: draws } as unknown as CanvasRenderingContext2D);
    render("charset", [0, 1].map(i => ({ kind: "charset", name: `sheet-${i}`, assetId: `easyrpg-charset-actor${i + 1}` })), []);
    const grid = root.querySelector<HTMLButtonElement>('[aria-label="그리드 뷰"]')!;
    if (!grid.classList.contains("active")) grid.click();
    expect(intersections).toHaveLength(2);
    expect(intersections[0]!.node?.classList.contains("rm-charset-characters-strip")).toBe(true);
    expect(intersections[0]!.root).toBe(root.querySelector('[data-testid="resource-entry-list"]'));
    const intersect = (index: number, visible: boolean) => intersections[index]!.callback([
      { target: intersections[index]!.node!, isIntersecting: visible } as IntersectionObserverEntry,
    ], {} as IntersectionObserver);
    intersect(0, true); vi.advanceTimersByTime(260); expect(draws).toHaveBeenCalledTimes(8);
    vi.advanceTimersByTime(260); expect(draws).toHaveBeenCalledTimes(16);
    intersect(0, false); vi.advanceTimersByTime(520); expect(draws).toHaveBeenCalledTimes(16);
    intersect(1, true); reduced = true; vi.advanceTimersByTime(520); expect(draws).toHaveBeenCalledTimes(24);
    hidden = true; reduced = false; vi.advanceTimersByTime(520); expect(draws).toHaveBeenCalledTimes(24);
    hidden = false; root.dataset.testid = "resource-modal"; registerModal(root, () => {});
    const overlay = document.createElement("div"); document.body.append(overlay); registerModal(overlay, () => {});
    vi.advanceTimersByTime(520); expect(draws).toHaveBeenCalledTimes(24);
    unregisterModal(overlay); overlay.remove(); vi.advanceTimersByTime(260); expect(draws).toHaveBeenCalledTimes(32);
    disposeResourceWorkbench(root);
    expect(intersections.every(entry => entry.disconnect.mock.calls.length === 1)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
