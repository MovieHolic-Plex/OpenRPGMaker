import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { createBlankProject } from "@/project/defaults";
import { PLAYER_RUNTIME_AUDIO_RESOURCE_IDS } from "@/player/playerRuntimeAudioIds";
import { collectWebExportAssets } from "@/project/webExportAssets";
import { describe, expect, it } from "vitest";

const AUDIO_ID_PATTERN = /"(easyrpg-sound|easyrpg-music|cc0-bgm)-[a-z0-9-]+"/g;
const PLAYER_DIR = "src/player";
// 목록 파일 자신과 카탈로그 정의는 「재생」 이 아니라 「선언」 이다.
const NOT_PLAYBACK = new Set(["playerRuntimeAudioIds.ts"]);

function playerSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) { out.push(...playerSourceFiles(path)); continue; }
    if (!entry.name.endsWith(".ts") || NOT_PLAYBACK.has(entry.name)) continue;
    out.push(path);
  }
  return out;
}

function hardcodedIdsInPlayerSource(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of playerSourceFiles(PLAYER_DIR)) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(AUDIO_ID_PATTERN)) {
      const id = match[0].slice(1, -1);
      found.set(id, [...(found.get(id) ?? []), file]);
    }
  }
  return found;
}

describe("player runtime audio ids", () => {
  // 이 테스트가 드리프트 방지 장치다. src/player 어딘가에 오디오 id 를 새로 박으면 여기서
  // 먼저 걸린다 — 그러지 않으면 내보낸 게임에서만 404 로 드러난다(실제로 그렇게 났다).
  it("소스에 박힌 오디오 id 를 하나도 빠뜨리지 않는다", () => {
    // Given
    const listed = new Set(PLAYER_RUNTIME_AUDIO_RESOURCE_IDS);

    // When
    const found = hardcodedIdsInPlayerSource();

    // Then
    expect(found.size).toBeGreaterThan(0);
    const missing = [...found.entries()]
      .filter(([id]) => !listed.has(id))
      .map(([id, files]) => `${id} (${files.join(", ")})`);
    expect(missing).toEqual([]);
  });

  it("목록에 죽은 id 를 남겨두지 않는다", () => {
    // Given
    const found = hardcodedIdsInPlayerSource();

    // When
    const stale = PLAYER_RUNTIME_AUDIO_RESOURCE_IDS.filter((id) => !found.has(id));

    // Then
    expect(stale).toEqual([]);
  });

  it("목록의 모든 id 가 내보내기 산출물에 실린다", () => {
    // Given
    const project = createBlankProject();

    // When
    const shipped = new Set(collectWebExportAssets(project).map((asset) => asset.zipPath));

    // Then
    const missing = PLAYER_RUNTIME_AUDIO_RESOURCE_IDS
      .map((id) => ({ id, url: resolveAssetResourceUrl(id, { project }) }))
      .filter(({ url }) => url?.startsWith("/") === true)
      .filter(({ url }) => !shipped.has(url!.slice(1)))
      .map(({ id, url }) => `${id} -> ${url}`);
    expect(missing).toEqual([]);
  });
});
