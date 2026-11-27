// 번들 타일셋 정의의 내용 요약을 빌드 때 구워 두고, 프로젝트 항목이 그 정의와 JSON 값이 같으면 요약 기억에 심는다.
//
// 왜(2026-11-26 실측, #5188): 빈 새 프로젝트 77MiB 중 74MiB 가 번들 타일셋 정의 49개다. 조수 세션을 열면 적용 권위 요약
// (AuthoredProjectBaseline)이 이 항목들을 처음부터 훑어 첫 세션이 6.0s(그중 요약 5.0s) 걸렸다. 값 비교(jsonEqual)는 0.4s 다.
//
// 계약:
//  - 구운 값(bundledTilesetDigests.json)은 `jsonContentDigest(bundledTilesetById(id))` 와 같아야 한다 — test/bundledTilesetDigests.test.ts 가 지키고,
//    번들 정의가 바뀌면 `node_modules/.bin/vite-node --script scripts/content/bake-bundled-tileset-digests.mts` 로 다시 굽는다.
//  - 심는 것은 항목이 지금 번들 정의와 JSON 값이 같을 때뿐이다. 저자가 고친 항목, 구운 값이 없는 id, 칸 수가 다른 판, 정의를 아직 읽지 않은 경우는
//    심지 않고 예전처럼 계산한다. 심은 기억은 믿음(withTrustedSharedEntries) 안에서만 쓰인다(seedTrustedEntryDigest).
import BAKED from "@/assets/bundledTilesetDigests.json" with { type: "json" };
import { bundledTilesetById, bundledTilesetDefinitionReady } from "@/project/defaults/defaultAssets";
import { hasPendingDefaultTilesets, pendingDefaultTilesetBuilder } from "@/project/defaults/lazyDefaultTilesets";
import { seedTrustedEntryDigest } from "@/project/persistence/core/contentDigest";
import { jsonEqual } from "@/util/structuralJson";
import type { Project } from "@/project/types";

type Baked = { readonly digest: string; readonly count: number };
const baked = BAKED as unknown as Readonly<Record<string, Baked>>;
const checked = new WeakSet<object>();

/** 프로젝트의 번들 타일셋 항목 중 정의와 값이 같은 것에 구운 요약을 심는다. 한 항목은 한 번만 비교한다. */
export function seedBundledTilesetDigests(project: Pick<Project, "tilesets">): void {
  const tilesets = project.tilesets as Readonly<Record<string, unknown>> | undefined;
  if (!tilesets) return;
  const hasPending = hasPendingDefaultTilesets(tilesets);
  for (const id of Object.keys(tilesets)) {
    if (hasPending && pendingDefaultTilesetBuilder(tilesets, id)) continue;
    const entry = tilesets[id];
    const bake = baked[id];
    if (!bake || entry === null || typeof entry !== "object" || checked.has(entry)) continue;
    checked.add(entry);
    if ((entry as { count?: unknown }).count !== bake.count) continue;
    if (bundledTilesetDefinitionReady(id) === false) continue;
    const definition = bundledTilesetById(id);
    if (definition && jsonEqual(entry, definition)) seedTrustedEntryDigest(entry, bake.digest);
  }
}

/** 시험·굽기용: 구운 표. */
export const bakedBundledTilesetDigests = baked;
