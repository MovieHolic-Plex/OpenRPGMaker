import { describe, expect, it } from "vitest";
import { OPRN_CHANNELS, OPRN_CHANNEL_PREFIX } from "../../electron/shared/channels";
import { assetPutSchema, commitRecordSchema, saveProjectSchema } from "../../electron/shared/schemas";

describe("electron shared contract", () => {
  it("모든 채널 이름이 접두사로 시작하고 서로 다르다", () => {
    const names = Object.values(OPRN_CHANNELS);

    expect(names.length).toBeGreaterThan(10);
    expect(names.every((name) => name.startsWith(OPRN_CHANNEL_PREFIX))).toBe(true);
    expect(new Set(names).size).toBe(names.length);
  });

  it("저장 입력은 폴더·직렬화 텍스트·기대 sha 를 요구한다", () => {
    expect(saveProjectSchema.safeParse({ projectDir: "/p", serialized: "{}", expectedSha: null }).success).toBe(true);
    expect(saveProjectSchema.safeParse({ projectDir: "", serialized: "{}", expectedSha: null }).success).toBe(false);
    expect(saveProjectSchema.safeParse({ projectDir: "/p", expectedSha: null }).success).toBe(false);
    expect(saveProjectSchema.safeParse({ projectDir: "/p", serialized: "", expectedSha: null }).success).toBe(false);
  });

  it("자산 입력은 바이트 배열만 받는다", () => {
    const base = { projectDir: "/p", mime: "image/png", extension: "png" };

    expect(assetPutSchema.safeParse({ ...base, bytes: new Uint8Array([1, 2, 3]) }).success).toBe(true);
    expect(assetPutSchema.safeParse({ ...base, bytes: "not-bytes" }).success).toBe(false);
    expect(assetPutSchema.safeParse({ ...base }).success).toBe(false);
  });

  it("커밋 입력은 도구 목록 기본값을 채우고 신원을 요구한다", () => {
    const parsed = commitRecordSchema.parse({
      projectDir: "/p",
      identity: { id: "u1", label: "사용자", kind: "human" },
      reviewStatus: "direct",
      summary: "요약",
    });

    expect(parsed.toolNames).toEqual([]);
    expect(commitRecordSchema.safeParse({ projectDir: "/p", identity: { id: "", label: "x", kind: "human" }, reviewStatus: "direct", summary: "s" }).success).toBe(false);
  });
});