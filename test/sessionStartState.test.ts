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
import { startSession } from "@/project/session";

describe("저작된 시작 상태 시드", () => {
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
});
