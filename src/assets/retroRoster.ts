// 도트 측면 전투(retro2003) 2차 확장 — 로스터 **계약 파일** (2026-09-28).
//
// 사용자 요구: 「Actor·People·Animal·Vehicles·Monster 걷기 칩 전부 직업·스킬을 만든다. 몬스터도 파티가 될 수 있는 자유도」.
// 기존 12직업(retroClassSkills.ts) 외 모든 걷기 칩(EasyRPG RTP CharSet 12장 × 8명)에 직업 하나씩. 직업당 스킬 8개 = 800개.
// 스킬 목록은 묶음(batch)별 파일 src/assets/retroRosterSkills/<batch>.ts 가 가진다(묶음 담당 에이전트만 그 파일을 쓴다).
//
// body — 전투 도트 방식:
//   humanoid  사람형. 48px 셀 전투 시트(charset-battlers/<chip>.png, 24포즈 cb_lib.POSES) + 시전 시트(cast/<chip>.png).
//             Actor 칩은 기본 시트가 이미 있다(무기만 직업에 맞게 다시 칠한다 — weapons.py/repaint_weapons.py).
//             People 칩은 시트를 새로 만든다(baseline.py → art 파이프라인, 선례 art4/heroes6.py).
//   beast·vehicle·monster  사람형이 아닌 칩. **몬스터 9칸 시트**(pixelEnemySheets.ts 머리 주석 규격, 셀 48 또는 64)를
//             **왼쪽을 보게** 그린다: public/assets/generated/party-pixel/<chip>.png. 파티원으로 설 때 몬스터 동작
//             (hop·swoop·stomp·dash·float·shoot·breath)을 좌우 반전해 재사용한다. motion 은 각 묶음 파일의 RETRO_PARTY_PIXEL 에 적는다.
//
// 칩 id: actor<N>-<i>, people<N>-<i>, animal-<i>, vehicles-<i>, monster<N>-<i> (i = 걷기 칩 characterIndex 0~7, 4열×2행 왼쪽 위부터).
// 마도사는 칩 이전: actor3-0(사무라이와 공유하던 붉은 무사 칩) → actor1-5(마법 모자). 스킬 8개는 retroClassSkills.ts 그대로.
import type { RetroClassSkill } from "@/assets/retroClassSkills";

export type RetroRosterBody = "humanoid" | "beast" | "vehicle" | "monster";

export interface RetroRosterClass {
  readonly classId: string;
  /** 걷기 칩 id(위 규칙). */
  readonly chip: string;
  readonly name: string;
  readonly role: string;
  readonly body: RetroRosterBody;
  /** 담당 묶음(에이전트 하나가 한 묶음을 끝까지). */
  readonly batch: string;
  readonly concept: string;
}

export const RETRO_ROSTER: readonly RetroRosterClass[] = [
  { classId: "class_valkyrie", chip: "actor1-1", name: "발키리", role: "물리", body: "humanoid", batch: "a1", concept: "푸른 머리 창 전사, 비행·강하 창술" },
  { classId: "class_paladin", chip: "actor1-2", name: "성기사", role: "탱커", body: "humanoid", batch: "a1", concept: "붉은 갑옷 성기사, 신성 방어·치유 검" },
  { classId: "class_red_mage", chip: "actor1-3", name: "적마도사", role: "혼합", body: "humanoid", batch: "a1", concept: "검과 마법을 번갈아 쓰는 붉은 옷 마검사" },
  { classId: "class_dark_knight", chip: "actor1-4", name: "암흑기사", role: "물리", body: "humanoid", batch: "a1", concept: "검은 투구·망토, 체력을 깎아 암흑검" },
  { classId: "class_mage", chip: "actor1-5", name: "마도사", role: "마법", body: "humanoid", batch: "a1", concept: "기존 마도사(칩 이전: actor3-0 → actor1-5). 스킬은 기존 그대로" },
  { classId: "class_chronomancer", chip: "actor1-6", name: "시공술사", role: "지원", body: "humanoid", batch: "a1", concept: "검은 머리 흰 로브, 시간 가속·정지" },
  { classId: "class_thief", chip: "actor2-1", name: "도적", role: "민첩", body: "humanoid", batch: "a1", concept: "주황 머리 도적, 훔치기·연속 찌르기" },
  { classId: "class_beast_tamer", chip: "actor2-2", name: "야수조련사", role: "소환", body: "humanoid", batch: "a1", concept: "갈색 피부 조련사, 야수를 불러 공격" },
  { classId: "class_pirate", chip: "actor2-4", name: "해적", role: "물리", body: "humanoid", batch: "a2", concept: "붉은 두건 해적, 곡도·대포" },
  { classId: "class_sorceress", chip: "actor2-5", name: "마녀술사", role: "마법", body: "humanoid", batch: "a2", concept: "보라 두건 여술사, 저주·흑마법 광역" },
  { classId: "class_elf_archer", chip: "actor2-6", name: "엘프 궁사", role: "원거리", body: "humanoid", batch: "a2", concept: "초록 머리 엘프, 정령 화살" },
  { classId: "class_hunter", chip: "actor2-7", name: "사냥꾼", role: "원거리", body: "humanoid", batch: "a2", concept: "초록 모자 사냥꾼, 덫·석궁" },
  { classId: "class_brawler", chip: "actor3-1", name: "권투가", role: "물리", body: "humanoid", batch: "a2", concept: "검은 머리 거리 싸움꾼, 잽·어퍼컷" },
  { classId: "class_martial_artist", chip: "actor3-3", name: "무술가", role: "물리", body: "humanoid", batch: "a2", concept: "머리 묶은 무술가, 기공 발차기" },
  { classId: "class_general", chip: "actor3-7", name: "장군", role: "탱커", body: "humanoid", batch: "a2", concept: "왕관 투구 장군, 호령·진형" },
  { classId: "class_prince", chip: "actor4-1", name: "왕자 기사", role: "물리", body: "humanoid", batch: "a2", concept: "금발 왕자, 레이피어·왕가의 빛" },
  { classId: "class_berserker", chip: "actor4-2", name: "광전사", role: "물리", body: "humanoid", batch: "a3", concept: "머리띠 광전사, 분노·양손 강타" },
  { classId: "class_gunner", chip: "actor4-3", name: "총사", role: "원거리", body: "humanoid", batch: "a3", concept: "푸른 머리 총사, 연사·저격" },
  { classId: "class_dancer", chip: "actor4-4", name: "무희", role: "지원", body: "humanoid", batch: "a3", concept: "붉은 머리 무희, 춤으로 버프·매혹" },
  { classId: "class_alchemist", chip: "actor4-5", name: "연금술사", role: "지원", body: "humanoid", batch: "a3", concept: "금발 연금술사, 포션 투척·폭탄" },
  { classId: "class_summoner", chip: "actor4-6", name: "소환사", role: "소환", body: "humanoid", batch: "a3", concept: "보라 머리 소환사, 환수를 부름" },
  { classId: "class_squire", chip: "people1-0", name: "견습 기사", role: "물리", body: "humanoid", batch: "a3", concept: "갈색 머리 소년 견습 기사" },
  { classId: "class_flower_girl", chip: "people1-1", name: "꽃집 아가씨", role: "지원", body: "humanoid", batch: "a3", concept: "금발 소녀, 꽃잎 치유" },
  { classId: "class_swordsman", chip: "people1-2", name: "검객", role: "물리", body: "humanoid", batch: "a3", concept: "푸른 머리 청년 검객, 빠른 검술" },
  { classId: "class_scholar", chip: "people1-3", name: "학자", role: "마법", body: "humanoid", batch: "p1", concept: "안경 쓴 학자, 분석·약점 간파" },
  { classId: "class_miner", chip: "people1-4", name: "광부", role: "물리", body: "humanoid", batch: "p1", concept: "곡괭이 광부, 땅 파기·낙석" },
  { classId: "class_farmer", chip: "people1-5", name: "농부", role: "물리", body: "humanoid", batch: "p1", concept: "갈색 피부 농부, 쇠스랑·수확" },
  { classId: "class_elder", chip: "people1-6", name: "촌장", role: "지원", body: "humanoid", batch: "p1", concept: "대머리 노인, 지혜·부활" },
  { classId: "class_grandma", chip: "people1-7", name: "할머니", role: "회복", body: "humanoid", batch: "p1", concept: "주황 옷 할머니, 약초·민간요법" },
  { classId: "class_gunslinger", chip: "people2-0", name: "건슬링어", role: "원거리", body: "humanoid", batch: "p1", concept: "중절모 건슬링어, 속사" },
  { classId: "class_butler", chip: "people2-1", name: "집사", role: "민첩", body: "humanoid", batch: "p1", concept: "은발 집사, 암기·차 대접(회복)" },
  { classId: "class_priest_monk", chip: "people2-2", name: "승려", role: "회복", body: "humanoid", batch: "p1", concept: "주황 승복 승려, 염불·금강" },
  { classId: "class_gypsy", chip: "people2-3", name: "방랑 점술사", role: "마법", body: "humanoid", batch: "p2", concept: "갈색 피부 점술사, 카드·저주" },
  { classId: "class_sword_dancer", chip: "people2-4", name: "검무사", role: "물리", body: "humanoid", batch: "p2", concept: "검은 머리 검무사, 쌍검 춤" },
  { classId: "class_gambler", chip: "people2-5", name: "도박사", role: "운", body: "humanoid", batch: "p2", concept: "토끼 귀 도박사, 주사위·슬롯" },
  { classId: "class_seraph", chip: "people2-6", name: "천사", role: "회복", body: "humanoid", batch: "p2", concept: "날개 달린 천사, 성광·부활" },
  { classId: "class_fairy", chip: "people2-7", name: "요정", role: "마법", body: "humanoid", batch: "p2", concept: "초록 요정, 빛가루·속박" },
  { classId: "class_king", chip: "people3-0", name: "국왕", role: "지휘", body: "humanoid", batch: "p2", concept: "왕관·망토 국왕, 왕명(아군 강화)" },
  { classId: "class_merchant", chip: "people3-1", name: "상인", role: "운", body: "humanoid", batch: "p2", concept: "터번 상인, 돈 던지기·흥정" },
  { classId: "class_noble", chip: "people3-2", name: "귀족", role: "지원", body: "humanoid", batch: "p2", concept: "주황 머리 귀족 청년, 결투·명령" },
  { classId: "class_princess", chip: "people3-3", name: "공주", role: "회복", body: "humanoid", batch: "p3", concept: "금발 공주, 기도·축복의 노래" },
  { classId: "class_archmage", chip: "people3-4", name: "대마법사", role: "마법", body: "humanoid", batch: "p3", concept: "흰 수염 대마법사, 고위 원소 마법" },
  { classId: "class_heavy_knight", chip: "people3-5", name: "중갑병", role: "탱커", body: "humanoid", batch: "p3", concept: "은갑 중갑병, 방패 돌격" },
  { classId: "class_mercenary", chip: "people3-6", name: "용병", role: "물리", body: "humanoid", batch: "p3", concept: "수염 용병, 도끼·전장 경험" },
  { classId: "class_dragoon", chip: "people3-7", name: "용기사", role: "물리", body: "humanoid", batch: "p3", concept: "푸른 투구 용기사, 점프 창" },
  { classId: "class_villager", chip: "people4-0", name: "마을 청년", role: "물리", body: "humanoid", batch: "p3", concept: "회색 머리 청년, 몽둥이·투석" },
  { classId: "class_tribal", chip: "people4-1", name: "부족 전사", role: "물리", body: "humanoid", batch: "p3", concept: "갈색 피부 부족 전사, 부메랑·함성" },
  { classId: "class_fortune_teller", chip: "people4-2", name: "점성술사", role: "마법", body: "humanoid", batch: "p3", concept: "두건 점성술사, 별점·운석" },
  { classId: "class_sailor", chip: "people4-3", name: "뱃사람", role: "물리", body: "humanoid", batch: "p4", concept: "두건 뱃사람, 닻·물대포" },
  { classId: "class_monk_elder", chip: "people4-4", name: "노승", role: "회복", body: "humanoid", batch: "p4", concept: "대머리 노승, 선정·기도" },
  { classId: "class_noblewoman", chip: "people4-5", name: "귀부인", role: "지원", body: "humanoid", batch: "p4", concept: "금색 드레스 귀부인, 부채·매혹" },
  { classId: "class_nomad", chip: "people4-6", name: "유목민", role: "원거리", body: "humanoid", batch: "p4", concept: "두건 유목민, 투창·모래바람" },
  { classId: "class_nun", chip: "people4-7", name: "수녀", role: "회복", body: "humanoid", batch: "p4", concept: "보라 수녀복, 성가·정화" },
  { classId: "class_jester", chip: "people5-0", name: "광대", role: "운", body: "humanoid", batch: "p4", concept: "광대 모자, 저글링·속임수" },
  { classId: "class_girl_alchemist", chip: "people5-1", name: "꼬마 발명가", role: "지원", body: "humanoid", batch: "p4", concept: "양갈래 소녀, 태엽 장치·폭죽" },
  { classId: "class_ronin", chip: "people5-2", name: "낭인", role: "물리", body: "humanoid", batch: "p4", concept: "붉은 머리 낭인, 거합·혈도" },
  { classId: "class_shrine_maiden", chip: "people5-3", name: "무녀", role: "회복", body: "humanoid", batch: "p5", concept: "무녀복, 부적·결계" },
  { classId: "class_desert_warrior", chip: "people5-4", name: "사막 전사", role: "물리", body: "humanoid", batch: "p5", concept: "금발 사막 전사, 곡도·모래" },
  { classId: "class_maid", chip: "people5-5", name: "메이드", role: "민첩", body: "humanoid", batch: "p5", concept: "메이드, 청소 도구 난무·차" },
  { classId: "class_hermit", chip: "people5-6", name: "은자", role: "마법", body: "humanoid", batch: "p5", concept: "수염 은자, 자연 마법·명상" },
  { classId: "class_old_warrior", chip: "people5-7", name: "노병", role: "탱커", body: "humanoid", batch: "p5", concept: "초록 옷 노병, 노련한 방어" },
  { classId: "class_dog", chip: "animal-0", name: "충견", role: "물리", body: "beast", batch: "b1", concept: "노란 개, 물기·짖기·충성" },
  { classId: "class_cat", chip: "animal-1", name: "고양이", role: "민첩", body: "beast", batch: "b1", concept: "갈색 고양이, 할퀴기·회피" },
  { classId: "class_rooster", chip: "animal-2", name: "수탉", role: "민첩", body: "beast", batch: "b1", concept: "수탉, 쪼기·새벽 울음(기상)" },
  { classId: "class_sheep", chip: "animal-3", name: "양", role: "탱커", body: "beast", batch: "b1", concept: "양, 털 방어·잠재우기" },
  { classId: "class_cow", chip: "animal-4", name: "젖소", role: "회복", body: "beast", batch: "b1", concept: "젖소, 우유(회복)·들이받기" },
  { classId: "class_horse", chip: "animal-5", name: "군마", role: "물리", body: "beast", batch: "b1", concept: "말, 돌진·뒷발차기" },
  { classId: "class_tiger", chip: "animal-6", name: "호랑이", role: "물리", body: "beast", batch: "b1", concept: "호랑이, 맹공·포효" },
  { classId: "class_lion", chip: "animal-7", name: "사자", role: "물리", body: "beast", batch: "b1", concept: "사자, 왕의 포효·갈기 돌격" },
  { classId: "class_skiff", chip: "vehicles-0", name: "쪽배", role: "원거리", body: "vehicle", batch: "b2", concept: "작은 돛배, 작살·물살" },
  { classId: "class_galleon", chip: "vehicles-1", name: "범선", role: "원거리", body: "vehicle", batch: "b2", concept: "대형 범선, 함포 일제사격" },
  { classId: "class_gunboat", chip: "vehicles-2", name: "철갑선", role: "탱커", body: "vehicle", batch: "b2", concept: "철갑 군함, 장갑·포격" },
  { classId: "class_balloon", chip: "vehicles-3", name: "열기구", role: "지원", body: "vehicle", batch: "b2", concept: "열기구, 폭탄 투하·정찰" },
  { classId: "class_drill", chip: "vehicles-4", name: "굴착기", role: "물리", body: "vehicle", batch: "b2", concept: "드릴 기계, 관통 굴착" },
  { classId: "class_tank", chip: "vehicles-5", name: "전차", role: "탱커", body: "vehicle", batch: "b2", concept: "궤도 전차, 포격·장갑" },
  { classId: "class_airship", chip: "vehicles-6", name: "비공정", role: "원거리", body: "vehicle", batch: "b2", concept: "비공정, 폭격·기총" },
  { classId: "class_ufo", chip: "vehicles-7", name: "미확인 비행체", role: "마법", body: "vehicle", batch: "b2", concept: "UFO, 광선·납치 광선" },
  { classId: "class_slime_pal", chip: "monster1-0", name: "슬라임", role: "탱커", body: "monster", batch: "b3", concept: "초록 슬라임, 분열·흡수" },
  { classId: "class_demon", chip: "monster1-1", name: "붉은 악마", role: "마법", body: "monster", batch: "b3", concept: "붉은 악마, 지옥불·계약" },
  { classId: "class_ogre_kid", chip: "monster1-2", name: "꼬마 오거", role: "물리", body: "monster", batch: "b3", concept: "살색 꼬마 거인, 몽둥이" },
  { classId: "class_ghost_pal", chip: "monster1-3", name: "유령", role: "마법", body: "monster", batch: "b3", concept: "하얀 유령, 빙의·저주" },
  { classId: "class_skeleton_pal", chip: "monster1-4", name: "해골병", role: "물리", body: "monster", batch: "b3", concept: "해골, 뼈 던지기·재조립" },
  { classId: "class_zombie_pal", chip: "monster1-5", name: "좀비", role: "탱커", body: "monster", batch: "b3", concept: "푸른 옷 좀비, 물어뜯기·불사" },
  { classId: "class_reaper", chip: "monster1-6", name: "사신", role: "마법", body: "monster", batch: "b3", concept: "보라 망토 사신, 즉사 낫" },
  { classId: "class_minotaur_pal", chip: "monster1-7", name: "수인 전사", role: "물리", body: "monster", batch: "b3", concept: "뿔 수인 전사, 도끼" },
  { classId: "class_harpy_pal", chip: "monster2-0", name: "하피", role: "민첩", body: "monster", batch: "b4", concept: "초록 깃 하피, 깃털 폭풍" },
  { classId: "class_gargoyle_pal", chip: "monster2-1", name: "가고일", role: "탱커", body: "monster", batch: "b4", concept: "푸른 가고일, 석화·급강하" },
  { classId: "class_vampire", chip: "monster2-2", name: "흡혈귀", role: "마법", body: "monster", batch: "b4", concept: "은발 흡혈귀, 흡혈·박쥐 떼" },
  { classId: "class_demon_knight", chip: "monster2-3", name: "마기사", role: "물리", body: "monster", batch: "b4", concept: "붉은 갑옷 마기사, 마검" },
  { classId: "class_golem_pal", chip: "monster2-4", name: "흙 골렘", role: "탱커", body: "monster", batch: "b4", concept: "흙 골렘, 대지 강타" },
  { classId: "class_dragonewt", chip: "monster2-5", name: "용인", role: "물리", body: "monster", batch: "b4", concept: "초록 용인, 브레스·꼬리" },
  { classId: "class_oni_warrior", chip: "monster2-6", name: "오니 무사", role: "물리", body: "monster", batch: "b4", concept: "붉은 오니 무사, 쌍도" },
  { classId: "class_dark_lord", chip: "monster2-7", name: "마족 공작", role: "마법", body: "monster", batch: "b4", concept: "보라 마족 귀족, 암흑 마법" },
  { classId: "class_siren", chip: "monster3-0", name: "세이렌", role: "마법", body: "monster", batch: "b5", concept: "붉은 머리 날개 여인, 노래·매혹" },
  { classId: "class_lamia", chip: "monster3-1", name: "라미아", role: "마법", body: "monster", batch: "b5", concept: "뱀 꼬리 여인, 휘감기·독" },
  { classId: "class_wraith_mage", chip: "monster3-2", name: "망령술사", role: "마법", body: "monster", batch: "b5", concept: "검은 두건 망령, 영혼 흡수" },
  { classId: "class_succubus", chip: "monster3-3", name: "서큐버스", role: "마법", body: "monster", batch: "b5", concept: "보라 머리 서큐버스, 매혹·흡정" },
  { classId: "class_mound", chip: "monster3-4", name: "개미귀신", role: "탱커", body: "monster", batch: "b5", concept: "흙더미 괴수, 모래 늪" },
  { classId: "class_red_dragon_pal", chip: "monster3-5", name: "새끼 화룡", role: "마법", body: "monster", batch: "b5", concept: "붉은 새끼 용, 화염 브레스" },
  { classId: "class_flame_spirit", chip: "monster3-6", name: "업화", role: "마법", body: "monster", batch: "b5", concept: "붉은 불꽃 덩어리, 폭염" },
  { classId: "class_demon_general", chip: "monster3-7", name: "마장군", role: "물리", body: "monster", batch: "b5", concept: "검은 갑옷 마장군, 암흑 대검" },
];

/** 묶음 설명(감독용). */
export const RETRO_ROSTER_BATCHES: Readonly<Record<string, string>> = {
  a1: "Actor 8(발키리~야수조련사)",
  a2: "Actor 8(해적~왕자 기사)",
  a3: "Actor 5 + People1 3",
  p1: "People 8",
  p2: "People 8",
  p3: "People 8",
  p4: "People 8",
  p5: "People 5",
  b1: "Animal 8",
  b2: "Vehicles 8",
  b3: "Monster1 8",
  b4: "Monster2 8",
  b5: "Monster3 8"
};

/** 사람형이 아닌 파티원의 9칸 시트 규격(묶음 파일이 채운다). */
export interface RetroPartyPixelSheet {
  readonly chip: string;
  readonly cell: 48 | 64;
  readonly motion: "hop" | "swoop" | "stomp" | "dash" | "float" | "shoot" | "breath";
  readonly idleFrameMs: number;
}

/** 묶음 파일 하나의 모양: 그 묶음 직업들의 스킬(직업당 8개, RetroClassSkill 계약 그대로)과 비인간형 시트 규격. */
export interface RetroRosterBatch {
  readonly skills: readonly RetroClassSkill[];
  readonly partyPixel?: readonly RetroPartyPixelSheet[];
}

export function retroRosterClass(classId: string | undefined): RetroRosterClass | undefined {
  return classId ? RETRO_ROSTER.find((row) => row.classId === classId) : undefined;
}

