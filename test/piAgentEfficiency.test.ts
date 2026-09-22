import { describe, expect, it } from "vitest";
// 2026-09-23 조수 비효율 리뷰의 수정 회귀. 숫자 상한은 느슨하게 둔다 — 잡으려는 것은 «제곱·통째 복제로 되돌아감» 이다.
import {
  addPiAgentUsage, changedProjectKeys, createPiAgentLineDecoder, encodePiAgentEvent, restoreCheckpointProject,
  slimDoneEvent, unchangedHeavyKeys, type PiAgentDoneEvent, type PiAgentEvent,
} from "@/ai/piAgent/protocol";
import { createDraft } from "@/editor/tools/changeset";
import { spatialToolFingerprint } from "@/editor/tools/spatialToolState";
import { createBlankProject } from "@/project/defaults";
import { contentFingerprint } from "@/util/fingerprint";
import { jsonEqual } from "@/util/structuralJson";

function doneFor(project: ReturnType<typeof createBlankProject>): PiAgentDoneEvent {
  return { type: "done", project, stats: { ms: 1, turns: 1, toolCalls: 0, toolErrors: 0 }, changedKeys: [] };
}

describe("NDJSON 디코더", () => {
  it("조각을 어떻게 잘라도 같은 이벤트를 낸다", () => {
    const events: PiAgentEvent[] = [{ type: "turn", index: 1 }, { type: "assistant", text: "가\n나" }, { type: "heartbeat", at: 3 }];
    const wire = events.map(encodePiAgentEvent).join("");
    for (const size of [1, 2, 3, 7, 64, wire.length]) {
      const out: PiAgentEvent[] = [];
      const decoder = createPiAgentLineDecoder(event => out.push(event));
      for (let i = 0; i < wire.length; i += size) decoder.push(wire.slice(i, i + size));
      decoder.flush();
      expect(out, `조각 ${size}`).toEqual(events);
    }
  });

  it("끝 줄바꿈 없는 마지막 줄은 flush 가 낸다", () => {
    const out: PiAgentEvent[] = [];
    const decoder = createPiAgentLineDecoder(event => out.push(event));
    decoder.push(JSON.stringify({ type: "turn", index: 9 }));
    expect(out).toEqual([]);
    decoder.flush();
    expect(out).toEqual([{ type: "turn", index: 9 }]);
  });

  // Break: 조각마다 버퍼 처음부터 indexOf 하면 8 MB 줄 × 1 KiB 조각이 수십 초가 된다(실측 33.5 MB 에 51 s).
  it("큰 한 줄을 잘게 받아도 선형이다", () => {
    const line = encodePiAgentEvent({ type: "assistant", text: "x".repeat(8_000_000) });
    const out: PiAgentEvent[] = [];
    const decoder = createPiAgentLineDecoder(event => out.push(event));
    const started = performance.now();
    for (let i = 0; i < line.length; i += 1024) decoder.push(line.slice(i, i + 1024));
    const ms = performance.now() - started;
    expect(out).toHaveLength(1);
    expect(ms).toBeLessThan(3_000);
  });
});

describe("내용 판정", () => {
  it("jsonEqual 은 JSON 문자열 비교와 같은 답을 낸다(키 순서만 무시)", () => {
    const cases: [unknown, unknown][] = [
      [{ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 }],
      [{ a: 1, b: undefined }, { a: 1 }],
      [[1, undefined], [1, null]],
      [{ a: 1 }, { a: 2 }],
      [{ a: [1, 2] }, { a: [1, 2, 3] }],
      ["x", "x"], [null, null], [0, -0], [{ a: {} }, { a: [] }],
    ];
    for (const [a, b] of cases) {
      const viaJson = JSON.stringify(a) === JSON.stringify(b) || JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
      expect(jsonEqual(a, b), JSON.stringify([a, b])).toBe(viaJson);
    }
  });

  it("지문은 같은 내용에 같고 한 글자 차이에 다르다", () => {
    const project = createBlankProject();
    expect(spatialToolFingerprint(project)).toBe(spatialToolFingerprint(structuredClone(project)));
    const changed = structuredClone(project);
    Object.values(changed.maps)[0]!.lowerTiles[0] += 1;
    expect(spatialToolFingerprint(changed)).not.toBe(spatialToolFingerprint(project));
    expect(contentFingerprint("ab")).not.toBe(contentFingerprint("ba"));
    expect(contentFingerprint("")).toMatch(/^[0-9a-f]{32}$/);
  });

  // Break: 쓰기 도구마다 createDraft 가 타일셋을 복제해 정체성 판정이 늘 실패했고, 체크포인트가 쓰기마다 33.5 MB 였다.
  it("초안으로 복제해도 안 바뀐 무거운 키는 빼고 보낸다", () => {
    const base = createBlankProject();
    const draft = createDraft(base);
    Object.values(draft.maps)[0]!.lowerTiles[0] += 1;
    expect(draft.tilesets).not.toBe(base.tilesets);
    expect(unchangedHeavyKeys(base, draft)).toEqual(["tilesets", "database"]);
    expect(changedProjectKeys(base, draft)).toEqual([`maps.${Object.keys(draft.maps)[0]}`]);
  });

  it("done 은 요청 그대로인 타일셋·DB 를 빼고 보내고 받는 쪽이 되붙인다", () => {
    const base = createBlankProject();
    const result = createDraft(base);
    const slim = slimDoneEvent(doneFor(result), base);
    expect(slim.unchangedKeys).toEqual(["tilesets", "database"]);
    expect(Object.keys(slim.project.tilesets)).toEqual([]);
    const wire = JSON.parse(encodePiAgentEvent(slim)) as PiAgentDoneEvent;
    const restored = restoreCheckpointProject(base, wire.project, wire.unchangedKeys);
    expect(restored.tilesets).toBe(base.tilesets);
    expect(jsonEqual(restored, result)).toBe(true);
    // 타일셋이 바뀌었으면 그대로 싣는다.
    const edited = createDraft(base);
    const firstTileset = Object.values(edited.tilesets)[0]!;
    firstTileset.name = `${firstTileset.name}!`;
    expect(slimDoneEvent(doneFor(edited), base).unchangedKeys).toEqual(["database"]);
  });
});

describe("토큰 원장", () => {
  // Break: 마지막 호출의 usage 로 덮어써서 Pi 실행 41건의 토큰 원장이 0이었다.
  it("호출마다 더하고 호출 수를 센다", () => {
    let total = addPiAgentUsage(undefined, { input: 100, output: 10, cacheRead: 50, cacheWrite: 0, totalTokens: 160 });
    total = addPiAgentUsage(total, { input: 20, output: 5, cacheRead: 0, cacheWrite: 0 });
    total = addPiAgentUsage(total, undefined);
    expect(total).toEqual({ input: 120, output: 15, cacheRead: 50, cacheWrite: 0, totalTokens: 185, calls: 2 });
    expect(addPiAgentUsage(total, total)).toMatchObject({ input: 240, calls: 4 });
  });
});

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortKeys((value as Record<string, unknown>)[key])]));
  return value;
}
