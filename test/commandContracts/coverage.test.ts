// test/commandContracts/coverage.test.ts
// 계약 파일 ↔ kind 대조 (스펙 §10 EC1 / §11 회귀 게이트 1).
//
// COMMAND_KINDS(레지스트리 단일 소스)의 모든 kind 에 대해 test/commandContracts/<kind>.contract.test.ts
// 파일 존재를 강제한다. 아직 미작성인 kind 는 아래 TODO 화이트리스트에 명시적으로 남는다.
// 화이트리스트는 줄어들 수만 있다: 파일이 생겼는데 화이트리스트에 남아 있으면 실패한다.
//
// 실측 메모: 스펙 §10 은 "화이트리스트=38"을 예상했지만, 실제 COMMAND_KINDS 는 45개
// (m2Command, setEventGraphicPattern 포함)라 레지스트리를 기계적 진실로 삼는다
// (차이는 EC1 보고서 "표 대조 결과"에 기록).
import { describe, expect, it } from "vitest";
import { COMMAND_KINDS, type CommandKind } from "@/project/commandKindRegistry";

// tsconfig 에 node 타입이 없어(types: []) 기존 테스트 관례(easyrpgRtpAssets.test.ts)대로
// node:fs 를 동적 import 로 우회한다.
type FsLike = {
  readonly existsSync: (path: URL | string) => boolean;
};

const loadFs = async (): Promise<FsLike> => {
  const moduleName = "node:fs";
  return (await import(moduleName)) as FsLike;
};

// EC1 완료 kind: breakLoop, learnSkill, enterHeroName, setSelfSwitch (화이트리스트에 없음).
// EC2(§5.1+§5.2) / EC3(§5.3+§5.4) 가 계약 파일을 추가하면서 이 배열에서 제거한다.
const CONTRACT_TEST_TODO_WHITELIST: readonly CommandKind[] = [
  // §5.2 legacy flag — EC2 지시는 신규 16개 / 화이트리스트 40→24 를 완료 기준으로 삼는다.
  // setFlag 동작은 setSwitch.contract.test.ts 안에서 함께 고정했고, 별도 파일은 후속 wave 로 남긴다.
  "setFlag",
  // §5.3 액터·파티·인벤토리 (EC3)
  "changeGold",
  "changeItem",
  "changeParty",
  "changeExp",
  "changeLevel",
  "changeEquipment",
  "changeActorHp",
  "changeActorMp",
  "recoverAll",
  // §5.4 화면·오디오·시스템 (EC3)
  "showPicture",
  "erasePicture",
  "playAudio",
  "stopAudio",
  "shop",
  "inn",
  "battleProcessing",
  "transfer",
  "moveEvent",
  "setEventGraphicPattern",
  "changeTile",
  "gameOver",
  "ending",
  "returnToTitle",
  // m2 네임스페이스 진입 kind — §9 m2 트리아지(EC4)와 함께 계약화.
  "m2Command",
];

function contractFileUrl(kind: CommandKind): URL {
  return new URL(`./${kind}.contract.test.ts`, import.meta.url);
}

describe("commandContracts 커버리지 — 화이트리스트 sanity", () => {
  it("화이트리스트에 중복이 없고, 모든 항목이 COMMAND_KINDS 에 속한다", () => {
    expect(new Set(CONTRACT_TEST_TODO_WHITELIST).size).toBe(CONTRACT_TEST_TODO_WHITELIST.length);
    for (const kind of CONTRACT_TEST_TODO_WHITELIST) {
      expect(COMMAND_KINDS).toContain(kind);
    }
  });

  it("EC1 완료 kind(breakLoop/learnSkill/enterHeroName/setSelfSwitch)는 화이트리스트에 없다", () => {
    for (const kind of ["breakLoop", "learnSkill", "enterHeroName", "setSelfSwitch"] as const) {
      expect(CONTRACT_TEST_TODO_WHITELIST).not.toContain(kind);
    }
  });
});

describe("commandContracts 커버리지 — kind별 계약 파일", () => {
  for (const kind of COMMAND_KINDS) {
    const whitelisted = CONTRACT_TEST_TODO_WHITELIST.includes(kind);
    if (whitelisted) {
      it(`${kind}: TODO(화이트리스트) — 계약 파일이 생기면 화이트리스트에서 제거해야 한다`, async () => {
        const fs = await loadFs();
        expect(
          fs.existsSync(contractFileUrl(kind)),
          `${kind}.contract.test.ts 가 존재합니다. coverage.test.ts 의 CONTRACT_TEST_TODO_WHITELIST 에서 "${kind}" 를 제거하세요.`
        ).toBe(false);
      });
    } else {
      it(`${kind}: 계약 테스트 파일이 존재한다`, async () => {
        const fs = await loadFs();
        expect(
          fs.existsSync(contractFileUrl(kind)),
          `${kind}.contract.test.ts 가 없습니다. 계약 테스트를 작성하거나(권장) 화이트리스트에 명시하세요.`
        ).toBe(true);
      });
    }
  }
});
