// 스토어 전투 애니메이션 증거용 픽스처: 2개짜리 시험 팩을 만들고 → validateManifest → 실제 applyPackToProject 로 넣고 → 마도사 기술에 단다.
// 실행: node_modules/.bin/vite-node scripts/qa/runtime/store-battle-anim-fixture.mts -- <burst.png> <smoke.png> <out project.json>
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRetro2003Fixture } from "./retro2003-fixture.mjs";
import { storeBattleAnimationSizeProblems, validateManifest, type StorePackManifest } from "@/assetStore/format";
import { applyPackToProject, storeAnimationId } from "@/assetStore/pack";
import { pngSize } from "@/assetStore/sniff";

const [burstPath, smokePath, outPath] = process.argv.slice(2).filter((arg) => arg !== "--");
const burst = new Uint8Array(readFileSync(burstPath!));
const smoke = new Uint8Array(readFileSync(smokePath!));
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const cell = (pattern: number, zoom = 100, opacity = 255) => ({ pattern, x: 0, y: 0, zoom, opacity, visible: true });
const gen = { method: "procedural" as const, engine: "PIL proof script" };

const manifest: StorePackManifest = {
  schema: "oprn-store-pack/1", title: "Proof fire burst", summary: "2 test battle animations", description: "", tags: ["test"],
  kind: "animation", license: "CC0", aiGenerated: false, credits: "",
  content: {
    assets: {
      "burst-sheet": { id: "burst-sheet", name: "Burst sheet", kind: "battle", blob: sha(burst), mime: "image/png", meta: { width: 288, height: 48 }, generation: gen },
      "smoke-sheet": { id: "smoke-sheet", name: "Smoke sheet", kind: "battle", blob: sha(smoke), mime: "image/png", meta: { width: 192, height: 48 }, generation: gen },
    },
    tilesets: {},
    battleAnimations: [
      {
        id: "burst", name: "Proof burst", resourceId: "burst-sheet", sheet: { frameWidth: 48, frameHeight: 48, columns: 6, assetScale: 3 },
        scope: "singleTarget", position: "center", blendMode: "add",
        // 3번 프레임(가장 큰 불덩이)을 hold 4 로 오래 보여 준다.
        frames: [{ cells: [cell(0)] }, { cells: [cell(1)] }, { cells: [cell(2)] }, { cells: [cell(3, 110)], hold: 4 }, { cells: [cell(4)] }, { cells: [cell(5, 100, 180)] }],
        timings: [{ frameIndex: 3, soundResourceId: "cc0-se-osx-gong-01", flash: { target: "target", color: { red: 255, green: 180, blue: 80, gray: 0 }, durationFrames: 3 }, screenShake: { power: 4, speed: 6, durationFrames: 4 } }],
        followUps: [{ animationId: "smoke", startFrame: 4 }],
      },
      {
        id: "smoke", name: "Proof smoke", resourceId: "smoke-sheet", sheet: { frameWidth: 48, frameHeight: 48, columns: 4, assetScale: 3 },
        frames: [{ cells: [cell(0)] }, { cells: [cell(1)], hold: 2 }, { cells: [cell(2)], hold: 2 }, { cells: [cell(3)] }],
      },
    ],
  },
  previews: [sha(burst)],
  blobs: [burst, smoke].map((bytes) => ({ sha256: sha(bytes), mime: "image/png" as const, bytes: bytes.byteLength })),
};

const checked = validateManifest(manifest);
if (!checked.ok) throw new Error(`manifest invalid: ${checked.errors.join(" | ")}`);
const blobs = new Map([[sha(burst), burst], [sha(smoke), smoke]]);
const sizes = storeBattleAnimationSizeProblems(manifest, (key) => pngSize(blobs.get(key)!));
if (sizes.length) throw new Error(sizes.join(" | "));

const fixture = createRetro2003Fixture();
const project = fixture.project;
const result = applyPackToProject(project, manifest, {
  slug: "proof-fire-burst", version: 1, author: "OPRN QA", storeUrl: "https://store.openrpgmaker.com", itemUrl: "https://store.openrpgmaker.com/items/proof-fire-burst",
  blob: (key) => blobs.get(key)!,
});
const burstId = storeAnimationId("proof-fire-burst", "burst");
// 마도사의 비전 화살(첫 기술)에 단다. 녹화에서 마법 명령을 고르면 이 애니메이션이 나와야 한다.
const skill = project.database.skills.find((entry) => entry.id === "skill_arcane_bolt")!;
skill.animationId = burstId;
writeFileSync(outPath!, JSON.stringify(project));
console.log(JSON.stringify({ added: result.addedAnimationIds, skill: skill.id, animationId: skill.animationId, sheet: project.database.battleAnimations.find((r) => r.id === burstId)?.resourceId }));
fixture.cleanup();
