import { describe, expect, it } from "vitest";
import { readFileSync, mkdtempSync } from "node:fs";
import { planCoverage, staticLint } from "../scripts/qa/pipeline/lib/plan.mjs";
import { detectRun, groupDeterministic, selectForObserver, textFindings } from "../scripts/qa/pipeline/lib/detect.mjs";
import { measurePlants } from "../scripts/qa/pipeline/lib/measure.mjs";
import { extractJson, reviewerChain } from "../scripts/qa/pipeline/lib/models.mjs";
import { reviewCandidates } from "../scripts/qa/pipeline/review.mjs";
import { createEventLog, parseStepLines, sessionLifecycles, STEP_PREFIX } from "../scripts/qa/pipeline/lib/events.mjs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CUTSCENE_STUCK_CAP_MS, STUCK_MS, cutsceneOnScreen, isStuck, spendsStep } from "../scripts/qa/pipeline/lib/stuck.mjs";
import { hiddenReason } from "../scripts/qa/pipeline/lib/hidden.mjs";
import { isolateTimers } from "./mergedTeardown";

describe("qaPipeline", () => {
  isolateTimers();
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

    // 왜: 이벤트 작업이 주인공을 이벤트 아래 칸에 무조건 세워, 아래가 지붕이면 지붕 위에 선 그림이 결함 후보가 됐다
    // (폴른 스타 1.39 광역 QA a1 — 실제 게임은 그 칸에 서지 않는다).
    it("이벤트 작업은 위층 타일(지붕)이 있는 칸에 주인공을 세우지 않는다", () => {
      const project = tinyProject();
      const m1 = project.maps.m1 as { width: number; height: number; upperTiles?: number[] };
      m1.upperTiles = Array.from({ length: m1.width * m1.height }, () => -1);
      m1.upperTiles[4 * m1.width + 3] = 22955; // npc (3,3) 바로 아래 칸이 지붕
      const cp = planCoverage(project, { game: "g" }).find((job) => job.target?.eventId === "npc")!.checkpoint;
      expect({ x: cp.x, y: cp.y, facing: cp.facing }).toEqual({ x: 3, y: 2, facing: "down" });
      const plain = planCoverage(tinyProject(), { game: "g" }).find((job) => job.target?.eventId === "npc")!.checkpoint;
      expect({ x: plain.x, y: plain.y }).toEqual({ x: 3, y: 4 });
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
  // 왜: 관제실 영상은 「누가 어느 세션을 언제 띄웠나」가 실제 기록이어야 한다. fs139-broad 에는 그 기록이 없어 파일 mtime(1초 해상도)으로
  // 되짚어야 했다. play.mjs --events 가 남기는 행이 순서·소유자·재시도를 잃으면 다음 영상도 다시 재구성이 된다.
  describe("qa pipeline control-room events", () => {
    it("행마다 소유자와 단조 시계를 남기고, 시계가 뒤로 가도 mono 는 줄지 않으며 모르는 종류는 거절한다", () => {
      const file = join(mkdtempSync(join(tmpdir(), "qa-events-")), "events.jsonl");
      const ticks = [0n, 5_000_000n, 2_000_000n, 9_000_000n];
      let i = 0;
      const log = createEventLog(file, { owner: "lane:qa-control-room", run: "r1", clock: () => ticks[Math.min(i++, ticks.length - 1)] });
      log.emit("spawn", "map-0001", { attempt: 1 });
      log.emit("ack", "map-0001", { attempt: 1 });
      log.emit("done", "map-0001", { attempt: 1, code: 0 });
      expect(() => log.emit("launched", "map-0001")).toThrow();
      log.close();
      const rows = readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l));
      expect(rows.map((r) => r.mono)).toEqual([5, 5, 9]);
      expect(rows.every((r) => r.owner === "lane:qa-control-room" && r.run === "r1")).toBe(true);
      expect(() => createEventLog(file, { owner: "", run: "r1" })).toThrow();
    });

    it("쪼개진 stdout 에서 걸음 줄만 꺼내고, 남은 반 줄은 다음 조각과 이어 붙인다", () => {
      const a = parseStepLines(`noise\n${STEP_PREFIX}{"seq":0,"t":40}\n${STEP_PREFIX}{"seq":1,`);
      expect(a.steps).toEqual([{ seq: 0, t: 40 }]);
      const b = parseStepLines(`${a.rest}"t":50}\n${STEP_PREFIX}not json\n`);
      expect(b.steps).toEqual([{ seq: 1, t: 50 }]);
      expect(b.rest).toBe("");
    });

    it("재시도한 세션은 시도 수 2, 첫 띄움 시각, 마지막 종료 코드로 묶인다", () => {
      const rows = [
        { mono: 0, owner: "o", type: "queued", id: "a" },
        { mono: 1, owner: "o", type: "spawn", id: "a", attempt: 1 },
        { mono: 2, owner: "o", type: "retry", id: "a", attempt: 1, code: 1 },
        { mono: 3, owner: "o", type: "spawn", id: "a", attempt: 2 },
        { mono: 4, owner: "o", type: "ack", id: "a", attempt: 2 },
        { mono: 5, owner: "o", type: "progress", id: "a", seq: 1 },
        { mono: 6, owner: "o", type: "done", id: "a", attempt: 2, code: 0 },
        { mono: 7, owner: "o", type: "gauge", active: 0 },
      ];
      expect(sessionLifecycles(rows)).toEqual([{ id: "a", owner: "o", attempts: 2, steps: 1, queuedAt: 0, spawnAt: 1, ackAt: 4, doneAt: 6, code: 0 }]);
    });
  });
});

describe("qaPipelineAbortedPacks", () => {
  isolateTimers();
  // 왜: 폴른 스타 광범위 QA(2026-11-07)에서 스토어 판본의 지연 그림 묶음 `/packs/p003~p008.json` ERR_ABORTED 가
  // 결함 후보로 올라왔다. 장면이 넘어가며 플레이어가 스스로 취소한 요청이고 전투는 정상 진행됐다(큐 B7).
  // 무시는 그 이름(`packs/pNNN.json`)에만 걸어야 한다 — 다른 .json 취소는 여전히 결함이다(ultrabrain 판정).

  const job = { id: "j1", slug: "fallen-star", version: "1.39", kind: "battle", input: "keyboard", viewportName: "desktop", target: { troopId: "t1" } };
  const failed = (url: string, why = "net::ERR_ABORTED") => ({ kind: "failed", url, why });
  const row = (net: object[]) => ({
    seq: 1, file: "1.jpg", label: "battle-turn", settled: true, darkMs: 0, lum: 60, hash: "0000000000000001",
    state: { screen: "battle", mapId: "m1" }, dom: { text: "", overflow: [] }, inputs: [], errors: [], net,
  });
  const claims = (net: object[]) => detectRun([{ job, summary: {}, rows: [row(net)] }]).findings
    .filter((f: { check: string }) => f.check === "asset-request").map((f: { claim: string }) => f.claim);
  describe("qa pipeline: 지연 그림 묶음 취소", () => {
    it("packs/pNNN.json 의 ERR_ABORTED 는 결함이 아니다 (실측 트레이스의 p003~p008)", () => {
      const base = "http://127.0.0.1:7812/fallen-star/1.39";
      expect(claims(["p003", "p004", "p005", "p006", "p007", "p008"].map((p) => failed(`${base}/packs/${p}.json`)))).toEqual([]);
      expect(claims([failed(`${base}/packs/p012.json?v=3`)])).toEqual([]);
    });

    it("다른 .json 취소와 packs 의 HTTP 오류·다른 실패는 그대로 결함이다", () => {
      const base = "http://127.0.0.1:7812/fallen-star/1.39";
      expect(claims([
        failed(`${base}/project.json`),
        failed(`${base}/maps/fs_hub.json`),
        failed(`${base}/packs/p003.json.bak`),
        failed(`${base}/packs/extra.json`),
        failed(`${base}/packs/p003.json`, "net::ERR_FAILED"),
        { kind: "http", status: 404, url: `${base}/packs/p009.json` },
      ])).toEqual([
        "net::ERR_ABORTED /project.json",
        "net::ERR_ABORTED /maps/fs_hub.json",
        "net::ERR_ABORTED /packs/p003.json.bak",
        "net::ERR_ABORTED /packs/extra.json",
        "net::ERR_FAILED /packs/p003.json",
        "404 /packs/p009.json",
      ]);
    });
  });
});

describe("qaPipelineCutsceneHang", () => {
  isolateTimers();
  // 왜: 폴른 스타 광범위 QA(큐 B8)에서 하네스가 컷신 대기(15초 무변화)를 멈춤으로 냈다. 컷신이 화면에 있으면 기다림을
  // 고정 상한까지 늘리되, 컷신 안에서 정말 얼어붙은 것은 여전히 잡아야 한다(ultrabrain: bounded, not unlimited).

  type Frame = { sig: string; cutscene: boolean };
  /** driveUntilFree 의 판정 순서를 그대로 따라 도는 시뮬레이터: 매 폴링 pollMs, 단계 예산 maxSteps. */
  function drive(frameAt: (ms: number) => Frame, { pollMs = 350, maxSteps = 40, hardMs = 240000 } = {}) {
    let same = 0; let last = ""; let sameSince = 0; let now = 0;
    for (let step = 0; step < maxSteps && now < hardMs; step += 1) {
      const f = frameAt(now);
      if (f.sig === last) same += 1; else { same = 0; sameSince = now; }
      last = f.sig;
      if (!spendsStep({ same, cutscene: f.cutscene })) step -= 1;
      if (isStuck({ same, unchangedMs: now - sameSince, cutscene: f.cutscene })) return { stuck: true, at: now };
      now += pollMs;
    }
    return { stuck: false, at: now };
  }
  describe("qa pipeline: 컷신 대기와 진짜 멈춤", () => {
    it("컷신 밖에서 얼어붙으면 15초에 멈춤이다(기존 판정 유지)", () => {
      const r = drive(() => ({ sig: "frozen", cutscene: false }), { pollMs: 1500 });
      expect(r).toEqual({ stuck: true, at: STUCK_MS });
    });

    it("컷신이 20초씩 멈췄다 넘어가는 것은 멈춤이 아니다", () => {
      const r = drive((ms) => ({ sig: `line-${Math.floor(ms / 20000)}`, cutscene: true }), { hardMs: 120000 });
      expect(r.stuck).toBe(false);
      expect(r.at).toBeGreaterThanOrEqual(120000);
    });

    it("컷신 안에서 정말 얼어붙으면 고정 상한(45초)에 멈춤으로 잡힌다 — 단계 예산이 먼저 끝나지 않는다", () => {
      expect(CUTSCENE_STUCK_CAP_MS).toBe(45000);
      for (const pollMs of [350, 600, 1500]) {
        const r = drive(() => ({ sig: "frozen", cutscene: true }), { pollMs });
        expect(r.stuck).toBe(true);
        expect(r.at).toBeGreaterThanOrEqual(CUTSCENE_STUCK_CAP_MS);
        expect(r.at).toBeLessThan(CUTSCENE_STUCK_CAP_MS + pollMs);
      }
    });

    it("건너뛰기 안내나 그려진 레터박스가 있을 때만 컷신이다(높이 0 인 남은 띠는 아니다)", () => {
      const doc = (hint: boolean, bars: number[]) => ({
        querySelector: (sel: string) => (hint && sel.includes("cutscene-skip-hint") ? {} : null),
        querySelectorAll: () => bars.map((height) => ({ getBoundingClientRect: () => ({ height }) })),
      });
      expect(cutsceneOnScreen(doc(true, []))).toBe(true);
      expect(cutsceneOnScreen(doc(false, [0, 54]))).toBe(true);
      expect(cutsceneOnScreen(doc(false, [0, 0]))).toBe(false);
      expect(cutsceneOnScreen(doc(false, []))).toBe(false);
    });

    it("플레이어 스크립트가 이 판정을 실제로 쓴다", () => {
      const source = readFileSync(new URL("../scripts/qa/pipeline/vm/player.mjs", import.meta.url), "utf8");
      expect(source).toMatch(/__qaCutsceneOnScreen = \$\{cutsceneOnScreen\.toString\(\)\}/);
      expect(source).toMatch(/cutscene: \(\(\) => \{ try \{ return window\.__qaCutsceneOnScreen\(document\)/);
      expect(source).toMatch(/if \(isStuck\(\{ same, unchangedMs: Date\.now\(\) - sameSince, cutscene: s\.cutscene === true \}\)\)/);
      expect(source).not.toMatch(/same >= 6 && Date\.now\(\) - sameSince >= 15000/);
    });
  });
});

describe("qaPipelineHiddenMeasure", () => {
  isolateTimers();
  // 왜: 폴른 스타 광범위 QA(큐 B3)가 픽셀 상점의 키 안내 「X/Esc 뒤로」를 「화면 밖」 결함으로 냈다. 그 줄은 픽셀 프리셋이
  // 일부러 시각 숨김한 프롬프트 패널(1px·overflow hidden·clip-path inset(50%)) 안에 있다 — 엔진 결함이 아니라 하네스가
  // 숨긴 요소를 잰 것이다(ultrabrain 판정). 숨긴 것은 재지 않고, 보이는 상자의 진짜 잘림은 계속 잡아야 한다.

  type Node = { cls?: string; display?: string; visibility?: string; opacity?: string; clip?: string; clipPath?: string; overflow?: string; w?: number; h?: number };
  const shown = (extra: Node = {}): Node => ({ cls: "", display: "block", visibility: "visible", opacity: "1", clip: "auto", clipPath: "none", overflow: "visible visible visible", w: 300, h: 40, ...extra });
  describe("qa pipeline: 숨긴 요소는 재지 않는다", () => {
    it("픽셀 상점 프롬프트 패널 안의 키 안내(실측 rect 48,876)는 숨김이다", () => {
      const kbd = shown({ cls: "runtime-shop-key", display: "inline-block", w: 135, h: 56 });
      const hints = shown({ cls: "runtime-shop-keyhints", display: "flex", w: 600, h: 60 });
      const promptPanel = shown({ cls: "runtime-shop-window runtime-shop-prompt-panel", display: "grid", overflow: "hidden hidden hidden", clipPath: "inset(50%)", w: 1, h: 1 });
      const shell = shown({ cls: "runtime-shop-shell", w: 1440, h: 900 });
      expect(hiddenReason([kbd, hints, promptPanel, shell])).toBe("ancestor-clipped");
      expect(hiddenReason([kbd, hints, { ...promptPanel, clipPath: "none" }, shell])).toBe("ancestor-visually-hidden");
    });

    it("display:none·visibility·opacity·sr-only 는 자기든 조상이든 숨김이다", () => {
      expect(hiddenReason([shown(), shown({ display: "none" })])).toBe("display-none");
      expect(hiddenReason([shown({ visibility: "hidden" })])).toBe("visibility-hidden");
      expect(hiddenReason([shown(), shown({ opacity: "0" })])).toBe("opacity-0");
      expect(hiddenReason([shown(), shown({ cls: "label sr-only" })])).toBe("sr-only");
      expect(hiddenReason([shown({ clip: "rect(0px, 0px, 0px, 0px)" })])).toBe("self-clipped");
    });

    it("보이는 상자의 잘림·장식 clip-path 조상·스크롤 목록 조상은 숨김이 아니다", () => {
      const clippedName = shown({ overflow: "hidden hidden hidden", w: 120, h: 20 });
      expect(hiddenReason([clippedName, shown(), shown()])).toBeNull();
      expect(hiddenReason([clippedName, shown({ clipPath: "polygon(14px 0, 100% 0, calc(100% - 14px) 100%, 0 100%)" })])).toBeNull();
      expect(hiddenReason([clippedName, shown({ clipPath: "inset(0px 4px)" })])).toBeNull();
      expect(hiddenReason([clippedName, shown({ overflow: "auto auto auto", w: 320, h: 200 })])).toBeNull();
      expect(hiddenReason([clippedName, shown({ overflow: "hidden hidden hidden", w: 1, h: 40 })])).toBeNull();
    });

    it("보이는 요소의 잘림은 감지기가 여전히 결함으로 낸다", () => {
      const job = { id: "j", slug: "g", version: "1", kind: "shop", input: "keyboard", viewportName: "desktop" };
      const overflow = [{ el: "span.runtime-shop-item-name", text: "아주 긴 장비 이름", clipsX: true, clipsY: false, ellipsis: false, offscreen: false, rect: [10, 20, 120, 20] }];
      const row = { seq: 1, file: "1.jpg", label: "shop", state: { screen: "shop" }, dom: { text: "", overflow }, errors: [], net: [] };
      expect(detectRun([{ job, summary: {}, rows: [row] }]).findings.map((f: { check: string }) => f.check)).toEqual(["text-clipped"]);
    });

    it("플레이어 측정은 이 규칙을 페이지에 그대로 주입해 쓴다", () => {
      const source = readFileSync(new URL("../scripts/qa/pipeline/vm/player.mjs", import.meta.url), "utf8");
      expect(source).toMatch(/import \{ hiddenReason \} from "\.\.\/lib\/hidden\.mjs"/);
      expect(source).toMatch(/__qaHiddenReason = \$\{hiddenReason\.toString\(\)\}/);
      expect(source).toMatch(/if \(window\.__qaHiddenReason\(chain\)\) continue;/);
    });
  });
});
