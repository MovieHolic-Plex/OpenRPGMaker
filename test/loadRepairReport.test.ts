import { describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";
import { deserializeStoredProjectJsonWithReport } from "@/project/persistence/core/loadRepair";
import { collectLoadRepairs, adoptLatestLoadRepairReport } from "@/project/loadRepairReport";
import { deserialize } from "@/project/io";
import type { GameEvent } from "@/project/types";

function quietly<T>(run: () => T): T {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    return run();
  } finally {
    warn.mockRestore();
  }
}

function projectWithBrokenReferences(): string {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  map.events.push({ id: "ev_door", x: 1, y: 1, trigger: { kind: "action" }, commands: [
    { kind: "transfer", mapId: "map_deleted", x: 1, y: 1 },
    { kind: "callCommonEvent", commonEventId: "ce_deleted" },
  ] } as GameEvent);
  map.events.push({ id: "ev_gate", x: 2, y: 1, trigger: { kind: "action" }, commands: [
    { kind: "transfer", mapId: "map_deleted", x: 3, y: 3 },
  ] } as GameEvent);
  return serialize(project);
}

describe("로드 복구 보고", () => {
  it("깨진 참조를 지운 것을 종류·건수·자리로 돌려준다", () => {
    const text = projectWithBrokenReferences();
    const { project, report } = quietly(() => deserializeStoredProjectJsonWithReport(JSON.parse(text), text));
    const mapId = project.startMapId;
    expect(report.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "removed", code: "command-missing-map", count: 2, where: [`${mapId}/ev_door`, `${mapId}/ev_gate`] }),
      expect.objectContaining({ kind: "removed", code: "command-missing-common-event", count: 1, where: [`${mapId}/ev_door`] }),
    ]));
    expect(report.total).toBe(report.entries.reduce((sum, entry) => sum + entry.count, 0));
  });

  it("고칠 것이 없는 프로젝트는 빈 보고다", () => {
    const text = serialize(createBlankProject());
    const { report } = deserializeStoredProjectJsonWithReport(JSON.parse(text), text);
    expect(report).toEqual({ total: 0, entries: [] });
  });

  it("수집 구간 밖의 검증(lint 왕복 등)은 보고를 남기지 않는다", () => {
    const text = projectWithBrokenReferences();
    adoptLatestLoadRepairReport();
    quietly(() => deserialize(text));
    expect(adoptLatestLoadRepairReport()).toBeNull();
    quietly(() => collectLoadRepairs(() => deserialize(text)));
    expect(adoptLatestLoadRepairReport()?.total).toBe(3);
  });
});
