// ScarloxyPeople11~13 — char-gen 갤러리 4 스크립트 합성 22종 설치(2026-10-17) 확인.
// 사용자가 이번 설치 작업에서 이 파일 한정 실행을 허용했다(전체 스위트·gates 아님).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { beforeEach, describe, expect, it } from "vitest";
import { findCharsetAsset } from "@/assets/charsetCatalog";
import { CHARSET_SEMANTICS } from "@/assets/charsetSemantics";
import { SCARLOXY_PEOPLE_CHARSET_RESOURCE_IDS, SCARLOXY_PEOPLE_CHARSET_SEMANTICS } from "@/assets/scarloxyPeopleCharsets";
import roster from "@/assets/scarloxyPeopleCharsets.json";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { charsetFamilyOf } from "@/project/charsetFamily";
import { createBlankProject } from "@/project/defaults";
import { applyGenrePreset } from "@/project/genrePresets";
import type { Project } from "@/project/types";

beforeEach(() => resetMapEditHistory());

interface Row { id: string; name: string; desc: string; role: string; sheet: number; index: number; tags: string[]; source: { slotRgbaSha256: string } }
const ROWS = (roster as { characters: Row[] }).characters;
// 시트 14(아스트라 4칸)는 #3225 에서 따로 덧붙었다 — 갤러리 4 는 시트 11~13 만이다.
const NEW = ROWS.filter((row) => row.sheet >= 11 && row.sheet <= 13);
const GALLERY = JSON.parse(readFileSync(resolve(process.cwd(), "harness-data/charset-actor/scarloxy-people/gallery4.json"), "utf8")) as { chips: { id: string; slotRgbaSha256: string }[] };

function slotHash(sheet: number, index: number): string {
  const png = PNG.sync.read(readFileSync(resolve(process.cwd(), `public/assets/generated/charsets/ScarloxyPeople${sheet}.png`)));
  expect(png.width).toBe(288);
  expect(png.height).toBe(256);
  const out = Buffer.alloc(72 * 128 * 4);
  const x0 = (index % 4) * 72;
  const y0 = Math.floor(index / 4) * 128;
  for (let y = 0; y < 128; y += 1) png.data.copy(out, y * 72 * 4, ((y0 + y) * png.width + x0) * 4, ((y0 + y) * png.width + x0 + 72) * 4);
  return createHash("sha256").update(out).digest("hex");
}

describe("ScarloxyPeople11~13 (갤러리 4 합성 22종)", () => {
  it("22칸이 시트 11(8)·12(8)·13(6)에 덧붙었고 기존 68칸은 그대로다", () => {
    expect(NEW).toHaveLength(22);
    expect(NEW.filter((r) => r.sheet === 11).map((r) => r.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(NEW.filter((r) => r.sheet === 12).map((r) => r.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(NEW.filter((r) => r.sheet === 13).map((r) => r.index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(ROWS).toHaveLength(94); // 90 + 아스트라 4칸(#3225)
    expect(new Set(ROWS.map((r) => r.id)).size).toBe(94);
    expect(ROWS.find((r) => r.id === "scarloxy-officer-navy")).toMatchObject({ sheet: 1, index: 0 });
    expect(ROWS.find((r) => r.id === "scarloxy-rookie-boy")).toMatchObject({ sheet: 10, index: 4 });
    expect(ROWS.some((r) => r.sheet === 8 && r.index === 3)).toBe(false);   // 사용자가 뺀 빈 칸 유지
    expect(ROWS.some((r) => r.sheet === 5 && r.index === 6)).toBe(false);
  });
  it("설치된 시트 칸의 화소 해시가 갤러리에서 본 그림(매니페스트)과 같다", () => {
    const byId = new Map(GALLERY.chips.map((c) => [c.id, c.slotRgbaSha256]));
    for (const row of NEW) {
      expect(byId.get(row.id)).toBe(row.source.slotRgbaSha256);
      expect(slotHash(row.sheet, row.index)).toBe(row.source.slotRgbaSha256);
    }
  });
  it("이름·설명·직군이 한국어로 있고 카탈로그·의미표·참조 검증 목록·계열에 모두 올라 있다", () => {
    for (const n of [11, 12, 13]) {
      const id = `oprn-charset-scarloxy-people${n}`;
      expect(findCharsetAsset(id)?.path).toBe(`assets/generated/charsets/ScarloxyPeople${n}.png`);
      expect(SCARLOXY_PEOPLE_CHARSET_RESOURCE_IDS).toContain(id);
      expect(SCARLOXY_PEOPLE_CHARSET_RESOURCE_IDS).toContain(`tex_oprn_charset_scarloxy_people${n}`);
      expect(charsetFamilyOf(undefined, id)).toBe("scarloxy-people");
      expect(charsetFamilyOf(undefined, `tex_oprn_charset_scarloxy_people${n}`)).toBe("scarloxy-people");
    }
    for (const row of NEW) {
      expect(row.name).toMatch(/[가-힣]/u);
      expect(row.desc.length).toBeGreaterThan(15);
      expect(row.role).toMatch(/[가-힣]/u);
      const entry = CHARSET_SEMANTICS.find((e) => e.textureKey === `tex_oprn_charset_scarloxy_people${row.sheet}` && e.characterIndex === row.index);
      expect(entry?.label).toBe(row.name);
      expect(entry?.appearance).toBe(row.desc);
    }
    expect(SCARLOXY_PEOPLE_CHARSET_SEMANTICS).toHaveLength(94); // 아스트라 4칸(#3225) 포함
  });
  it("몬스터 수집 잠금이 새 칩을 허용하고 RTP 사람 칩은 계속 거부한다", () => {
    const project: Project = createBlankProject();
    applyGenrePreset(project, "monster-collect");
    const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
    for (const [i, row] of [NEW[0]!, NEW[9]!, NEW[21]!].entries()) {
      const result = runTool(ctx, "place_npc", { mapId: project.startMapId, name: row.name, x: 3 + i * 3, y: 5, graphic: { textureKey: `tex_oprn_charset_scarloxy_people${row.sheet}`, characterIndex: row.index } }, { dryRun: false });
      expect(result.ok).toBe(true);
    }
    const denied = runTool(ctx, "place_npc", { mapId: project.startMapId, name: "판타지 청년", x: 12, y: 5, graphic: { textureKey: "tex_easyrpg_charset_people1", characterIndex: 2 } }, { dryRun: false });
    expect(denied.ok).toBe(false);
  });
});
