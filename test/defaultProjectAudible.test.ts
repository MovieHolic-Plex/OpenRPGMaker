// "게임을 켜면 소리가 난다" 를 지키는 가드.
//
// 실측 배경(2026-07-26): 등록된 음악 리소스 30곡이 전부 .mid 였고 기본 전투 BGM 도 그중 하나였다.
// 브라우저 HTMLAudioElement 는 MIDI 를 재생하지 못하므로 게임은 완전 무음으로 돌아갔다.
// 이 테스트는 기본값이 다시 재생 불가 리소스로 돌아가는 것을 막는다.
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defaultSystem } from "@/project/defaults/defaultDatabase";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { CC0_AUDIO_ASSETS, isBrowserPlayableAudioPath } from "@/assets/cc0AudioAssets";
import { EASYRPG_RTP_ASSETS } from "@/assets/easyrpgRtp";

/** resourceId → 번들 자산 경로. 두 레지스트리만 보면 되므로 리졸버를 통째로 끌어오지 않는다. */
function bundledPathFor(resourceId: string): string | null {
  const cc0 = CC0_AUDIO_ASSETS.find((asset) => asset.id === resourceId);
  if (cc0) return cc0.path;
  const rtp = EASYRPG_RTP_ASSETS.find((asset) => asset.id === resourceId);
  return rtp ? rtp.path : null;
}

describe("기본 프로젝트 오디오", () => {
  const system = defaultSystem();

  it("전투 BGM 과 기본 BGM 이 모두 지정돼 있다", () => {
    expect(system.battleBgmResourceId?.trim()).toBeTruthy();
    expect(system.defaultBgmResourceId?.trim()).toBeTruthy();
  });

  for (const field of ["battleBgmResourceId", "defaultBgmResourceId"] as const) {
    it(`${field} 은 브라우저에서 재생 가능한 포맷이다(MIDI 금지)`, () => {
      const id = system[field];
      const path = id ? bundledPathFor(id) : null;
      expect(path, `${id} 를 번들 자산에서 찾지 못했다`).not.toBeNull();
      expect(isBrowserPlayableAudioPath(path!), `${path} 는 브라우저 재생 불가(MIDI 등)`).toBe(true);
    });

    it(`${field} 의 파일이 실제로 존재한다`, () => {
      const path = bundledPathFor(system[field]!)!;
      expect(existsSync(resolve("public", path)), `${path} 없음`).toBe(true);
    });
  }

  it("defaultBgmResourceId 가 정규화 왕복에서 살아남는다", () => {
    // normalizeSystemRecords 는 화이트리스트 방식이라 필드를 빠뜨리면 저장/로드 1회에 조용히 사라진다.
    // 실제로 이 함정에 걸렸다 — 값이 사라져 게임이 계속 무음이었다(2026-07-26).
    const round = normalizeSystemRecords(defaultSystem());
    expect(round.defaultBgmResourceId).toBe(system.defaultBgmResourceId);
    expect(normalizeSystemRecords(round).defaultBgmResourceId).toBe(system.defaultBgmResourceId);
  });

  it("EasyRPG RTP 음악은 전부 MIDI 이므로 BGM 기본값 후보가 아니다", () => {
    // 이 사실이 바뀌면(누군가 ogg 를 넣었다면) 위 규칙을 다시 판단해야 하므로 명시적으로 못박는다.
    const playable = EASYRPG_RTP_ASSETS.filter(
      (asset) => asset.category === "music" && isBrowserPlayableAudioPath(asset.path),
    );
    expect(playable.map((a) => a.path)).toEqual([]);
  });
});
