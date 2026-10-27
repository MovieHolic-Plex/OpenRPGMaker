// 연애 시뮬레이션 두 번째 측정 수리(2026-10-16) — 미실행(이 세션은 테스트·게이트 금지). 기대값은 qa-runs 실측과 같은 방향이다.
import { describe, expect, it } from "vitest";
import { queryNpcGraphics } from "@/assets/charsetQuery";
import { friendshipShortName } from "@/project/friendship";
import { usesRelationshipMenu } from "@/project/relationshipMenu";
import { ROMANCE_TITLE_SUBTITLE } from "@/project/romancePreset";

describe("romance fix 3", () => {
  it("일반 질의(villager)도 Modern 연애 칩을 사람으로 센다", () => {
    // 이 경우는 「Modern 칩이 사람 후보에 든다」를 본다 — 순위가 아니다. scarloxy 사람 시트가 늘어(#2335 뒤 OPRN 사람 칩 추가)
    // 상위 20 은 다른 시트가 채우므로 후보 전체(최대 100)에서 찾는다.
    const keys = queryNpcGraphics("villager", 100).map((match) => match.entry.textureKey);
    expect(keys.some((key) => key.startsWith("tex_oprn_charset_modern"))).toBe(true);
  });

  it("HUD 이름은 호칭 꼬리를 뗀다", () => {
    expect(friendshipShortName("한서연 선배")).toBe("한서연");
    expect(friendshipShortName("선생님")).toBe("선생님");
    expect(friendshipShortName("차도현")).toBe("차도현");
  });

  it("관계 중심 게임만 호감 메뉴를 쓴다", () => {
    expect(usesRelationshipMenu({ system: { genreLock: { preset: "romance" } } } as never)).toBe(true);
    expect(usesRelationshipMenu({ system: {} } as never)).toBe(false);
  });

  it("연애 기본 타이틀 부제는 모험 문구가 아니다", () => {
    expect(ROMANCE_TITLE_SUBTITLE).not.toMatch(/ADVENTURE|모험/u);
  });
});
