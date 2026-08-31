import { FARMING_LIFE_UI_ASSETS } from "@/assets/farmingLifeUi";
import { createBlankProject } from "@/project/defaults";
import { prepareWebExport } from "@/project/webExport";
import { exactWebExportEntries } from "@/project/webExportZip";
import type { VerifiedPlayerDeployment } from "@/project/playerDeploymentManifest";
import { describe, expect, it } from "vitest";

const encoder = new TextEncoder();
const PRUNED_CARD = FARMING_LIFE_UI_ASSETS.animals.replace(/^\//, "");

function bundleFile(zipPath: string) {
  return { sourcePath: zipPath, zipPath, bytes: encoder.encode(`bytes:${zipPath}`) };
}

/** SDK 가 내주는 배포물 — 런타임 에셋을 그대로 담고 있는 상태를 재현한다. */
function deploymentOffering(runtimeAssetPaths: readonly string[]): VerifiedPlayerDeployment {
  return {
    bundleFiles: [bundleFile("index.html"), bundleFile("assets/player.js")],
    runtimeAssets: runtimeAssetPaths.map(bundleFile),
  };
}

describe("web export zip pruning", () => {
  it("배포물이 내줬어도 이 프로젝트가 안 쓰는 기능의 아트는 뺀다", async () => {
    // Given
    const project = createBlankProject();
    const prepared = prepareWebExport(project);
    const planned = new Set(prepared.assets.map((asset) => asset.zipPath));
    const offeredButUnplanned = PRUNED_CARD;
    const offeredAndPlanned = "assets/easyrpg-chipset-exterior.png";

    // When
    const entries = await exactWebExportEntries(
      prepared,
      deploymentOffering([offeredButUnplanned, offeredAndPlanned]),
      async (path) => encoder.encode(`fetched:${path}`),
    );
    const names = new Set(entries.map((entry) => entry.name));

    // Then
    expect(planned.has(offeredAndPlanned)).toBe(true);
    expect(planned.has(offeredButUnplanned)).toBe(false);
    expect(names.has(offeredAndPlanned)).toBe(true);
    expect(names.has(offeredButUnplanned)).toBe(false);
  });

  it("조건부 그룹 전체를 빼되 나머지는 남긴다", async () => {
    // Given
    const project = createBlankProject();
    const prepared = prepareWebExport(project);
    const cards = Object.values(FARMING_LIFE_UI_ASSETS).map((path) => path.replace(/^\//, ""));
    const keeper = "assets/easyrpg-chipset-exterior.png";

    // When
    const entries = await exactWebExportEntries(
      prepared,
      deploymentOffering([...cards, keeper]),
      async (path) => encoder.encode(`fetched:${path}`),
    );
    const names = new Set(entries.map((entry) => entry.name));

    // Then
    for (const card of cards) expect(names.has(card)).toBe(false);
    expect(names.has(keeper)).toBe(true);
  });

  // 프루닝 판단은 조건부 그룹 한 곳에만 있어야 한다. 매니페스트에 있는데 그 목록에 없는 에셋을
  // "프로젝트가 계획하지 않았다"는 이유로 빼면, 앱이 모르는 새 런타임 에셋을 SDK 가 들고 온
  // 순간 배포물에서 조용히 사라진다 — 부팅이 깨지는 쪽으로 기본값이 기울면 안 된다.
  it("앱이 모르는 런타임 에셋은 계획에 없어도 그대로 싣는다", async () => {
    // Given
    const project = createBlankProject();
    const prepared = prepareWebExport(project);
    const unknown = "assets/runtime-from-a-newer-sdk.png";
    const planned = new Set(prepared.assets.map((asset) => asset.zipPath));

    // When
    const entries = await exactWebExportEntries(
      prepared,
      deploymentOffering([unknown]),
      async (path) => encoder.encode(`fetched:${path}`),
    );
    const names = new Set(entries.map((entry) => entry.name));

    // Then
    expect(planned.has(unknown)).toBe(false);
    expect(names.has(unknown)).toBe(true);
  });

  it("계획했는데 배포물에 없는 에셋은 여전히 받아온다", async () => {
    // Given
    const project = createBlankProject();
    const prepared = prepareWebExport(project);
    const target = prepared.assets.find(
      (asset): asset is Extract<typeof asset, { kind: "public" }> => asset.kind === "public",
    );
    const fetched: string[] = [];

    // When
    const entries = await exactWebExportEntries(
      prepared,
      deploymentOffering([]),
      async (path) => {
        fetched.push(path);
        return encoder.encode(`fetched:${path}`);
      },
    );
    const names = new Set(entries.map((entry) => entry.name));

    // Then
    expect(target).toBeDefined();
    expect(names.has(target!.zipPath)).toBe(true);
    expect(fetched).toContain(`/${target!.sourcePath}`);
  });
});
