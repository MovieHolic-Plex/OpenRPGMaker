// 도트 측면 전투(retro2003) 몬스터 확장 계약 — 2026-09-28. 그림 에이전트 셋과 런타임이 같은 목록을 본다.
// 시트 규격은 pixelEnemySheets.ts 머리 주석(셀 cell×cell 3×3, 오른쪽 보기, 바닥 y=cell-4, 알파 0/255).
// 리소스 id 는 generated-enemy-<slug> (generatedEnemyRecords.ts 의 기존 적 레코드가 이 id 를 이미 쓴다).
import type { PixelEnemyMotion } from "@/assets/pixelEnemySheets";

export interface RetroMonsterPlan {
  readonly slug: string;
  readonly name: string;
  readonly cell: 48 | 64 | 96;
  readonly motion: PixelEnemyMotion;
  readonly design: string;
}

export const RETRO_MONSTER_PLAN: readonly RetroMonsterPlan[] = [
  { slug: "bat-vampire", name: "흡혈 박쥐", cell: 48, motion: "swoop", design: "검붉은 날개·송곳니, 흡혈 박쥐(기존 박쥐보다 크고 사나움)" },
  { slug: "bee-giant", name: "거대 벌", cell: 48, motion: "swoop", design: "노랑·검정 줄무늬 몸통, 반투명 날개, 침을 앞으로 찌름" },
  { slug: "scorpion-sand", name: "모래 전갈", cell: 48, motion: "dash", design: "모래색 갑각, 집게 둘, 꼬리 독침을 머리 위로 휘어 찌름" },
  { slug: "mantis-blade", name: "칼날 사마귀", cell: 48, motion: "dash", design: "연두색, 낫 같은 앞다리 두 개로 교차 베기" },
  { slug: "boar-tusk", name: "송곳니 멧돼지", cell: 64, motion: "dash", design: "갈색 털, 휘어진 흰 엄니, 낮게 돌진" },
  { slug: "bear-brown", name: "갈색 곰", cell: 64, motion: "stomp", design: "일어서서 앞발로 내려치기" },
  { slug: "snake-viper", name: "독사", cell: 48, motion: "dash", design: "초록 비늘, 몸을 말았다가 튀어 물기" },
  { slug: "crab-rock", name: "바위 게", cell: 48, motion: "dash", design: "등에 바위를 진 게, 큰 집게로 꼬집기" },
  { slug: "hound-hell", name: "지옥 사냥개", cell: 64, motion: "dash", design: "검은 털·불타는 갈기·붉은 눈, 불 이빨" },
  { slug: "plant-carnivore", name: "식충 식물", cell: 64, motion: "stomp", design: "큰 입 꽃봉오리와 덩굴, 제자리에서 덩굴을 뻗어 물기(stomp 대신 덩굴 채찍)" },
  { slug: "skeleton-knight", name: "해골 기사", cell: 48, motion: "stomp", design: "녹슨 갑옷·방패·장검의 해골" },
  { slug: "ghost-pale", name: "창백한 유령", cell: 48, motion: "float", design: "하얀 천 같은 몸, 텅 빈 눈, 스르르 다가와 할퀴기" },
  { slug: "lich-frost", name: "서릿 리치", cell: 64, motion: "shoot", design: "왕관·푸른 로브의 해골 마법사, 얼음 구체를 쏨" },
  { slug: "mummy-bandage", name: "미라", cell: 48, motion: "stomp", design: "붕대 감긴 몸, 붕대 채찍" },
  { slug: "spirit-fire", name: "불의 정령", cell: 48, motion: "float", design: "불꽃 인간형, 불꽃 머리칼" },
  { slug: "spirit-water", name: "물의 정령", cell: 48, motion: "float", design: "물방울 인간형, 반투명 푸른 몸" },
  { slug: "golem-iron", name: "철 골렘", cell: 64, motion: "stomp", design: "리벳 박힌 철판 몸, 눈이 빛남" },
  { slug: "armor-living", name: "살아있는 갑옷", cell: 48, motion: "stomp", design: "빈 갑옷 안에서 보라빛, 큰 도끼" },
  { slug: "mimic-chest", name: "미믹 상자", cell: 48, motion: "hop", design: "보물상자에 이빨과 혀, 뛰어올라 물기" },
  { slug: "eye-floating", name: "부유하는 눈", cell: 48, motion: "shoot", design: "거대한 눈알과 촉수, 눈에서 광선" },
  { slug: "goblin-scout", name: "고블린 정찰병", cell: 48, motion: "dash", design: "초록 피부·큰 귀·단검" },
  { slug: "orc-warrior", name: "오크 전사", cell: 64, motion: "stomp", design: "회녹색 근육질, 큰 도끼, 뿔 투구" },
  { slug: "orc-shaman", name: "오크 주술사", cell: 48, motion: "shoot", design: "해골 지팡이, 깃털 머리장식, 녹색 불꽃을 쏨" },
  { slug: "bandit-mask", name: "복면 산적", cell: 48, motion: "dash", design: "두건·복면·곡도" },
  { slug: "lizardman-spear", name: "리자드맨", cell: 48, motion: "dash", design: "파란 비늘 도마뱀 인간, 창 찌르기" },
  { slug: "harpy-cliff", name: "하피", cell: 48, motion: "swoop", design: "여인 얼굴에 새 날개와 발톱" },
  { slug: "minotaur-maze", name: "미노타우로스", cell: 96, motion: "stomp", design: "황소 머리 거인, 양날 도끼(보스급)" },
  { slug: "troll-cave", name: "동굴 트롤", cell: 96, motion: "stomp", design: "회색 피부 거인, 몽둥이" },
  { slug: "gargoyle-stone", name: "가고일", cell: 64, motion: "swoop", design: "돌 날개 악마 석상, 급강하 할퀴기" },
  { slug: "demon-lord", name: "마왕", cell: 96, motion: "breath", design: "뿔·망토·붉은 눈의 마왕, 보라 암흑 불꽃을 뿜음(최종 보스)" },
];
