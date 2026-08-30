import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { villageArchetypeShotUrl } from "@/editor/panels/villageHousePreview";
import { VILLAGE_ARCHETYPES } from "@/editor/tools/village/authoringData";

// 드리프트 게이트.
//
// 원형 전경은 브라우저에서 굽지 않는다 — 도로 탐색까지 도는 무거운 시공이라
// `scripts/bake-village-archetype-previews.mts` 가 미리 PNG 로 만든다. 그래서 원형을
// 하나 더하고 굽는 것을 잊으면 화면에서는 카드 하나가 조용히 글자만 남는다.
// 여기서 빨갛게 잡아 "굽기를 잊었다" 를 코드 리뷰가 아니라 테스트가 말하게 한다.

const PUBLIC_DIR = path.resolve("public");

function shotPath(archetypeId: string): string {
  return path.join(PUBLIC_DIR, villageArchetypeShotUrl(archetypeId));
}

describe("마을 원형 전경 PNG", () => {
  it("원형 전 갈래에 구운 그림이 있다", () => {
    const missing = VILLAGE_ARCHETYPES.filter((archetype) => !fs.existsSync(shotPath(archetype.id))).map(
      (archetype) => archetype.id,
    );
    expect(
      missing,
      `원형 전경 PNG 가 없습니다. npx vite-node scripts/bake-village-archetype-previews.mts 로 구우세요: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("빈 파일이나 자리끼우기가 아니다", () => {
    for (const archetype of VILLAGE_ARCHETYPES) {
      const file = shotPath(archetype.id);
      if (!fs.existsSync(file)) continue;
      const bytes = fs.readFileSync(file);
      // PNG 시그니처 — 이름만 맞춘 빈 파일이나 잘린 내려받기를 걸러낸다.
      expect(bytes.subarray(0, 8).toString("hex"), archetype.id).toBe("89504e470d0a1a0a");
      expect(bytes.length, archetype.id).toBeGreaterThan(2048);
    }
  });

  it("굽지 않은 남는 그림이 없다", () => {
    // 원형을 지웠는데 PNG 가 남으면 다음 사람이 "이건 뭐지" 로 시간을 쓴다.
    const dir = path.join(PUBLIC_DIR, "assets/village-preview");
    if (!fs.existsSync(dir)) return;
    const known = new Set(VILLAGE_ARCHETYPES.map((archetype) => `${archetype.id}.png`));
    const stray = fs.readdirSync(dir).filter((name) => name.endsWith(".png") && !known.has(name));
    expect(stray).toEqual([]);
  });
});
