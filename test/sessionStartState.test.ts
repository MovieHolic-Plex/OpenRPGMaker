/**
 * `ProjectStartState`(= `project.session`)의 저작값이 새 세션에 실제로 시드되는지 본다.
 *
 * 타입 주석은 "에디터가 정의하는 초기 스위치/변수/골드/인벤토리/파티 … 새 세션의 시드로만
 * 쓰인다"고 선언한다. 그런데 `startSession` 은 스위치·변수를 전부 false/0 으로 덮어써
 * 저작값을 조용히 버렸다 — 농사 데모가 `var_stamina: 100` 을 저작했는데 런타임 상태 덤프가
 * 0 을 보여주는 것을 브라우저에서 실측했다. 골드·인벤토리는 시드되는데 변수만 안 되는,
 * 저작 표면과 런타임이 갈라진 자리였다.
 */
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { createFarmingDemoProject } from "@/project/defaults/defaultProject";
import { startSession } from "@/project/session";

describe("저작된 시작 상태 시드", () => {
  it("저작된 시작 변수가 새 세션에 그대로 들어간다", () => {
    const project = createFarmingDemoProject();
    // 농사 데모는 기력을 100 으로 저작한다.
    expect(project.session.variables.var_stamina, "데모가 기력을 저작하지 않았다").toBe(100);

    const session = startSession(project, 1);
    expect(session.variables.var_stamina, "저작한 시작 변수가 버려졌다").toBe(100);
  });

  it("저작하지 않은 변수와 스위치는 0/false 로 시작한다", () => {
    const project = createBlankProject();
    project.variables.push({ id: "var_untouched", name: "손대지 않은 변수" });
    project.switches.push({ id: "sw_untouched", name: "손대지 않은 스위치" });

    const session = startSession(project, 1);
    expect(session.variables.var_untouched).toBe(0);
    expect(session.switches.sw_untouched).toBe(false);
  });

  it("저작된 시작 스위치가 켜진 채로 시작한다", () => {
    const project = createBlankProject();
    project.switches.push({ id: "sw_prologue_done", name: "프롤로그 완료" });
    project.session = { ...project.session, switches: { ...project.session.switches, sw_prologue_done: true } };

    const session = startSession(project, 1);
    expect(session.switches.sw_prologue_done, "저작한 시작 스위치가 버려졌다").toBe(true);
  });

  it("선언되지 않은 id 는 시작 상태에 있어도 세션에 들어오지 않는다", () => {
    // 옛 세이브에서 넘어온 잔재를 되살리면 지워진 퀘스트 플래그가 부활한다.
    const project = createBlankProject();
    project.session = {
      ...project.session,
      variables: { ...project.session.variables, var_deleted_long_ago: 42 },
      switches: { ...project.session.switches, sw_deleted_long_ago: true },
    };

    const session = startSession(project, 1);
    expect(session.variables.var_deleted_long_ago).toBeUndefined();
    expect(session.switches.sw_deleted_long_ago).toBeUndefined();
  });

  /**
   * 광산의 돌은 맵 타일이 아니라 시작 상태의 설치물이다(캐면 사라지므로).
   * 시드되지 않으면 광산은 생성 직후부터 이미 다 파먹은 방이 된다.
   */
  it("저작된 설치물이 새 세션에 놓인다", () => {
    const project = createFarmingDemoProject();
    const authored = Object.values(project.session.placeables ?? {}).filter((p) => p.kind === "rock");
    expect(authored.length, "데모가 돌을 저작하지 않았다").toBeGreaterThanOrEqual(2);

    const session = startSession(project, 1);
    const seeded = Object.values(session.placeables ?? {}).filter((p) => p.kind === "rock");
    expect(seeded.length, "저작한 설치물이 버려졌다").toBe(authored.length);
  });

  /** 캔 돌은 해당 세션에서만 사라진다 — 원본을 공유하면 다음 세션이 벼 방에서 시작한다. */
  it("세션에서 설치물을 캐도 프로젝트 시작 상태는 그대로다", () => {
    const project = createFarmingDemoProject();
    const before = Object.keys(project.session.placeables ?? {}).length;

    const first = startSession(project, 1);
    for (const key of Object.keys(first.placeables ?? {})) delete first.placeables?.[key];

    expect(Object.keys(project.session.placeables ?? {})).toHaveLength(before);
    const second = startSession(project, 1);
    expect(Object.keys(second.placeables ?? {})).toHaveLength(before);
  });
});
