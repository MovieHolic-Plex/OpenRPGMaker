import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderEventEditor } from "@/editor/panels/eventEditor";
import { openEventCommandPicker } from "@/editor/panels/eventEditor/commandPicker";
import { renderEventEditorContent } from "@/editor/panels/eventEditor/content";
import { openNpcGraphicDialog } from "@/editor/panels/eventEditor/graphicDialog";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EventPage, GameEvent } from "@/project/types";

class FakeNode {
  protected childNodes: (FakeNode | string)[] = [];
  parentElement: FakeElement | null = null;

  append(...nodes: (FakeNode | string)[]): void {
    for (const node of nodes) {
      if (node instanceof FakeNode && this instanceof FakeElement) {
        node.parentElement = this;
      }
      this.childNodes.push(node);
    }
  }

  get textContent(): string {
    return this.childNodes.map((node) => String(node instanceof FakeNode ? node.textContent : node)).join("");
  }

  set textContent(value: string) {
    this.childNodes = [value];
  }

  get firstChild(): FakeNode | string | null {
    return this.childNodes[0] ?? null;
  }

  removeChild(node: FakeNode | string): FakeNode | string {
    const index = this.childNodes.indexOf(node);
    if (index >= 0) this.childNodes.splice(index, 1);
    if (node instanceof FakeNode) node.parentElement = null;
    return node;
  }
}

class FakeElement extends FakeNode {
  className = "";
  value = "";
  checked = false;
  disabled = false;
  type = "";
  readonly style = {
    setProperty: () => undefined,
  };
  readonly dataset: Record<string, string> = {};
  private readonly attributes: Record<string, string> = {};

  constructor(readonly tagName: string) {
    super();
  }

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }

  addEventListener(): void {
  }

  prepend(...nodes: (FakeNode | string)[]): void {
    for (const node of nodes.slice().reverse()) {
      if (node instanceof FakeNode) node.parentElement = this;
      this.childNodes.unshift(node);
    }
  }

  remove(): void {
    this.parentElement?.removeChild(this);
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const matches: FakeElement[] = [];
    this.collectMatches(selector, matches);
    return matches;
  }

  private collectMatches(selector: string, matches: FakeElement[]): void {
    for (const node of this.childNodes) {
      if (!(node instanceof FakeElement)) continue;
      if (node.matchesSelector(selector)) matches.push(node);
      node.collectMatches(selector, matches);
    }
  }

  private matchesSelector(selector: string): boolean {
    if (selector.startsWith(".")) {
      return this.className.split(" ").includes(selector.slice(1));
    }
    const testId = selector.match(/^\[data-testid=['"]?([^'"\]]+)['"]?\]$/u)?.[1];
    if (testId) return this.dataset.testid === testId;
    return false;
  }
}

const fakeDocument = {
  createElement: (tagName: string): HTMLElement => new FakeElement(tagName) as unknown as HTMLElement,
  createTextNode: (text: string): Node => {
    const node = new FakeNode();
    node.textContent = text;
    return node as unknown as Node;
  },
};

function fakeContainer(): HTMLElement {
  return new FakeElement("div") as unknown as HTMLElement;
}

function eventPage(): EventPage {
  return {
    id: "page-1",
    name: "EV001",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "text", body: "Hello" }],
  };
}

function gameEvent(page: EventPage): GameEvent {
  return {
    id: "event-1",
    x: 2,
    y: 3,
    trigger: { kind: "action" },
    commands: [],
    pages: [page],
  };
}

describe("RPG Maker style event editor entry points", () => {
  beforeEach(() => {
    vi.stubGlobal("Node", FakeNode);
    vi.stubGlobal("document", fakeDocument);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes the sidebar launcher and modal editor entry points", () => {
    expect(typeof renderEventEditor).toBe("function");
    expect(typeof openEventEditorModal).toBe("function");
    expect(typeof openEventCommandPicker).toBe("function");
    expect(typeof openNpcGraphicDialog).toBe("function");
  });

  it("renders missing map/event messages localized in Korean", () => {
    const project = createBlankProject();
    store.replace(project);

    const sidebar = fakeContainer();
    editorState.set({ currentMapId: "missing-map", selectedEventId: null });
    renderEventEditor(sidebar);
    expect(sidebar.textContent).toContain("맵을 찾을 수 없습니다.");
    expect(sidebar.textContent).not.toContain("Map not found.");

    const missingMapContent = fakeContainer();
    renderEventEditorContent(missingMapContent, "missing-map", "missing-event");
    expect(missingMapContent.textContent).toContain("맵을 찾을 수 없습니다.");
    expect(missingMapContent.textContent).not.toContain("Map not found.");

    const missingEventContent = fakeContainer();
    renderEventEditorContent(missingEventContent, project.startMapId, "missing-event");
    expect(missingEventContent.textContent).toContain("이벤트를 찾을 수 없습니다.");
    expect(missingEventContent.textContent).not.toContain("Event not found.");
  });

  it("exposes classic ontology-aligned shell markers for a populated event page", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    const page = eventPage();
    map.events = [gameEvent(page)];
    store.replace(project);
    editorState.set({ selectedEventPageId: page.id });

    const content = fakeContainer();
    renderEventEditorContent(content, project.startMapId, "event-1");

    const requiredShellMarkers = [
      "event-classic-name",
      "event-classic-page-controls",
      "event-classic-conditions",
      "event-classic-graphic",
      "event-classic-movement-type",
      "event-classic-trigger",
      "event-classic-animation-type",
      "event-classic-movement-speed",
      "event-classic-contents",
    ];
    for (const testId of requiredShellMarkers) {
      expect(content.querySelector(`[data-testid="${testId}"]`), testId).not.toBeNull();
    }
  });

  it("renders the classic page toolbar with icons and a left-attached page tab strip", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    const pages = [
      { ...eventPage(), id: "page-1", name: "EV0002" },
      { ...eventPage(), id: "page-2", name: "EV0002-2" },
      { ...eventPage(), id: "page-3", name: "EV0002-3" },
    ];
    map.events = [{ ...gameEvent(pages[0]), pages }];
    store.replace(project);
    editorState.set({ selectedEventPageId: "page-3" });

    const content = fakeContainer();
    renderEventEditorContent(content, project.startMapId, "event-1");

    const pageActionExpectations = [
      ["event-page-add", "New Page"],
      ["event-page-copy", "Copy Page"],
      ["event-page-paste", "Paste Page"],
      ["event-page-delete", "Delete Page"],
    ] as const;
    for (const [testId, label] of pageActionExpectations) {
      const button = content.querySelector(`[data-testid="${testId}"]`);
      expect(button?.textContent).toContain(label);
      expect(button?.querySelector(".event-page-button-icon")).not.toBeNull();
    }

    const tabStrip = content.querySelector('[data-testid="event-classic-page-tabs"]');
    expect(tabStrip?.textContent).toBe("123");
    expect(content.querySelector('[data-testid="event-page-tab-3"]')?.className).toContain("active");
  });
});
