// 2026-09-24 헤드리스 r0735 「등대지기의 겨울」: 보스전 승리 분기를 선택지 모양
// `battleProcessing.options:[{text:"승리",branch:[setSwitch, setSelfSwitch]}]` 으로 보냈다. 도구는 ok 였지만
// 런타임은 options 를 읽지 않아 셀프 스위치가 켜지지 않았고 엔딩 페이지가 열리지 않았다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { canonicalizeCommandFieldAliases } from "@/project/eventCommands/commandFieldAliases";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

const WIN = [{ kind: "setSwitch", switchId: "sw_0001", value: true }, { kind: "setSelfSwitch", key: "A", value: true }];

function convert(battle: Record<string, unknown>): { command: Record<string, unknown>; warnings: string[] } {
  const command = { kind: "battleProcessing", troopId: "troop_x", ...battle };
  const warnings: string[] = [];
  canonicalizeCommandFieldAliases([command], message => warnings.push(message));
  return { command, warnings };
}

describe("battleProcessing result options alias", () => {
  it("moves a 승리 option into victoryBranch through upsert_event and warns", () => {
    const ctx: { project: Project } = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const troopId = ctx.project.database.troops[0]!.id;
    const result = runTool(ctx, "upsert_event", {
      mapId,
      event: {
        id: "ev_boss", x: 3, y: 3, name: "보스",
        pages: [{
          id: "p1", trigger: { kind: "action" },
          graphic: { pattern: 0, sprite: { id: "tex_easyrpg_charset_actor1", type: "bundled" }, direction: "down" },
          commands: [{ kind: "battleProcessing", troopId, options: [{ text: "승리", branch: [{ kind: "setSelfSwitch", key: "A", value: true }] }] }],
        }],
      },
    });
    expect(result.ok, result.summary).toBe(true);
    const battle = ctx.project.maps[mapId]!.events.find(e => e.id === "ev_boss")!.pages![0]!.commands[0] as Record<string, unknown>;
    expect(battle).not.toHaveProperty("options");
    expect(battle).toMatchObject({ branchOnResult: true, victoryBranch: [{ kind: "setSelfSwitch", key: "A", value: true }] });
    expect(JSON.stringify(result)).toContain("→ victoryBranch");
    expect(JSON.stringify(result)).toContain("옮겼습니다");
  });

  it("maps defeat and escape texts and enables their flags", () => {
    const { command, warnings } = convert({
      options: [
        { text: "이겼을 때", branch: WIN },
        { text: "Defeat", branch: [{ kind: "text", body: "졌다" }] },
        { text: "도망친다", commands: [{ kind: "text", body: "도망" }] },
      ],
    });
    expect(command).toMatchObject({ branchOnResult: true, canLose: true, canEscape: true });
    expect(command.victoryBranch).toEqual(WIN);
    expect(command.defeatBranch).toEqual([{ kind: "text", body: "졌다" }]);
    expect(command.escapeBranch).toEqual([{ kind: "text", body: "도망" }]);
    expect(command).not.toHaveProperty("options");
    expect(warnings.join("\n")).toMatch(/defeatBranch/);
  });

  it("treats a single unrecognized option as the victory branch and says so", () => {
    const { command, warnings } = convert({ options: [{ text: "보스 격전", branch: WIN }] });
    expect(command.victoryBranch).toEqual(WIN);
    expect(warnings.join("\n")).toContain("승리로 봤습니다");
  });

  it("leaves several unrecognized options alone but explains the right shape", () => {
    const { command, warnings } = convert({ options: [{ text: "가", branch: WIN }, { text: "나", branch: [] }] });
    expect(command).toHaveProperty("options");
    expect(command).not.toHaveProperty("victoryBranch");
    expect(warnings.join("\n")).toContain("branchOnResult:true");
  });
});
