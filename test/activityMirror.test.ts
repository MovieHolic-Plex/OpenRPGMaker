import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ACTIVITY_MIRROR_LIMITS,
  activityMirrorDir,
  handleActivityMirror,
} from "../scripts/lib/activityMirror.mjs";

// 왜 실제 파일을 쓰고 읽는가: 이 코어의 존재 이유가 "껍데기 어디서든 로그가 실제로 남는다"이고,
// 예전 사고는 전부 **404 나 경로 불일치로 조용히 0줄**이 되는 형태였다. 문자열 대조로는 그걸
// 못 잡는다. 임시 폴더에 진짜로 쓰고 진짜로 다시 읽는다.
describe("activity mirror core", () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), "oprn-mirror-"));
  });
  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it("AI 턴 로그를 jsonl·latest·index 에 남긴다", () => {
    const record = {
      id: "run-7",
      at: "2026-09-16T00:00:00.000Z",
      channel: "chat",
      instruction: "마을을 넓혀줘",
      result: { ok: false, error: "도구 실패" },
      toolCalls: [{ name: "place_tiles", ok: false }, { name: "list_maps", ok: true }],
    };
    const result = handleActivityMirror({
      method: "POST",
      url: "/__oprn/ai-activity",
      bodyText: JSON.stringify(record),
      baseDir,
    });

    expect(result?.status).toBe(204);
    const dir = activityMirrorDir("ai", baseDir);
    expect(existsSync(join(dir, "activity.jsonl"))).toBe(true);
    expect(existsSync(join(dir, "run-7.json"))).toBe(true);

    const index = JSON.parse(readFileSync(join(dir, "index.json"), "utf8"));
    expect(index[0].id).toBe("run-7");
    expect(index[0].ok).toBe(false);
    expect(index[0].failedTools).toEqual(["place_tiles"]);
  });

  it("편집 배치를 edits.jsonl 과 index 에 남기고 같은 seq 는 교체한다", () => {
    const post = (entries: unknown[]) =>
      handleActivityMirror({
        method: "POST",
        url: "/__oprn/edit-activity",
        bodyText: JSON.stringify({ entries }),
        baseDir,
      });

    expect(post([{ seq: 1, label: "타일", origin: "human" }])?.status).toBe(204);
    expect(post([{ seq: 2, label: "이벤트", origin: "ai" }])?.status).toBe(204);
    expect(post([{ seq: 1, label: "타일(병합)", origin: "human", mergedCount: 3 }])?.status).toBe(204);

    const dir = activityMirrorDir("edit", baseDir);
    const lines = readFileSync(join(dir, "edits.jsonl"), "utf8").trim().split("\n");
    expect(lines).toHaveLength(3);

    const index = JSON.parse(readFileSync(join(dir, "index.json"), "utf8"));
    expect(index.map((row: { seq: number }) => row.seq)).toEqual([1, 2]);
    expect(index[0].label).toBe("타일(병합)");
  });

  it("빈 배치를 400 으로 끊지 않는다", () => {
    // 400 을 주면 클라이언트가 미러를 영구히 끄고, 그 뒤로 로그가 조용히 0줄이 된다.
    const result = handleActivityMirror({
      method: "POST",
      url: "/__oprn/edit-activity",
      bodyText: JSON.stringify({ entries: [] }),
      baseDir,
    });
    expect(result?.status).toBe(204);
    expect(existsSync(join(activityMirrorDir("edit", baseDir), "edits.jsonl"))).toBe(false);
  });

  it("GET 이 latest/index 를 돌려주고 비어 있으면 [] 다", () => {
    const empty = handleActivityMirror({ method: "GET", url: "/__oprn/edit-activity", baseDir });
    expect(empty?.status).toBe(200);
    expect(empty?.body).toBe("[]");

    handleActivityMirror({
      method: "POST",
      url: "/__oprn/edit-activity",
      bodyText: JSON.stringify({ entries: [{ seq: 9, label: "하나" }] }),
      baseDir,
    });
    const latest = JSON.parse(
      handleActivityMirror({ method: "GET", url: "/__oprn/edit-activity", baseDir })?.body ?? "null",
    );
    expect(latest.label).toBe("하나");
  });

  it("상한 초과 배치를 413 으로 끊고 파일을 만들지 않는다", () => {
    const huge = "가".repeat(ACTIVITY_MIRROR_LIMITS.editMaxBodyBytes);
    const result = handleActivityMirror({
      method: "POST",
      url: "/__oprn/edit-activity",
      bodyText: JSON.stringify({ entries: [{ seq: 1, label: huge }] }),
      baseDir,
    });
    expect(result?.status).toBe(413);
    expect(existsSync(join(activityMirrorDir("edit", baseDir), "edits.jsonl"))).toBe(false);
  });

  it("경로를 모르면 null 을 돌려준다 — 부르는 쪽이 next() 로 흘려보낸다", () => {
    expect(handleActivityMirror({ method: "GET", url: "/index.html", baseDir })).toBeNull();
    expect(handleActivityMirror({ method: "GET", url: "/__oprn/bridge", baseDir })).toBeNull();
  });

  it("AI 로그의 id 가 경로 탈출을 시도하면 파일명에 쓰지 않는다", () => {
    const dir = activityMirrorDir("ai", baseDir);
    const result = handleActivityMirror({
      method: "POST",
      url: "/__oprn/ai-activity",
      bodyText: JSON.stringify({ id: "../../escaped", channel: "chat" }),
      baseDir,
    });

    expect(result?.status).toBe(204);
    expect(existsSync(join(baseDir, "escaped.json"))).toBe(false);
    expect(existsSync(join(baseDir, "..", "escaped.json"))).toBe(false);
    const written = readFileSync(join(dir, "activity.jsonl"), "utf8");
    expect(written).toContain("../../escaped");
  });
});
