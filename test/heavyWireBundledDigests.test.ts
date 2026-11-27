// 조수 무거운 키 해시가 번들 타일셋의 구운 요약을 심어도(heavyWire.computeHeavyHash) 결과는 타일셋 글의 sha256 그대로인지 본다.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { planHeavyWire } from "@/ai/piAgent/heavyWire";
import { createStarterBlankProject } from "@/project/defaults";

describe("heavyWire 번들 타일셋 구운 요약", () => {
  it("빈 새 프로젝트 타일셋 해시는 글의 sha256 이고, 같은 내용의 새 사전도 같은 해시다", async () => {
    const project = createStarterBlankProject();
    const expected = createHash("sha256").update(JSON.stringify(project.tilesets)).digest("hex");
    const first = await planHeavyWire({ project });
    expect(first?.body.heavy?.tilesets).toBe(expected);
    const again = await planHeavyWire({ project: { ...project, tilesets: { ...project.tilesets } } });
    expect(again?.body.heavy?.tilesets).toBe(expected);
  });
});
