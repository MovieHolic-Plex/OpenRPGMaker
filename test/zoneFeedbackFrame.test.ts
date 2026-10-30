// Zone feedback is asked every play frame. Suppression used to walk the dialogue host and
// then the document once per overlay id, and an unchanged line rewrote its text node.
import { afterEach, describe, expect, it } from "vitest";

import { createZoneFeedbackDom, feedbackSuppressedByOverlay } from "@/player/playSceneZoneFeedback";
import { createZoneFeedbackModel, updateZoneFeedback, type ZoneFeedbackView } from "@/player/zoneFeedback";
import { FakeElement, installFakeDom } from "./fakeDom";

const SUPPRESSING_TEST_IDS = [
  "dialogue-box",
  "battle-scene",
  "title-screen",
  "game-over-screen",
  "main-menu",
  "status-menu",
  "shop-scene",
  "inn-scene",
  "chest-scene",
  "ending-screen",
] as const;

let restoreDom: (() => void) | null = null;

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
});

function field(): FakeElement {
  restoreDom = installFakeDom();
  const host = new FakeElement("div");
  (document.body as unknown as FakeElement).append(host);
  return host;
}

function watch(host: FakeElement): { host: number; document: number; selector: string } {
  const counts = { host: 0, document: 0, selector: "" };
  const hostQuery = host.querySelector.bind(host);
  Object.assign(host, {
    querySelector: (selector: string) => {
      counts.host += 1;
      counts.selector = selector;
      return hostQuery(selector);
    },
  });
  const doc = host.ownerDocument as unknown as { querySelector(selector: string): FakeElement | null };
  const docQuery = doc.querySelector.bind(doc);
  Object.assign(doc, {
    querySelector: (selector: string) => {
      counts.document += 1;
      counts.selector = selector;
      return docQuery(selector);
    },
  });
  return counts;
}

function overlay(testId: string): FakeElement {
  const node = new FakeElement("div");
  node.dataset.testid = testId;
  return node;
}

describe("zone feedback frame", () => {
  it("scans a clear field once on the host and once on the document", () => {
    const host = field();
    const counts = watch(host);
    expect(feedbackSuppressedByOverlay(host as unknown as HTMLElement)).toBe(false);
    expect(counts.host).toBe(1);
    expect(counts.document).toBe(1);
    expect(counts.selector.split(",")).toEqual(
      SUPPRESSING_TEST_IDS.map((id) => `[data-testid='${id}']`),
    );
    host.append(overlay("zone-feedback"));
    expect(feedbackSuppressedByOverlay(host as unknown as HTMLElement)).toBe(false);
  });

  it("hides for an overlay inside a detached host without asking the document", () => {
    restoreDom = installFakeDom();
    const host = new FakeElement("div");
    host.append(overlay("dialogue-box"));
    const counts = watch(host);
    expect(feedbackSuppressedByOverlay(host as unknown as HTMLElement)).toBe(true);
    expect(counts.host).toBe(1);
    expect(counts.document).toBe(0);
  });

  it("hides for every suppressing overlay, including one mounted outside the host", () => {
    const host = field();
    for (const testId of SUPPRESSING_TEST_IDS) {
      const node = overlay(testId);
      host.append(node);
      expect(feedbackSuppressedByOverlay(host as unknown as HTMLElement), testId).toBe(true);
      node.remove();
    }
    const shop = overlay("shop-scene");
    (document.body as unknown as FakeElement).append(shop);
    const counts = watch(host);
    expect(feedbackSuppressedByOverlay(host as unknown as HTMLElement)).toBe(true);
    expect(counts.host).toBe(1);
    expect(counts.document).toBe(1);
    expect(feedbackSuppressedByOverlay(null)).toBe(true);
  });

  it("reuses the model while the message is stable and keeps an unchanged text node", () => {
    const host = field();
    const entries = [{ surface: "banner", message: "골목", durationMs: 0 }];
    const shown = updateZoneFeedback(createZoneFeedbackModel([]), {
      entries, nowMs: 0, prompt: "Z 조사", suppressed: false,
    });
    const idle = updateZoneFeedback(shown.model, {
      entries, nowMs: 16, prompt: "Z 조사", suppressed: false,
    });
    expect(idle.model).toBe(shown.model);
    expect(idle.effects).toBe(shown.effects);
    expect(idle.view.banner).toBe("골목");

    const expired = updateZoneFeedback(shown.model, {
      entries, nowMs: 1500, prompt: null, suppressed: false,
    });
    expect(expired.model).not.toBe(shown.model);
    expect(expired.view.banner).toBeNull();

    const dom = createZoneFeedbackDom(host as unknown as HTMLElement);
    const view: ZoneFeedbackView = {
      banner: "골목", toast: null, objective: "열쇠", prompt: "Z 조사", suppressed: false,
    };
    dom.render(view, []);
    const banner = host.querySelector("[data-testid='zone-feedback-banner']") as FakeElement;
    const text = banner.firstChild;
    let hiddenWrites = 0;
    let hidden = banner.hidden;
    Object.defineProperty(banner, "hidden", {
      configurable: true,
      get: () => hidden,
      set: (value: boolean) => { hiddenWrites += 1; hidden = value; },
    });
    dom.render(view, []);
    expect(banner.firstChild).toBe(text);
    expect(hiddenWrites).toBe(0);
    dom.render({ ...view, banner: "광장" }, []);
    expect(banner.textContent).toBe("광장");
    expect(banner.firstChild).not.toBe(text);

    const root = host.querySelector("[data-testid='zone-feedback']") as FakeElement;
    let removes = 0;
    const remove = root.remove.bind(root);
    Object.assign(root, { remove: () => { removes += 1; remove(); } });
    dom.render({ ...view, banner: "광장", suppressed: true }, []);
    dom.render({ ...view, banner: "광장", suppressed: true }, []);
    expect(removes).toBe(1);
    dom.destroy();
  });

  it("advances the cursor without copying the seen set when the same line is appended", () => {
    const entries = [{ surface: "banner", message: "골목", durationMs: 0 }];
    const shown = updateZoneFeedback(createZoneFeedbackModel([]), {
      entries, nowMs: 0, prompt: null, suppressed: false,
    });
    entries.push({ surface: "banner", message: "골목", durationMs: 0 });
    const repeated = updateZoneFeedback(shown.model, {
      entries, nowMs: 32, prompt: null, suppressed: false,
    });
    expect(repeated.model).not.toBe(shown.model);
    expect(repeated.model.cursor).toBe(2);
    expect(repeated.model.seen).toBe(shown.model.seen);
    expect(repeated.view.banner).toBe("골목");
  });

  it("still chimes once when a checkpoint toast arrives", () => {
    const entries = [{ surface: "checkpoint", message: "쉼터", durationMs: 1000 }];
    const chimed = updateZoneFeedback(createZoneFeedbackModel([]), {
      entries, nowMs: 0, prompt: null, suppressed: false,
    });
    expect(chimed.effects).toEqual([{ kind: "checkpointChime" }]);
    expect(chimed.view.toast).toBe("쉼터");
    const quiet = updateZoneFeedback(chimed.model, {
      entries, nowMs: 16, prompt: null, suppressed: false,
    });
    expect(quiet.model).toBe(chimed.model);
    expect(quiet.effects).toEqual([]);
    expect(quiet.view.toast).toBe("쉼터");
  });
});
