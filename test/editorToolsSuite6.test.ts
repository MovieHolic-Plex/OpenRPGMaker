import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { compileSimplePage } from "@/editor/tools/eventCompile";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { AUTHOR_BEODEUL_TOWN_TOOL } from "@/editor/tools/authorBeodeulTown";
import { AUTHOR_DUNGEON_TOOL } from "@/editor/tools/dungeonTools";
import { checkBboxVillage, type BboxVillageLayout } from "@/editor/tools/bboxVillage";
import { reliefAllowsStep, reliefSlopes } from "@/project/relief/walk";
import { reliefRampArt } from "@/project/relief/styles";
import { cutPieceFor } from "@/project/relief/cutPieces";
import type { ReliefData } from "@/project/relief/types";
import { isolateTimers } from "./mergedTeardown";

// 에이전틱 개선(2026-07-04) 회귀 테스트.
// - 사용자 제한은 출력 토큰 예산 하나(기본 200000) — 예산 소진 시 token-budget으로 정지.
// - SimplePage 별칭(showText/text/messages)이 대사로 컴파일된다(조용한 유실 방지).
// - place_npc는 통행 불가/점유 좌표를 근처 통행 가능 칸으로 자동 조정한다.
describe("aiAgentic", () => {
  isolateTimers();
  function toolCallResult(name: string, completionTokens: number): ChatResult {
    return {
      message: {
        role: "assistant",
        content: null,
        tool_calls: [{ id: `call_${Math.trunc(completionTokens)}`, type: "function", function: { name, arguments: "{}" } }],
      },
      finishReason: "tool_calls",
      usage: { completion_tokens: completionTokens },
    };
  }
  describe("출력 토큰 예산", () => {
    it("누적 출력 토큰이 maxTokens를 넘으면 token-budget으로 멈춘다", async () => {
      let rounds = 0;
      const session = new AssistantSession(createBlankProject(), {
        config: { ...defaultAiConfig(), apiKey: "sk", maxTokens: 10240 },
        chat: async (cfg, req) => {
          // 플래너(tool 없음)는 예산 집계 밖 또는 direct 로 패스 — 실행 루프만 카운트.
          const hasTools = Array.isArray((req as { tools?: unknown }).tools) && ((req as { tools: unknown[] }).tools?.length ?? 0) > 0;
          if (!hasTools) {
            return {
              message: { role: "assistant", content: JSON.stringify({ action: "direct", reason: "lookup" }) },
              finishReason: "stop",
              usage: { completion_tokens: 20 },
            };
          }
          rounds += 1;
          return toolCallResult("get_project_summary", 6000);
        },
      });
      const result = await session.sendUserMessage("계속 조회해", () => {});
      expect(result.stoppedReason).toBe("token-budget");
      expect(rounds).toBe(2); // 6000 + 6000 = 12000 ≥ 10240
    });

    it("예산 안에서 최종 응답하면 final로 끝난다", async () => {
      const session = new AssistantSession(createBlankProject(), {
        config: { ...defaultAiConfig(), apiKey: "sk" },
        chat: async () => ({
          message: { role: "assistant", content: "완료" },
          finishReason: "stop",
          usage: { completion_tokens: 100 },
        }),
      });
      const result = await session.sendUserMessage("안녕", () => {});
      expect(result.stoppedReason).toBe("final");
    });
  });
  describe("SimplePage 대사 별칭", () => {
    const graphic = { transparent: true as const };

    it("showText 배열이 text 커맨드로 컴파일된다 (감사 로그 유실 케이스)", () => {
      const page = compileSimplePage("p0", "현자 노인", { showText: ["첫 줄", "둘째 줄"] }, graphic);
      const texts = page.commands.filter((command) => command.kind === "text");
      expect(texts).toHaveLength(2);
    });

    it("text 단일 문자열과 messages 배열도 대사가 된다", () => {
      expect(compileSimplePage("p1", "n", { text: "한 줄" }, graphic).commands.filter((c) => c.kind === "text")).toHaveLength(1);
      expect(compileSimplePage("p2", "n", { messages: ["a", "b", "c"] }, graphic).commands.filter((c) => c.kind === "text")).toHaveLength(3);
    });

    it("lines가 있으면 lines가 우선한다", () => {
      const page = compileSimplePage("p3", "n", { lines: ["본문"], showText: ["무시"] }, graphic);
      const texts = page.commands.filter((command) => command.kind === "text" && "body" in command);
      expect(texts).toHaveLength(1);
    });
  });
  describe("place_npc 자동 착지", () => {
    it("이미 점유된 좌표에 배치하면 인근 통행 가능 칸으로 조정된다", () => {
      const context: ToolContext = { project: createBlankProject() };
      const mapId = context.project.startMapId;
      const first = runTool(context, "place_npc", {
        mapId, x: 2, y: 2, id: "npc_a", name: "갑", pages: [{ lines: ["안녕"] }],
      });
      expect(first.ok, first.summary).toBe(true);

      const second = runTool(context, "place_npc", {
        mapId, x: 2, y: 2, id: "npc_b", name: "을", pages: [{ lines: ["반가워"] }],
      });
      expect(second.ok, second.summary).toBe(true);
      const data = second.data as { x: number; y: number; adjusted: boolean };
      expect(data.adjusted).toBe(true);
      expect(`${data.x},${data.y}`).not.toBe("2,2");
      expect(second.summary).toContain("자동 조정");
    });

    it("반경 3칸 내에 통행 가능 칸이 없으면 여전히 실패한다", () => {
      const context: ToolContext = { project: createBlankProject() };
      const mapId = context.project.startMapId;
      const map = context.project.maps[mapId];
      const tileset = context.project.tilesets[map.tilesetId];
      // 전 타일을 통행 불가로 만들어 조정 불가 상황을 강제한다.
      for (let index = 0; index < tileset.passability.length; index += 1) {
        tileset.passability[index] = { up: false, down: false, left: false, right: false };
      }
      const result = runTool(context, "place_npc", {
        mapId, x: 5, y: 5, id: "npc_c", name: "병", pages: [{ lines: ["..."] }],
      });
      expect(result.ok).toBe(false);
      expect(result.summary).toContain("통행 가능 칸이 없습니다");
    });
  });
});

// test/assistantReliefCutPieces.test.ts
// 조수 빌더(버들항 마을 · 던전 높이 단 · bbox 마을)가 놓는 계단이 모두 절벽을 깎은 통째 조각(rampArt *-steps)에 맞는다.
// 조각이 없는 모양(cutPieceFor null)이면 렌더러가 말없이 옛 돌계단 타일로 물러난다 — 2026-11-04 전에는 빌더 모양 9/9 가 null 이었다.
describe("assistantReliefCutPieces", () => {
  isolateTimers();
  /** 모든 경사로: 조각 키 · 조각이 있는가 · 아랫 층계참에서 윗 층계참까지 모든 열을 걸어 오르는가. */
  function slopesOf(r: ReliefData, style: string | undefined) {
    const pieces = reliefRampArt(style)?.pieces;
    return reliefSlopes(r).map((s) => {
      const code = r.ramps?.[s.y * r.width + s.x] ?? 0, kind = code > 4 ? "stairs" : "ramp";
      const key = `${kind}:${s.dir}:${s.w}x${s.h}:${s.hi - s.lo}`;
      let walk = s.dir === "n" || s.dir === "s";
      for (let a = 0; walk && a < s.w; a += 1) {
        const dy = s.dir === "n" ? -1 : 1, x = s.x + a;
        let y = s.dir === "n" ? s.y + s.h : s.y - 1;
        for (let k = 0; k <= s.h; k += 1, y += dy) if (!reliefAllowsStep(r, x, y, x, y + dy)) { walk = false; break; }
      }
      return { key, at: [s.x, s.y], piece: !!(pieces && cutPieceFor(pieces, kind, s.dir, s.w, s.h, s.hi - s.lo)), walk };
    });
  }
  describe("assistant builders lay carved stair pieces", () => {
    it("버들항 마을(코드 지형 언덕·계단식 단): 모든 계단이 조각에 맞고 걸어 오른다", { timeout: 120_000 }, () => {
      let total = 0;
      for (const theme of ["river", "desert"]) for (const landform of ["hill", "terraces"]) for (const seed of [1, 2]) {
        const p = createBlankProject();
        const res = AUTHOR_BEODEUL_TOWN_TOOL.run(p as never, { theme, landform, seed, name: "relief" }) as { data: { mapId: string } };
        const map = p.maps[res.data.mapId]!;
        const sl = slopesOf(map.relief!, map.relief!.style);
        total += sl.length;
        for (const s of sl) expect(s, `${theme}/${landform}/${seed} ${s.key} @${s.at}`).toMatchObject({ piece: true, walk: true });
      }
      expect(total).toBeGreaterThan(0);
    });

    it("던전 높이 단(rooms[].level): 모든 계단이 조각에 맞고 걸어 오른다", { timeout: 60_000 }, () => {
      const designs = [
        { type: "cave", design: { rooms: [{ id: "a", role: "entrance", at: "s", level: 0 }, { id: "b", role: "hall", at: "center", level: 1 }, { id: "c", role: "boss", at: "n", level: 2 }], connections: "linear" } },
        { type: "cave", design: { rooms: [{ id: "a", role: "entrance", at: "w", level: 0 }, { id: "b", role: "hall", at: "center", level: 1 }, { id: "c", role: "treasure", at: "ne", level: 2 }, { id: "d", role: "boss", at: "e", level: 1 }], connections: "branch" } },
        { type: "forest", design: { rooms: [{ id: "a", role: "entrance", at: "s", level: 0 }, { id: "b", role: "camp", at: "e", level: 1 }, { id: "c", role: "boss", at: "n", level: 2 }], connections: "linear" } },
      ];
      let total = 0;
      for (const d of designs) for (const seed of [1, 2]) {
        const p = createBlankProject();
        const res = AUTHOR_DUNGEON_TOOL.run(p as never, { name: "relief", type: d.type, design: d.design, seed, populate: false, gimmick: "none", adapter: "beodeul", genre: "rpg" }) as { data: { mapId?: string; mapIds?: string[] } };
        const map = p.maps[res.data.mapIds?.[0] ?? res.data.mapId!]!;
        if (!map.relief) continue;
        const sl = slopesOf(map.relief, map.relief.style);
        total += sl.length;
        for (const s of sl) expect(s, `${d.type}/${seed} ${s.key} @${s.at}`).toMatchObject({ piece: true, walk: true });
      }
      expect(total).toBeGreaterThan(0);
    });

    it("bbox 마을: 북쪽 오르막은 발치 한 줄, 남쪽 오르막은 단 차 + 2줄만 받고 그 계단이 조각에 맞는다", () => {
      // 20×20: 0~7줄 2단(북쪽 대지) · 8~14줄 0단 · 15~19줄 1단(남쪽 대지, 북향 절벽)
      const W = 20, H = 20, levels = Array.from({ length: W * H }, (_, i) => { const y = Math.floor(i / W); return y <= 7 ? 2 : y >= 15 ? 1 : 0; });
      const T = { W, H, levels, water: new Array<number>(W * H).fill(0) };
      const rect = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });
      const layout = (stairs: { x: number; y: number; w: number; h: number; dir: "north" | "south" }[], rects: ReturnType<typeof rect>[]) =>
        ({ name: "t", roads: [{ kind: "main", rects }], stairs, plazas: [], buildings: [], fields: [], fences: [], trees: [], props: [],
          forests: [rect(0, 0, 8, 8), rect(12, 0, 8, 8), rect(0, 15, 8, 5), rect(12, 15, 8, 5), rect(0, 8, 8, 3), rect(12, 8, 8, 3), rect(0, 12, 8, 3), rect(12, 12, 8, 3)] }) as unknown as BboxVillageLayout;
      const stairErrors = (L: BboxVillageLayout) => checkBboxVillage([], L, T as never).errors.filter((e) => /stairs\[/.test(e));
      const good = layout([{ x: 9, y: 8, w: 2, h: 1, dir: "north" }, { x: 9, y: 12, w: 2, h: 3, dir: "south" }], [rect(9, 0, 2, 8), rect(9, 9, 2, 2), rect(0, 11, 20, 1), rect(9, 15, 2, 5)]);
      const checked = checkBboxVillage([], good, T as never);
      expect(checked.errors).toEqual([]);
      const plan = checked.plan!;
      const sl = slopesOf({ width: W, height: H, levels, ramps: plan.ramps }, "grass-steps");
      expect(sl.map((s) => s.key).sort()).toEqual(["stairs:n:2x1:2", "stairs:s:2x3:1"]);
      for (const s of sl) expect(s).toMatchObject({ piece: true, walk: true });
      // 옛 모양(북쪽 단 차 + 1줄 · 폭 1)은 거절한다
      expect(stairErrors(layout([{ x: 9, y: 8, w: 2, h: 3, dir: "north" }], [rect(9, 0, 2, 8), rect(9, 11, 2, 1), rect(0, 11, 20, 1)]))).toHaveLength(1);
      expect(stairErrors(layout([{ x: 9, y: 8, w: 1, h: 1, dir: "north" }], [rect(9, 0, 1, 8), rect(9, 9, 1, 3), rect(0, 11, 20, 1)]))).toHaveLength(1);
    });
  });
});
