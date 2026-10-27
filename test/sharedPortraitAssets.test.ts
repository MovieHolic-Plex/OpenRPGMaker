import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FACE_EXPRESSION_SETS } from "@/assets/faceExpressionSets";
import { builtinGeneratedResourceIds, resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { resolveAppearancePortrait } from "@/project/characterAppearances";
import type { Project } from "@/project/types";
import {
  CAST_PORTRAIT_SETS,
  SHARED_PORTRAIT_DIALOGUE_EXPRESSIONS,
  MODERN_PORTRAIT_EXPRESSIONS,
  MODERN_PORTRAIT_SETS,
  SHARED_PORTRAIT_ASSETS,
  dialogueFaceForEmotion,
  findSharedPortrait,
  sharedExpressionSetIdOf,
  sharedPortraitExpressionSiblings,
  sharedPortraitWithExpression,
} from "@/assets/sharedPortraitAssets";

describe("공용 표정 세트 흉상·전신", () => {
  // 캐스트 흉상 세트(CAST_PORTRAIT_SETS, 대사 5표정·흉상만)가 #3435 폴른 스타 심문관으로 더해졌다.
  it("76세트 × 2모양 × 16표정 + 현대 연애 24세트 × 2모양 × 5표정 + 캐스트 흉상 세트 × 5표정 = 2677장이고 파일이 모두 있다", () => {
    expect(FACE_EXPRESSION_SETS).toHaveLength(76);
    expect(SHARED_PORTRAIT_ASSETS).toHaveLength(
      2432 + MODERN_PORTRAIT_SETS.length * 2 * MODERN_PORTRAIT_EXPRESSIONS.length + CAST_PORTRAIT_SETS.length * SHARED_PORTRAIT_DIALOGUE_EXPRESSIONS.length,
    );
    const missing = SHARED_PORTRAIT_ASSETS.filter((asset) => !existsSync(path.join("public", asset.path))).map((asset) => asset.path);
    expect(missing).toEqual([]);
  });

  it("id 가 대화창 표시 방식(-bust/-full)을 담고, 내장 리소스로 해석된다", () => {
    const builtin = new Set(builtinGeneratedResourceIds());
    for (const asset of SHARED_PORTRAIT_ASSETS) {
      expect(asset.id).toContain(`-${asset.mode}-`);
      expect(asset.id.includes("-full")).toBe(asset.mode === "full");
      expect(builtin.has(asset.id)).toBe(true);
      expect(resolveAssetResourceUrl(asset.id)).toContain(asset.path);
    }
  });

  it("바탕 얼굴이 공용 초상이면 대사 표정으로 같은 모양의 표정 그림을 고른다", () => {
    const bust = "shared-people1-boy-expressions-bust-base";
    expect(dialogueFaceForEmotion(bust, "happy", undefined)).toBe("shared-people1-boy-expressions-bust-happy");
    // 화자 프로필의 48px 낱장 표정이 있어도 흉상이 낱장으로 떨어지지 않는다.
    expect(dialogueFaceForEmotion(bust, "sad", "shared-people1-boy-expressions-10")).toBe("shared-people1-boy-expressions-bust-sad");
    expect(dialogueFaceForEmotion("shared-people1-boy-expressions-full-happy", "angry", undefined)).toBe("shared-people1-boy-expressions-full-angry");
    // 표정이 없으면 고른 그림 그대로.
    expect(dialogueFaceForEmotion("shared-people1-boy-expressions-full-happy", undefined, undefined)).toBe("shared-people1-boy-expressions-full-happy");
    // 공용 초상이 아니면 예전 규칙(프로필 표정 얼굴 우선).
    expect(dialogueFaceForEmotion("shared-people1-boy-expressions-00", "happy", "shared-people1-boy-expressions-02")).toBe("shared-people1-boy-expressions-02");
    expect(dialogueFaceForEmotion("easyrpg-faceset-actor1-00", "happy", undefined)).toBe("easyrpg-faceset-actor1-00");
  });

  it("세트·표정 이웃을 찾는다", () => {
    expect(findSharedPortrait("shared-monster-slime-expressions-full-sad")).toMatchObject({ mode: "full", expression: "sad", setId: "shared-monster-slime-expressions" });
    expect(sharedPortraitWithExpression("shared-monster-slime-expressions-full-sad", "base")).toBe("shared-monster-slime-expressions-full-base");
    expect(sharedPortraitExpressionSiblings("shared-monster-slime-expressions-bust-base")).toHaveLength(5);
    expect(sharedPortraitExpressionSiblings("easyrpg-faceset-actor1-00")).toEqual([]);
    // 대사 표정이 아닌 표정은 emotion 으로 바뀌지 않는다(직접 고른 그대로).
    expect(dialogueFaceForEmotion("shared-monster-slime-expressions-bust-wink", undefined, undefined)).toBe("shared-monster-slime-expressions-bust-wink");
    expect(sharedExpressionSetIdOf("shared-people1-girl-expressions-07")).toBe("shared-people1-girl-expressions");
    expect(sharedExpressionSetIdOf("shared-people1-girl-expressions-bust-angry")).toBe("shared-people1-girl-expressions");
    expect(sharedExpressionSetIdOf("easyrpg-faceset-people1-01")).toBe("shared-people1-girl-expressions");
    expect(sharedExpressionSetIdOf("easyrpg-faceset-actor5-01")).toBeUndefined();
  });

  it("외형의 전신 칸: 전신 → 흉상 → 얼굴 순으로 내려간다", () => {
    const project = (appearance: Record<string, unknown>) => ({ database: { characterAppearances: [{ id: "a", name: "", description: "", ...appearance }] } }) as unknown as Project;
    const all = project({ face: { resourceId: "shared-people1-boy-expressions-00" }, bust: { resourceId: "shared-people1-boy-expressions-bust-base" }, full: { resourceId: "shared-people1-boy-expressions-full-base" } });
    expect(resolveAppearancePortrait(all, "a", "full")).toMatchObject({ resourceId: "shared-people1-boy-expressions-full-base", presentation: "full" });
    expect(resolveAppearancePortrait(all, "a", "bust")).toMatchObject({ resourceId: "shared-people1-boy-expressions-bust-base", presentation: "bust" });
    const noFull = project({ face: { resourceId: "shared-people1-boy-expressions-00" }, bust: { resourceId: "shared-people1-boy-expressions-bust-base" } });
    expect(resolveAppearancePortrait(noFull, "a", "full")).toMatchObject({ resourceId: "shared-people1-boy-expressions-bust-base", presentation: "bust" });
    const faceOnly = project({ face: { resourceId: "shared-people1-boy-expressions-00" } });
    expect(resolveAppearancePortrait(faceOnly, "a", "full")).toMatchObject({ resourceId: "shared-people1-boy-expressions-00", presentation: "face" });
  });

  it("현대 연애 칩은 짝 흉상·전신이 따라오고, 없는 표정은 기본 그림에 머문다", () => {
    const bust = "shared-modern-uni-girl-navy-expressions-bust-base";
    expect(dialogueFaceForEmotion(bust, "happy", undefined)).toBe("shared-modern-uni-girl-navy-expressions-bust-happy");
    // 분노는 이 세트에 그려져 있지 않다 → 깨진 이미지 대신 기본 그림.
    expect(dialogueFaceForEmotion(bust, "angry", undefined)).toBe(bust);
    expect(sharedPortraitExpressionSiblings(bust)).toHaveLength(4);
    const project = { database: { characterAppearances: [{ id: "m", name: "", description: "", charset: { resourceId: "oprn-charset-modern1", characterIndex: 4 } }] } } as unknown as Project;
    expect(resolveAppearancePortrait(project, "m", "full")).toMatchObject({ resourceId: "shared-modern-uni-girl-navy-expressions-full-base", presentation: "full" });
    expect(resolveAppearancePortrait(project, "m", "bust")).toMatchObject({ resourceId: bust, presentation: "bust" });
    expect(resolveAppearancePortrait(project, "m", "face")).toMatchObject({ resourceId: bust, presentation: "bust" });
    // 현대 칩 24종은 모두 짝이 있다(Modern1 #1 회색 블레이저도 2026-10-17 부터).
    const second = { database: { characterAppearances: [{ id: "u", name: "", description: "", charset: { resourceId: "oprn-charset-modern1", characterIndex: 1 } }] } } as unknown as Project;
    expect(resolveAppearancePortrait(second, "u", "full")).toMatchObject({ resourceId: "shared-modern-uni-boy-grey-expressions-full-base", presentation: "full" });
    expect(MODERN_PORTRAIT_SETS).toHaveLength(24);
  });

  it("현대 연애 초상은 한 그림체(고해상도 일러스트)로 잠겨 있다 - 거친 도트 인물이 섞이지 않는다", () => {
    // #2870 이 세 세트만 768×1130 일러스트로 바꿔 매끈한 인물 옆에 120×288 도트 확대 인물이 섰다. 24세트 모두 같은 규격이다.
    const modern = SHARED_PORTRAIT_ASSETS.filter((asset) => MODERN_PORTRAIT_SETS.some((set) => asset.path.includes(`/${set.stem}/`)));
    const offStyle = modern.flatMap((asset) => {
      const png = readFileSync(path.join("public", asset.path));
      const size = `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
      const expected = asset.mode === "full" ? "768x1130" : "512x512";
      return size === expected && png[25] === 6 && asset.rendering === "smooth" ? [] : [`${asset.path} ${size} type${png[25]} ${asset.rendering}`];
    });
    expect(offStyle).toEqual([]);
    expect(modern.length).toBeGreaterThan(0);
  });
});
