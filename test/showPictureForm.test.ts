/**
 * 그림 표시 폼이 런타임이 지원하는 변환을 전부 노출해야 한다.
 *
 * 회귀 배경: 런타임은 확대·투명도·회전·전환시간을 모두 지원하는데(pictures/pictureTween.ts,
 * types/events.ts:315-318) 폼이 커밋하는 필드는 pictureId/resourceId/x/y 넷뿐이었다.
 * 감독이 "60%로 줄여 15도 기울여 페이드인" 을 하려면 AI 툴이나 JSON 손편집으로 우회해야 했다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { showPictureBody } from "@/editor/panels/eventEditor/commandBodyPage3Native";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

type ShowPicture = Extract<Command, { kind: "showPicture" }>;

function stagedContext(initial: ShowPicture): {
  readonly context: CommandEditContext;
  readonly current: () => ShowPicture;
} {
  let staged = structuredClone(initial) as ShowPicture;
  return {
    context: {
      path: [1],
      actions: {
        addCommand: vi.fn(),
        insertCommand: vi.fn(),
        replaceCommand: (_path, command) => { staged = structuredClone(command) as ShowPicture; },
        deleteCommand: vi.fn(),
        moveCommand: vi.fn(),
        moveCommandTo: vi.fn(),
      },
      getCurrentCommand: () => staged,
    },
    current: () => staged,
  };
}

function change(node: FakeElement | null, value: string): void {
  expect(node).not.toBeNull();
  if (!node) return;
  node.value = value;
  node.dispatchEvent(new Event("change"));
}

const BASE: ShowPicture = { kind: "showPicture", pictureId: "pic1", resourceId: "", x: 0, y: 0 };

let restoreDom: (() => void) | undefined;
beforeEach(() => {
  restoreDom = installFakeDom();
  store.replace(createBlankProject());
});
afterEach(() => {
  restoreDom?.();
});

describe("그림 표시 폼", () => {
  it("확대·투명도·회전·전환시간 칸이 모두 있다", () => {
    const { context } = stagedContext(BASE);
    const body = renderWithFakeDom(() => showPictureBody(context, BASE));
    for (const testId of [
      "show-picture-scale-input",
      "show-picture-opacity-input",
      "show-picture-rotation-input",
      "show-picture-duration-input",
    ]) {
      expect(findByTestId(body, testId), `${testId} 칸이 없다`).not.toBeNull();
    }
  });

  it("입력한 값이 커맨드에 실린다", () => {
    const { context, current } = stagedContext(BASE);
    const body = renderWithFakeDom(() => showPictureBody(context, BASE));

    change(findByTestId(body, "show-picture-scale-input"), "60");
    change(findByTestId(body, "show-picture-opacity-input"), "50");
    change(findByTestId(body, "show-picture-rotation-input"), "15");
    change(findByTestId(body, "show-picture-duration-input"), "400");

    expect(current().scale).toBe(60);
    expect(current().opacity).toBe(128);
    expect(current().rotation).toBe(15);
    expect(current().durationMs).toBe(400);
  });

  it("기존 값이 있으면 칸에 채워진다", () => {
    const seeded: ShowPicture = { ...BASE, scale: 75, opacity: 200, rotation: -30, durationMs: 250 };
    const { context } = stagedContext(seeded);
    const body = renderWithFakeDom(() => showPictureBody(context, seeded));

    expect(findByTestId(body, "show-picture-scale-input")?.value).toBe("75");
    expect(findByTestId(body, "show-picture-opacity-input")?.value).toBe("78");
    expect(findByTestId(body, "show-picture-rotation-input")?.value).toBe("-30");
    expect(findByTestId(body, "show-picture-duration-input")?.value).toBe("250");
  });

  it("범위 밖 값은 폼에서 접어 런타임까지 새지 않는다", () => {
    const { context, current } = stagedContext(BASE);
    const body = renderWithFakeDom(() => showPictureBody(context, BASE));

    change(findByTestId(body, "show-picture-opacity-input"), "9999");
    expect(current().opacity).toBe(255);

    change(findByTestId(body, "show-picture-opacity-input"), "-40");
    expect(current().opacity).toBe(0);

    change(findByTestId(body, "show-picture-scale-input"), "0");
    expect(current().scale).toBe(1);
  });

  it("회전은 한 바퀴를 넘겨도 접지 않는다", () => {
    const { context, current } = stagedContext(BASE);
    const body = renderWithFakeDom(() => showPictureBody(context, BASE));
    change(findByTestId(body, "show-picture-rotation-input"), "540");
    expect(current().rotation).toBe(540);
  });

  it("좌표만 바꿔도 기존 변환값이 날아가지 않는다", () => {
    const seeded: ShowPicture = { ...BASE, scale: 50, opacity: 100, rotation: 10, durationMs: 300 };
    const { context, current } = stagedContext(seeded);
    const body = renderWithFakeDom(() => showPictureBody(context, seeded));

    change(findByTestId(body, "show-picture-x-input"), "120");

    expect(current().x).toBe(120);
    expect(current().scale).toBe(50);
    expect(current().opacity).toBe(100);
    expect(current().rotation).toBe(10);
    expect(current().durationMs).toBe(300);
  });

  it("미리보기 문구가 런타임과 같은 좌상단 앵커라고 알린다", () => {
    const { context } = stagedContext(BASE);
    const body = renderWithFakeDom(() => showPictureBody(context, BASE));
    // 예전 문구는 "중심 앵커" 였는데 런타임(transform-origin: top left)과 달랐다.
    const text = body.textContent ?? "";
    expect(text).toContain("왼쪽 위");
    expect(text).not.toContain("중심 앵커");
  });

  // 회귀: 불투명도 입력칸은 퍼센트(0~100)인데 미리보기가 255 로 나눠,
  // 100% 로 저작해도 반지가 opacity 0.39 로 보여 게임 화면과 어깃났다.
  it("미리보기 불투명도는 퍼센트를 그대로 반영한다", () => {
    const seeded: ShowPicture = { ...BASE, opacity: 255 };
    const { context } = stagedContext(seeded);
    const body = renderWithFakeDom(() => showPictureBody(context, seeded));

    expect(findByTestId(body, "show-picture-opacity-input")?.value).toBe("100");
    expect(Number(findByTestId(body, "show-picture-preview-marker")?.style.opacity)).toBe(1);
  });

  it("미리보기 불투명도는 입력 변경을 따라간다", () => {
    const { context } = stagedContext(BASE);
    const body = renderWithFakeDom(() => showPictureBody(context, BASE));

    change(findByTestId(body, "show-picture-opacity-input"), "50");

    expect(Number(findByTestId(body, "show-picture-preview-marker")?.style.opacity)).toBeCloseTo(0.5, 3);
  });

  it("AI로 만들기 칸이 있다", () => {
    const { context } = stagedContext(BASE);
    const body = renderWithFakeDom(() => showPictureBody(context, BASE));
    expect(findByTestId(body, "show-picture-ai-prompt"), "프롬프트 칸").not.toBeNull();
    expect(findByTestId(body, "show-picture-ai-generate"), "생성 버튼").not.toBeNull();
  });

  it("프롬프트로 그림을 만들면 업로드 리소스가 커맨드에 실린다", async () => {
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFHAP/q842iQAAAABJRU5ErkJggg==";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            image: { dataUrl: png, mimeType: "image/png", model: "gemini-3.8-flash", provider: "google-antigravity" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const { context, current } = stagedContext(BASE);
    const body = renderWithFakeDom(() => showPictureBody(context, BASE));
    const prompt = findByTestId(body, "show-picture-ai-prompt");
    expect(prompt).not.toBeNull();
    if (prompt) prompt.value = "달빛 창가";
    findByTestId(body, "show-picture-ai-generate")?.click();
    await vi.waitFor(() => {
      expect(current().resourceId.length).toBeGreaterThan(0);
    });
    const resourceId = current().resourceId;
    expect(store.getCurrent().assets.uploaded[resourceId]?.kind).toBe("picture");
    expect(store.getCurrent().assets.uploaded[resourceId]?.dataUrl).toBe(png);
    vi.unstubAllGlobals();
  });

  it("빈 프롬프트는 요청하지 않는다", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { context, current } = stagedContext(BASE);
    const body = renderWithFakeDom(() => showPictureBody(context, BASE));
    findByTestId(body, "show-picture-ai-generate")?.click();
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(current().resourceId).toBe("");
    vi.unstubAllGlobals();
  });
});
