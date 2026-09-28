// 포켓몬풍 완결 게임의 지역 조립점 — 코어(configureScarloxyPokemonDemoProject)가 한 번 부른다.
// 지역 파일은 서로를 모르고 scarloxyPokemonWorld.ts 계약만 본다. 순서: A(이끼 마을·풀 체육관·바위굴) → B(파도 마을·물 체육관·3번 도로) → C(잿불 마을·불 체육관·챔피언 로드·챔피언의 탑·엔딩).

import type { Project } from "../types";
import { PKMN_FLAGS, PKMN_GATES, PKMN_LINKS, PKMN_MAPS } from "./scarloxyPokemonWorld";
import { installPkmnRegionA } from "./scarloxyPokemonRegionA";
import { installPkmnRegionB } from "./scarloxyPokemonRegionB";
import { installPkmnRegionC } from "./scarloxyPokemonRegionC";

export function installScarloxyPokemonRegions(project: Project): void {
  installPkmnRegionA(project);
  installPkmnRegionB(project);
  installPkmnRegionC(project);
  lockGateExits(project);
  orderGymPuzzles(project);
}

/** 체육관(지역 접두어 a·b·c)마다 퍼즐 스위치가 켜는 이야기 스위치. */
const GYM_PUZZLES = [
  { region: "a", mapKey: "grassGym", switchId: "sw_pkmn_gym_grass_open", name: "풀 체육관 차단기 열림" },
  { region: "b", mapKey: "waterGym", switchId: "sw_pkmn_gym_water_open", name: "물 체육관 차단기 열림" },
  { region: "c", mapKey: "fireGym", switchId: "sw_pkmn_gym_fire_open", name: "불 체육관 차단기 열림" },
] as const;

/**
 * 관장 앞 차단기는 바닥 스위치의 changeTile 로 열린다 — 타일이 길을 여는 것이라 데이터만 봐서는
 * 「스위치 → 관장」 순서가 드러나지 않는다. 스위치가 이야기 스위치도 켜게 하고, 관장 전투 페이지가 그것을 조건으로 삼는다.
 * 스위치 전에는 같은 관장이 첫 페이지(조건 없음)에서 퍼즐 힌트만 말한다. 차단기 때문에 그 칸에는 원래 닿지 못하므로
 * 플레이 흐름은 달라지지 않고, 자동 플레이 검사기가 퍼즐을 먼저 계획한다.
 */
function orderGymPuzzles(project: Project): void {
  for (const puzzle of GYM_PUZZLES) {
    const map = project.maps[PKMN_MAPS[puzzle.mapKey]];
    const switchEvent = map?.events.find((event) => event.id === `ev_pkmn_${puzzle.region}_gym_switch`);
    const leader = map?.events.find((event) => event.id === `ev_pkmn_${puzzle.region}_gym_leader`);
    const pressPage = switchEvent?.pages?.[0];
    const battlePage = leader?.pages?.[0];
    if (!pressPage || !battlePage || !leader?.pages) continue;
    if (!project.switches.some((entry) => entry.id === puzzle.switchId)) project.switches.push({ id: puzzle.switchId, name: puzzle.name });
    if (!pressPage.commands.some((command) => command.kind === "setSwitch" && command.switchId === puzzle.switchId)) {
      pressPage.commands.push({ kind: "setSwitch", switchId: puzzle.switchId, value: true });
    }
    if (battlePage.conditions.some((condition) => condition.kind === "switch" && condition.switchId === puzzle.switchId)) continue;
    const speaker = battlePage.name;
    const hintPage = {
      ...battlePage,
      id: `${battlePage.id}_locked`,
      commands: [
        ...battlePage.commands.filter((command) => command.kind === "changeFace"),
        { kind: "text" as const, speaker, body: "도전하려면 먼저 바닥 스위치로 차단기를 내리고 와." },
      ],
      conditions: [],
    };
    battlePage.conditions = [...battlePage.conditions, { kind: "switch", switchId: puzzle.switchId, value: true }];
    leader.pages = [hintPage, ...leader.pages];
  }
}

/**
 * 관문 출구 칸의 이동 페이지에 배지 스위치 조건을 건다(PKMN_GATES).
 * 런타임에서는 경비원이 이미 길을 막으므로 달라지는 것이 없다. 조건을 문 자체에 적어 두면
 * 「이 문은 배지 N 이 있어야 연다」가 데이터로 드러나 자동 플레이 검사기(src/qa/gameCheck)가 체육관을 먼저 계획한다.
 */
/** 관문 목록 + 챔피언 로드 끝의 라이벌 3(길을 막고 서 있다가 지면 비켜 선다). */
const DOOR_LOCKS: readonly { readonly link: string; readonly requires: string }[] = [
  ...PKMN_GATES,
  { link: "victoryRoad->championTower", requires: PKMN_FLAGS.rival3 },
];

function lockGateExits(project: Project): void {
  for (const gate of DOOR_LOCKS) {
    const [fromKey, toKey] = gate.link.split("->") as [keyof typeof PKMN_MAPS, keyof typeof PKMN_MAPS];
    const link = PKMN_LINKS.find((entry) => entry.from === fromKey && entry.to === toKey);
    const map = link ? project.maps[PKMN_MAPS[fromKey]] : undefined;
    if (!link || !map) continue;
    for (const event of map.events) {
      if (event.x !== link.x || event.y !== link.y) continue;
      for (const page of event.pages ?? []) {
        const transfers = page.commands.some((command) => command.kind === "transfer" && command.mapId === PKMN_MAPS[toKey]);
        const locked = page.conditions.some((condition) => condition.kind === "switch" && condition.switchId === gate.requires);
        if (transfers && !locked) page.conditions = [...page.conditions, { kind: "switch", switchId: gate.requires, value: true }];
      }
    }
  }
}
