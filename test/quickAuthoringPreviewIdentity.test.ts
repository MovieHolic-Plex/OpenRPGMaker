import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderCommandPreview } from "@/editor/panels/eventEditor/commandPreview";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

/**
 * 「빠른 저작」 미리보기 식별성 계약 —
 * .omo/plans/event-editor-quick-authoring-adversarial-review.md
 *
 * 빈 본문이 '...' 로만 끝나지 않고, 얼굴은 카피가 아니라 실제 시트 그림이며,
 * 자리수 캡션은 변수 표시명에 잡아먹히지 않고, 대기는 요약 카드가 아니라 타임라인이다.
 */
describe("quick-authoring preview identity", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("empty text body previews a sample sentence instead of '...'", () => {
    const preview = renderWithFakeDom(() => renderCommandPreview({ kind: "text", body: "" }));
    const body = findByTestId(preview, "ecp-message-body");
    expect(body).not.toBeNull();
    const text = (body?.textContent ?? "").trim();
    expect(text).not.toBe("...");
    expect(text.length).toBeGreaterThan(3);
    expect(findByTestId(preview, "ecp-message-sample")).not.toBeNull();
  });

  it("authored text still renders verbatim (no sample injection)", () => {
    const preview = renderWithFakeDom(() =>
      renderCommandPreview({ kind: "text", body: "마을에 온 걸 환영하네." })
    );
    expect(findByTestId(preview, "ecp-message-sample")).toBeNull();
    expect(preview.textContent).toContain("마을에 온 걸 환영하네.");
  });

  it("changeFace preview carries the real standalone face image inside the face box", () => {
    const preview = renderWithFakeDom(() =>
      renderCommandPreview({
        kind: "changeFace",
        resourceId: "easyrpg-faceset-actor1-02",
        position: "left",
        flipHorizontally: false,
      })
    );
    const crop = findByTestId(preview, "event-command-face-crop");
    expect(crop?.className).toContain("faceset-crop-box");
    const sheet = findByTestId(preview, "faceset-crop-sheet") as FakeElement | null;
    expect(sheet?.tagName).toBe("IMG");
    expect(sheet?.attrs.src).toContain("/assets/easyrpg/faceset/Actor1/02.png");
  });

  it("inputNumber digit caption never carries the variable display name", () => {
    const project = store.getCurrent();
    const variableId = project.variables[0]?.id ?? "var_0001";
    const variableName = project.variables[0]?.name?.trim() ?? "";
    const preview = renderWithFakeDom(() =>
      renderCommandPreview({ kind: "inputNumber", variableId, digits: 3 })
    );
    const meta = findByTestId(preview, "ecp-number-meta");
    expect(meta?.textContent).toContain("3자리");
    if (variableName) expect(meta?.textContent ?? "").not.toContain(variableName);
    // 저장 위치는 별도 줄에서만 이름을 밝힌다.
    expect(findByTestId(preview, "ecp-number-target")?.textContent ?? "").toContain(variableName || "");
  });

  it("wait preview is a timeline with one duration label, not a duplicated card", () => {
    const preview = renderWithFakeDom(() => renderCommandPreview({ kind: "wait", ms: 500 }));
    expect(findByTestId(preview, "ecp-wait-timeline")).not.toBeNull();
    expect(findByTestId(preview, "ecp-wait-gap")?.textContent).toContain("0.5초");
    const occurrences = (preview.textContent ?? "").split("0.5초").length - 1;
    expect(occurrences).toBe(1);
  });
});
