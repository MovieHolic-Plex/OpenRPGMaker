// 목표 꼬리 「(<맵> 입구: <자리> → <대상>)」 는 그 맵에 들어선 뒤에는 틀린 말이다 — 화면에는 지금 맵에서 읽는 글이 뜬다.
// 2026-11-11 fun-x1 눈가림 플레이: 궁전 안에서 「초승달 궁전 입구: 동쪽 끝 가운데」 를 따라 궁전 동쪽 끝을 10분 헤맸다.
import { describe, expect, it } from "vitest";
import { objectiveTextOnMap } from "@/player/objectiveTarget";

const on = (name: string, events: string[] = []) => ({ name, events: events.map((n) => ({ name: n })) }) as never;

describe("objectiveTextOnMap", () => {
  const tail = "피라미드의 수호자와 봉인에 대해 묻는다 (초승달 궁전 입구: 동쪽 끝 가운데 → 자라)";

  it("drops the entrance leg once the hero is on that map and keeps the target", () => {
    expect(objectiveTextOnMap(on("초승달 궁전"), tail)).toBe("피라미드의 수호자와 봉인에 대해 묻는다 (자라)");
  });

  it("keeps the whole tail on the map where the entrance still lies ahead", () => {
    expect(objectiveTextOnMap(on("바람 대상 숙영지"), tail)).toBe(tail);
  });

  it("drops an entrance-only tail", () => {
    expect(objectiveTextOnMap(on("황금 모래 시장"), "「하산」을 찾아가자 (황금 모래 시장 입구: 서쪽 끝 가운데)")).toBe("「하산」을 찾아가자");
  });

  it("re-bases a pass-through map on its own exit", () => {
    expect(objectiveTextOnMap(on("여관 로비"), "단서를 찾자 (여관 로비 입구: 남쪽 → 여관 로비에서 서쪽 · 문 셋 중 왼쪽 → 여관 뒤뜰 · 단서 발견)"))
      .toBe("단서를 찾자 (여관 뒤뜰 입구: 서쪽 · 문 셋 중 왼쪽 → 단서 발견)");
    expect(objectiveTextOnMap(on("여관 로비"), "단서를 찾자 (여관 로비 입구: 남쪽 → 여관 뒤뜰 · 단서 발견)")).toBe("단서를 찾자 (여관 뒤뜰 · 단서 발견)");
  });

  it("handles a one-letter map name and leaves the other hints of a joined tail alone", () => {
    expect(objectiveTextOnMap(on("숲"), "숲을 지나자 (숲 입구: 북동쪽 → 숲 통과 / 회복의 샘: 마을 남쪽)")).toBe("숲을 지나자 (숲 통과 / 회복의 샘: 마을 남쪽)");
  });

  it("leaves 「이름: 자리」 tails and an event literally named 「<맵> 입구」 untouched", () => {
    expect(objectiveTextOnMap(on("마을"), "「나지라」를 찾아가자 (회복의 샘: 달샘 오아시스 남쪽)")).toBe("「나지라」를 찾아가자 (회복의 샘: 달샘 오아시스 남쪽)");
    expect(objectiveTextOnMap(on("동굴", ["동굴 입구"]), "열쇠로 문을 열자 (동굴 입구: 북쪽)")).toBe("열쇠로 문을 열자 (동굴 입구: 북쪽)");
    expect(objectiveTextOnMap(on("마을"), "별의 정령에게 소원을 빌자")).toBe("별의 정령에게 소원을 빌자");
  });
});
