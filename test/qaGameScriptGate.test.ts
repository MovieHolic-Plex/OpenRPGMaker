import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { runGameCheck } from "@/qa/gameCheck";
import { scriptGatedFailure } from "@/qa/gameCheck/scriptGate";
import type { Project } from "@/project/types";
import { deserialize, serialize } from "@/project/io";
import { isolateTimers } from "./mergedTeardown";

// qa:game 자동 플레이가 스크립트가 정하는 진행을 «막힘»으로 내지 않는지.
// 2026-10-31 script-ab sab-1031 A 마을: 「평판 ≥ 10 → 촌장 엔딩」의 선행 스위치를 할머니 스크립트가 «약초 세 포기를 가졌으면» 켠다.
// 실제 플레이로는 엔딩까지 가는데 계획기가 스크립트 안의 아이템 조건을 몰라 막힘으로 나왔다.
describe("qaGameScriptGate", () => {
  isolateTimers();
  const SOURCE = "if (game.itemCount('item_herb') >= 3) { game.removeItem('item_herb', 3); game.setSwitch('sw_reward', true); }";
  function villageGame(withScript: boolean): Project {
    const ctx: { project: Project } = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const { x, y } = ctx.project.startPos;
    const ok = (name: string, args: Record<string, unknown>) => { const r = runTool(ctx, name, args); expect(r.ok, `${name} ${r.summary}`).toBe(true); };
    ctx.project.switches.push({ id: "sw_reward", name: "보상 받음" } as never);
    ok("define_ending", { id: "ending_hero", name: "마을의 은인", conditions: [] });
    ok("upsert_event", { mapId, event: { id: "ev_grandma", name: "할머니", x: x + 1, y, pages: [{ trigger: { kind: "action" }, conditions: [], commands: [{ kind: "text", body: "고맙구나." }] }] } });
    ok("upsert_event", { mapId, event: { id: "ev_chief", name: "촌장", x: x - 1, y, pages: [
      { trigger: { kind: "action" }, conditions: [], commands: [{ kind: "text", body: "누구신가?" }] },
      { trigger: { kind: "action" }, conditions: [{ kind: "switch", switchId: "sw_reward", value: true }], commands: [{ kind: "triggerEnding", endingId: "ending_hero" }] },
    ] } });
    if (withScript) {
      const grandma = ctx.project.maps[mapId]!.events.find((event) => event.id === "ev_grandma")!;
      grandma.pages[0]!.commands = [{
        kind: "script", name: "약초 의뢰", source: SOURCE, compiled: SOURCE, sourceHash: "test", apiVersion: 1,
        effects: { reads: [{ kind: "item", id: "item_herb" }], writes: [{ kind: "item", id: "item_herb" }, { kind: "switch", id: "sw_reward" }], calls: [], dynamic: [] },
      } as never];
    }
    return ctx.project;
  }
  describe("qa:game script-gated progress", () => {
    it("reports a script-gated ending as unknown (info), not blocked", () => {
      const report = runGameCheck(villageGame(true));
      const failed = report.autoPlay?.runs.some((run) => !run.ok);
      if (failed) {
        expect(report.findings.some((f) => f.code === "autoplay-failed")).toBe(false);
        expect(report.findings.some((f) => f.code === "autoplay-script-gated" && f.severity === "info")).toBe(true);
      }
      expect(report.findings.filter((f) => f.code.startsWith("autoplay")).every((f) => f.severity !== "blocker")).toBe(true);
    });

    it("finds the script writer through the switch the ending page reads", () => {
      const project = villageGame(true);
      const gate = scriptGatedFailure(project, { mapId: project.startMapId, eventId: "ev_chief" }, "이벤트는 돌았지만 목표가 충족되지 않았습니다");
      expect(gate?.keys.join(" ")).toContain("보상 받음");
    });

    it("leaves games without scripts alone", () => {
      const project = villageGame(false);
      expect(scriptGatedFailure(project, { mapId: project.startMapId, eventId: "ev_chief" }, "이벤트는 돌았지만 목표가 충족되지 않았습니다")).toBeUndefined();
      expect(runGameCheck(project).findings.some((f) => f.code === "autoplay-failed" && f.severity === "blocker")).toBe(true);
    });
  });
});

describe("qaGameStoryChain", () => {
  isolateTimers();
  // 회상 스토리: 기억 1(시작 맵)의 메멘토 → 문 열림 → 기억 2(잠긴 맵)의 메멘토 → 엔딩.
  // 기억 2 로 가는 문은 스위치 조건 페이지에만 있다 — 자동 플레이가 그 문을 여는 사슬을 스스로 세워야 한다.
  function memoryChain() {
    const ctx = { project: createBlankProject() };
    const start = ctx.project.startMapId;
    expect(runTool(ctx, "create_map", { id: "map_memory_2", name: "두 번째 기억", width: 12, height: 10 }).ok).toBe(true);
    const [m1, gate, m2] = ctx.project.switches.slice(0, 3).map((entry) => entry.id) as [string, string, string];
    expect(runTool(ctx, "define_ending", { id: "ending_song", name: "마지막 소절", conditions: [] }).ok).toBe(true);
    const ok = (name: string, args: Record<string, unknown>) => { const r = runTool(ctx, name, args); expect(r.ok, r.summary).toBe(true); };
    ok("script_cutscene", { mapId: start, eventId: "ev_m1", x: 3, y: 3, beats: [{ kind: "say", text: "턴테이블" }, { kind: "switch", switchId: m1 }] });
    ok("script_cutscene", { mapId: start, eventId: "ev_gate", x: 8, y: 8, trigger: "auto", once: true, requiresSwitches: [m1], beats: [{ kind: "switch", switchId: gate }] });
    ok("script_cutscene", { mapId: start, eventId: "ev_door", x: 10, y: 3, requiresSwitches: [gate], beats: [{ kind: "transfer", mapId: "map_memory_2", x: 5, y: 5 }] });
    ok("script_cutscene", { mapId: "map_memory_2", eventId: "ev_m2", x: 2, y: 2, beats: [{ kind: "switch", switchId: m2 }] });
    ok("script_cutscene", { mapId: "map_memory_2", eventId: "ev_song", x: 8, y: 6, requiresSwitches: [m2], beats: [{ kind: "say", text: "자장가" }, { kind: "ending", endingId: "ending_song" }] });
    return deserialize(serialize(ctx.project));
  }
  describe("qa gameCheck — 잠긴 맵으로 이어지는 회상 사슬", () => {
    it("다음 기억으로 가는 문을 여는 선행 목표를 세워 엔딩까지 걷는다", () => {
      const report = runGameCheck(memoryChain(), { autoPlayBudgetMs: 20_000 });
      const run = report.autoPlay!.runs[0]!;
      expect(run.failure?.detail).toBeUndefined();
      expect(run.ok).toBe(true);
      expect(run.endingReached).toBe("ending_song");
      expect(report.findings.filter((f) => f.severity === "blocker").map((f) => f.code)).toEqual([]);
    });
  });
});

describe("qaGameStoryCheck", () => {
  isolateTimers();
  describe("qa gameCheck — 회상 스토리 장르 검사", () => {
    it("투명 메멘토와 연출 없는 컷신을 경고하고, @player 이동은 없는 이벤트로 치지 않는다", () => {
      const ctx = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const ok = (name: string, args: Record<string, unknown>) => { const r = runTool(ctx, name, args); expect(r.ok, r.summary).toBe(true); };
      ok("place_examine_hotspots", { mapId, hotspots: [
        { at: { x: 3, y: 3 }, name: "메멘토: 턴테이블", lines: ["바늘"], graphic: { textureKey: "tex_easyrpg_charset_object2", characterIndex: 7 } },
        { at: { x: 4, y: 3 }, name: "메멘토: 숨은 쪽지", lines: ["글씨"], graphic: { transparent: true } },
      ] });
      ok("script_cutscene", { mapId, eventId: "ev_intro", x: 6, y: 6, trigger: "auto", once: true, beats: [{ kind: "say", text: "여긴 어디지" }] });
      ok("script_cutscene", { mapId, eventId: "ev_walk", x: 8, y: 6, beats: [{ kind: "moveActor", target: "player", moves: [{ kind: "move", dir: "up" }] }] });
      const report = runGameCheck(ctx.project, { skipAutoPlay: true, briefText: "회상 스토리. 두 주인공 이동 연출, 카메라 이동, 페이드." });
      const codes = report.findings.map((f) => f.code);
      const invisible = report.findings.find((f) => f.code === "story-memento-invisible");
      expect(invisible?.message).toContain("1/2");
      expect(invisible?.message).toContain("ev_examine_2");
      expect(invisible?.message).not.toContain("ev_examine_1");
      expect(report.findings.some((f) => f.code === "command-missing-reference" && f.message.includes("@player"))).toBe(false);
      // 이동이 있는 컷신이 하나 있으니 「연출 없음」은 아니다.
      expect(codes).not.toContain("story-no-staging");
    });
  });
});
