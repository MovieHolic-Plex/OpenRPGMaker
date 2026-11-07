import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { planCoverage, staticLint } from "../scripts/qa/pipeline/lib/plan.mjs";
import { detectRun, groupDeterministic, selectForObserver, textFindings } from "../scripts/qa/pipeline/lib/detect.mjs";
import { measurePlants } from "../scripts/qa/pipeline/lib/measure.mjs";
import { extractJson, reviewerChain } from "../scripts/qa/pipeline/lib/models.mjs";
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
          { id: "smith", x: 2, y: 5, pages: [{ trigger: { kind: "action" }, conditions: [], commands: [text("어서 와"), { kind: "fork", condition: { kind: "switch", switchId: "sw_quest_done", value: true }, then: [{ kind: "shop", itemIds: ["potion"] }], else: [text("일이 먼저다")] }] }] },
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
    expect(jobs.find((job) => job.target?.eventId === "smith")?.checkpoint.switches).toEqual({ sw_quest_done: true });
    expect(new Set(jobs.map((job) => job.input))).toEqual(new Set(["keyboard", "mouse", "touch"]));
    expect(jobs.filter((job) => job.input === "touch").every((job) => job.viewport.touch === true)).toBe(true);
  });

  // 왜: 체크포인트 하나에 늘 같은 레벨을 박으면 마지막 보스가 쉬워지고 첫 싸움이 불공평해진다(2026-11-07 실측).
  // 이야기 순서로 누적한 표(scripts/qa/pipeline/data/story-levels.json)가 체크포인트 레벨·장비 티어를 정하고,
  // 전투는 예상·−3·+3 세 상태로 갈린다.
  it("체크포인트 레벨·장비는 이야기 표에서 오고, 전투는 세 상태로 계획된다", () => {
    const story = {
      gearSets: { 1: { a1: { weapon: "better" } } },
      byTroop: {
        t1: { act: "1막", map: "m1", kind: null, party: ["a1"], level: 9, gold: 120, gearTier: 1 },
      },
    };
    const battles = planCoverage(tinyProject(), { game: "g", story }).filter((job) => job.kind === "battle");
    expect(battles.map((job) => job.target.state)).toEqual(["expected", "weak", "strong"]);
    expect(battles.map((job) => job.checkpoint.party[0].level)).toEqual([9, 6, 12]);
    expect(battles.map((job) => job.target.gearTier)).toEqual([1, 0, 1]);
    expect(battles[0].checkpoint.sessionPatch).toEqual({ actorEquipment: { a1: { weapon: "better" } } });
    expect(battles[1].checkpoint.sessionPatch).toBeUndefined();
    expect(battles[0].checkpoint.gold).toBe(120);
  });

  it("적대적 입력 트랙을 만들고 입력 방식·화면 크기를 섞는다 (재료가 없으면 그 경우만 빠진다)", () => {
    const adversarial = planCoverage(tinyProject(), { game: "g" }).filter((job) => job.kind === "adversarial");
    // The fixture has one shop map and no openSaveMenu event, so broke-shopper-touch and save-load cannot be planned;
    // the shipped game (45 maps, 10 save points, 2 shop maps) plans all 10 (coverage-plan.json 2026-11-07).
    expect(adversarial).toHaveLength(9);
    const kinds = adversarial.map((job) => job.adversarial);
    expect(kinds).toContain("mash-dialogue");
    expect(kinds).toContain("menu-mid-battle");
    expect(kinds).toContain("broke-shopper");
    expect(kinds).toContain("map-edges");
    expect(kinds).toContain("mixed-input");
    expect(kinds).not.toContain("save-load");
    expect(adversarial.every((job) => job.script === "adversarial" && job.viewport?.width > 0)).toBe(true);
    expect(new Set(adversarial.map((job) => job.viewportName)).size).toBeGreaterThanOrEqual(3);
    const broke = adversarial.find((job) => job.adversarial === "broke-shopper");
    if (broke) expect(broke.checkpoint.gold).toBe(0);
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
      row(4, { darkMs: 3600, lum: 2, state: { screen: "field", mapId: "m1", dialogue: null }, dom: { text: "", overflow: [] } }),
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

  it("대사 글자를 모델 없이 검사한다: 모지바케·자리표시·내부 id, 정상 한국어는 통과", () => {
    const checksOf = (dialogue: string) => textFindings({ state: { dialogue } }).map((f: { check: string }) => f.check);
    expect(checksOf("ë¸Œëžœ ì§€ê¸ˆ 숭으로")).toEqual(["garbled-text"]);
    expect(checksOf("TODO: 여기에 대사 넣기")).toEqual(["placeholder-text"]);
    expect(checksOf("문을 열려면 sw_gate_open 을 켜라")).toEqual(["raw-id-text"]);
    expect(checksOf("난 été 카페에서 일해. 숫자는 12·34 — 괜찮아")).toEqual([]);
  });

  it("한 장짜리 전환 암전과, 게임 오버·암전 위 내레이션은 결함이 아니다", () => {
    const { findings } = detectRun([{ job, summary: {}, rows: [
      row(1, { darkMs: 600, lum: 3 }),
      row(2, { darkMs: 3600, lum: 2, state: { screen: "gameover" }, dom: { text: "", overflow: [] } }),
      row(3, { darkMs: 3600, lum: 2, state: { screen: "field", dialogue: "이튿날 밤, 초소 지하." } }),
    ] }]);
    expect(findings.some((f) => f.check === "black-screen")).toBe(false);
  });

  it("음악·blob 요청의 ERR_ABORTED 는 결함이 아니고, 그림 404 는 결함이다", () => {
    const { findings } = detectRun([{ job, summary: {}, rows: [row(1, { net: [
      { kind: "failed", url: "http://127.0.0.1:7812/g/1.0/assets/bgm/forest.mp3", why: "net::ERR_ABORTED" },
      { kind: "failed", url: "blob:http://127.0.0.1:7812/abc", why: "net::ERR_ABORTED" },
      { kind: "http", status: 404, url: "http://127.0.0.1:7812/g/1.0/assets/portraits/a.png" },
    ] })] }]);
    expect(findings.filter((f) => f.check === "asset-request").map((f) => f.claim)).toEqual(["404 /assets/portraits/a.png"]);
  });
});

describe("qa pipeline measurement", () => {  it("심은 결함은 그 위치를 가리키고 설명할 수 있는 후보가 real 일 때만 검토 후 포착이다", () => {
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

  // 왜: 심은 판본 린트가 깨끗한 실행의 static.json 을 덮어쓰면, 심은 결함 4건이 출하본의 결함으로 보고된다
  // (2026-11-07 실측: bad-transfer·endless-loop·sprite-cell-range·portrait-kind 가 깨끗한 후보에 섞였다).
  // 실행은 CLI 라 단위 테스트가 import 하지 않으므로, 판본 소스의 출력 경로와 그 행동을 직접 확인한다.
  it("--lint-only 는 static.json 이 아니라 static-planted.json 에 쓴다", () => {
    const source = readFileSync(new URL("../scripts/qa/pipeline/vm/plan-run.mjs", import.meta.url), "utf8");
    expect(source).toContain('static-planted.json');
    expect(source).not.toMatch(/lint-only[\s\S]{0,400}path\.join\(values\.out, "static\.json"\)/);
  });

  // 왜: 검토가 Opus 하나에 묶여 있으면 Claude 한도가 마르는 순간 검토가 통째로 실패한다(2026-11-07 오너 지시:
  // 검토는 OPUS 또는 ASTRA 또는 ARGON, 남는 것 순서). 체인은 먼저 답한 모델을 쓰고, 실패한 모델은 기록하고 건너뛴다.
  it("검토 체인은 Opus→Astra→Argon 순서로 답한 첫 모델을 쓰고, 죽은 모델은 건너뛴다", async () => {
    const calls: string[] = [];
    const base = "http://127.0.0.1:1";
    const members = [
      { id: "opus", model: "claude-opus-5-5", kind: "anthropic", baseUrl: base, apiKey: "k" },
      { id: "astra", model: "gpt-6-astra", kind: "openai", baseUrl: base, apiKey: "k" },
      { id: "argon", model: "gemini-4-argon-high", kind: "openai", baseUrl: base, apiKey: "k" },
    ];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string) => {
      const isAnthropic = String(url).endsWith("/v1/messages");
      const who = isAnthropic ? "opus" : String(url).includes("127.0.0.1:1") ? "other" : "x";
      calls.push(who);
      // Opus(with Anthropic shape) fails, so the chain must fall through to Astra.
      if (isAnthropic) return new Response("exhausted", { status: 429 });
      return new Response(JSON.stringify({ model: "gpt-6-astra", choices: [{ message: { content: '{"ok":true}' } }], usage: {} }), { status: 200 });
    }) as unknown as typeof fetch;
    try {
      const client = reviewerChain(members.map((member) => ({ ...member, retryDelayMs: 1 })), { stage: "test" });
      const first = await client([{ type: "text", text: "hi" }], {});
      expect(first.ok).toBe(true);
      expect(first.member).toBe("astra");
      expect(client.answeredBy()).toBe("astra");
      const opusProbes = calls.filter((c) => c === "opus").length;
      await client([{ type: "text", text: "again" }], {});
      // The model that answered stays preferred: the failed Opus is not probed a second time.
      expect(calls.filter((c) => c === "opus")).toHaveLength(opusProbes);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
