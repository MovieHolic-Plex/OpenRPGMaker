import type { DatabaseTab } from "@/editor/panels/database";

type DatabaseManualTopic = {
  readonly label: string;
  readonly url: string;
};

const MANUAL_BASE_URL = "https://haylee.garden/rpg2003";

export const databaseManualTopics = {
  actors: { label: "주인공", url: `${MANUAL_BASE_URL}/dactors.htm` },
  animations: { label: "전투 애니메이션", url: `${MANUAL_BASE_URL}/danimations.htm` },
  battleAnimations: { label: "전투 애니메이션", url: `${MANUAL_BASE_URL}/danimations.htm` },
  battleCommands: { label: "전투 화면", url: `${MANUAL_BASE_URL}/dbattlescreen.htm` },
  battleScreen: { label: "전투 화면", url: `${MANUAL_BASE_URL}/dbattlescreen.htm` },
  battlerAnimations: { label: "전투 애니메이션 2", url: `${MANUAL_BASE_URL}/danimations2.htm` },
  classes: { label: "직업", url: `${MANUAL_BASE_URL}/dclasses.htm` },
  commonEvents: { label: "공용 이벤트", url: `${MANUAL_BASE_URL}/dcommonevents.htm` },
  elements: { label: "속성", url: `${MANUAL_BASE_URL}/delements.htm` },
  enemies: { label: "적 캐릭터", url: `${MANUAL_BASE_URL}/denemies.htm` },
  equipment: { label: "아이템", url: `${MANUAL_BASE_URL}/ditems.htm` },
  items: { label: "아이템", url: `${MANUAL_BASE_URL}/ditems.htm` },
  skills: { label: "특수기능", url: `${MANUAL_BASE_URL}/dskills.htm` },
  states: { label: "상태", url: `${MANUAL_BASE_URL}/dstates.htm` },
  switches: { label: "스위치/변수 창", url: `${MANUAL_BASE_URL}/supplementarywindowsb.htm` },
  system: { label: "시스템", url: `${MANUAL_BASE_URL}/dsystem.htm` },
  terms: { label: "용어", url: `${MANUAL_BASE_URL}/dterms.htm` },
  terrain: { label: "지형", url: `${MANUAL_BASE_URL}/dterrain.htm` },
  tilesets: { label: "타일셋", url: `${MANUAL_BASE_URL}/dtilesets.htm` },
  troops: { label: "적 그룹", url: `${MANUAL_BASE_URL}/dtroops.htm` },
  variables: { label: "스위치/변수 창", url: `${MANUAL_BASE_URL}/supplementarywindowsb.htm` },
} satisfies Record<DatabaseTab, DatabaseManualTopic>;

export function databaseManualTopic(tab: DatabaseTab): DatabaseManualTopic {
  return databaseManualTopics[tab];
}
