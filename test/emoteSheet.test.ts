// 이모트 어휘(EMOTE_KINDS) ↔ 시트 페인터 ↔ 커밋된 PNG 드리프트 게이트.
// 한쪽만 늘어나거나 순서가 바뀌면 프레임 인덱스가 어긋나 엉뚱한 아이콘이 뜬다.
import { describe, expect, it } from "vitest";
import { EMOTE_FRAME_SIZE, EMOTE_KINDS, emoteFrameIndex, isEmoteKind } from "@/project/emotes";

type RenderModule = {
  readonly EMOTE_SLUGS: readonly string[];
  readonly paintedEmoteSlugs: () => readonly string[];
  readonly renderEmoteSheetPng: () => Uint8Array;
};

type FsLike = { readonly readFileSync: (path: URL | string) => Uint8Array };

const loadRenderer = async (): Promise<RenderModule> => {
  const moduleName = "../scripts/lib/emoteSheet/render.mjs";
  return (await import(moduleName)) as RenderModule;
};

const loadFs = async (): Promise<FsLike> => {
  const moduleName = "node:fs";
  return (await import(moduleName)) as FsLike;
};

const SHEET_URL = new URL("../public/assets/generated-emotes.png", import.meta.url);

describe("이모트 시트", () => {
  it("EMOTE_KINDS 와 페인터 목록이 순서까지 같다", async () => {
    const renderer = await loadRenderer();
    expect(renderer.EMOTE_SLUGS).toEqual([...EMOTE_KINDS]);
    expect([...renderer.paintedEmoteSlugs()].sort()).toEqual([...EMOTE_KINDS].sort());
  });

  it("커밋된 PNG 가 현재 페인터 출력과 바이트까지 같다", async () => {
    const [renderer, fs] = await Promise.all([loadRenderer(), loadFs()]);
    const committed = fs.readFileSync(SHEET_URL);
    expect(Buffer.from(committed).equals(Buffer.from(renderer.renderEmoteSheetPng()))).toBe(true);
  });

  it("PNG 크기가 이모트 수 × 프레임 크기다", async () => {
    const fs = await loadFs();
    const bytes = Buffer.from(fs.readFileSync(SHEET_URL));
    expect(bytes.readUInt32BE(16)).toBe(EMOTE_KINDS.length * EMOTE_FRAME_SIZE);
    expect(bytes.readUInt32BE(20)).toBe(EMOTE_FRAME_SIZE);
  });

  it("프레임 인덱스는 목록 순서이고 kind 판별이 어휘를 지킨다", () => {
    EMOTE_KINDS.forEach((kind, index) => {
      expect(emoteFrameIndex(kind)).toBe(index);
      expect(isEmoteKind(kind)).toBe(true);
    });
    expect(isEmoteKind("nope")).toBe(false);
    expect(isEmoteKind(undefined)).toBe(false);
  });
});
