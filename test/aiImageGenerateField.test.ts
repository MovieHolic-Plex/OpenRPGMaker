// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aiImageGenerateField } from "@/editor/panels/aiImageGenerateField";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { installAdmitClient } from "./aiJobAdmitSupport";

const monsterDest = { kind: "database" as const, table: "enemies" as const, recordId: "e1", field: "monsterResourceId" as const };
const faceDest = { kind: "database" as const, table: "actors" as const, recordId: "a1", field: "faceResourceId" as const };
const titleDest = { kind: "system" as const, field: "titleScreen.backgroundResourceId" as const };

let restoreDom: (() => void) | undefined;
beforeEach(async () => {
  restoreDom = installFakeDom();
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false, disabledReason: "load-failed" });
  await store.loadFallbackProject(createBlankProject());
});
afterEach(() => {
  restoreDom?.();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("aiImageGenerateField", () => {
  it("종류별 placeholder 와 testid 접두사로 렌더된다", () => {
    const face = renderWithFakeDom(() =>
      aiImageGenerateField({ kind: "faceset", testidPrefix: "face-ai", destination: faceDest }),
    );
    const prompt = findByTestId(face, "face-ai-prompt");
    expect(prompt, "faceset 프롬프트 칸").not.toBeNull();
    expect(prompt?.getAttribute("placeholder")?.length ?? 0).toBeGreaterThan(0);
    expect(findByTestId(face, "face-ai-generate"), "faceset 생성 버튼").not.toBeNull();

    const title = renderWithFakeDom(() =>
      aiImageGenerateField({ kind: "title", testidPrefix: "title-ai", destination: titleDest }),
    );
    expect(findByTestId(title, "title-ai-prompt"), "title 프롬프트 칸").not.toBeNull();
    expect(findByTestId(title, "title-ai-generate"), "title 생성 버튼").not.toBeNull();
  });

  it("빈 프롬프트는 요청하지 않는다", async () => {
    const harness = installAdmitClient();
    const field = renderWithFakeDom(() =>
      aiImageGenerateField({ kind: "monster", testidPrefix: "monster-ai", destination: monsterDest }),
    );
    findByTestId(field, "monster-ai-generate")?.click();
    expect(harness.admits).toHaveLength(0);
  });

  it("종류별 프롬프트 접두사를 붙여 맡긴다", async () => {
    const harness = installAdmitClient();
    const troopId = store.getCurrent().database.troops[0]?.id ?? "troop-1";
    const field = aiImageGenerateField({
      kind: "backdrop",
      testidPrefix: "backdrop-ai",
      destination: { kind: "database", table: "troops", recordId: troopId, field: "previewBackgroundResourceId" },
    });
    document.body.append(field);
    const prompt = field.querySelector<HTMLInputElement>('[data-testid="backdrop-ai-prompt"]');
    const generate = field.querySelector<HTMLButtonElement>('[data-testid="backdrop-ai-generate"]');
    expect(prompt && generate).toBeTruthy();
    prompt!.value = "화산 동굴";
    const pending = harness.nextAdmitted();
    generate!.click();
    const admitted = await pending;
    expect(String(admitted.input.payload.prompt)).toContain("화산 동굴");
    expect(String(admitted.input.payload.prompt)).toContain("battle background");
    expect(admitted.input.payload.kind).toBe("backdrop");
    expect(admitted.input.target).toMatchObject({ table: "troops", recordId: troopId });
  });
});
