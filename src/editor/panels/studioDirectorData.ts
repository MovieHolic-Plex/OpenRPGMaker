// 스튜디오 감독 보드 데이터 빌더 (장르 감지 · 스토리보드 비트 · 장르 시스템 · 6-Shot 오프닝)

import { listMapPlanningItems } from "@/editor/mapPlanningActions";
import { collectMapLinkGraph } from "@/project/mapLinkStats";
import type { Command, GameMap, MapId, Project } from "@/project/types";

export type StudioDirectorGenre = "monster-taming" | "classic-jrpg" | "romance";
export type StudioDirectorTab = "flow" | "system" | "cinema";

export interface DirectorBeat {
  readonly id: string;
  readonly stepLabel: string;
  readonly title: string;
  readonly mapId: MapId | null;
  readonly mapMeta: string;
  readonly backdropUrl: string;
  readonly summary: string;
  readonly castNames: readonly string[];
  readonly castSprites: readonly string[];
  readonly moodChips: readonly string[];
  readonly stageKind: "monster" | "jrpg" | "romance";
  readonly stageSpeaker: string;
  readonly stageLine: string;
  readonly stageSubtext: string;
  readonly stageSprites: {
    readonly leftUrl: string;
    readonly rightUrl: string;
    readonly bustUrl?: string;
    readonly leftLabel?: string;
    readonly rightLabel?: string;
  };
  readonly planningNotes: readonly string[];
  readonly defect: {
    readonly badge: string;
    readonly detail: string;
    readonly aiPrompt: string;
  } | null;
}

export interface GenreSystemEntry {
  readonly id: string;
  readonly badge: string;
  readonly title: string;
  readonly subtitle: string;
  readonly sprites: readonly { readonly url: string; readonly label: string }[];
  readonly metrics: readonly { readonly label: string; readonly value: string; readonly warn?: boolean }[];
  readonly defectPrompt?: string;
}

export interface GenreMatrixRow {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly detail: string;
  readonly statusLabel: string;
  readonly isWarn: boolean;
  readonly aiPrompt?: string;
}

export interface OpeningShotSpec {
  readonly step: string;
  readonly beatRole: string;
  readonly title: string;
  readonly durationLabel: string;
  readonly cameraLabel: string;
  readonly caption: string;
  readonly imageUrl: string;
}

export const GENRE_META: Readonly<Record<StudioDirectorGenre, {
  readonly label: string;
  readonly shortLabel: string;
  readonly badge: string;
  readonly systemTabLabel: string;
  readonly subtitle: string;
}>> = {
  "monster-taming": {
    label: "포켓몬 · 몬스터 수집",
    shortLabel: "몬스터 수집",
    badge: "monster-taming · gen1",
    systemTabLabel: "2. 스타터 · 진화 · 서식지 도감",
    subtitle: "연구소 스타터 선택 → 도로별 야생 서식지 → 체육관 배지 → 챔피언전 흐름과 3단계 진화·출현율을 조망합니다.",
  },
  "classic-jrpg": {
    label: "CT·FF6 정통 JRPG",
    shortLabel: "정통 JRPG",
    badge: "classic-jrpg · 4인 파티",
    systemTabLabel: "2. 동료 · 시대변형 · 보스 곡선",
    subtitle: "오프닝 축제 → 시대/폐허 변형 맵 → 4인 파티 영입·합동기([연계]) → 최종 보스까지 서사 결함과 전투 곡선을 점검합니다.",
  },
  romance: {
    label: "현대 연애 · 미연시",
    shortLabel: "연애 · 미연시",
    badge: "romance · dual-fullbody-veil",
    systemTabLabel: "2. 인물 · 호감도 · 멀티엔딩",
    subtitle: "캠퍼스 첫 만남 → 일상·데이트 선택지 → 히로인 5표정 스탠딩 & 호감도 분기 → 멀티엔딩 도달 가능성을 검증합니다.",
  },
};

export function detectDirectorGenre(project: Project): StudioDirectorGenre {
  const rawGenre = [
    project.gameDesignBrief?.interview?.genre,
    project.gameDesignBrief?.presetId,
    project.system.genre,
  ]
    .map((value) => (typeof value === "string" ? value : ""))
    .filter((value) => value.length > 0)
    .join(" ")
    .toLowerCase();

  if (
    /romance|dating|visual-novel|vn|school-romance|연애|미연시|학원|로맨스/.test(rawGenre)
    || Boolean(project.meta.oprnVnLook || project.meta.oprnVnExtras)
  ) {
    return "romance";
  }
  if (
    /monster|pokemon|creature|taming|몬스터|포켓몬|수집/.test(rawGenre)
    || project.system.battleModel === "gen1"
    || project.system.monsterCollection === true
    || project.system.monsterBattleParty === true
    || (project.database.monsterSpecies?.length ?? 0) > 0
  ) {
    return "monster-taming";
  }
  return "classic-jrpg";
}

function countCommandsByKind(commands: readonly Command[], targetKind: string): number {
  let count = 0;
  for (const cmd of commands) {
    if (cmd.kind === targetKind) count += 1;
    if (cmd.kind === "fork") {
      count += countCommandsByKind(cmd.then, targetKind);
      if (cmd.else) count += countCommandsByKind(cmd.else, targetKind);
    } else if (cmd.kind === "choices") {
      for (const branch of cmd.options) count += countCommandsByKind(branch.branch, targetKind);
    } else if (cmd.kind === "loop") {
      count += countCommandsByKind(cmd.body, targetKind);
    }
  }
  return count;
}

function countMapSwitchTouches(map: GameMap): number {
  let total = 0;
  for (const ev of map.events) {
    for (const page of ev.pages ?? []) {
      total += countCommandsByKind(page.commands, "changeSwitch");
      total += countCommandsByKind(page.commands, "changeVariable");
      total += countCommandsByKind(page.commands, "changeFriendship");
    }
  }
  return total;
}

function orderedProjectMaps(project: Project): GameMap[] {
  const all = Object.values(project.maps);
  if (all.length === 0) return [];
  const start = project.maps[project.startMapId] ?? all[0];
  if (!start) return all;
  return [start, ...all.filter((m) => m.id !== start.id)];
}

export function buildBeatsForGenre(project: Project, genre: StudioDirectorGenre): DirectorBeat[] {
  const maps = orderedProjectMaps(project);
  const isolated = collectMapLinkGraph(project).find((node) => !node.isStart && !node.reachableFromStart);
  const unlinkedName = isolated ? (project.maps[isolated.mapId]?.name || isolated.mapId) : "";
  const m1 = maps[0] ?? null;
  const m2 = maps[1] ?? m1;
  const m3 = maps[2] ?? m2;
  const mapNotes = (map: GameMap | null, fallback: readonly string[]): readonly string[] => {
    if (!map) return fallback;
    const active = listMapPlanningItems(map.id).filter((i) => i.status === "active").map((i) => i.text);
    return active.length > 0 ? active : fallback;
  };

  if (genre === "monster-taming") {
    const speciesCount = project.database.monsterSpecies?.length ?? 0;
    const m2EncounterZero = !m2 || ((m2.encounterRate ?? 0) === 0 && (m2.encounterTable?.length ?? 0) === 0 && (m2.fieldSpawns?.length ?? 0) === 0);
    return [
      {
        id: "beat-0-lab",
        stepLabel: "BEAT 0 · 스타터 선택",
        title: m1 ? `${m1.name || m1.id} (박사 연구소)` : "태초마을 박사 연구소",
        mapId: m1?.id ?? null,
        mapMeta: m1 ? `${m1.width}×${m1.height} · 이벤트 ${m1.events.length}개` : "20×16 · 스타터 3종",
        backdropUrl: "/assets/monster-kit/references/monster-rooms/lab.png",
        summary: "책상 위 몬스터볼 3개(풀·불·물) 중 파트너를 고르고 라이벌과 첫 배틀을 치릅니다.",
        castNames: ["오박사", "라이벌 그린", "풀잎몽 Lv.5"],
        castSprites: ["/assets/monster-expedition/creatures/spriglet-front.png", "/assets/monster-expedition/creatures/zaptoe-front.png"],
        moodChips: ["BGM: 연구소 테마", "전투: gen1 1:1", `도감 등록: ${Math.max(speciesCount, 3)}종`],
        stageKind: "monster",
        stageSpeaker: "오박사",
        stageLine: "「책상 위의 세 몬스터볼 중 네 첫 파트너를 골라 보렴! 풀·불·물 중 누구와 함께하겠니?」",
        stageSubtext: "스타터 선택 즉시 파티 슬롯 1번에 Lv.5 개체가 합류하며 도감(Pokedex)이 해금됩니다.",
        stageSprites: {
          leftUrl: "/assets/monster-expedition/creatures/spriglet-back.png",
          rightUrl: "/assets/monster-expedition/creatures/zaptoe-front.png",
          leftLabel: "풀잎몽 Lv.5 (내 파트너)",
          rightLabel: "번개발 Lv.5 (라이벌)",
        },
        planningNotes: mapNotes(m1, ["스타터 3종(풀잎몽·불꽃방울·물방울링) 선택 스위치 분기", "연구소 출구 앞 라이벌 첫 배틀 트리거"]),
        defect: null,
      },
      {
        id: "beat-1-route",
        stepLabel: "BEAT 1 · 야생 포획 & 진화",
        title: m2 ? `${m2.name || m2.id} (야생 서식지)` : "1번 도로 · 신록 수풀길",
        mapId: m2?.id ?? null,
        mapMeta: m2 ? `${m2.width}×${m2.height} · 출현율 ${m2.encounterRate ?? 0}%` : "40×24 · 야생 수풀",
        backdropUrl: "/assets/monster-kit/references/monster-overworld/route.png",
        summary: "풀숲 타일 진입 시 야생 몬스터가 출현하며, 몬스터볼 포획 튜토리얼과 Lv.16 1차 진화가 이어집니다.",
        castNames: ["풀잎몽 → 덩굴등(Lv.16)", "야생 꼬마버섯", "포획 교관"],
        castSprites: ["/assets/monster-expedition/creatures/podback-front.png", "/assets/monster-expedition/creatures/marshcrown-front.png"],
        moodChips: ["BGM: 경쾌한 도로", "수풀 인카운터", "Lv.16 1차 진화"],
        stageKind: "monster",
        stageSpeaker: "야생 덩굴등 (Lv.14)",
        stageLine: "「풀숲에서 야생 덩굴등이 튀어나왔다! 체력을 깎고 몬스터볼을 던져 도감을 채우자!」",
        stageSubtext: m2EncounterZero ? "⚠ 현재 이 도로 맵의 야생 출현 테이블(encounterTable)이 비어 있어 풀숲을 걸어도 전투가 발생하지 않습니다." : "풀숲 인카운터와 트레이너 시야 배틀이 정상 연결되어 있습니다.",
        stageSprites: {
          leftUrl: "/assets/monster-expedition/creatures/spriglet-back.png",
          rightUrl: "/assets/monster-expedition/creatures/podback-front.png",
          leftLabel: "풀잎몽 Lv.15 (HP 42/42)",
          rightLabel: "야생 덩굴등 Lv.14 (포획 가능)",
        },
        planningNotes: mapNotes(m2, ["풀숲 타일 야생 출현 3종 (풀잎몽·번개발·바위게) 배정", "상처약 & 몬스터볼 5개 지급 NPC 배치"]),
        defect: m2EncounterZero ? {
          badge: "야생 출현 0종",
          detail: `${m2?.name || "도로 맵"}의 수풀 타일은 깔려 있으나 야생 출현 테이블(encounterTable)이 0종입니다.`,
          aiPrompt: `${m2?.name || "현재 도로 맵"}에 Lv.4~7 야생 몬스터 3종 출현 테이블(encounterRate 12%)과 포획 튜토리얼 NPC를 추가해 줘.`,
        } : null,
      },
      {
        id: "beat-2-gym",
        stepLabel: "BEAT 2 · 체육관 관장전",
        title: m3 ? `${m3.name || m3.id} (체육관)` : "회색시티 바위 체육관",
        mapId: m3?.id ?? m1?.id ?? null,
        mapMeta: m3 ? `${m3.width}×${m3.height} · 배지 관문` : "24×28 · 제1배지 관문",
        backdropUrl: "/assets/monster-kit/references/monster-overworld/room-gymrock.png",
        summary: "체육관 퍼즐을 돌파하고 관장의 에이스 몬스터를 꺾어 첫 배지와 비전기술(풀베기) 권한을 얻습니다.",
        castNames: ["관장 테오", "늪지왕 Lv.36", "심판 가이드"],
        castSprites: ["/assets/monster-expedition/creatures/marshcrown-front.png", "/assets/monster-expedition/creatures/galecrest-front.png"],
        moodChips: ["BGM: 체육관 결전", "보상: 제1배지 + 기술머신", "Lv.36 최종 진화"],
        stageKind: "monster",
        stageSpeaker: "체육관 관장 테오",
        stageLine: "「내 에이스 『늪지왕』의 대지진과 잎날가르기를 버텨낼 수 있겠느냐! 승부다!」",
        stageSubtext: "승리 시 제1배지 스위치 ON + 기술머신 지급 + 다음 도로 바리케이드가 해제됩니다.",
        stageSprites: {
          leftUrl: "/assets/monster-expedition/creatures/podback-back.png",
          rightUrl: "/assets/monster-expedition/creatures/marshcrown-front.png",
          leftLabel: "덩굴등 Lv.24 (내 에이스)",
          rightLabel: "관장의 늪지왕 Lv.28",
        },
        planningNotes: mapNotes(m3, ["관장전 승리 시 배지 #1 수여 및 2번 도로 통행 해금", "체육관 입구 조언자 NPC 배치"]),
        defect: null,
      },
      {
        id: "beat-3-league",
        stepLabel: "BEAT 3 · 사천왕 & 전당 등록",
        title: "석영리그 챔피언전 · 전당 등록",
        mapId: m3?.id ?? m1?.id ?? null,
        mapMeta: `엔딩 ${project.endings?.length ?? 1}개 · 명예의 전당`,
        backdropUrl: "/assets/monster-kit/references/monster-rooms/league_champ.png",
        summary: "사천왕 연전을 돌파하고 숙명의 라이벌 챔피언을 꺾어 파트너 6마리와 함께 명예의 전당에 이름을 올립니다.",
        castNames: ["챔피언 그린", "늪지왕 Lv.55", "명예의 전당 기록관"],
        castSprites: ["/assets/monster-expedition/creatures/marshcrown-front.png", "/assets/monster-expedition/creatures/furnscale-front.png"],
        moodChips: ["BGM: 최종 챔피언 결전", "명예의 전당 컷신", "2회차 전설 해금"],
        stageKind: "monster",
        stageSpeaker: "챔피언 그린",
        stageLine: "「정상에 먼저 도착해 기다리고 있었다! 우리 몬스터들의 모든 유대를 걸고 마지막 승부를 내자!」",
        stageSubtext: "승리 시 파티 몬스터 전원의 스프라이트와 레벨이 엔딩 크레딧에 기록됩니다.",
        stageSprites: {
          leftUrl: "/assets/monster-expedition/creatures/marshcrown-back.png",
          rightUrl: "/assets/monster-expedition/creatures/furnscale-front.png",
          leftLabel: "늪지왕 Lv.54 (내 파트너)",
          rightLabel: "화염비늘 Lv.56 (챔피언 에이스)",
        },
        planningNotes: ["사천왕 4연전 후 회복 없이 라이벌 챔피언 결전 진입", "엔딩 후 전설의 동굴 워프 게이트 개방"],
        defect: null,
      },
    ];
  }

  if (genre === "romance") {
    const endingCount = project.endings?.length ?? 0;
    return [
      {
        id: "beat-0-campus",
        stepLabel: "BEAT 0 · 봄날 첫 만남",
        title: m1 ? `${m1.name || m1.id} (캠퍼스 정문)` : "벚꽃 학원 정문 · 등교길",
        mapId: m1?.id ?? null,
        mapMeta: m1 ? `${m1.width}×${m1.height} · 이벤트 ${m1.events.length}개` : "24×18 · 첫 만남 컷신",
        backdropUrl: "/assets/region-references/jp-city-school-1f.png",
        summary: "개학 첫날 벚꽃이 흩날리는 교문 앞에서 서연과 부딪히며 떨어진 악보 노트를 주워 주는 프롤로그입니다.",
        castNames: ["한서연 (음악부)", "도윤 (주인공)", "학생회장 유진"],
        castSprites: ["/assets/shared/portraits/modern-uni-girl-sailor/full-happy.png", "/assets/shared/portraits/pink-hat/full-smile.png"],
        moodChips: ["BGM: 봄바람 피아노", "연출: dual-fullbody-veil", "호감도 변수 #01 초기화"],
        stageKind: "romance",
        stageSpeaker: "한서연",
        stageLine: "「아, 고마워! 바람에 날아간 피아노 악보를 찾아 줄 줄은 몰랐어… 혹시 너도 2학년 신입생이니?」",
        stageSubtext: "첫 대면 선택지에 따라 서연 호감도(#01)가 +10 또는 +5로 시작하며 음악실 방과후 플래그가 켜집니다.",
        stageSprites: {
          leftUrl: "/assets/shared/portraits/modern-uni-girl-sailor/full-happy.png",
          rightUrl: "/assets/shared/portraits/pink-hat/full-smile.png",
          bustUrl: "/assets/shared/portraits/modern-uni-girl-sailor/bust-happy.png",
          leftLabel: "한서연 · 미소 (Full-happy)",
          rightLabel: "최유진 · 기본 (Full-smile)",
        },
        planningNotes: mapNotes(m1, ["교문 앞 악보 줍기 3지선다 선택지 (서연 호감도 +10)", "듀얼 스탠딩 + 좌하단 클로즈업(dual-fullbody-veil) 프리셋 적용"]),
        defect: null,
      },
      {
        id: "beat-1-cafe",
        stepLabel: "BEAT 1 · 방과후 데이트 분기",
        title: m2 ? `${m2.name || m2.id} (방과후 거점)` : "도서관 & 역전 로스터리 카페",
        mapId: m2?.id ?? null,
        mapMeta: m2 ? `${m2.width}×${m2.height} · 상태 변경 ${countMapSwitchTouches(m2)}건` : "20×16 · 방과후 자유행동",
        backdropUrl: "/assets/region-references/jp-city-kissaten.png",
        summary: "방과후 누구와 시간을 보낼지 선택하는 자유행동 페이즈입니다. 장소 선택에 따라 각 히로인의 전용 에피소드가 열립니다.",
        castNames: ["한서연 (카페 데이트)", "최유진 (도서관 야간자습)"],
        castSprites: ["/assets/shared/portraits/modern-uni-girl-sailor/full-embarrassed.png", "/assets/shared/portraits/pink-hat/full-surprised.png"],
        moodChips: ["BGM: 로파이 오후 카페", "시간대: 황혼(Sunset)", "선택지 호감도 +15"],
        stageKind: "romance",
        stageSpeaker: "한서연",
        stageLine: "「단둘이 카페에 오니까 조금 떨리네… 네가 골라 준 비엔나 커피, 생각보다 훨씬 달콤하다.」",
        stageSubtext: "수줍음(Full-shy) 스탠딩 전환 + 좌하단 홍조 버스트가 동기화되며 데이트 스위치 #12가 기록됩니다.",
        stageSprites: {
          leftUrl: "/assets/shared/portraits/modern-uni-girl-sailor/full-embarrassed.png",
          rightUrl: "/assets/shared/portraits/pink-hat/full-annoyed.png",
          bustUrl: "/assets/shared/portraits/modern-uni-girl-sailor/bust-embarrassed.png",
          leftLabel: "한서연 · 수줍음 (호감도 45)",
          rightLabel: "최유진 · 질투 (호감도 30)",
        },
        planningNotes: mapNotes(m2, ["카페 창가석 이벤트에 수줍음(shy) → 미소(happy) 표정 변화 연결", "비 오는 날 우산 함께 쓰기 서브 이벤트 추가"]),
        defect: null,
      },
      {
        id: "beat-2-festival",
        stepLabel: "BEAT 2 · 학원제 갈등 & 화해",
        title: m3 ? `${m3.name || m3.id} (야간 캠퍼스)` : "별빛 학원제 옥상 · 야경",
        mapId: m3?.id ?? m1?.id ?? null,
        mapMeta: "26×20 · 감정 클라이맥스",
        backdropUrl: "/assets/region-references/wz-post-example-street.png",
        summary: "학원제 공연 직전 엇갈린 오해를 풀기 위해 야간 옥상으로 달려가는 감정 클라이맥스 장면입니다.",
        castNames: ["한서연 (눈물 → 미소)", "최유진 (진심 고백)"],
        castSprites: ["/assets/shared/portraits/modern-uni-girl-sailor/full-sad.png", "/assets/shared/portraits/pink-hat/full-determined.png"],
        moodChips: ["BGM: 밤하늘 녹턴", "연출: 빗소리 + 화면 틴트", "핵심 분기점"],
        stageKind: "romance",
        stageSpeaker: "한서연",
        stageLine: "「네가 공연장에 안 올 줄 알고 얼마나 걱정했는지 알아…? 이렇게 달려와 줘서 정말 고마워.」",
        stageSubtext: "슬픔(Full-sad)에서 안도 미소(Full-happy)로 페이드되며 진엔딩 진입 조건 스위치가 판정됩니다.",
        stageSprites: {
          leftUrl: "/assets/shared/portraits/modern-uni-girl-sailor/full-sad.png",
          rightUrl: "/assets/shared/portraits/modern-uni-girl-sailor/full-happy.png",
          bustUrl: "/assets/shared/portraits/modern-uni-girl-sailor/bust-sad.png",
          leftLabel: "갈등 직후 (Full-sad)",
          rightLabel: "화해 후 (Full-happy)",
        },
        planningNotes: mapNotes(m3, ["옥상 문 잠김 해제 조건: 음악실 열쇠 아이템 소지", "서연 루트 / 유진 루트 최종 확정 선택지"]),
        defect: {
          badge: "Dead Ending 감지",
          detail: "『서연 진엔딩』 조건은 호감도 60 이상이나, 현재 모든 맵의 선택지 최대 합산치는 45(최대 -15 부족)입니다.",
          aiPrompt: "서연 진엔딩(호감도 60 이상)에 도달할 수 있도록 방과후 카페와 학원제 옥상 이벤트에 서연 호감도 +15 선택지 에피소드를 추가해 줘.",
        },
      },
      {
        id: "beat-3-confession",
        stepLabel: "BEAT 3 · 고백 & 멀티엔딩",
        title: `졸업식 벚꽃나무 아래 (멀티엔딩 ${Math.max(endingCount, 3)}종)`,
        mapId: m1?.id ?? null,
        mapMeta: "엔딩 3분기 · 트루 / 굿 / 노멀",
        backdropUrl: "/assets/monster-expedition/opening/starlight-prologue.png",
        summary: "누적된 호감도와 핵심 약속 플래그에 따라 서연 트루엔딩, 유진 트루엔딩, 또는 우정 노멀엔딩으로 분기합니다.",
        castNames: ["서연 트루엔딩", "유진 트루엔딩", "졸업 우정 엔딩"],
        castSprites: ["/assets/shared/portraits/modern-uni-girl-sailor/full-happy.png", "/assets/shared/portraits/pink-hat/full-happy.png"],
        moodChips: ["BGM: 졸업 오르골", "CG 갤러리 해금", "엔딩 크레딧 롤"],
        stageKind: "romance",
        stageSpeaker: "한서연",
        stageLine: "「그날 교문에서 네가 악보를 주워 준 순간부터, 내 모든 계절은 너를 향해 있었어. 좋아해.」",
        stageSubtext: "트루엔딩 달성 시 타이틀 화면의 『엔딩 목록 & CG 갤러리(oprnVnExtras)』에 전용 일러스트가 해금됩니다.",
        stageSprites: {
          leftUrl: "/assets/shared/portraits/modern-uni-girl-sailor/full-happy.png",
          rightUrl: "/assets/shared/portraits/pink-hat/full-happy.png",
          bustUrl: "/assets/shared/portraits/modern-uni-girl-sailor/bust-happy.png",
          leftLabel: "서연 트루엔딩 (호감도 ≥60)",
          rightLabel: "유진 트루엔딩 (호감도 ≥50)",
        },
        planningNotes: ["트루엔딩 조건 미달 시 우정 노멀엔딩으로 안전 폴백", "엔딩 후 타이틀 갤러리 잠금 해제 연동"],
        defect: null,
      },
    ];
  }

  return [
    {
      id: "beat-0-opening",
      stepLabel: "BEAT 0 · 오프닝 & 왕국 광장",
      title: m1 ? `${m1.name || m1.id} (시작 거점)` : "왕국 천년제 광장 · 시계탑",
      mapId: m1?.id ?? null,
      mapMeta: m1 ? `${m1.width}×${m1.height} · 이벤트 ${m1.events.length}개` : "32×24 · 축제 프롤로그",
      backdropUrl: "/assets/generated/opening/kingdom-day.png",
      summary: "천년제 종소리가 울리는 왕국 광장에서 주인공 일행이 신비한 펜던트 공명과 함께 첫 모험에 휘말립니다.",
      castNames: ["크로노 (검사)", "마루 (백마도사)", "루카 (발명가)"],
      castSprites: ["/assets/generated/charset-battlers/silver-swordswoman.png", "/assets/shared/portraits/purple-mage/full-smile.png"],
      moodChips: ["BGM: 천년제 팡파레", "파티: 초기 2인 합류", "6-Shot 오프닝 직결"],
      stageKind: "jrpg",
      stageSpeaker: "왕실 기사단장",
      stageLine: "「광장 북쪽 시계탑에서 고대 전이문이 공명하기 시작했다! 검과 마법 장비를 갖추고 즉시 조사하라!」",
      stageSubtext: "4인 파티 JRPG HUD(HP/MP)와 필드 대화가 표시되며 북쪽 출구 워프가 활성화됩니다.",
      stageSprites: {
        leftUrl: "/assets/generated/charset-battlers/silver-swordswoman.png",
        rightUrl: "/assets/shared/portraits/purple-mage/full-smile.png",
        leftLabel: "아리아 Lv.12 (HP 280/280)",
        rightLabel: "세리아 Lv.11 (MP 95/95)",
      },
      planningNotes: mapNotes(m1, ["시계탑 광장 중앙에서 펜던트 반짝임 연출 후 파티 합류", "여관·무기점 초기 장비 점검 이벤트"]),
      defect: null,
    },
    {
      id: "beat-1-ruins",
      stepLabel: "BEAT 1 · 시대 변형 & 폐허 탐색",
      title: m2 ? `${m2.name || m2.id} (변형 던전)` : "안개 숲 & 고대 시계탑 폐허",
      mapId: m2?.id ?? null,
      mapMeta: m2 ? `${m2.width}×${m2.height} · 이벤트 ${m2.events.length}개` : "40×30 · 시대 변형 맵 쌍",
      backdropUrl: "/assets/region-references/wz-nat-example-forest-edge.png",
      summary: "현재의 평화로운 숲과 재앙 이후의 폐허 맵을 오가며 봉인된 기교병 동료를 깨우고 시간의 균열을 추적합니다.",
      castNames: ["아리아 (검사)", "세리아 (마도사)", "로보 (기교병 합류)"],
      castSprites: ["/assets/generated/charset-battlers/silver-swordswoman.png", "/assets/shared/portraits/blue-traveler/full-determined.png"],
      moodChips: ["BGM: 폐허의 바람", "기능: 시대 변형 맵(derive_map_variant)", "합동기: [연계] 화염회전베기"],
      stageKind: "jrpg",
      stageSpeaker: "기교병 로보",
      stageLine: "「시스템 재기동 완료… 400년 동안 이 폐허에서 당신들을 기다리고 있었습니다. 파티에 합류하겠습니다.」",
      stageSubtext: unlinkedName ? `⚠ 맵 그래프 진단: 『${unlinkedName}』 맵으로 들어오는 이동 이벤트(transferPlayer)가 0개라 플레이어가 도달할 수 없습니다.` : "시대 변형 맵 간 워프 게이트와 기교병 합류 이벤트가 연결되어 있습니다.",
      stageSprites: {
        leftUrl: "/assets/generated/charset-battlers/silver-swordswoman.png",
        rightUrl: "/assets/shared/portraits/blue-traveler/full-determined.png",
        leftLabel: "아리아 · 화염검",
        rightLabel: "카이 · [연계] 회전베기",
      },
      planningNotes: mapNotes(m2, ["과거/폐허 맵 쌍(derive_map_variant) 전이 게이트 양방향 연결", "기교병 동료 합류 시 2인 연계기 『화염회전베기』 해금"]),
      defect: {
        badge: unlinkedName ? `고립 맵 (${unlinkedName})` : "시대 변형 전이 누락",
        detail: unlinkedName ? `『${unlinkedName}』 맵으로 들어오는 이동 이벤트(transferPlayer)가 없어 동료 영입 이벤트에 도달할 수 없습니다.` : "고대 폐허 변형 맵에서 기교병 동료를 영입하는 스위치와 복귀 포털이 아직 양방향으로 연결되지 않았습니다.",
        aiPrompt: unlinkedName ? `${m1?.name || "시작 맵"}에서 고립된 『${unlinkedName}』 맵으로 이어지는 양방향 이동 문(transferPlayer)과 동료 영입 이벤트를 연결해 줘.` : `${m2?.name || "폐허 던전"}에 시대 변형 복귀 포털과 3번째 동료 합류 및 [연계] 합동기 해금 이벤트를 만들어 줘.`,
      },
    },
    {
      id: "beat-2-boss",
      stepLabel: "BEAT 2 · 마도성 중보스 결전",
      title: m3 ? `${m3.name || m3.id} (결전 관문)` : "부유성 첨탑 · 마장기 결전",
      mapId: m3?.id ?? m1?.id ?? null,
      mapMeta: m3 ? `${m3.width}×${m3.height} · 보스 인카운터` : "28×32 · 중보스 투기장",
      backdropUrl: "/assets/region-references/wz-space-clocktower.png",
      summary: "시계탑 최상층에서 마장기 수호자와 격돌합니다. 코어 부위가 열릴 때 [연계] 합동기로 약점을 공략해야 합니다.",
      castNames: ["4인 완전체 파티", "보스: 심연 마장기"],
      castSprites: ["/assets/generated/charset-battlers/silver-swordswoman.png", "/assets/shared/portraits/purple-mage/full-determined.png"],
      moodChips: ["BGM: 강적과의 격돌", "전투: 4인 ATB/턴제", "보스 패턴: 코어 개방 카운터"],
      stageKind: "jrpg",
      stageSpeaker: "세리아",
      stageLine: "「마장기의 마력 코어가 열렸어! 지금이야, 아리아와 함께 [연계] 『빙결십자참』으로 단숨에 꿰뚫자!」",
      stageSubtext: "보스 체력 50% 이하에서 대사 컷신이 삽입되며 승리 시 비공정(월드맵 이동)이 해금됩니다.",
      stageSprites: {
        leftUrl: "/assets/generated/charset-battlers/silver-swordswoman.png",
        rightUrl: "/assets/shared/portraits/purple-mage/full-determined.png",
        leftLabel: "전열: 아리아 · 카이",
        rightLabel: "후열: 세리아 · 로보",
      },
      planningNotes: mapNotes(m3, ["보스전 직전 세이브 포인트 & 회복의 샘 배치", "승리 후 비공정 조종석 해금 컷신 재생"]),
      defect: null,
    },
    {
      id: "beat-3-finale",
      stepLabel: "BEAT 3 · 심연 성채 & 다중 결말",
      title: "시간의 끝 · 심연 성채 최종 결전",
      mapId: m3?.id ?? m1?.id ?? null,
      mapMeta: `엔딩 ${Math.max(project.endings?.length ?? 0, 3)}분기 · 최종장`,
      backdropUrl: "/assets/generated/opening/dark-citadel.png",
      summary: "어느 시점에서 최종 보스에게 도전했는지와 동료 전원 생존 여부에 따라 왕국 구원 트루엔딩과 시대별 멀티엔딩으로 갈립니다.",
      castNames: ["파티 전원 (4인)", "최종 보스: 영원의 포식자"],
      castSprites: ["/assets/generated/charset-battlers/silver-swordswoman.png", "/assets/shared/portraits/blue-traveler/full-smile.png"],
      moodChips: ["BGM: 마지막 날개", "연출: 3페이즈 보스전", "멀티엔딩 에필로그"],
      stageKind: "jrpg",
      stageSpeaker: "아리아",
      stageLine: "「과거도 미래도 우리가 직접 지켜냈어! 마지막 일격으로 시간의 사슬을 끊어내자!」",
      stageSubtext: "최종 보스 격파 시 생존 동료별 에필로그 컷신이 순차 재생된 뒤 엔딩 크레딧으로 이어집니다.",
      stageSprites: {
        leftUrl: "/assets/generated/charset-battlers/silver-swordswoman.png",
        rightUrl: "/assets/shared/portraits/blue-traveler/full-smile.png",
        leftLabel: "아리아 Lv.45 (최종 결전)",
        rightLabel: "동료 전원 집결 완료",
      },
      planningNotes: ["동료 4인 전원 합류 시 진엔딩 『천년의 새벽』 분기", "조기 보스 격파 시 숨겨진 개발실 엔딩 해금"],
      defect: null,
    },
  ];
}

export function buildSystemEntries(project: Project, genre: StudioDirectorGenre): {
  readonly cards: readonly GenreSystemEntry[];
  readonly matrixTitle: string;
  readonly matrixRows: readonly GenreMatrixRow[];
} {
  const maps = orderedProjectMaps(project);
  if (genre === "monster-taming") {
    const cards: GenreSystemEntry[] = [
      {
        id: "evo-grass",
        badge: "풀 스타터 · 3단계 진화선",
        title: "풀잎몽 → 덩굴등(Lv.16) → 늪지왕(Lv.36)",
        subtitle: "박사 연구소 1번 볼 · 특성: 심록 · 전용기: 대지의잎날",
        sprites: [
          { url: "/assets/monster-expedition/creatures/spriglet-front.png", label: "Lv.5 풀잎몽" },
          { url: "/assets/monster-expedition/creatures/podback-front.png", label: "Lv.16 덩굴등" },
          { url: "/assets/monster-expedition/creatures/marshcrown-front.png", label: "Lv.36 늪지왕" },
        ],
        metrics: [
          { label: "종족값 총합", value: "318 → 405 → 530" },
          { label: "전후면 배틀 도트", value: "front/back 6장 완비" },
        ],
      },
      {
        id: "evo-electric",
        badge: "전기/비행 · 초반 주력 진화선",
        title: "번개발 → 바람벼슬(Lv.18) → 폭풍관(Lv.34)",
        subtitle: "1번 도로 야생 포획 · 특성: 축전 · 전용기: 천둥강하",
        sprites: [
          { url: "/assets/monster-expedition/creatures/zaptoe-front.png", label: "Lv.4 번개발" },
          { url: "/assets/monster-expedition/creatures/galecrest-front.png", label: "Lv.18 바람벼슬" },
          { url: "/assets/monster-expedition/creatures/furnscale-front.png", label: "Lv.36 화염비늘" },
        ],
        metrics: [
          { label: "포획률 (catchRate)", value: "190 → 95 → 45" },
          { label: "서식지 배정", value: "1번 도로 · 발전소" },
        ],
      },
    ];
    const matrixRows: GenreMatrixRow[] = (maps.length > 0 ? maps.slice(0, 4) : [
      { id: "map-1", name: "태초마을 연구소", width: 20, height: 16, encounterRate: 0, events: [] },
      { id: "map-2", name: "1번 도로 수풀길", width: 40, height: 24, encounterRate: 0, events: [] },
      { id: "map-3", name: "회색시티 체육관", width: 24, height: 28, encounterRate: 0, events: [] },
    ] as unknown as GameMap[]).map((m, idx) => {
      const rate = m.encounterRate ?? 0;
      const isRoute = idx === 1 || /도로|숲|수풀|동굴|route|forest|cave/i.test(m.name || "");
      const warn = isRoute && rate === 0 && (m.encounterTable?.length ?? 0) === 0;
      return {
        id: m.id,
        name: m.name || m.id,
        role: idx === 0 ? "스타터 거점 (안전지대)" : isRoute ? "야생 포획 도로 (수풀)" : "체육관 / 보스 관문",
        detail: warn ? "수풀 타일 존재 · 야생 출현 테이블 0종 (전투 미발생)" : rate > 0 ? `출현율 ${rate}% · 등록 개체 ${(m.encounterTable?.length ?? 0) || 3}종` : "비전투 안전 거점 · 트레이너/이벤트 중심",
        statusLabel: warn ? "야생 출현 0종 ⚠" : "정상 연결",
        isWarn: warn,
        ...(warn ? { aiPrompt: `${m.name || m.id}에 Lv.4~8 야생 몬스터 3종 출현 테이블(encounterRate 12%)을 자동 배정해 줘.` } : {}),
      };
    });
    return { cards, matrixTitle: "장면별 야생 서식지 & 체육관 배지 배치표", matrixRows };
  }

  if (genre === "romance") {
    return {
      cards: [
        {
          id: "cast-seoyeon",
          badge: "메인 히로인 · 음악부 피아니스트",
          title: "한서연 (변수 #01 서연 호감도)",
          subtitle: "5표정 전신 스탠딩 + 버스트 완비 · 트루엔딩 요구치 ≥ 60",
          sprites: [
            { url: "/assets/shared/portraits/modern-uni-girl-sailor/full-happy.png", label: "미소(happy)" },
            { url: "/assets/shared/portraits/modern-uni-girl-sailor/full-embarrassed.png", label: "수줍음(shy)" },
            { url: "/assets/shared/portraits/modern-uni-girl-sailor/full-sad.png", label: "슬픔(sad)" },
          ],
          metrics: [
            { label: "현재 최대 획득 가능 호감도", value: "45 / 60 (15 부족)", warn: true },
            { label: "대사창 프리셋", value: "dual-fullbody-veil" },
          ],
          defectPrompt: "서연 진엔딩 요구 호감도(60)를 채울 수 있도록 방과후 카페/음악실 이벤트에 호감도 +15 선택지를 추가해 줘.",
        },
        {
          id: "cast-yujin",
          badge: "히로인 2 · 학생회장",
          title: "최유진 (변수 #02 유진 호감도)",
          subtitle: "5표정 전신 스탠딩 + 버스트 완비 · 트루엔딩 요구치 ≥ 50",
          sprites: [
            { url: "/assets/shared/portraits/pink-hat/full-smile.png", label: "기본(smile)" },
            { url: "/assets/shared/portraits/pink-hat/full-surprised.png", label: "놀람(surprised)" },
            { url: "/assets/shared/portraits/pink-hat/full-determined.png", label: "결심(determined)" },
          ],
          metrics: [
            { label: "현재 최대 획득 가능 호감도", value: "55 / 50 (도달 가능)" },
            { label: "전용 이벤트", value: "도서관 야간자습 · 학생회실" },
          ],
        },
      ],
      matrixTitle: "히로인 호감도 정산 & 멀티엔딩 도달 가능성 매트릭스",
      matrixRows: [
        {
          id: "end-seoyeon-true",
          name: "엔딩 1 · 한서연 트루엔딩 『봄날의 연탄곡』",
          role: "진엔딩 (CG 갤러리 #01 해금)",
          detail: "조건: 변수 #01(서연 호감도) ≥ 60 && 스위치 #12(옥상 화해) ON → 현재 최대치 45로 도달 불가",
          statusLabel: "Dead Ending ⚠",
          isWarn: true,
          aiPrompt: "서연 트루엔딩(호감도 60 이상)에 도달할 수 있도록 방과후 데이트 선택지 보상을 보강해 줘.",
        },
        {
          id: "end-yujin-true",
          name: "엔딩 2 · 최유진 트루엔딩 『별빛 학생회실』",
          role: "진엔딩 (CG 갤러리 #02 해금)",
          detail: "조건: 변수 #02(유진 호감도) ≥ 50 && 스위치 #15(학원제 준비) ON → 현재 최대치 55로 도달 가능",
          statusLabel: "도달 가능 ✓",
          isWarn: false,
        },
        {
          id: "end-normal",
          name: "엔딩 3 · 졸업 우정 노멀엔딩 『우리들의 계절』",
          role: "기본 폴백 엔딩",
          detail: "조건: 진엔딩 미달 시 자동 진입 (도달 보장 안전망)",
          statusLabel: "폴백 보장 ✓",
          isWarn: false,
        },
      ],
    };
  }

  return {
    cards: [
      {
        id: "party-front",
        badge: "전열 검사 & 화염 마검사",
        title: "아리아 (Lv.1→50) & 카이 (Lv.5 합류)",
        subtitle: "합동기: [연계] 화염회전베기 (전체 화염 물리 2.4배)",
        sprites: [
          { url: "/assets/generated/charset-battlers/silver-swordswoman.png", label: "아리아 (검사)" },
          { url: "/assets/shared/portraits/blue-traveler/full-determined.png", label: "카이 (마검사)" },
        ],
        metrics: [
          { label: "초기/만렙 HP 곡선", value: "240 → 3,450" },
          { label: "합동기 조건", value: "두 캐릭터 동시 생존 + TP 25" },
        ],
      },
      {
        id: "party-back",
        badge: "후열 백마도사 & 고대 기교병",
        title: "세리아 (초기 합류) & 로보 (폐허 던전 영입)",
        subtitle: "합동기: [연계] 성광배리어 (아군 전체 회복 + 마법반사)",
        sprites: [
          { url: "/assets/shared/portraits/purple-mage/full-smile.png", label: "세리아 (마도사)" },
          { url: "/assets/shared/portraits/purple-mage/full-determined.png", label: "각성 세리아" },
        ],
        metrics: [
          { label: "기교병 영입 상태", value: "폐허 포털 미연결 (고립)", warn: true },
          { label: "보스 약점 카운터", value: "심연 마장기 코어 파괴" },
        ],
        defectPrompt: "고대 폐허 맵에 기교병 로보 영입 이벤트와 현재↔폐허 양방향 시대 변형 포털을 연결해 줘.",
      },
    ],
    matrixTitle: "시대 변형 맵 쌍(현재 ↔ 폐허) & 보스/동료 영입 곡선",
    matrixRows: [
      {
        id: "pair-1",
        name: "왕국 천년제 광장 ↔ 암흑기 폐허 광장",
        role: "시대 변형 맵 쌍 (derive_map_variant)",
        detail: "시계탑 전이문을 통해 현재(밝음)와 폐허(황폐+몬스터 출현) 지형을 왕복",
        statusLabel: "양방향 연결 ✓",
        isWarn: false,
      },
      {
        id: "pair-2",
        name: "고대 시계탑 지하 · 기교병 봉인실",
        role: "3번째 동료(로보) 영입 & 연계기 해금 관문",
        detail: "들어오는 transferPlayer 이벤트가 누락되어 파티가 3명으로 고정되는 진행 막힘",
        statusLabel: "고립 구역 ⚠",
        isWarn: true,
        aiPrompt: "시계탑 1층에서 지하 기교병 봉인실로 내려가는 계단 워프(transferPlayer)와 동료 합류 이벤트를 연결해 줘.",
      },
      {
        id: "pair-3",
        name: "부유성 첨탑 · 심연 마장기 (Ch.2 보스)",
        role: "권장 Lv.18 · 4인 파티 기준 밸런스",
        detail: "코어 개방 시 [연계] 기술 데미지 1.8배 · 승리 시 비공정 해금",
        statusLabel: "밸런스 적정 ✓",
        isWarn: false,
      },
    ],
  };
}

export function buildOpeningShots(project: Project, genre: StudioDirectorGenre): readonly OpeningShotSpec[] {
  const customScenes = project.system.opening?.scenes ?? [];
  if (customScenes.length >= 6) {
    return customScenes.slice(0, 6).map((scene, idx) => ({
      step: `SHOT ${idx + 1}`,
      beatRole: ["WORLD", "RUPTURE", "STAKES", "MYSTERY", "INVITATION", "HANDOFF"][idx] ?? "SCENE",
      title: scene.narration.slice(0, 22) || `오프닝 컷 #${idx + 1}`,
      durationLabel: `${(scene.durationMs / 1000).toFixed(1)}s`,
      cameraLabel: idx % 2 === 0 ? "Slow Pan + Bloom" : "Zoom-In + Shake",
      caption: scene.narration,
      imageUrl: "/assets/generated/opening/kingdom-day.png",
    }));
  }
  if (genre === "monster-taming") {
    return [
      { step: "SHOT 1", beatRole: "WORLD", title: "신록의 관동·성도 대자연", durationLabel: "3.2s", cameraLabel: "Wide Pan · 새벽 안개", caption: "숲과 바다, 하늘 어디에나 신비한 생명체 『몬스터』가 사람들과 숨 쉬며 살아가는 세계.", imageUrl: "/assets/generated/opening/farm-golden.png" },
      { step: "SHOT 2", beatRole: "RUPTURE", title: "전설의 그림자와 고대 유적", durationLabel: "3.0s", cameraLabel: "Camera Shake · 번개 섬광", caption: "구름 너머 고대 유적에서 깨어난 전설의 포효가 지방 전역의 서식지를 뒤흔든다.", imageUrl: "/assets/generated/opening/desert-ruin.png" },
      { step: "SHOT 3", beatRole: "STAKES", title: "박사 연구소의 세 몬스터볼", durationLabel: "3.5s", cameraLabel: "Close-Up · 스포트라이트", caption: "오박사의 연구소 책상 위에서 주인을 기다리는 풀·불·물 세 개의 몬스터볼.", imageUrl: "/assets/monster-kit/references/monster-rooms/lab.png" },
      { step: "SHOT 4", beatRole: "MYSTERY", title: "숙명의 라이벌과 배지 8개", durationLabel: "3.2s", cameraLabel: "Split Wipe · 대결 구도", caption: "각 도시의 체육관 관장들과 라이벌을 넘어 석영리그 정상을 향한 여정이 펼쳐진다.", imageUrl: "/assets/monster-kit/references/monster-overworld/room-gymrock.png" },
      { step: "SHOT 5", beatRole: "INVITATION", title: "너만의 도감과 6마리 파티", durationLabel: "3.0s", cameraLabel: "Slow Zoom · 별빛 비네트", caption: "풀숲에서 만나 교감하고 3단계로 진화하며 함께 성장하는 단 하나의 파트너.", imageUrl: "/assets/monster-kit/references/monster-overworld/route.png" },
      { step: "SHOT 6", beatRole: "HANDOFF", title: "태초마을 내 방 침대에서 기상", durationLabel: "2.8s", cameraLabel: "Crossfade → 시작 맵 직결", caption: "아침 햇살이 창문을 비추며 플레이어 조작 가능한 시작 맵으로 끊김 없이 이어진다.", imageUrl: "/assets/monster-kit/references/monster-overworld/map.png" },
    ];
  }
  if (genre === "romance") {
    return [
      { step: "SHOT 1", beatRole: "WORLD", title: "흩날리는 4월의 벚꽃 교정", durationLabel: "3.5s", cameraLabel: "Soft Bloom · 꽃잎 파티클", caption: "새로운 학기가 시작되는 봄날 아침, 따스한 햇살과 피아노 선율이 흐르는 학원 교정.", imageUrl: "/assets/region-references/jp-city-school-1f.png" },
      { step: "SHOT 2", beatRole: "RUPTURE", title: "바람에 날아간 악보와 첫 눈맞춤", durationLabel: "3.2s", cameraLabel: "Depth Blur · 슬로모션", caption: "교문 앞에서 마주친 한서연의 손에서 악보가 흩날리고, 두 사람의 손끝이 처음으로 닿는다.", imageUrl: "/assets/monster-expedition/opening/starlight-prologue.png" },
      { step: "SHOT 3", beatRole: "STAKES", title: "방과후 음악실과 학생회실", durationLabel: "3.4s", cameraLabel: "Dual Split · 황혼 색조", caption: "콩쿠르를 준비하는 피아니스트 서연과 학원제를 이끄는 학생회장 유진 사이의 설레는 방과후.", imageUrl: "/assets/region-references/jp-city-kissaten.png" },
      { step: "SHOT 4", beatRole: "MYSTERY", title: "비 내리는 정류장의 엇갈린 진심", durationLabel: "3.2s", cameraLabel: "Rain Overlay · 네온 반사", caption: "전하지 못한 말 한마디가 만든 작은 오해, 우산 아래에서 흔들리는 눈빛.", imageUrl: "/assets/region-references/wz-post-example-street.png" },
      { step: "SHOT 5", beatRole: "INVITATION", title: "별빛 학원제 옥상의 약속", durationLabel: "3.5s", cameraLabel: "Camera Push · 불꽃놀이", caption: "네가 건네는 선택 하나하나가 그녀의 표정과 계절의 결말을 바꾼다.", imageUrl: "/assets/monster-expedition/opening/storyboard-20261003/lighthouse-dimming.png" },
      { step: "SHOT 6", beatRole: "HANDOFF", title: "교문 앞 첫 대사로 심리스 진입", durationLabel: "2.6s", cameraLabel: "White Fade → 첫 씬 핸드오프", caption: "오프닝 피아노 코드가 잦아들며 교문 앞 첫 선택지 화면으로 자연스럽게 전환된다.", imageUrl: "/assets/region-references/jp-city-school.png" },
    ];
  }
  return [
    { step: "SHOT 1", beatRole: "WORLD", title: "천년제 종소리가 울리는 왕국", durationLabel: "3.4s", cameraLabel: "Pan Down · 구름 그림자", caption: "오랜 평화를 기념하는 천년제 아침, 왕국 시계탑의 거대한 종이 하늘을 울린다.", imageUrl: "/assets/generated/opening/kingdom-day.png" },
    { step: "SHOT 2", beatRole: "RUPTURE", title: "붉게 물든 전이문과 시공 균열", durationLabel: "3.2s", cameraLabel: "Screen Shake + Crimson Flash", caption: "광장 북쪽 고대 장치가 폭주하며 하늘이 갈라지고 400년 후의 폐허가 모습을 드러낸다.", imageUrl: "/assets/generated/opening/dark-citadel.png" },
    { step: "SHOT 3", beatRole: "STAKES", title: "폐허가 된 미래와 멈춘 시계탑", durationLabel: "3.5s", cameraLabel: "Slow Track · 잿빛 안개", caption: "심연의 포식자가 휩쓸고 지나간 미래를 본 일행은 역사를 바꾸기로 결의한다.", imageUrl: "/assets/generated/opening/desert-ruin.png" },
    { step: "SHOT 4", beatRole: "MYSTERY", title: "고대 기교병과 봉인된 비공정", durationLabel: "3.2s", cameraLabel: "Spotlight Reveal · 룬 문자", caption: "시대를 넘어 잠들어 있던 동료들과 고대 비공정의 날개가 다시 깨어난다.", imageUrl: "/assets/generated/opening/snow-village.png" },
    { step: "SHOT 5", beatRole: "INVITATION", title: "검과 마법이 교차하는 4인 연계", durationLabel: "3.0s", cameraLabel: "Dynamic Zoom · 검기 이펙트", caption: "네 명의 동료가 힘을 합쳐 시전하는 합동기([연계])가 심연의 장벽을 가른다.", imageUrl: "/assets/monster-expedition/opening/storyboard-20261003/lighthouse-dimming.png" },
    { step: "SHOT 6", beatRole: "HANDOFF", title: "왕국 광장 시작 위치로 카메라 착지", durationLabel: "2.8s", cameraLabel: "Seamless Iris → 인게임 시작", caption: "시계탑에서 내려온 카메라가 주인공 머리 위에 멈추며 즉시 조작이 시작된다.", imageUrl: "/assets/generated/opening/farm-golden.png" },
  ];
}
