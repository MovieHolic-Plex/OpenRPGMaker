import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aiImageGenerateField } from "@/editor/panels/aiImageGenerateField";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;
beforeEach(() => {
  restoreDom = installFakeDom();
  store.replace(createBlankProject());
});
afterEach(() => {
  restoreDom?.();
});

describe("aiImageGenerateField", () => {
  it("종류별 placeholder 와 testid 접두사로 렌더된다", () => {
    const face = renderWithFakeDom(() =>
      aiImageGenerateField({ kind: "faceset", testidPrefix: "face-ai", onInserted: vi.fn() })
    );
    const prompt = findByTestId(face, "face-ai-prompt");
    expect(prompt, "faceset 프롬프트 칸").not.toBeNull();
    expect(prompt?.getAttribute("placeholder")?.length ?? 0).toBeGreaterThan(0);
    expect(findByTestId(face, "face-ai-generate"), "faceset 생성 버튼").not.toBeNull();

    const title = renderWithFakeDom(() =>
      aiImageGenerateField({ kind: "title", testidPrefix: "title-ai", onInserted: vi.fn() })
    );
    expect(findByTestId(title, "title-ai-prompt"), "title 프롬프트 칸").not.toBeNull();
    expect(findByTestId(title, "title-ai-generate"), "title 생성 버튼").not.toBeNull();
  });

  it("빈 프롬프트는 요청하지 않는다", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const field = renderWithFakeDom(() =>
      aiImageGenerateField({ kind: "monster", testidPrefix: "monster-ai", onInserted: vi.fn() })
    );
    findByTestId(field, "monster-ai-generate")?.click();
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("종류별 프롬프트 접두사를 붙여 요청한다", async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
        seen.push(String((init?.body as string | undefined) ?? ""));
        return new Response(
          JSON.stringify({
            image: {
              dataUrl:
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFHAP/q842iQAAAABJRU5ErkJggg==",
              mimeType: "image/png",
              model: "gemini-3.8-flash",
              provider: "google-antigravity",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );
    const inserted: string[] = [];
    const field = renderWithFakeDom(() =>
      aiImageGenerateField({
        kind: "backdrop",
        testidPrefix: "backdrop-ai",
        onInserted: (id) => inserted.push(id),
      })
    );
    const prompt = findByTestId(field, "backdrop-ai-prompt");
    expect(prompt).not.toBeNull();
    if (prompt) prompt.value = "화산 동굴";
    findByTestId(field, "backdrop-ai-generate")?.click();
    await vi.waitFor(() => {
      expect(inserted.length).toBe(1);
    });
    expect(seen.length).toBe(1);
    expect(seen[0]).toContain("화산 동굴");
    expect(seen[0]).toContain("battle background");
    vi.unstubAllGlobals();
  });
});
