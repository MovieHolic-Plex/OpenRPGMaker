import { describe, expect, it } from "vitest";
import { contentHash, mergeClearRecords, planSlot, savedAtMs } from "@/player/storeCloudSync";
import { cloudParentOrigin, parseCloudSlot, type CloudSlot } from "@/player/storeCloudBridge";
import type { StoreGameBoot } from "@/player/storeGameHost";

const save = (at: string, extra = ""): string => JSON.stringify({ savedAt: at, session: { note: extra } });
const cloud = (data: string, revision: number): CloudSlot => ({ slot: "1", revision, data, savedAt: null, updatedAt: "", gameVersion: null });

describe("store cloud save planning", () => {
  const older = save("2026-10-24T01:00:00Z", "a");
  const newer = save("2026-10-24T02:00:00Z", "b");

  it("pulls cloud into an empty slot and offers (not forces) uploading local-only saves", () => {
    expect(planSlot("1", null, cloud(older, 1), undefined)).toEqual({ kind: "take-cloud", keepLocalAsOther: false });
    expect(planSlot("1", older, null, undefined)).toEqual({ kind: "offer-upload", base: 0, keepCloudAsOther: false });
    expect(planSlot("1", null, null, undefined)).toEqual({ kind: "none" });
  });

  it("follows whichever side changed since the last sync", () => {
    expect(planSlot("1", newer, cloud(older, 3), { rev: 3, hash: contentHash(older) })).toEqual({ kind: "push", base: 3, keepCloudAsOther: false });
    expect(planSlot("1", older, cloud(newer, 4), { rev: 3, hash: contentHash(older) })).toEqual({ kind: "take-cloud", keepLocalAsOther: false });
    expect(planSlot("1", older, cloud(older, 4), undefined)).toEqual({ kind: "mark", rev: 4 });
  });

  it("keeps both when both changed: newest takes the slot, the other is kept", () => {
    const local = save("2026-10-24T03:00:00Z", "local");
    expect(planSlot("1", local, cloud(newer, 4), { rev: 3, hash: contentHash(older) })).toEqual({ kind: "push", base: 4, keepCloudAsOther: true });
    expect(planSlot("1", older, cloud(newer, 4), { rev: 3, hash: contentHash(save("2026-10-24T00:00:00Z")) })).toEqual({ kind: "take-cloud", keepLocalAsOther: true });
    // 이 계정과 처음인데 로컬이 더 늦다 → 묻는다(공용 PC 의 남 세이브를 몰래 올리지 않는다).
    expect(planSlot("1", local, cloud(newer, 4), undefined)).toEqual({ kind: "offer-upload", base: 4, keepCloudAsOther: true });
  });

  it("merges clear records instead of choosing one", () => {
    const merged = JSON.parse(mergeClearRecords(
      JSON.stringify({ endingIds: ["a"], clearCount: 1, clearedAt: "2026-10-24T01:00:00Z", carry: {} }),
      JSON.stringify({ endingIds: ["b"], clearCount: 2, clearedAt: "2026-10-24T02:00:00Z", carry: {} }),
    )) as { endingIds: string[]; clearCount: number };
    expect(merged.endingIds.sort()).toEqual(["a", "b"]);
    expect(merged.clearCount).toBe(2);
    expect(savedAtMs(JSON.stringify({ clearedAt: "2026-10-24T02:00:00Z" }))).toBe(Date.parse("2026-10-24T02:00:00Z"));
  });

  it("rejects malformed cloud slots", () => {
    expect(parseCloudSlot({ slot: "9", revision: 1, data: "{}" })).toBeNull();
    expect(parseCloudSlot({ slot: "1", revision: 0, data: "{}" })).toBeNull();
    expect(parseCloudSlot({ slot: "auto", revision: 2, data: "{}" })?.slot).toBe("auto");
  });
});

describe("store cloud bridge parent origin", () => {
  const boot: StoreGameBoot = { slug: "first-love", version: "1.5", title: "t", savePrefix: "oprn-export:store:first-love@", embedders: ["https://play.openrpgmaker.com"] };
  const fakeWindow = (ancestor: string | null, framed = true): Window => {
    const self = {} as Window;
    return {
      self, parent: framed ? ({} as Window) : self,
      location: { origin: "https://games-kr.openrpgmaker.com", ancestorOrigins: ancestor ? { length: 1, item: () => ancestor } : { length: 0, item: () => null } },
      document: { referrer: "" },
    } as unknown as Window;
  };
  it("opens only under the allowed store parent", () => {
    expect(cloudParentOrigin(boot, fakeWindow("https://play.openrpgmaker.com"))).toBe("https://play.openrpgmaker.com");
    expect(cloudParentOrigin(boot, fakeWindow("https://evil.example"))).toBeNull();
    expect(cloudParentOrigin(boot, fakeWindow(null))).toBeNull();
  });
});
