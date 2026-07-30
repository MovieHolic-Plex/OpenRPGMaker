// test/battleModelSelector.test.ts
// system.battleModel 선택자("rm2k3" | "gen1")의 스키마/마이그레이션/정규화/DOM 속성 검증.
// 기본(rm2k3)은 기존 RM2k3 전투 동작을 100% 유지하며, gen1 만 별도 보존한다.

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { deserialize, serialize } from "@/project/io";
import { createBlankProject } from "@/project/defaults";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { syncBattleModelAttribute } from "@/app/mode";
import { installFakeDom } from "./fakeDom";

describe("system.battleModel — 기본값/마이그레이션", () => {
  it("새 프로젝트는 기본 rm2k3 이다(필드 생략)", () => {
    const project = createBlankProject();
    expect(project.system.battleModel).toBeUndefined();
    expect(project.system.battleModel ?? "rm2k3").toBe("rm2k3");
    // 기본 프로젝트 JSON 에는 battleModel 키가 없다(레거시와 동일한 바이트).
    expect(serialize(project)).not.toContain("battleModel");
  });

  it("레거시 프로젝트(battleModel 필드 없음)는 rm2k3 로 로드된다", () => {
    const project = createBlankProject();
    const raw = serialize(project);
    const restored = deserialize(raw);
    expect(restored.system.battleModel).toBeUndefined();
    expect(restored.system.battleModel ?? "rm2k3").toBe("rm2k3");
  });

  it("gen1 명시적으로 설정한 프로젝트에서 rm2k3 로 되돌리면 키가 생략된다", () => {
    const project = createBlankProject();
    project.system.battleModel = "gen1";
    const obj = JSON.parse(serialize(project));
    expect(obj.system.battleModel).toBe("gen1");
    // gen1 -> rm2k3 전환 후 직렬화하면 키가 사라진다(기본값 미저장 계약).
    obj.system.battleModel = "rm2k3";
    const restored = deserialize(JSON.stringify(obj));
    expect(restored.system.battleModel).toBeUndefined();
    expect(restored.system.battleModel ?? "rm2k3").toBe("rm2k3");
  });
});

describe("system.battleModel — 직렬화 왕복", () => {
  it("gen1 설정은 serialize/deserialize 왕복을 보존한다", () => {
    const project = createBlankProject();
    project.system.battleModel = "gen1";
    const wire = serialize(project);
    expect(wire).toContain('"battleModel":"gen1"');
    const restored = deserialize(wire);
    expect(restored.system.battleModel).toBe("gen1");
  });

  it("rm2k3(기본)은 왕복해도 JSON 에 키를 만들지 않는다", () => {
    const project = createBlankProject();
    project.system.battleModel = "rm2k3";
    const restored = deserialize(serialize(project));
    expect(restored.system.battleModel).toBeUndefined();
    expect(serialize(restored)).not.toContain("battleModel");
  });
});

describe("system.battleModel — 정규화", () => {
  it("gen1 은 normalizeSystemRecords 후 보존된다", () => {
    const base = createBlankProject();
    const out = normalizeSystemRecords({ ...base.system, battleModel: "gen1" });
    expect(out.battleModel).toBe("gen1");
  });

  it("rm2k3 은 normalizeSystemRecords 후 생략된다", () => {
    const base = createBlankProject();
    const out = normalizeSystemRecords({ ...base.system, battleModel: "rm2k3" });
    expect(out.battleModel).toBeUndefined();
  });

  it("무효값은 역직렬화 경로에서 rm2k3 로 정규화된다", () => {
    const project = createBlankProject();
    const obj = JSON.parse(serialize(project));
    obj.system.battleModel = "gen5"; // 무효값
    const restored = deserialize(JSON.stringify(obj));
    expect(restored.system.battleModel).toBeUndefined();
    expect(restored.system.battleModel ?? "rm2k3").toBe("rm2k3");
  });
});

describe("data-battle-model DOM 속성", () => {
  let restoreDom: () => void;

  beforeEach(() => {
    restoreDom = installFakeDom();
  });
  afterEach(() => {
    restoreDom();
  });

  it("기본 프로젝트는 data-battle-model=rm2k3", () => {
    syncBattleModelAttribute(createBlankProject());
    expect(document.body.getAttribute("data-battle-model")).toBe("rm2k3");
  });

  it("gen1 프로젝트는 data-battle-model=gen1", () => {
    const project = createBlankProject();
    project.system.battleModel = "gen1";
    syncBattleModelAttribute(project);
    expect(document.body.getAttribute("data-battle-model")).toBe("gen1");
  });

  it("전환 시 속성 값이 최신값으로 갱신된다", () => {
    const project = createBlankProject();
    syncBattleModelAttribute(project);
    expect(document.body.getAttribute("data-battle-model")).toBe("rm2k3");
    project.system.battleModel = "gen1";
    syncBattleModelAttribute(project);
    expect(document.body.getAttribute("data-battle-model")).toBe("gen1");
    project.system.battleModel = undefined;
    syncBattleModelAttribute(project);
    expect(document.body.getAttribute("data-battle-model")).toBe("rm2k3");
  });
});
