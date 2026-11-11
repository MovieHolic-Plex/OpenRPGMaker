// 없는 그림 기록은 모양이 하나다(src/project/artGap.ts) — 끝맺음 단계 · 장소 테마 · 빌더가 같은 줄을 쓰고, 턴 끝 요약과 없는 그림 장부가 그 줄을 기록으로 읽는다.
// 2026-11-11: 단계의 한국어 줄 + `v2.art-gap` 기록과 장소 테마의 `[art-gap]` 줄이 따로 있어 장부가 둘을 따로 읽어야 했다.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { artGapLine, artGapsIn, artGapText, parseArtGap, recordArtGaps, type ArtGap } from "@/project/artGap";
import { reportOfArtGap, toolReportsIn, toolReportsOfSession } from "@/harnesses/assistant-capability/node/mapVqa/artGaps";

const tile: ArtGap = { chipset: "desert_east", want: "cave-mouth", wanted: "굴 입구 그림", where: "사막 12,10", standIn: "none", by: "cave-gates", note: "「→ 모래 굴」 던전 출입구" };
const themed: ArtGap = { theme: "sf_station/*", want: "foe", wanted: "security robots, drones, aliens", where: "정거장", standIn: "금속 슬라임" };

describe("the art-gap record", () => {
  it("is one line that reads back as the same record", () => {
    expect(artGapLine(tile)).toBe("[art-gap] chipset=desert_east want=cave-mouth wanted=«굴 입구 그림» where=«사막 12,10» stand-in=«none» by=cave-gates note=«「→ 모래 굴」 던전 출입구»");
    expect(artGapLine(themed)).toBe("[art-gap] theme=sf_station/* want=foe wanted=«security robots, drones, aliens» where=«정거장» stand-in=«금속 슬라임»");
    expect(parseArtGap(artGapLine(tile))).toEqual(tile);
    expect(parseArtGap(artGapLine(themed))).toEqual(themed);
    // 꺾쇠·줄바꿈이 든 글도 줄을 깨뜨리지 않는다.
    expect(parseArtGap(artGapLine({ ...tile, wanted: "문 «큰» 것\n둘" }))?.wanted).toBe("문  큰  것 둘");
  });

  it("still reads the earlier line that wrote the stand-in bare to the end of the line", () => {
    expect(parseArtGap("[art-gap] theme=desert_east/tomb want=backdrop wanted=«stone burial chamber» where=«묘실» stand-in=battle-scenery-cave"))
      .toEqual({ theme: "desert_east/tomb", want: "backdrop", wanted: "stone burial chamber", where: "묘실", standIn: "battle-scenery-cave" });
    expect(parseArtGap("[art-gap] theme=x want=foe wanted=«a» where=«b» stand-in=default field troops")?.standIn).toBe("default field troops");
    expect(parseArtGap("여관(inn) — 이 종류를 짓는 빌더가 없다")).toBeUndefined();
  });

  it("is written once per spot and read out of the report lines at the end of the turn", () => {
    const session = { missingArt: new Set<string>(["항구에 정박한 배 (카드 대기: 그림 완성·선택 전, 맵에 없음)"]) };
    recordArtGaps(session, [tile, themed]);
    recordArtGaps(session, [tile]);
    expect(session.missingArt.size).toBe(3);
    // 빌더의 자유 글은 기록이 아니다 — 그대로 보고 줄로만 남는다.
    expect(artGapsIn(session.missingArt)).toEqual([tile, themed]);
  });

  it("reads as a short phrase in the final report", () => {
    expect(artGapText(artGapLine(tile))).toBe("굴 입구 그림(사막 12,10 · 「→ 모래 굴」 던전 출입구)");
    expect(artGapText(artGapLine(themed))).toBe("security robots, drones, aliens(정거장 — 대신 금속 슬라임)");
    expect(artGapText("여관(inn) — 이 종류를 짓는 빌더가 없다")).toBe("여관(inn) — 이 종류를 짓는 빌더가 없다");
  });
});

describe("the missing-art ledger reads the record, not the prose", () => {
  it("turns a record into a ledger report: wanted thing, chipset, stand-in, theme", () => {
    expect(reportOfArtGap(tile, "finish")).toMatchObject({ kind: "art-gap", thing: "굴 입구 그림", chipset: "desert_east", instead: "", want: "cave-mouth", tool: "cave-gates" });
    expect(reportOfArtGap(themed, "finish")).toMatchObject({ kind: "art-gap", thing: "security robots, drones, aliens", chipset: "", instead: "금속 슬라임", want: "foe", theme: "sf_station/*", tool: "finish" });
  });

  it("finds record lines inside a tool result's missingArt list — the line's own bracket does not end the list", () => {
    const text = JSON.stringify({ ok: true, missingArt: [artGapLine(tile), artGapLine(themed), "항구에 정박한 배 (카드 대기: 그림 완성·선택 전, 맵에 없음)"] });
    expect(toolReportsIn("make_game", text).map((r) => `${r.kind}:${r.thing}:${r.chipset}:${r.instead}`)).toEqual([
      "art-gap:굴 입구 그림:desert_east:", "art-gap:security robots, drones, aliens::금속 슬라임", "missing-art:항구에 정박한 배::없음(그리기 카드 대기)",
    ]);
  });

  it("reads the turn record's artGaps — the same gap also quoted in a tool result counts once", () => {
    const dir = mkdtempSync(join(tmpdir(), "art-gap-"));
    try {
      mkdirSync(join(dir, "turns"));
      writeFileSync(join(dir, "turns", "001.json"), JSON.stringify({
        artGaps: [tile, themed],
        toolCalls: [{ name: "make_game", modelText: JSON.stringify({ ok: true, missingArt: [artGapLine(tile)] }) }],
      }));
      // 기록 칸이 없는 옛 턴: 결과 글의 줄에서 읽는다.
      writeFileSync(join(dir, "turns", "002.json"), JSON.stringify({ toolCalls: [{ name: "build_places", modelText: JSON.stringify({ missingArt: [artGapLine({ ...themed, wanted: "sand wraith" })] }) }] }));
      const reports = toolReportsOfSession(dir);
      expect(reports.map((r) => `${r.kind}:${r.thing}`).sort()).toEqual(["art-gap:sand wraith", "art-gap:security robots, drones, aliens", "art-gap:굴 입구 그림"]);
      expect(reports.find((r) => r.thing === "굴 입구 그림")).toMatchObject({ chipset: "desert_east", want: "cave-mouth" });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
