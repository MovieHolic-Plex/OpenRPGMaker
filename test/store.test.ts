import { afterEach, describe, expect, it, vi } from "vitest";
import type { Project, ResourceProfile } from "@/project/types";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installElectronBridgeSession } from "./support/electronBridgeSession";
import { resourceProfileThirdPartyWord, splitStoreGameThirdPartyProfiles } from "@/assetStore/storeGameThirdParty";
import { isolateTimers } from "./mergedTeardown";

describe("storeFlushSerializationBridge", () => {
  isolateTimers();
  let disposeBridgeSession: (() => void) | null = null;
  afterEach(() => {
    disposeBridgeSession?.();
    disposeBridgeSession = null;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  describe("store flush 직렬화 (Electron 브리지)", () => {
    it("앞 저장이 in-flight 인 동안 뒤 저장은 저장을 시작하지 않는다", async () => {
      const session = await installElectronBridgeSession({ project: createBlankProject() });
      disposeBridgeSession = session.dispose;
      const gate = session.holdNextSave();

      store.replaceProject(createBlankProject());
      store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
      store._setPersistedBaselineForTest(null);
      store._setCleanPersistStateForTest();
      store.update((draft: Project) => {
        draft.meta.title = "A";
      });

      const first = store.flush();
      await gate.entered();
      expect(session.calls.save).toBe(1);

      store.update((draft: Project) => {
        draft.meta.title = "B";
      });
      const second = store.flush();
      await Promise.resolve();
      expect(session.calls.save).toBe(1);

      gate.release();
      await Promise.all([first, second]);
      // 두 번째 flush 는 새 저장을 시작하는 대신 앞 저장에 합쳐진다 — 그래도 최신 내용은 남아야 한다.
      const stored = session.storedSerialized();
      expect(stored).not.toBeNull();
      expect(JSON.parse(String(stored)).meta.title).toBe("B");
      expect(session.calls.save).toBeGreaterThanOrEqual(1);
    });

    it("배경 커밋 기록이 in-flight 인 동안 두 번째 flush 도 커밋을 중복으로 내지 않는다", async () => {
      const session = await installElectronBridgeSession({ project: createBlankProject() });
      disposeBridgeSession = session.dispose;

      store.replaceProject(createBlankProject());
      store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
      store._setPersistedBaselineForTest(null);
      store._setCleanPersistStateForTest();
      store.update((draft: Project) => {
        draft.meta.title = "C";
      });

      const gate = session.holdNextCommit();
      const first = store.flush();
      await gate.entered();
      expect(session.calls.commit).toBe(1);

      const second = store.flush();
      await Promise.resolve();
      expect(session.calls.commit).toBe(1);

      gate.release();
      await Promise.all([first, second]);
      expect(session.calls.commit).toBeGreaterThanOrEqual(1);
    });
  });
});

describe("storeGameThirdParty", () => {
  isolateTimers();
  const charset = (assetId: string, name: string): ResourceProfile => ({ kind: "charset", name, assetId, tileWidth: 24, tileHeight: 32 });
  const project = (profiles: ResourceProfile[], spriteIds: string[]): Project => ({
    resourceProfiles: profiles,
    maps: { m: { events: spriteIds.map((id, i) => ({ id: `ev${i}`, pages: [{ graphic: { sprite: { type: "bundled", id } } }] })) } },
  } as unknown as Project);
  // e9dc7f22ef: 고친 REFMAP 칩(RefmapDoll, src/assets/refmapDollCharsets.ts)만 「refmap」 낱말을 풀어 준다. 원본 REFMAP 이름은 그대로 막는다.
  const MODIFIED = () => charset("tex_oprn_charset_refmap_doll1", "RefmapDoll1 · REFMAP 변형 인물");
  const ORIGINAL = () => charset("upload_refmap_actor1", "REFMAP Actor1");
  describe("스토어 판본의 제3자 이름 자원", () => {
    it("원본 REFMAP 이름 걷기 칩은 막는 낱말을 돌려준다", () => {
      expect(resourceProfileThirdPartyWord(ORIGINAL())).toBe("refmap");
    });
    it("고친 REFMAP 칩(RefmapDoll)은 refmap 낱말을 막지 않는다", () => {
      expect(resourceProfileThirdPartyWord(MODIFIED())).toBeNull();
    });
    it("공개 라이선스 카탈로그(cc0-·easyrpg-)는 「rtp」가 들어 있어도 막지 않는다", () => {
      expect(resourceProfileThirdPartyWord(charset("cc0-bgm-rtp-btl-001", "rtp btl 001"))).toBeNull();
      expect(resourceProfileThirdPartyWord(charset("easyrpg-charset-rtp-actor1", "EasyRPG RTP Actor1"))).toBeNull();
    });
    it("게임이 쓰지 않는 제3자 이름 자원(원본 REFMAP·고친 REFMAP)은 빼고, 나머지는 그대로 둔다", () => {
      const own = charset("tex_oprn_charset_modern3", "Modern3");
      const split = splitStoreGameThirdPartyProfiles(project([own, ORIGINAL(), MODIFIED()], ["tex_oprn_charset_modern3"]));
      expect(split.kept).toEqual([own]);
      expect(split.dropped).toEqual([ORIGINAL(), MODIFIED()]);
      expect(split.referenced).toEqual([]);
      expect(split.usesModifiedRefmap).toBe(false);
    });
    it("게임이 쓰는 원본 제3자 이름 자원은 referenced 로 알린다", () => {
      const split = splitStoreGameThirdPartyProfiles(project([ORIGINAL()], ["upload_refmap_actor1"]));
      expect(split.dropped).toEqual([]);
      expect(split.referenced.map((r) => r.word)).toEqual(["refmap"]);
    });
    it("게임이 쓰는 고친 REFMAP 칩은 막지 않고 싣되 크레딧 표시(usesModifiedRefmap)를 켠다", () => {
      const split = splitStoreGameThirdPartyProfiles(project([MODIFIED()], ["tex_oprn_charset_refmap_doll1"]));
      expect(split.kept).toEqual([MODIFIED()]);
      expect(split.referenced).toEqual([]);
      expect(split.usesModifiedRefmap).toBe(true);
    });
  });
});
