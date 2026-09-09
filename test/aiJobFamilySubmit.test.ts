// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { openDatabaseAiGenerateDialog } from "@/editor/panels/databaseAiGenerateDialog";
import { aiImageGenerateField } from "@/editor/panels/aiImageGenerateField";
import { executeBridgeCommand, sendAiAssistantMessage } from "@/editor/aiAssistantBridge";
import { submitAssistantJob } from "@/editor/aiJobs/submitAssistantJob";
import { DEFAULT_TILESET_TEXTURE_KEY } from "@/project/defaults/constants";
import { sha256HexBytes } from "@/util/sha256";
import { installAdmitClient, PNG_1x1 } from "./aiJobAdmitSupport";

let harness: ReturnType<typeof installAdmitClient>;

beforeEach(async () => {
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false, disabledReason: "load-failed" });
  await store.loadFallbackProject(createBlankProject());
  harness = installAdmitClient();
});

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("database generate dialog admits one database job instead of applying from the dialog", async () => {
  const dialog = openDatabaseAiGenerateDialog({ kind: "item", rerender: () => undefined });
  document.body.append(dialog);
  const brief = dialog.querySelector<HTMLTextAreaElement>('[data-testid="db-ai-generate-brief"]');
  const run = dialog.querySelector<HTMLButtonElement>('[data-testid="db-ai-generate-run"]');
  expect(brief && run).toBeTruthy();
  const before = store.getCurrent().database.items.map(item => item.id);
  brief!.value = "ZXQ-허브-테스트-아이템";
  const pending = harness.nextAdmitted();
  run!.click();
  const admitted = await pending;
  expect(admitted.input.family).toBe("database");
  expect(admitted.input.mode).toBe("review");
  expect(admitted.input.payload.kind).toBe("item");
  expect(store.getCurrent().database.items.map(item => item.id)).toEqual(before);
  expect(brief!.value).toBe("ZXQ-허브-테스트-아이템");
});

it("image generate field admits one image job and does not insert via onInserted", async () => {
  const enemyId = store.getCurrent().database.enemies[0]?.id ?? "enemy-1";
  const field = aiImageGenerateField({
    kind: "monster",
    testidPrefix: "q",
    destination: { kind: "database", table: "enemies", recordId: enemyId, field: "monsterResourceId" },
  });
  document.body.append(field);
  const prompt = field.querySelector<HTMLInputElement>('[data-testid="q-prompt"]');
  const generate = field.querySelector<HTMLButtonElement>('[data-testid="q-generate"]');
  expect(prompt && generate).toBeTruthy();
  prompt!.value = "푸른 슬라임";
  const pending = harness.nextAdmitted();
  generate!.click();
  const admitted = await pending;
  expect(admitted.input.family).toBe("image");
  expect(admitted.input.mode).toBe("review");
  expect(Object.keys(store.getCurrent().assets.uploaded)).toHaveLength(0);
});

it("assistant bridge admits without a mounted chat panel when a project is loaded", async () => {
  const pending = harness.nextAdmitted();
  const result = await sendAiAssistantMessage("마을 입구를 만들어 주세요");
  await pending;
  expect(harness.admits.map(request => request.input.family)).toEqual(["assistant"]);
  expect(harness.admits[0]?.input.mode).toBe("review");
  expect(result.ok).toBe(true);
  expect(result.error).toBeUndefined();
});

it("assistant admission pins bundled tileset artwork before the job is sent", async () => {
  const pending = harness.nextAdmitted();
  await sendAiAssistantMessage("마을 입구를 만들어 주세요");
  const admitted = await pending;
  const pin = admitted.input.payload.reportAssets as Record<string, { sha256: string; byteLength: number; mediaType: string }>;
  const expected = {
    sha256: await sha256HexBytes(PNG_1x1),
    byteLength: PNG_1x1.byteLength,
    mediaType: "image/png",
  };
  expect(pin[DEFAULT_TILESET_TEXTURE_KEY]).toEqual(expected);
  expect(admitted.artwork.some(item => item.mediaType === "image/png" && item.base64.length > 0)).toBe(true);
});

it("MCP send admits the parent assistant job without a mounted chat panel", async () => {
  const pending = harness.nextAdmitted();
  const result = await executeBridgeCommand({ id: "cmd-1", type: "send", text: "마을 입구를 만들어 주세요" });
  await pending;
  expect(harness.admits).toHaveLength(1);
  expect(harness.admits[0]?.input.family).toBe("assistant");
  expect(result).toMatchObject({ ok: true });
});

it("freezes loaded project identity at admission, not after a later switch", async () => {
  const identity = store.getLoadedProjectIdentity();
  const pending = harness.nextAdmitted();
  await sendAiAssistantMessage("첫 요청");
  await pending;
  store.replaceProject(createBlankProject());
  expect(harness.admits[0]?.input.project).toEqual(identity);
  expect(harness.admits[0]?.input.project).not.toEqual(store.getLoadedProjectIdentity());
});

it("retains auto when an autonomous turn is submitted without a mode override", async () => {
  const pending = harness.nextAdmitted();
  await submitAssistantJob({
    instruction: "마을 입구를 만들어 주세요",
    turn: { autonomous: true },
  });
  const admitted = await pending;
  expect(admitted.input.mode).toBe("auto");
  expect(admitted.input.payload.turn).toMatchObject({ autonomous: true });
});

it("uses explicit request.mode review even when the turn is autonomous", async () => {
  const pending = harness.nextAdmitted();
  await submitAssistantJob({
    instruction: "마을 입구를 만들어 주세요",
    turn: { autonomous: true },
    mode: "review",
  });
  const admitted = await pending;
  expect(admitted.input.mode).toBe("review");
  expect(admitted.input.payload.turn).toMatchObject({ autonomous: true });
});
