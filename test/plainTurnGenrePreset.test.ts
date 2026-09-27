// 장르 프리셋 첫 요청은 의도 선언(모델 호출)을 건너뛴다 — 답이 정해진 판정에 10~24초와 30초 실패 창을 쓰지 않는다.
import { describe, expect, it, vi } from "vitest";
import { resolveAutonomy } from "@/ai/autonomyLevels";
import { GENRE_PRESET_BRIEF_PREFIX } from "@/ai/genrePresetBrief";
import { classifyPlainPiTurn } from "@/ai/piAgent/plainTurn";
import { createBlankProject } from "@/project/defaults";

const input = (text: string, piTeam: boolean, autonomy = resolveAutonomy("balanced")) => {
  const declarer = vi.fn(() => { throw new Error("프리셋 요청에서 의도 선언을 불렀다"); });
  const project = createBlankProject();
  return { declarer, run: () => classifyPlainPiTurn({ project, text, currentMapId: project.startMapId, selection: null, hasActivePlan: false, autonomy, declarer, piTeam }) };
};

describe("장르 프리셋 첫 요청", () => {
  it.each([true, false])("의도 선언 없이 쓰기 실행으로 분류한다 (팀=%s)", async (piTeam) => {
    const { declarer, run } = input(`${GENRE_PRESET_BRIEF_PREFIX} 몬스터 수집\n\n기획…`, piTeam);
    const out = await run();
    expect(declarer).not.toHaveBeenCalled();
    expect(out.mode).toBe(piTeam ? "team" : "single");
    expect(out.plan).toMatchObject({ readOnly: false, routineEdit: false });
    expect(out.plan.villageContract).toBeUndefined();
    // 도구를 좁히지 않는다 — 게임 전체 저작은 DB·시스템·맵 도구를 모두 쓴다.
    expect(out.initialToolNames).toBeUndefined();
  });

  it("읽기 전용 다이얼이면 여전히 단독 읽기 턴이다", async () => {
    const { declarer, run } = input(`${GENRE_PRESET_BRIEF_PREFIX} 몬스터 수집`, true, resolveAutonomy("readonly"));
    const out = await run();
    expect(declarer).not.toHaveBeenCalled();
    expect(out.mode).toBe("single");
    expect(out.plan.readOnly).toBe(true);
  });
});
