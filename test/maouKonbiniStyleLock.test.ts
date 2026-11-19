import { expect, it } from "vitest";
import { CAST, say } from "@/project/flagship/maouKonbiniKit";
import { createBlankProject } from "@/project/defaults/blankProject";
import { FLAGSHIP_BEAT_MANIFESTS, FLAGSHIP_DEMO_IDS, validateFlagshipStyleLock } from "@/project/flagship";

it("마왕 편의점만 오프닝 네 컷을 허용한다", () => {
  const project = createBlankProject();
  const scenes = Array.from({ length: 4 }, (_, i) => ({
    id: String(i), kind: "text" as const, narration: "", durationMs: 1000,
  }));
  project.system.opening = { enabled: true, skippable: false, scenes };

  for (const id of FLAGSHIP_DEMO_IDS) {
    const { violations } = validateFlagshipStyleLock(id, project);
    expect(violations.includes("오프닝 샷 수 부족: 4 < 5")).toBe(id !== "maou-konbini");
  }
  expect(FLAGSHIP_BEAT_MANIFESTS["maou-konbini"].beats[0].playerFeel).toContain("네 컷");
  scenes.pop();
  expect(validateFlagshipStyleLock("maou-konbini", project).violations).toContain("오프닝 샷 수 부족: 3 < 4");
});

it("면접의 히나와 채용 전후 주인공이 지정된 기존 에셋을 쓴다", () => {
  const manifest = FLAGSHIP_BEAT_MANIFESTS["maou-konbini"];
  const hinaPortrait = "shared-modern-casual-girl-pink-expressions-bust-base";

  expect(CAST.hina).toMatchObject({ resource: "oprn-charset-modern2", index: 5 });
  expect(say("hina", "base", "안녕.")[0]).toMatchObject({ resourceId: hinaPortrait, presentation: "bust" });
  expect(manifest.cast.find((member) => member.id === "npc_mk_hina")?.assetId).toBe(hinaPortrait);
  expect(CAST.zervas).toMatchObject({ resource: "oprn-charset-modern2", index: 3, stem: "casual-boy-olive" });
  expect(CAST.maou).toMatchObject({ resource: "oprn-charset-scarloxy-people5", index: 0 });
  expect(manifest.styleLock.allowedCharsetPrefixes).toContain(CAST.maou.resource);
});
