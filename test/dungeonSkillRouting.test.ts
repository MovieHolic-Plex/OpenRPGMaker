import { describe, expect, it } from "vitest";
import { rankSkillsForText, resolveIntentClarification, topSkillMatches } from "@/ai/intentClarify";
import { listAllSkills } from "@/ai/skills";

// build-dungeon 스킬 배선 — 요청이 dungeon-room-v1 하네스에 실제로 도달하는지 고정.
describe("build-dungeon 스킬 라우팅", () => {
  it("스킬 레지스트리에 build-dungeon 이 등록돼 있고 하네스 툴 절차를 담는다", () => {
    const skill = listAllSkills().find((s) => s.id === "build-dungeon");
    expect(skill).toBeDefined();
    expect(skill!.kind).toBe("prompt");
    const prompt = (skill as { buildPrompt: (args: Record<string, unknown>, ctx: Record<string, unknown>) => string })
      .buildPrompt({ brief: "", theme: "ice", width: 26, height: 18, hazard: "with" }, {});
    expect(prompt).toContain("run_dungeon_room_pipeline");
    expect(prompt).toContain('"ice"');
    expect(prompt).toContain("좌끝·가로증식·우끝");
  });

  it("던전 요청 문구에서 build-dungeon 이 최상위로 매칭된다", () => {
    for (const text of ["용암 던전 만들어줘", "얼음 동굴 하나 지어줘", "던전 시공 부탁해"]) {
      const top = topSkillMatches(rankSkillsForText(text));
      expect(top.length, text).toBeGreaterThan(0);
      expect(top[0]!.skillId, text).toBe("build-dungeon");
    }
  });

  it("던전 요청은 house-vs-interior 로 되묻지 않는다", () => {
    expect(resolveIntentClarification("용암 던전 방 하나 만들어줘")).toBeNull();
    expect(resolveIntentClarification("얼음 동굴 던전 지어줘")).toBeNull();
  });

  it("기존 집/실내 라우팅은 영향받지 않는다", () => {
    // 집만 있으면 여전히 되묻는다 (기존 계약 유지)
    expect(resolveIntentClarification("집 하나 만들어줘")).not.toBeNull();
    // 실내 표지는 여전히 실내 경로 확정
    expect(resolveIntentClarification("실내 맵 하나 만들어줘")).toBeNull();
  });
});
