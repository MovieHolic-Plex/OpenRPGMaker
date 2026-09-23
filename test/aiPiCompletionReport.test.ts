/** @vitest-environment happy-dom */
// 실행 마무리 말 — 만든 것이 먼저, 남은 지적은 접은 「더 다듬을 곳 (N)」 칸. 지적은 버리지 않는다.
import { afterEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { setActivityLevel } from "@/editor/panels/aiActivityPreference";
import {
  COMPLETION_PLAY_HINT,
  compactRefineFindings,
  completionHeadline,
  createRefineFindings,
  plainMadeSummary,
  refineFindingsText,
} from "@/editor/panels/aiPiCompletionReport";

afterEach(() => setActivityLevel("brief"));

describe("실행 마무리 말", () => {
  it("새로 생긴 맵·이벤트·캐릭터를 사람 말로 센다", () => {
    const before = createBlankProject();
    const after = structuredClone(before);
    const template = Object.values(after.maps)[0]!;
    for (let i = 0; i < 2; i++) after.maps[`map_new_${i}`] = { ...structuredClone(template), id: `map_new_${i}`, name: `새 맵 ${i}`, events: [] };
    const events = after.maps.map_new_0!.events as unknown[];
    const sample = { id: "evt_a", name: "고양이", x: 1, y: 1, pages: [] };
    events.push(sample, { ...sample, id: "evt_b" }, { ...sample, id: "evt_c" });
    const actor = { ...(before.database.actors[0] ?? { name: "주인공" }), id: "actor_new" } as (typeof after.database.actors)[number];
    after.database.actors.push(actor);
    expect(plainMadeSummary(before, after)).toBe("맵 2개 · 이벤트 3개 · 캐릭터 1명을 만들었어요.");
    // 새로 생긴 게 없으면 숫자를 지어내지 않는다.
    expect(plainMadeSummary(before, structuredClone(before))).toBeNull();
  });

  it("머리말은 만든 것과 플레이 안내로 시작하고, 확인을 못 끝냈으면 그 사실을 숨기지 않는다", () => {
    const made = "맵 14개 · 이벤트 151개 · 캐릭터 11명을 만들었어요.";
    expect(completionHeadline(made, { unverified: false })).toBe(`${made}\n${COMPLETION_PLAY_HINT}`);
    expect(completionHeadline(null, { unverified: true }).split("\n")).toEqual([
      "변경 내용을 반영했어요.",
      COMPLETION_PLAY_HINT,
      "끝까지 확인하지는 못했어요. 마음에 들지 않으면 되돌릴 수 있어요.",
    ]);
  });

  it("여러 맵에 되풀이된 같은 유형의 지적과 똑같은 문장은 한 줄로 모인다", () => {
    // 2026-09-23 「등대지기의 겨울」 실제 검수 문장(요약)
    const bedroom = "좌측 방((2,2)~(5,5))과 우측 방((7,2)~(10,5))의 침대, 협탁, 거울, 액자 배치가 완전히 동일하게 복사되어 있어 인위적입니다.";
    const findings = [
      `바란의 집 내부 (2층): ${bedroom}`,
      "늙은 어부의 집 내부 (2층): 상단 두 침실 (2~5, 1~6)과 (7~10, 1~6)의 침대, 협탁, 화장대, 창문 배치가 완전히 똑같이 복사되어 있어 인위적입니다.",
      "헬가의 여관: 상단 방 사이의 비정상적인 외부 공백 (x=6, y=1~6): 북측 두 방 사이에 1타일 폭의 검은 배경 보이드가 깊게 파고들어 있습니다.",
      "바란의 집 내부 (2층): 상단 두 방 사이 (6,1)~(6,6) 구간에 1타일 너비의 외부 암흑 공백이 파고들어 있습니다.",
      "성에항: 중앙 상단 건물(x: 29~36, y: 6~12)에서 우측 지붕 구역 아래에 벽체나 기둥이 없어 지붕이 공중에 홀로 떠 있습니다.",
      "바란의 상점: 우상단 방과 우하단 방은 가구가 극소수만 흩어져 있어 휑합니다.",
      `바란의 집 내부 (2층): ${bedroom}`,
    ];
    const lines = compactRefineFindings(findings);
    expect(lines).toHaveLength(4);
    expect(lines[0]).toMatch(/^방·가구가 복사한 듯 똑같음 — 2곳\(바란의 집 내부 \(2층\), 늙은 어부의 집 내부 \(2층\)\)\. 예: 좌측 방/);
    expect(lines[1]).toMatch(/^맵 안의 검은 빈칸 — 2곳\(헬가의 여관, 바란의 집 내부 \(2층\)\)/);
    // 한 맵에만 나온 유형과 분류되지 않은 지적은 원문 그대로.
    expect(lines).toContain(findings[4]);
    expect(lines).toContain(findings[5]);
    const details = createRefineFindings(findings) as HTMLDetailsElement;
    expect(details.querySelector("summary")?.textContent).toBe("더 다듬을 곳 (4)");
  });

  it("지적은 간단히 보기에서 접힌 칸에 전부 남고, 자세히 보기에서는 펼쳐진다", () => {
    const findings = ["마을: 맵 좌측 전체가 검은 공백으로 방치되어 있습니다", "마을: 집 입구가 막혔습니다", "숲: 길이 끊겼습니다", "숲: 나무가 겹칩니다"];
    const details = createRefineFindings(findings) as HTMLDetailsElement;
    document.body.append(details);
    expect(details.querySelector("summary")?.textContent).toBe("더 다듬을 곳 (4)");
    expect(details.open).toBe(false);
    // 옛 문구는 셋만 보이고 나머지는 「작업 과정」 으로 밀었다 — 이제는 넷 다 칸 안에 있다.
    expect([...details.querySelectorAll("li")].map(li => li.textContent)).toEqual(findings);
    setActivityLevel("detail");
    expect(details.open).toBe(true);
    expect(refineFindingsText(findings)).toContain("• 숲: 나무가 겹칩니다");
  });
});
