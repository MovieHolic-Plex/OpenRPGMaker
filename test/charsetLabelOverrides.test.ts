import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { queryNpcGraphics, resolveNpcGraphic } from "@/assets/charsetQuery";
import { searchResources } from "@/assets/resourceSearch";
import {
  CHARSET_SEMANTICS,
  applyCharsetLabelOverrides,
  findCharsetSemantic,
  upsertCharsetLabelOverride,
} from "@/assets/charsetSemantics";
import { createBlankProject } from "@/project/defaults";
import type { CharsetLabelOverride } from "@/project/types";

const ACTOR4_0 = { textureKey: "tex_easyrpg_charset_actor4", characterIndex: 0 };

const CHIEF: CharsetLabelOverride = {
  textureKey: ACTOR4_0.textureKey,
  characterIndex: ACTOR4_0.characterIndex,
  label: "우리 마을 촌장",
  tags: ["촌장", "노인"],
  origin: "user",
};

describe("charset label overrides", () => {
  it("번들 라벨이 기본값으로 그대로 나온다", () => {
    const base = CHARSET_SEMANTICS.find(
      (entry) =>
        entry.textureKey === ACTOR4_0.textureKey &&
        entry.characterIndex === ACTOR4_0.characterIndex,
    );
    expect(base?.label).toBe("파란 머리 청년");
    expect(findCharsetSemantic(ACTOR4_0.textureKey, ACTOR4_0.characterIndex)?.label).toBe(
      "파란 머리 청년",
    );
  });

  it("사용자 오버라이드가 라벨·태그를 덮어쓴다", () => {
    const applied = applyCharsetLabelOverrides(CHARSET_SEMANTICS, [CHIEF]);
    const hit = applied.find(
      (entry) =>
        entry.textureKey === ACTOR4_0.textureKey &&
        entry.characterIndex === ACTOR4_0.characterIndex,
    );
    expect(hit?.label).toBe("우리 마을 촌장");
    expect(hit?.tags).toContain("촌장");
    expect(hit?.gender).toBe(
      findCharsetSemantic(ACTOR4_0.textureKey, ACTOR4_0.characterIndex)?.gender,
    );
  });

  it("없는 슬롯·빈 라벨 오버라이드는 무시된다", () => {
    const applied = applyCharsetLabelOverrides(CHARSET_SEMANTICS, [
      { textureKey: "tex_nope", characterIndex: 0, label: "유령", origin: "user" },
      { textureKey: ACTOR4_0.textureKey, characterIndex: 0, label: "   ", origin: "user" },
    ]);
    expect(applied).toHaveLength(CHARSET_SEMANTICS.length);
    expect(findCharsetSemantic(ACTOR4_0.textureKey, ACTOR4_0.characterIndex)?.label).toBe(
      "파란 머리 청년",
    );
  });

  it("upsert 는 같은 슬롯을 덮어쓰고 빈 라벨이면 지운다", () => {
    const once = upsertCharsetLabelOverride([], CHIEF);
    expect(once).toHaveLength(1);
    const twice = upsertCharsetLabelOverride(once, { ...CHIEF, label: "새 촌장" });
    expect(twice).toHaveLength(1);
    expect(twice[0]?.label).toBe("새 촌장");
    expect(upsertCharsetLabelOverride(twice, { ...CHIEF, label: "  " })).toEqual([]);
  });

  it("queryNpcGraphics 가 가르친 이름으로 그 칸을 찾는다", () => {
    const match = resolveNpcGraphic("우리 마을 촌장", [CHIEF]);
    expect(match?.textureKey).toBe(ACTOR4_0.textureKey);
    expect(match?.characterIndex).toBe(ACTOR4_0.characterIndex);
    expect(queryNpcGraphics("촌장", 8, [CHIEF])[0]?.entry.label).toBe("우리 마을 촌장");
  });

  it("list_resources charset 검색이 가르친 라벨을 탄다", () => {
    const results = searchResources("charset", "우리 마을 촌장", { charsetLabels: [CHIEF] });
    expect(results[0]?.id).toBe(`charset:${ACTOR4_0.textureKey}:${ACTOR4_0.characterIndex}`);
  });

  it("animal#7 은 사자다", () => {
    expect(findCharsetSemantic("tex_easyrpg_charset_animal", 7)?.label).toBe("사자");
    expect(resolveNpcGraphic("사자")?.textureKey).toBe("tex_easyrpg_charset_animal");
    expect(resolveNpcGraphic("사자")?.characterIndex).toBe(7);
    expect(searchResources("charset", "사자")[0]?.id).toBe("charset:tex_easyrpg_charset_animal:7");
  });

  it("시스템 프롬프트에 가르친 캐릭터 칩이 실린다", () => {
    const project = createBlankProject();
    project.charsetLabels = [CHIEF];
    const prompt = buildSystemPrompt(project, { currentMapId: project.startMapId });
    expect(prompt).toContain("캐릭터 칩 지식");
    expect(prompt).toContain("우리 마을 촌장");
    expect(prompt).toContain(`${ACTOR4_0.textureKey}#${ACTOR4_0.characterIndex}`);
  });
});
