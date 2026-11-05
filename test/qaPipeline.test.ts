import { describe, expect, it } from "vitest";
import { planCoverage, staticLint } from "../scripts/qa/pipeline/lib/plan.mjs";
import { detectRun, groupDeterministic, selectForObserver } from "../scripts/qa/pipeline/lib/detect.mjs";
import { measurePlants } from "../scripts/qa/pipeline/lib/measure.mjs";
import { extractJson } from "../scripts/qa/pipeline/lib/models.mjs";
import { reviewCandidates } from "../scripts/qa/pipeline/review.mjs";

// 왜: QA 파이프라인은 모델 앞에서 결정적으로 거르는 단계가 핵심이다. 이 판정이 조용히 0건이 되면
// 싼 관찰 모델과 Opus 검토가 전부를 떠안아 비용·오판이 되돌아온다(지난 3데모 VQA: 확정 29건 중 실제 약 9건).

function tinyProject() {
  const text = (body: string) => ({ kind: "text", body });
  return {
    startMapId: "m1",
    startPos: { x: 1, y: 1 },
    system: { startActorIds: ["a1"] },
    resourceProfiles: [
      { kind: "faceset", assetId: "face-ok" },
      { kind: "picture", assetId: "bg-sky" },
      { kind: "charset", assetId: "chars", imageWidth: 288, imageHeight: 256, tileWidth: 24, tileHeight: 32 },
    ],
    assets: { uploaded: {} },
    database: { troops: [{ id: "t1", name: "늑대" }], items: [{ id: "potion", name: "회복약" }], equipment: [] },
    maps: {
      m1: {
        id: "m1", name: "광장", width: 10, height: 8,
        events: [
          { id: "npc", x: 3, y: 3, pages: [{ trigger: { kind: "action" }, conditions: [], commands: [text("안녕"), { kind: "transfer", mapId: "m2", x: 40, y: 2 }] }] },
          { id: "shop", x: 5, y: 3, pages: [{ trigger: { kind: "action" }, conditions: [], commands: [{ kind: "shop", itemIds: ["potion", "ghost"] }] }] },
          { id: "loop", x: 6, y: 3, pages: [{ trigger: { kind: "action" }, conditions: [], commands: [text("기다려"), { kind: "loop", body: [{ kind: "wait", ms: 100 }] }] }] },
          { id: "foe", x: 7, y: 3, pages: [{ trigger: { kind: "action" }, conditions: [], commands: [{ kind: "battleProcessing", troopId: "t1" }] }] },
          { id: "face", x: 8, y: 3, pages: [{ trigger: { kind: "action" }, conditions: [], commands: [{ kind: "changeFace", resourceId: "bg-sky" }, text("얼굴")] }] },
          { id: "npc2", x: 9, y: 3, pages: [{ trigger: { kind: "action" }, conditions: [], graphic: { sprite: { type: "bundled", id: "chars" }, pattern: 96 }, commands: [text("칸")] }] },
          { id: "npc3", x: 9, y: 4, pages: [{ trigger: { kind: "action" }, conditions: [], graphic: { sprite: { type: "bundled", id: "chars" }, pattern: 95 }, commands: [{ kind: "changeFace", resourceId: "face-ok" }, text("정상")] }] },
        ],
      },
      m2: { id: "m2", name: "숲", width: 20, height: 20, events: [] },
      island: { id: "island", name: "섬", width: 5, height: 5, events: [{ id: "x", x: 1, y: 1, pages: [] }] },
    },
  };
}

describe("qa pipeline planner", () => {
  it("맵·이벤트·상점·전투 작업을 만들고 입력 방식을 돌려 배정한다", () => {
    const jobs = planCoverage(tinyProject(), { game: "g" });
    const kinds = jobs.map((job) => job.kind);
    expect(kinds.filter((k) => k === "map")).toHaveLength(3);
    expect(kinds).toContain("shop");
    expect(jobs.find((job) => job.kind === "battle")?.checkpoint.startTroopId).toBe("t1");
    expect(jobs.find((job) => job.target?.eventId === "npc")?.checkpoint.startEventId).toBe("npc");
    expect(new Set(jobs.map((job) => job.input))).toEqual(new Set(["keyboard", "mouse", "touch"]));
    expect(jobs.filter((job) => job.input === "touch").every((job) => job.viewport.touch === true)).toBe(true);
  });

  it("정적 검사: 맵 밖 이동·없는 상점 품목·끝나지 않는 반복·못 가는 맵", () => {
    const checks = staticLint(tinyProject(), { game: "g" }).map((f) => `${f.check}@${f.where}`);
    expect(checks).toContain("bad-transfer@m1 npc");
    expect(checks).toContain("bad-shop@m1 shop");
    expect(checks).toContain("endless-loop@m1 loop");
    expect(checks).toContain("unreachable-map@island");
    expect(checks).toContain("portrait-kind@m1 face");
    expect(checks).toContain("sprite-cell-range@m1 npc2");
    expect(checks.some((c) => c.endsWith("npc3"))).toBe(false);
    expect(checks.some((c) => c.startsWith("unreachable-map@m2"))).toBe(false);
  });
});

describe("qa pipeline deterministic detection", () => {
  const job = { id: "j1", slug: "g", version: "1.0", kind: "event", input: "keyboard", viewportName: "desktop", target: { mapId: "m1", eventId: "npc" } };
  const row = (seq: number, extra: Record<string, unknown> = {}) => ({
    seq, file: `${seq}.jpg`, label: "ev-dlg", settled: true, darkMs: 0, lum: 60, hash: `00000000000000${String(seq).padStart(2, "0")}`,
    state: { screen: "field", mapId: "m1", dialogue: "안녕" }, dom: { text: "안녕", overflow: [] }, inputs: [], errors: [], net: [], ...extra,
  });

  it("멈춤·지속 암전·DOM 잘림·404 를 후보로 만들고, 반복은 하나로 묶는다", () => {
    const rows = [
      row(1, { net: [{ kind: "http", status: 404, url: "http://127.0.0.1:7812/g/1.0/assets/a.png" }] }),
      row(2, { net: [{ kind: "http", status: 404, url: "http://127.0.0.1:7812/g/1.0/assets/a.png" }] }),
      row(3, { label: "ev-stuck" }),
      row(4, { darkMs: 3600, lum: 2 }),
      row(5, { dom: { text: "", overflow: [{ el: "span.name", text: "아주 긴 이름", clipsX: true, clipsY: false, ellipsis: false, offscreen: false, rect: [1, 2, 3, 4] }] } }),
    ];
    const { findings, frames } = detectRun([{ job, summary: {}, rows }]);
    const groups = groupDeterministic(findings);
    const byCheck = Object.fromEntries(groups.map((g) => [g.check, g]));
    expect(byCheck["asset-request"].count).toBe(2);
    expect(byCheck.stuck.severity).toBe("blocker");
    expect(byCheck["black-screen"]).toBeDefined();
    expect(byCheck["text-clipped"].claim).toContain("아주 긴 이름");
    expect(selectForObserver(frames).some((f) => f.seq === 4)).toBe(false);
  });

  it("한 장짜리 전환 암전은 결함이 아니다", () => {
    const { findings } = detectRun([{ job, summary: {}, rows: [row(1, { darkMs: 600, lum: 3 }), row(2)] }]);
    expect(findings.some((f) => f.check === "black-screen")).toBe(false);
  });
});

describe("qa pipeline measurement", () => {
  it("심은 결함은 그 위치를 가리키고 설명할 수 있는 후보가 real 일 때만 검토 후 포착이다", () => {
    const truth = [
      { id: "p-1", type: "garbled-text", mapId: "m1", eventId: "npc" },
      { id: "p-2", type: "void-tiles", mapId: "m2", eventId: null },
    ];
    const reviewed = [
      { id: "V1", source: "observer", check: "C10", target: { mapId: "m1", eventId: "npc" }, review: { verdict: "real" } },
      { id: "V2", source: "observer", check: "C08", jobs: ["map-m2"], review: { verdict: "misread" } },
      { id: "V3", source: "observer", check: "C01", target: { mapId: "m1", eventId: "other" }, review: { verdict: "real" } },
    ];
    const jobs = [{ id: "map-m2", kind: "map", target: { mapId: "m2" } }];
    const m = measurePlants(truth, reviewed, jobs);
    expect([m.caughtBefore, m.caughtAfter]).toEqual([2, 1]);
    expect(m.nonPlantKeptIds).toEqual(["V3"]);
  });

  it("측정된 결함(DOM 잘림·404)은 검토가 전환·오독으로 기각하지 못하고, QA 환경 판정만 빼낼 수 있다", async () => {
    const replies: Record<string, string> = { D1: "transition", D2: "environment", V1: "transition" };
    const client = async (content: Array<{ type: string; text?: string }>) => {
      const id = /Candidate (\w+)/.exec(content.map((c) => c.text ?? "").join(" "))?.[1] ?? "";
      return { ok: true, text: JSON.stringify({ verdict: replies[id], confidence: 0.9, severity: "visual", owner: "engine" }) };
    };
    const rows = await reviewCandidates([
      { id: "D1", source: "deterministic", check: "text-clipped", claim: "긴 이름", frames: [] },
      { id: "D2", source: "deterministic", check: "asset-request", claim: "404", frames: [] },
      { id: "V1", source: "observer", check: "C01", claim: "잘림?", frames: [] },
    ], { client, poolSize: 1 });
    expect(rows.map((r) => r.verdict)).toEqual(["real", "environment", "transition"]);
    expect(rows[0].reviewerVerdict).toBe("transition");
  });

  it("모델 답의 마지막 JSON 을 꺼낸다(생각 글 안의 중괄호는 무시)", () => {
    expect(extractJson('생각 {x} … {"verdict":"real","confidence":0.8}', ["verdict"])).toEqual({ verdict: "real", confidence: 0.8 });
    expect(extractJson("JSON 없음", ["verdict"])).toBeNull();
  });
});
