import { describe, expect, it } from "vitest";
import { refusalLoopRefusal, refusalSignature, repeatedRefusalHint, requiredCallIn } from "../src/ai/piAgent/argRepair";

const gate = '타일셋 참고문서 선행 읽기 필요 (3건). 한 번에 읽기: read_tileset_reference({tilesetId:"gothic_manor", categoryId:"gm-kits-rooms"}) — documentId·imageId 를 빼면 …\n두 번째 줄';

describe("identical refusal loop breaker (J74)", () => {
  it("signs a refusal by its first line", () => {
    expect(refusalSignature(gate)).not.toContain("두 번째 줄");
  });
  it("names the exact prerequisite call on the 2nd refusal", () => {
    expect(requiredCallIn(gate)).toBe('read_tileset_reference({tilesetId:"gothic_manor", categoryId:"gm-kits-rooms"})');
    expect(repeatedRefusalHint("stamp_object", gate, 2)).toContain("먼저 정확히 이 호출을 한다");
  });
  it("tells the model to change approach on the 3rd", () => {
    expect(refusalLoopRefusal("stamp_object", refusalSignature(gate), 3, gate)).toContain("방법을 바꾼다");
  });
});
