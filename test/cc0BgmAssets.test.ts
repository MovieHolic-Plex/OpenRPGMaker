// CC0 BGM 자산 가드 — 등록만 하고 파일이 없으면 게임은 조용히 무음이 된다(재생 실패는 콘솔 경고뿐).
// 그래서 "등록 ↔ 실제 파일" 을 테스트로 묶는다.
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  CC0_AUDIO_ASSETS,
  CC0_MUSIC_ASSETS,
  isBrowserPlayableAudioPath,
  resolveCc0AudioAssetUrl,
} from "@/assets/cc0AudioAssets";

// mapBgm 배선이 가리키는 장면별 곡 — 하나라도 사라지면 그 장면이 무음이 된다.
const SCENE_BGM_IDS = [
  "cc0-bgm-field",
  "cc0-bgm-town",
  "cc0-bgm-inn",
  "cc0-bgm-dungeon",
  "cc0-bgm-battle",
] as const;

describe("CC0 오디오 자산", () => {
  it("등록된 모든 파일이 public/ 아래에 실제로 존재한다", () => {
    const missing = CC0_AUDIO_ASSETS.filter((asset) => !existsSync(resolve("public", asset.path)));
    expect(missing.map((a) => a.path)).toEqual([]);
  });

  it("모든 경로가 브라우저에서 재생 가능한 컨테이너다", () => {
    const bad = CC0_AUDIO_ASSETS.filter((asset) => !isBrowserPlayableAudioPath(asset.path));
    expect(bad.map((a) => a.path)).toEqual([]);
  });

  it("장면별 BGM 5종이 모두 등록돼 있고 URL 로 해석된다", () => {
    for (const id of SCENE_BGM_IDS) {
      expect(resolveCc0AudioAssetUrl(id), `${id} 미등록`).toMatch(/^\/assets\/cc0\/audio\//);
    }
  });

  it("장면별 BGM 은 music kind 여야 한다 — sound 면 resolveAudioSource 가 BGM 채널로 안 보낸다", () => {
    const musicIds = new Set(CC0_MUSIC_ASSETS.map((asset) => asset.id));
    expect(SCENE_BGM_IDS.filter((id) => !musicIds.has(id))).toEqual([]);
  });

  it("모든 자산이 CC0 이며 출처가 비어 있지 않다", () => {
    for (const asset of CC0_AUDIO_ASSETS) {
      expect(asset.license).toBe("CC0-1.0");
      expect(asset.sourceName.trim().length).toBeGreaterThan(0);
    }
  });

  it("id 가 중복되지 않는다", () => {
    const ids = CC0_AUDIO_ASSETS.map((asset) => asset.id);
    expect(ids.length).toBe(new Set(ids).size);
  });
});
