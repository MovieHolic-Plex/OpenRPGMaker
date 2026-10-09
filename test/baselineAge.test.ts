// 기준선 나이 경고. 실패가 아니라 경고여야 한다 — 만료로 실패시키면 게이트가 꺼진다.
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { baselineAgeDays, warnIfStale } from "../scripts/lib/baseline-age.mjs";

const NOW = Date.parse("2026-09-17T00:00:00Z");
const write = (doc: unknown) => {
  const p = join(mkdtempSync(join(tmpdir(), "bl-")), "b.json");
  writeFileSync(p, JSON.stringify(doc));
  return p;
};

describe("baselineAgeDays", () => {
  it("generatedAt 을 읽는다", () => {
    expect(baselineAgeDays({ generatedAt: "2026-09-07T00:00:00Z" }, NOW)).toBe(10);
  });

  it("ranAt 등 다른 이름도 읽는다", () => {
    expect(baselineAgeDays({ ranAt: "2026-09-16T00:00:00Z" }, NOW)).toBe(1);
    expect(baselineAgeDays({ updatedAt: "2026-09-16T00:00:00Z" }, NOW)).toBe(1);
  });

  it("시각이 없거나 파싱 불가면 null", () => {
    expect(baselineAgeDays({ tokens: [] }, NOW)).toBeNull();
    expect(baselineAgeDays({ generatedAt: "언젠가" }, NOW)).toBeNull();
  });
});

describe("warnIfStale", () => {
  const capture = () => {
    const lines: string[] = [];
    return { lines, log: (s: string) => lines.push(s) };
  };

  it("30일이 넘으면 경고한다", () => {
    const c = capture();
    const r = warnIfStale(write({ generatedAt: "2026-08-01T00:00:00Z" }), "dead-css", { now: NOW, log: c.log });
    expect(r.stale).toBe(true);
    expect(c.lines[0]).toContain("47일");
  });

  it("최근이면 조용하다", () => {
    const c = capture();
    const r = warnIfStale(write({ generatedAt: "2026-09-16T00:00:00Z" }), "dead-css", { now: NOW, log: c.log });
    expect(r.stale).toBe(false);
    expect(c.lines).toHaveLength(0);
  });

  it("시각이 없으면 넣으라고 안내한다 (실패는 아니다)", () => {
    const c = capture();
    const r = warnIfStale(write({ tokens: [] }), "dead-css", { now: NOW, log: c.log });
    expect(r.stale).toBe(false);
    expect(c.lines[0]).toContain("generatedAt");
  });

  it("파일이 없으면 조용히 넘어간다", () => {
    const c = capture();
    expect(warnIfStale("/tmp/없는-기준선.json", "x", { now: NOW, log: c.log })).toEqual({ days: null, stale: false });
    expect(c.lines).toHaveLength(0);
  });
});
