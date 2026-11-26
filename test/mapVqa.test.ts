import { describe, expect, it } from "vitest";
import { artGapLine, artGapsIn, artGapText, parseArtGap, recordArtGaps, type ArtGap } from "@/project/artGap";
import { isolateTimers } from "./mergedTeardown";

// 없는 그림 기록은 모양이 하나다(src/project/artGap.ts) — 끝맺음 단계 · 장소 테마 · 빌더가 같은 줄을 쓰고, 턴 끝 요약과 없는 그림 장부가 그 줄을 기록으로 읽는다.
// 2026-11-11: 단계의 한국어 줄 + `v2.art-gap` 기록과 장소 테마의 `[art-gap]` 줄이 따로 있어 장부가 둘을 따로 읽어야 했다.
describe("artGapRecord", () => {
  isolateTimers();
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
});
