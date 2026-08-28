// 번들 전투 애니메이션 수렴 계약.
//
// 왜 이 테스트가 필요한가(실측 회귀, 2026-08-28): 갓 만든 프로젝트에서 ▶테스트가
// 아무 반응도 없었다. openTestPlayModal 첫 줄의 passesAuthoringTestGate() 가
// fail-closed 인데, 참조 문제가 18건 잡혔기 때문이다. 전부
// "item item_gen_*: animationId does not exist."
//
// 원인: generatedBattleEffectBindings 가 스타터 아이템·스킬을 생성 이펙트 팩
// (anim_gen_*)에 묶었는데, 로드되는 마을 데모 픽스처의 battleAnimations 는 팩
// 도입 이전 스냅샷(12개)이라 anim_gen_* 레코드가 하나도 없다. 정의는 있고
// (defaultBattleAnimationRecords() 는 43개를 낸다) 프로젝트에만 안 실린 상태였다.
//
// 그래서 ensureBundledResourceProfiles 와 같은 수렴 함수를 둔다 — 이미 저장된
// 프로젝트도 로드 한 번으로 번들 애니메이션을 되찾는다.
import { describe, expect, it } from "vitest";
import { ensureBundledBattleAnimations } from "@/project/defaults/defaultDatabase";
import { defaultBattleAnimationRecords } from "@/project/defaults/defaultDatabaseStarterRecords";
import { createBlankProject } from "@/project/defaults";
import { collectProjectReferenceIssues } from "@/project/io/references";
import type { Project } from "@/project/types";

/** 생성 이펙트 팩 도입 이전 스냅샷을 흉내낸다 — anim_gen_* 를 전부 걷어낸다. */
function projectWithStaleAnimations(): Project {
  const project = createBlankProject();
  project.database.battleAnimations = project.database.battleAnimations.filter(
    (record) => !record.id.startsWith("anim_gen_")
  );
  return project;
}

describe("ensureBundledBattleAnimations", () => {
  it("팩 이전 스냅샷에 빠진 anim_gen_* 레코드를 되채운다", () => {
    const project = projectWithStaleAnimations();
    const before = project.database.battleAnimations.length;
    expect(project.database.battleAnimations.some((r) => r.id.startsWith("anim_gen_"))).toBe(false);

    expect(ensureBundledBattleAnimations(project)).toBe(true);

    const after = project.database.battleAnimations.length;
    expect(after).toBeGreaterThan(before);
    expect(after).toBe(defaultBattleAnimationRecords().length);
  });

  it("두 번째 호출은 아무것도 바꾸지 않는다(멱등)", () => {
    const project = projectWithStaleAnimations();
    expect(ensureBundledBattleAnimations(project)).toBe(true);
    expect(ensureBundledBattleAnimations(project)).toBe(false);
  });

  it("저자가 고친 같은 id 레코드는 덮어쓰지 않는다", () => {
    const project = projectWithStaleAnimations();
    const kept = project.database.battleAnimations[0];
    expect(kept).toBeDefined();
    kept!.name = "저자가 바꾼 이름";

    ensureBundledBattleAnimations(project);

    const still = project.database.battleAnimations.find((r) => r.id === kept!.id);
    expect(still?.name).toBe("저자가 바꾼 이름");
  });

  it("수렴 뒤에는 애니메이션 참조 문제가 남지 않는다 — 재생 게이트가 열린다", () => {
    const project = projectWithStaleAnimations();
    const blocked = collectProjectReferenceIssues(project).filter((issue) =>
      issue.includes("animationId does not exist")
    );
    expect(blocked.length).toBeGreaterThan(0);

    ensureBundledBattleAnimations(project);

    const remaining = collectProjectReferenceIssues(project).filter((issue) =>
      issue.includes("animationId does not exist")
    );
    expect(remaining).toEqual([]);
  });
});

describe("갓 만든 프로젝트", () => {
  it("애니메이션 참조 문제 없이 시작한다", () => {
    const issues = collectProjectReferenceIssues(createBlankProject()).filter((issue) =>
      issue.includes("animationId does not exist")
    );
    expect(issues).toEqual([]);
  });
});
