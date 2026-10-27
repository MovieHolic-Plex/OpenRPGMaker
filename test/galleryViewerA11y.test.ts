// @vitest-environment happy-dom
// 갤러리 전체 화면: 보이는 캡션이 대화상자 이름이고, 좌우로 넘기면 그 문장을 알린다.
import { afterEach, describe, expect, it } from "vitest";
import { closeGalleryViewer, openGalleryViewer, stepGalleryViewer } from "@/player/galleryViewer";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";

afterEach(() => {
  closeGalleryViewer();
  document.body.replaceChildren();
});

describe("gallery viewer accessibility", () => {
  it("names the dialog with the visible caption and announces the next picture", () => {
    store.replace(deserialize(serialize(createBlankProject())));
    const opener = document.createElement("button");
    opener.textContent = "그림 열기";
    document.body.append(opener);
    opener.focus();

    openGalleryViewer({
      project: store.getCurrent(),
      resourceIds: ["gallery-missing-a", "gallery-missing-b"],
      index: 0,
    });

    const dialog = document.querySelector<HTMLElement>("[data-testid='gallery-viewer']");
    const caption = document.querySelector<HTMLElement>("[data-testid='gallery-viewer-caption']");
    expect(dialog?.getAttribute("role")).toBe("dialog");
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(dialog?.getAttribute("aria-labelledby")).toBe(caption?.id);
    expect(caption?.textContent).toBe("갤러리 1/2 · 그림");
    expect(dialog?.getAttribute("aria-describedby")).toBe("gallery-viewer-missing");
    expect(document.getElementById("gallery-viewer-missing")?.textContent).toBe("그림을 찾을 수 없습니다.");
    expect(document.activeElement).toBe(dialog);
    const announcement = document.querySelector("[data-testid='gallery-viewer-announcement']");
    expect(announcement?.getAttribute("role")).toBe("status");
    expect(announcement?.getAttribute("aria-live")).toBe("polite");
    expect(announcement?.textContent).toBe("");

    const closeButton = document.querySelector<HTMLButtonElement>("[data-testid='gallery-viewer-close']");
    closeButton?.focus();
    stepGalleryViewer(1);
    expect(document.activeElement).toBe(closeButton);
    expect(document.querySelector("[data-testid='gallery-viewer-announcement']")).toBe(announcement);
    expect(caption?.textContent).toBe("갤러리 2/2 · 그림");
    expect(document.querySelector("[data-testid='gallery-viewer-announcement']")?.textContent).toBe(
      "갤러리 2/2 · 그림. 그림을 찾을 수 없습니다.",
    );
    closeGalleryViewer();
    expect(document.querySelector("[data-testid='gallery-viewer']")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
