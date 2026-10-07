// 타이틀 메뉴 라벨 충돌 가드.
//
// resume(오토세이브 즉시 재개)과 continueGame(저장 슬롯 패널 열기)은 서로 다른 동작인데
// 기본 라벨이 둘 다 "이어하기"였다. resume 은 오토세이브가 있을 때만 노출되므로 새 프로젝트에서는
// 안 보이고, 저자가 한 번 저장한 뒤부터 타이틀에 같은 글자가 두 줄 뜬다 — 발견이 늦는 종류의 버그다.
// 동봉 샘플 게임들도 같은 함정을 밟아 "이어 하기"(공백 하나 차이)를 쓰고 있었다.
// 그래서 라벨 문자열을 하나씩 단정하는 대신, **충돌 없음**이라는 성질을 표로 고정한다.
import { describe, expect, it } from "vitest";
import { listTitleMenuOptions } from "../src/player/titleScreen";
import { defaultTitleScreenSettings } from "../src/project/defaults/defaultDatabase";
import { createScarloxyDemoProject } from "../src/project/defaults/defaultProject";
import type { TitleScreenSettings } from "../src/project/types/database";

/** 저자가 눈으로 구별하지 못하는 차이(공백)는 같은 라벨로 취급한다. */
function normalize(label: string): string {
  return label.replace(/\s+/gu, "");
}

const BUNDLED: readonly (readonly [string, TitleScreenSettings])[] = [
  ["기본 프로젝트", defaultTitleScreenSettings()],
  ["몬스터 초원", createScarloxyDemoProject().system.titleScreen!],
];

describe("타이틀 메뉴 라벨", () => {
  it.each(BUNDLED)("%s — 오토세이브가 있어도 라벨이 겹치지 않는다", (_name, settings) => {
    const labels = listTitleMenuOptions(settings, { autosaveAvailable: true }).map((option) => normalize(option.label));
    expect(labels).toEqual([...new Set(labels)]);
  });

  it("오토세이브가 있으면 resume 과 continueGame 이 함께, 서로 다른 라벨로 노출된다", () => {
    const options = listTitleMenuOptions(defaultTitleScreenSettings(), { autosaveAvailable: true });
    const resume = options.find((option) => option.id === "resume");
    const continueGame = options.find((option) => option.id === "continueGame");
    expect(resume?.label).toBe("이어하기");
    // continueGame 이 여는 패널의 제목과 같은 낱말이어야 화면과 메뉴가 어긋나지 않는다.
    expect(continueGame?.label).toBe("불러오기");
  });

  it("오토세이브가 없으면 resume 이 빠지고 continueGame 만 남는다", () => {
    const ids = listTitleMenuOptions(defaultTitleScreenSettings(), { autosaveAvailable: false }).map((option) => option.id);
    expect(ids).toEqual(["newGame", "continueGame", "quit"]);
  });
});
