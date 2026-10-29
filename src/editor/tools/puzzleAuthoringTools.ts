// src/editor/tools/puzzleAuthoringTools.ts
// 퍼즐 프리셋 카탈로그 조회(list_puzzle_presets) + 원큐 퍼즐 시공기(author_map_puzzle).
//
// 왜 (2026-10-18 사용자 지시 「그래 퍼즐같은 게 핵심일거같군. 고칠 거 다 고치고, 새 보고서 작성해라.
// 그리고 흠 .... AI 조수가 퍼즐같은 걸 잘 만들 수 있게 뭐 프리셋이라던가 , 툴이라던가 좀 만들어놔야 할거같음.」):
// 기존 compile_puzzle 은 저수준 스위치/암호 이벤트 뼈대만 만들고, 시각적 2상태 기물(작동 전/후 그래픽 전환),
// changeTile 타일 개방(비밀 계단·돌다리·봉인 해제), 효과음·화면 진동·파티클 연출, 소프트락 방지 동선 검증을
// 조수가 매번 수동으로 조합해야 했다.
// 이 모듈은 12종 장르 범용 퍼즐 프리셋 카탈로그(list_puzzle_presets)와,
// 한 번의 호출로 2상태 기물 이벤트 + 스위치/변수 + changeTile 타일 변화 + 연출 + 보상 + 통행 무결성 검증까지
// 원자적으로 시공하는 author_map_puzzle 도구를 제공한다.

import {
  allSwitchesFork,
  makePage,
  objGraphic,
  particles,
  revealInWaves,
  se,
  sfx,
  tintPulse,
  shake,
  textCmd,
} from "./puzzleKit";
import { PUZZLE_MECHANICS } from "./puzzleMechanics";
import { analysePuzzleModel, hashSeed, type MechanicContext, type MechanicDef, type PuzzlePlayStep } from "./puzzleMechanicCore";
import { claimPuzzleRoomWindow } from "./puzzleRoomScenery";
import { NEW_QUALITY_PRESETS, QUALITY_OVERRIDES } from "./puzzlePresetQuality";
import { chestOpenCommands, chestOpenedGraphic, lootGrantCommands } from "@/editor/lootFeedback";
import { CHANGE_TILE_USAGE, changeTileProblems } from "@/project/changeTileValidation";
import { isPassable } from "@/project/collision";
import { EventPlacementAnalysis } from "@/project/eventPlacementRecovery";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { supportSurfaceOf } from "@/project/groundSupport";
import type {
  Command,
  Dir,
  EventPage,
  EventPageGraphic,
  GameEvent,
  GameMap,
  Project,
} from "@/project/types";
import { charsetGraphic, resolveGraphic } from "./eventCompile";
import { ensureNamedSwitch, ensureNamedVariable } from "./flagHelpers";
import { mainComponent, sanitizeId, type Cell } from "./jrpgVolumeTools";
import { requireMap } from "./mapHelpers";
import { buildDramaticPuzzleStage } from "./puzzleStageScenery";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

export const PUZZLE_PRESET_IDS = [
  "lever_secret_passage",
  "two_step_sequence",
  "cathedral_organ_tuning",
  "brazier_ignition_order",
  "statue_pressure_plates",
  "ice_conveyor_slide",
  "time_gate_causality",
  "dynamite_rock_blast",
  "riddle_mimic_chests",
  "sluice_lava_bridge",
  "stealth_guard_patrol",
  "boss_seal_monoliths",
  "rolling_boulder_chasm",
  "mirror_beam_refraction",
  "minecart_track_switch",
  "elemental_pedestal_swap",
  "cracked_plank_bridge",
  "number_code_lock",
  "balance_scale_weights",
  "flip_floor_tiles",
] as const;

export type PuzzlePresetId = (typeof PUZZLE_PRESET_IDS)[number];

export interface PuzzlePresetEntry {
  readonly id: PuzzlePresetId;
  readonly index: number;
  readonly title: string;
  readonly category:
    | "mechanism"
    | "sequence"
    | "musical_astronomy"
    | "elemental"
    | "spatial"
    | "movement"
    | "time_causality"
    | "obstacle_clear"
    | "riddle"
    | "environment"
    | "stealth"
    | "boss_seal"
    | "logic"
    | "memory"
    | "navigation"
    | "timing"
    | "light";
  readonly genres: readonly string[];
  readonly summary: string;
  readonly mechanics: string;
  readonly visualProps: readonly string[];
  readonly usesChangeTile: true;
  readonly requiredCells: number;
  readonly defaultReward: {
    readonly itemId: string;
    readonly itemName: string;
    readonly itemDescription: string;
    readonly gold: number;
  };
  readonly exampleCall: {
    readonly mapId: string;
    readonly presetId: PuzzlePresetId;
  };
  /** quality = 상태 공간 모형·실기 플레이 검증을 통과한 현역 프리셋, legacy = 판단 요소가 없어 기본 목록에서 내린 옛 프리셋(시공은 그대로 된다). */
  readonly tier: "quality" | "legacy";
  readonly quality?: PuzzleQualityInfo;
}

export type { PuzzlePlayStep };

/** 품질 프리셋의 조수용 메타데이터 — list_puzzle_presets 가 그대로 돌려준다. */
export interface PuzzleQualityInfo {
  /** 기믹 계열(push_block · path · slide · toggle · order · memory · logic · routing · stealth · timing · light · resource). */
  readonly family: string;
  readonly difficulty: "easy" | "medium" | "hard";
  /** 한 줄 기믹 설명. */
  readonly mechanic: string;
  /** 쓰는 이벤트 모양(기존 명령·조건만). */
  readonly eventShapes: readonly string[];
  readonly reset: string;
  readonly hint: string;
  readonly reveal: string;
  readonly roomSize: "20x15";
  /** 조수가 이 프리셋을 고를 한 문장 예시와 그때의 호출. */
  readonly sentence: string;
  readonly call: Readonly<Record<string, string | number>>;
  /** 이전 판에서 바뀐 점(같은 id 를 다시 만든 경우). */
  readonly reworkedFrom?: string;
}

/** 2026-10-19 까지의 16종 원래 항목. 품질 판으로 다시 만든 id 는 아래 QUALITY_OVERRIDES 가 제목·설명·메타데이터를 덮는다. */
const BASE_PRESET_ENTRIES: readonly Omit<PuzzlePresetEntry, "tier" | "quality">[] = [
  {
    id: "lever_secret_passage",
    index: 1,
    title: "① 레버-비밀통로 changeTile 개방",
    category: "mechanism",
    genres: ["jrpg", "dungeon", "horror", "classic", "레버", "비밀통로", "계단"],
    summary: "레버를 당기면 2상태 레버 그래픽이 전환되고 changeTile 로 비밀 통로 바닥과 봉인문이 동시에 열린다.",
    mechanics: "2페이지 레버(down→up) + changeTile 바닥 개방 + 2페이지 철문(차단→통과) + 진동·섬광·효과음·보상 지급",
    visualProps: ["2상태 작동 레버 (object2#0 down→up)", "비밀 통로 철문 (object1#3 차단→개방)", "changeTile 개방 바닥 타일"],
    usesChangeTile: true,
    requiredCells: 2,
    defaultReward: {
      itemId: "item_puzzle_secret_key",
      itemName: "비밀통로 고대 열쇠",
      itemDescription: "레버로 개방한 비밀 통로 바닥에서 발견한 고대 열쇠.",
      gold: 150,
    },
    exampleCall: { mapId: "map_dungeon_1", presetId: "lever_secret_passage" },
  },
  {
    id: "two_step_sequence",
    index: 2,
    title: "② 2단계 비밀번호/순서 레버 퍼즐",
    category: "sequence",
    genres: ["jrpg", "scifi", "steampunk", "mystery", "순서", "암호", "콘솔", "2단계"],
    summary: "단서 비석의 힌트를 읽고 제어 콘솔/레버를 2단계 순서대로 조작해 보안 철문과 바닥 타일을 개방한다.",
    mechanics: "단서 비석 조사 + 2단계 선택지 분기(오답 시 경보음·적색 섬광 후 초기화) + 2상태 콘솔 + changeTile 보안문 개방",
    visualProps: ["암호 단서 비석 (object2#3)", "2단계 제어 콘솔 레버 (object2#0 down→up)", "보안 차단문 (object1#4 차단→개방)"],
    usesChangeTile: true,
    requiredCells: 3,
    defaultReward: {
      itemId: "item_puzzle_security_card",
      itemName: "보안 해제 마스터키",
      itemDescription: "2단계 보안 콘솔을 해독하고 얻은 마스터 인증 키.",
      gold: 200,
    },
    exampleCall: { mapId: "map_factory_1", presetId: "two_step_sequence" },
  },
  {
    id: "cathedral_organ_tuning",
    index: 3,
    title: "③ 성당 파이프 오르간·별자리 조율 퍼즐",
    category: "musical_astronomy",
    genres: ["jrpg", "gothic", "cathedral", "chronotrigger", "오르간", "별자리", "비밀계단"],
    summary: "성가대 비문의 별자리 화음 순서를 읽고 파이프 오르간 건반과 페달을 조율해 바닥 카펫 아래 비밀 계단을 드러낸다.",
    mechanics: "성가대 악보 비석 + 2단계 오르간 화음·페달 선택지 + 파이프 화음 SE + changeTile 지하 비밀 계단 드러냄",
    visualProps: ["파이프 오르간 조율대 (object2#7)", "성가대 별자리 비문 (object2#3)", "지하 비밀 계단/결정 (object2#2→object2#6 + changeTile)"],
    usesChangeTile: true,
    requiredCells: 3,
    defaultReward: {
      itemId: "item_puzzle_astral_crest",
      itemName: "성당 성좌의 인장",
      itemDescription: "파이프 오르간 화음으로 열린 지하 계단에서 얻은 별자리 인장.",
      gold: 250,
    },
    exampleCall: { mapId: "map_chapel_1", presetId: "cathedral_organ_tuning" },
  },
  {
    id: "brazier_ignition_order",
    index: 4,
    title: "④ 횃불/화로 점화 순서 퍼즐",
    category: "elemental",
    genres: ["jrpg", "dungeon", "prehistoric", "temple", "횃불", "화로", "점화", "불"],
    summary: "꺼진 화로 3기를 제1→제2→제3 순서대로 점화하면 화로마다 불꽃 보석이 타오르고 봉인 철창과 통로 타일이 열린다.",
    mechanics: "진행 변수(var_progress 0→1→2→3) + 화로 3기 2상태 그래픽(받침대#3→불꽃보석#6) + 오순서 시 역류 리셋 + changeTile 봉인 개방",
    visualProps: ["제1·제2·제3 고대 화로 (object2#3 꺼짐 → object2#6 타오르는 불꽃 보석)", "화염 봉인 철창문 (object1#5 차단→개방)"],
    usesChangeTile: true,
    requiredCells: 4,
    defaultReward: {
      itemId: "item_puzzle_solar_ember",
      itemName: "태양의 불씨 보관함",
      itemDescription: "세 화로를 순서대로 점화해 봉인을 풀고 얻은 영원한 불씨.",
      gold: 250,
    },
    exampleCall: { mapId: "map_canyon_1", presetId: "brazier_ignition_order" },
  },
  {
    id: "statue_pressure_plates",
    index: 5,
    title: "⑤ 석상/바위 발판 스위치 퍼즐",
    category: "spatial",
    genres: ["jrpg", "ruins", "temple", "zelda-like", "발판", "석상", "스위치", "바위"],
    summary: "유적 바닥의 압력 발판들을 직접 걸어서 밟으면(playerTouch) 각 발판이 내려앉고 모든 발판 작동 시 고대 석문이 열린다.",
    mechanics: "playerTouch 압력 발판 2기(나선 발판#4→눌린 원판#2) + allSwitchesFork 판정 + changeTile 석문 개방",
    visualProps: ["제1·제2 압력 발판 (object2#4 미작동 → object2#2 눌림)", "고대 유적 석문 (object1#3 차단→개방)"],
    usesChangeTile: true,
    requiredCells: 3,
    defaultReward: {
      itemId: "item_puzzle_statue_medallion",
      itemName: "고대 석상 문장",
      itemDescription: "모든 압력 발판을 작동시켜 유적 석문을 열고 얻은 황금 문장.",
      gold: 200,
    },
    exampleCall: { mapId: "map_ruins_1", presetId: "statue_pressure_plates" },
  },
  {
    id: "ice_conveyor_slide",
    index: 6,
    title: "⑥ 얼음/컨베이어 미끄럼 길 찾기",
    category: "movement",
    genres: ["jrpg", "snow", "factory", "pokemon-gym", "얼음", "컨베이어", "미끄럼"],
    summary: "밟으면 미끄러지는 빙판/컨베이어 트랙과 궤도 전환 레버·정지 바위를 조합해 미끄럼 길을 정렬하고 보물에 도달한다.",
    mechanics: "playerTouch 미끄럼 트랙(moveEvent @player 이동) + 궤도 전환 레버(down→up) + changeTile 정렬 트랙 개방 + 정지 바위 해제",
    visualProps: ["궤도 전환 레버 (object2#0 down→up)", "빙판/컨베이어 미끄럼 패드 (object2#4)", "정지 바위/보물 지점 (object2#5→개방)"],
    usesChangeTile: true,
    requiredCells: 3,
    defaultReward: {
      itemId: "item_puzzle_glacier_boots",
      itemName: "빙하 돌파 아이젠",
      itemDescription: "얼음과 컨베이어 미끄럼 궤도를 돌파하고 얻은 특수 장화.",
      gold: 250,
    },
    exampleCall: { mapId: "map_ice_mine_1", presetId: "ice_conveyor_slide" },
  },
  {
    id: "time_gate_causality",
    index: 7,
    title: "⑦ 시간의 문 시대 연동 기믹",
    category: "time_causality",
    genres: ["jrpg", "chronotrigger", "time-travel", "시간의문", "시대연동", "인과"],
    summary: "과거(원점)의 시공 제단에서 마석/씨앗을 공명시키면 changeTile 과 시대 인과 플래그로 미래(대상)의 봉인 유산 상자가 깨어난다.",
    mechanics: "과거 시공 제단(받침대#3→공명 수정#6) + 미래 유산 상자 3단계(풍화 나무상자#7→각성 붉은상자#6→개봉 상자 up) + changeTile 시공 바닥 변화",
    visualProps: ["과거 시공 공명 제단 (object2#3→object2#6)", "미래 시대 연동 유산 상자 (object1#7→object1#6→개봉)"],
    usesChangeTile: true,
    requiredCells: 2,
    defaultReward: {
      itemId: "item_puzzle_chrono_heirloom",
      itemName: "시공의 비보 크로노 메달",
      itemDescription: "과거의 공명이 시대를 건너 미래의 유산 상자에서 깨어난 시공 유물.",
      gold: 500,
    },
    exampleCall: { mapId: "map_present_1", presetId: "time_gate_causality" },
  },
  {
    id: "dynamite_rock_blast",
    index: 8,
    title: "⑧ 열쇠·다이너마이트 장애물 폭파/해제",
    category: "obstacle_clear",
    genres: ["jrpg", "mine", "western", "dungeon", "다이너마이트", "폭파", "바위", "열쇠"],
    summary: "화약 보급 상자에서 다이너마이트를 입수한 뒤 길목을 막은 거대 낙석에 설치해 폭파(changeTile + 바위 소멸)하고 통로를 연다.",
    mechanics: "2페이지 화약 보급 상자(다이너마이트 지급) + 거대 낙석 아이템 검사(fork item) + 폭발 SE·섬광·진동 + changeTile 암반 제거 + 낙석 투명화",
    visualProps: ["화약 보급 상자 (object1#7 닫힘→열림)", "균열 간 거대 낙석 (object2#5 차단→폭파 소멸)", "changeTile 개방 광맥 바닥"],
    usesChangeTile: true,
    requiredCells: 2,
    defaultReward: {
      itemId: "item_puzzle_gold_nugget",
      itemName: "폭파된 광맥의 금괴",
      itemDescription: "거대 낙석을 다이너마이트로 폭파한 자리에서 드러난 순금 광석.",
      gold: 300,
    },
    exampleCall: { mapId: "map_mine_1", presetId: "dynamite_rock_blast" },
  },
  {
    id: "riddle_mimic_chests",
    index: 9,
    title: "⑨ 보물상자 함정/미믹/진실의 상자 수수께끼",
    category: "riddle",
    genres: ["jrpg", "mystery", "dungeon", "mimic", "보물상자", "미믹", "수수께끼", "거짓말쟁이"],
    summary: "수수께끼 비석의 논리 힌트를 읽고 3개의 상자(미믹 함정 2 + 진실의 상자 1) 중 진짜 보물상자를 골라 연다.",
    mechanics: "수수께끼 비석 + 가짜 상자 2기(미믹 이빨/독가스 함정 연출) + 진실의 상자 1기(2상태 개봉 애니메이션 + changeTile 황금 바닥 + 보상)",
    visualProps: ["수수께끼 비석 (object2#3)", "미믹/함정 나무상자 2기 (object1#7)", "진실의 붉은 보물상자 (object1#6 닫힘→열림)"],
    usesChangeTile: true,
    requiredCells: 4,
    defaultReward: {
      itemId: "item_puzzle_truth_chalice",
      itemName: "진실의 황금 성배",
      itemDescription: "거짓 상자들의 유혹을 꿰뚫고 진실의 상자에서 찾아낸 성배.",
      gold: 350,
    },
    exampleCall: { mapId: "map_tower_1", presetId: "riddle_mimic_chests" },
  },
  {
    id: "sluice_lava_bridge",
    index: 10,
    title: "⑩ 수문/용암 수위 조절 다리 개방",
    category: "environment",
    genres: ["jrpg", "sewer", "volcano", "castle", "수문", "용암", "다리", "수위"],
    summary: "수문·용암 냉각 밸브를 돌리면 수위가 내려가며 changeTile 로 2~3칸의 돌다리 바닥이 드러나고 수문 차단기가 열린다.",
    mechanics: "2상태 수문 밸브 레버(down→up) + 지진·수류 SE + 다중 칸 changeTile 돌다리 타일 부설 + 수문 차단기(object1#5) 개방",
    visualProps: ["수문·용암 조절 밸브 (object2#0 down→up)", "수문 차단 철창 (object1#5 차단→개방)", "changeTile 다리 바닥 타일"],
    usesChangeTile: true,
    requiredCells: 3,
    defaultReward: {
      itemId: "item_puzzle_sluice_crest",
      itemName: "수문장의 청동 증표",
      itemDescription: "수문 밸브를 조작해 다리를 개방하고 건너편에서 얻은 증표.",
      gold: 250,
    },
    exampleCall: { mapId: "map_sewer_1", presetId: "sluice_lava_bridge" },
  },
  {
    id: "stealth_guard_patrol",
    index: 11,
    title: "⑪ 경비병 시야/순찰 잠입 퍼즐",
    category: "stealth",
    genres: ["jrpg", "castle", "prison", "stealth", "경비병", "잠입", "순찰", "시야"],
    summary: "길목을 지키는 경비병을 정면으로는 통과할 수 없으나, 유인 종/연막 통을 울리면 경비병이 옆으로 이동(moveEvent)해 통로와 보급함이 열린다.",
    mechanics: "경비병 NPC(1페이지 길목 차단 → 2페이지 유인 후 비켜섬) + 유인 종/밧줄(object2#1) + moveEvent 실제 걸음 이동 + changeTile 통로 개방 + 보급 상자 해금",
    visualProps: ["유인 종/연막 밧줄 (object2#1)", "순찰 경비병 NPC (병사 차셋, moveEvent 이동)", "경비 초소 보급 상자 (object1#6)"],
    usesChangeTile: true,
    requiredCells: 3,
    defaultReward: {
      itemId: "item_puzzle_stealth_cipher",
      itemName: "근위대 잠입 암호문",
      itemDescription: "경비병의 시선을 돌리고 초소 보급함에서 입수한 기밀 암호문.",
      gold: 200,
    },
    exampleCall: { mapId: "map_castle_1", presetId: "stealth_guard_patrol" },
  },
  {
    id: "boss_seal_monoliths",
    index: 12,
    title: "⑫ 보스 봉인 결계 3비석 해제",
    category: "boss_seal",
    genres: ["jrpg", "final-dungeon", "temple", "boss", "봉인", "결계", "3비석", "마석"],
    summary: "보스방 입구를 막은 결계문 주변의 3개 비석(태양·달·별)을 모두 작동시키면 비석들이 크리스탈로 빛나며 결계문과 바닥 타일이 열린다.",
    mechanics: "3개 봉인 비석(받침대#3→빛나는 보석#6) + allSwitchesFork 3비석 공명 판정 + 결계 파쇄 연출 + changeTile 4칸(비석 3 + 결계문 1) + 결계문(object1#4) 개방",
    visualProps: ["태양·달·별의 봉인 비석 3기 (object2#3→object2#6)", "보스 봉인 결계문 (object1#4 차단→개방)"],
    usesChangeTile: true,
    requiredCells: 4,
    defaultReward: {
      itemId: "item_puzzle_seal_relic",
      itemName: "결계 파쇄의 성물",
      itemDescription: "세 봉인 비석을 모두 공명시켜 보스 결계를 해제하고 얻은 고대 성물.",
      gold: 400,
    },
    exampleCall: { mapId: "map_boss_temple_1", presetId: "boss_seal_monoliths" },
  },
  {
    id: "rolling_boulder_chasm",
    index: 13,
    title: "⑬ 거대 바위 굴리기·구렁 메우기 퍼즐",
    category: "obstacle_clear",
    genres: ["jrpg", "ruins", "mountain", "zelda-like", "바위", "굴리기", "구렁", "돌다리", "물리궤적"],
    summary: "상부 고패 윈치와 바위 멈춤쇠를 풀면 거대 바위가 경사로를 따라 6단계 궤적으로 회전·먼지 구름을 일으키며 굴러 내려와 심연 구렁을 메우고 돌다리를 만든다.",
    mechanics: "상부 윈치 해제 + 바위 멈춤쇠 작동 + 5단계 경사로 구름 궤적(boulder_step_1~5 changeTile + 먼지·연기·불꽃 입자 + 단계별 진동) + 구렁 착지 3물결 폭발 및 3×2 돌다리·성소 계단 개방",
    visualProps: ["상부 고패 윈치 (gate winch)", "경사로 3열 거대 바위 (push boulder 궤적 이동)", "심연 구렁 3×2 돌다리 & 성소 계단"],
    usesChangeTile: true,
    requiredCells: 3,
    defaultReward: {
      itemId: "item_puzzle_earthshaker_core",
      itemName: "대지진의 바위 핵",
      itemDescription: "거대 바위를 굴려 심연 구렁을 메우고 성소에서 획득한 대지의 마력 핵.",
      gold: 350,
    },
    exampleCall: { mapId: "map_chasm_ruins_1", presetId: "rolling_boulder_chasm" },
  },
  {
    id: "mirror_beam_refraction",
    index: 14,
    title: "⑭ 고대 거울 빛줄기 굴절 퍼즐",
    category: "musical_astronomy",
    genres: ["jrpg", "temple", "light", "mirror", "거울", "빛줄기", "굴절", "프리즘", "봉인"],
    summary: "천창의 태양빛을 받는 서·동 프리즘 거울 기둥을 차례로 회전시켜 황금 빛줄기를 성소 바닥 위로 굴절·집중시켜 북쪽 암흑 결계를 파쇄한다.",
    mechanics: "제1 프리즘 거울 회전(동쪽 빛줄기 changeTile) + 제2 굴절 거울 회전(북쪽 봉인 빛줄기 changeTile) + 섬광·마법 입자 + 북쪽 암흑 봉인 파쇄 및 성소 계단 개방",
    visualProps: ["서·동 굴절 거울 기둥 (tailor mirror→mana crystal)", "황금 빛줄기 바닥 궤적 (rug royal + footlights)", "북쪽 암흑 봉인 제단 (dark orb pedestal→magic circle)"],
    usesChangeTile: true,
    requiredCells: 3,
    defaultReward: {
      itemId: "item_puzzle_helios_prism",
      itemName: "태양신의 굴절 프리즘",
      itemDescription: "고대 거울로 태양 빛줄기를 굴절시켜 암흑 봉인을 정화하고 얻은 황금 프리즘.",
      gold: 350,
    },
    exampleCall: { mapId: "map_sun_temple_1", presetId: "mirror_beam_refraction" },
  },
  {
    id: "minecart_track_switch",
    index: 15,
    title: "⑮ 광산 선로 전환기 & 광차 충돌 퍼즐",
    category: "movement",
    genres: ["jrpg", "mine", "steampunk", "dwarf", "광차", "선로", "전환기", "충돌", "바리케이드"],
    summary: "막다른 서쪽 지선으로 향해 있던 광산 분기 선로를 전환기로 북쪽 본선에 연결한 뒤 광석 광차를 출발시켜 낙석 바리케이드를 정면 돌파한다.",
    mechanics: "분기 선로 전환기(rail changeTile) + 광차 발진 4단계 선로 질주(minecart_step_1~4 + 불꽃·먼지 입자 + 진동) + 낙석 바리케이드 정면 충돌 폭파 및 금고 개방",
    visualProps: ["분기 선로 전환기 (gate winch + rail)", "질주하는 광석 광차 (mine cart 4단계 이동)", "북쪽 금고 낙석 바리케이드 (push boulder→treasure pile)"],
    usesChangeTile: true,
    requiredCells: 3,
    defaultReward: {
      itemId: "item_puzzle_mithril_ingot",
      itemName: "특제 미스릴 주괴",
      itemDescription: "광차로 금고 바리케이드를 돌파해 찾아낸 고순도 미스릴 주괴.",
      gold: 400,
    },
    exampleCall: { mapId: "map_dwarf_mine_1", presetId: "minecart_track_switch" },
  },
  {
    id: "elemental_pedestal_swap",
    index: 16,
    title: "⑯ 사원소 룬 제단 공명 퍼즐",
    category: "elemental",
    genres: ["jrpg", "sanctum", "elemental", "rune", "사원소", "제단", "룬", "공명", "마법진"],
    summary: "화염·빙결·질풍·대지 4방위 원소 제단에 각각 상응하는 원소 성물을 깨워 중앙 대마법진과 북쪽 대성소 계단을 개방한다.",
    mechanics: "4방위 원소 제단(plinth→lava brazier/mana crystal/orb pedestal/rune stone 단계별 changeTile) + allSwitchesFork 4원소 합일 판정 + 대마법진·성소 계단 개방",
    visualProps: ["화·빙·풍·지 4원소 제단 (plinth→4원소 성물)", "중앙 대마법진 (summoning circle→magic circle + save crystal)", "북쪽 성소 봉인문 (portcullis→stairs up stone)"],
    usesChangeTile: true,
    requiredCells: 4,
    defaultReward: {
      itemId: "item_puzzle_elemental_crown",
      itemName: "사원소 공명의 관",
      itemDescription: "네 원소 제단을 모두 깨워 대마법진을 완성하고 얻은 고대 왕관.",
      gold: 450,
    },
    exampleCall: { mapId: "map_elemental_sanctum_1", presetId: "elemental_pedestal_swap" },
  },
] as const;

export const PUZZLE_PRESET_CATALOG: readonly PuzzlePresetEntry[] = [
  ...BASE_PRESET_ENTRIES.map((entry): PuzzlePresetEntry => {
    const override = QUALITY_OVERRIDES[entry.id];
    return override ? { ...entry, ...override, tier: "quality" } : { ...entry, tier: "legacy" };
  }),
  ...NEW_QUALITY_PRESETS,
];
const PRESET_ALIASES: Readonly<Record<string, PuzzlePresetId>> = {
  "1": "lever_secret_passage",
  lever: "lever_secret_passage",
  secret_passage: "lever_secret_passage",
  "레버": "lever_secret_passage",
  "비밀통로": "lever_secret_passage",
  "2": "two_step_sequence",
  sequence: "two_step_sequence",
  password: "two_step_sequence",
  "2단계": "two_step_sequence",
  "비밀번호": "two_step_sequence",
  "순서레버": "two_step_sequence",
  "3": "cathedral_organ_tuning",
  organ: "cathedral_organ_tuning",
  constellation: "cathedral_organ_tuning",
  "오르간": "cathedral_organ_tuning",
  "별자리": "cathedral_organ_tuning",
  "성당": "cathedral_organ_tuning",
  "4": "brazier_ignition_order",
  brazier: "brazier_ignition_order",
  torch: "brazier_ignition_order",
  "횃불": "brazier_ignition_order",
  "화로": "brazier_ignition_order",
  "점화": "brazier_ignition_order",
  "5": "statue_pressure_plates",
  pressure_plates: "statue_pressure_plates",
  plates: "statue_pressure_plates",
  "발판": "statue_pressure_plates",
  "석상": "statue_pressure_plates",
  "6": "ice_conveyor_slide",
  ice_slide: "ice_conveyor_slide",
  conveyor: "ice_conveyor_slide",
  "얼음": "ice_conveyor_slide",
  "컨베이어": "ice_conveyor_slide",
  "미끄럼": "ice_conveyor_slide",
  "7": "time_gate_causality",
  time_causality: "time_gate_causality",
  causality: "time_gate_causality",
  "시간의문": "time_gate_causality",
  "시대연동": "time_gate_causality",
  "인과": "time_gate_causality",
  "8": "dynamite_rock_blast",
  dynamite: "dynamite_rock_blast",
  rock_blast: "dynamite_rock_blast",
  "다이너마이트": "dynamite_rock_blast",
  "폭파": "dynamite_rock_blast",
  "장애물": "dynamite_rock_blast",
  "9": "riddle_mimic_chests",
  mimic: "riddle_mimic_chests",
  riddle_chest: "riddle_mimic_chests",
  "미믹": "riddle_mimic_chests",
  "진실의상자": "riddle_mimic_chests",
  "보물상자수수께끼": "riddle_mimic_chests",
  "10": "sluice_lava_bridge",
  sluice: "sluice_lava_bridge",
  lava_bridge: "sluice_lava_bridge",
  "수문": "sluice_lava_bridge",
  "용암수위": "sluice_lava_bridge",
  "다리개방": "sluice_lava_bridge",
  "11": "stealth_guard_patrol",
  stealth: "stealth_guard_patrol",
  guard_patrol: "stealth_guard_patrol",
  "경비병": "stealth_guard_patrol",
  "잠입": "stealth_guard_patrol",
  "순찰": "stealth_guard_patrol",
  "12": "boss_seal_monoliths",
  boss_seal: "boss_seal_monoliths",
  monoliths: "boss_seal_monoliths",
  "결계": "boss_seal_monoliths",
  "3비석": "boss_seal_monoliths",
  "봉인비석": "boss_seal_monoliths",
  "13": "rolling_boulder_chasm",
  boulder: "rolling_boulder_chasm",
  rolling_boulder: "rolling_boulder_chasm",
  boulder_roll: "rolling_boulder_chasm",
  "바위굴리기": "rolling_boulder_chasm",
  "구렁메우기": "rolling_boulder_chasm",
  "바위궤적": "rolling_boulder_chasm",
  "14": "mirror_beam_refraction",
  mirror: "mirror_beam_refraction",
  mirror_beam: "mirror_beam_refraction",
  refraction: "mirror_beam_refraction",
  "거울": "mirror_beam_refraction",
  "빛줄기": "mirror_beam_refraction",
  "굴절": "mirror_beam_refraction",
  "15": "minecart_track_switch",
  minecart: "minecart_track_switch",
  track_switch: "minecart_track_switch",
  "광차": "minecart_track_switch",
  "선로전환": "minecart_track_switch",
  "광차충돌": "minecart_track_switch",
  "16": "elemental_pedestal_swap",
  elemental: "elemental_pedestal_swap",
  elemental_pedestal: "elemental_pedestal_swap",
  "사원소": "elemental_pedestal_swap",
  "원소제단": "elemental_pedestal_swap",
  "17": "cracked_plank_bridge",
  plank_bridge: "cracked_plank_bridge",
  cracked_plank: "cracked_plank_bridge",
  "판자다리": "cracked_plank_bridge",
  "무너지는다리": "cracked_plank_bridge",
  "한붓건너기": "cracked_plank_bridge",
  "18": "number_code_lock",
  number_lock: "number_code_lock",
  code_lock: "number_code_lock",
  "숫자자물쇠": "number_code_lock",
  "번호자물쇠": "number_code_lock",
  "개수세기": "number_code_lock",
  "19": "balance_scale_weights",
  balance_scale: "balance_scale_weights",
  scale_weights: "balance_scale_weights",
  "저울": "balance_scale_weights",
  "저울추": "balance_scale_weights",
  "무게맞추기": "balance_scale_weights",
  "20": "flip_floor_tiles",
  flip_tiles: "flip_floor_tiles",
  flip_floor: "flip_floor_tiles",
  "뒤집히는바닥": "flip_floor_tiles",
  "타일반전": "flip_floor_tiles",
};
export function resolvePuzzlePresetId(raw: unknown): PuzzlePresetId | undefined {
  if (typeof raw !== "string" && typeof raw !== "number") return undefined;
  const trimmed = String(raw).trim().toLowerCase().replace(/\s+/gu, "");
  if ((PUZZLE_PRESET_IDS as readonly string[]).includes(trimmed)) return trimmed as PuzzlePresetId;
  return PRESET_ALIASES[trimmed];
}

const NEIGHBORS: readonly Cell[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

const cellKey = (c: Cell): string => `${c.x},${c.y}`;

/** 프로젝트 내 모든 transfer 명령의 착지 좌표를 모아 퍼즐 기물이 착지 칸을 막지 않게 한다. */
function collectTransferLandings(project: Project, mapId: string): Set<string> {
  const landings = new Set<string>();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!node || typeof node !== "object") return;
    const rec = node as Record<string, unknown>;
    if (rec.kind === "transfer" && rec.mapId === mapId && typeof rec.x === "number" && typeof rec.y === "number") {
      landings.add(`${rec.x},${rec.y}`);
    }
    for (const val of Object.values(rec)) visit(val);
  };
  for (const map of Object.values(project.maps)) {
    for (const ev of map.events ?? []) {
      visit(ev.commands);
      for (const p of ev.pages ?? []) visit(p.commands);
    }
  }
  return landings;
}

function bfsDistances(project: Project, map: GameMap, origin: Cell, blocked: ReadonlySet<string>): Map<string, number> {
  const dist = new Map<string, number>([[cellKey(origin), 0]]);
  const queue: Cell[] = [origin];
  for (let i = 0; i < queue.length; i += 1) {
    const at = queue[i];
    if (!at) continue;
    const d = dist.get(cellKey(at)) ?? 0;
    for (const n of NEIGHBORS) {
      const next = { x: at.x + n.x, y: at.y + n.y };
      const k = cellKey(next);
      if (next.x < 0 || next.y < 0 || next.x >= map.width || next.y >= map.height) continue;
      if (dist.has(k) || blocked.has(k) || !isPassable(project, map, next.x, next.y)) continue;
      dist.set(k, d + 1);
      queue.push(next);
    }
  }
  return dist;
}

function mapOriginCell(project: Project, map: GameMap, main: ReadonlySet<string>): Cell {
  if (project.startMapId === map.id && main.has(cellKey(project.startPos))) {
    return project.startPos;
  }
  let best: Cell | undefined;
  let bestD = Infinity;
  for (const k of main) {
    const [x, y] = k.split(",").map(Number);
    if (x === undefined || y === undefined) continue;
    const d = Math.abs(x - map.width / 2) + Math.abs(y - map.height / 2);
    if (d < bestD) {
      bestD = d;
      best = { x, y };
    }
  }
  if (!best) throw new ToolError(`맵 '${map.name}'(${map.id})에 걸을 수 있는 바닥 칸이 없습니다.`, { code: "no-walkable", mapId: map.id });
  return best;
}

function isSafeGroundCell(project: Project, map: GameMap, x: number, y: number): boolean {
  if (x <= 0 || y <= 0 || x >= map.width - 1 || y >= map.height - 1) return false;
  if (!isPassable(project, map, x, y)) return false;
  const ts = project.tilesets[map.tilesetId];
  const lower = map.lowerTiles[y * map.width + x] ?? -1;
  if (ts) {
    if (supportSurfaceOf(ts, lower) !== "ground") return false;
    const tags = ts.tileMeta?.[lower]?.tags ?? [];
    if (tags.includes("water")) return false;
  }
  return true;
}

/**
 * 기준점(anchor) 근처에서 통행 그래프를 끊지 않는(non-cut-vertex) 안전한 바닥 칸 count 개를 고른다.
 * 각 칸이 기존 이벤트·시작 위치·전이 착지 칸과 겹치지 않으며, 서로 최소 2칸 이상(또는 인접해도 사방이 막히지 않게) 배치된다.
 */
export function pickPuzzleCluster(
  project: Project,
  map: GameMap,
  requestedAnchor: Cell | undefined,
  count: number,
  reservedExtra?: ReadonlySet<string>,
): { readonly origin: Cell; readonly cells: readonly Cell[]; readonly adjusted: boolean } {
  const main = mainComponent(project, map);
  const origin = mapOriginCell(project, map, main);
  const landings = collectTransferLandings(project, map.id);
  const eventOccupied = new Set<string>();
  for (const ev of map.events ?? []) {
    eventOccupied.add(`${ev.x},${ev.y}`);
  }
  const blocked = new Set<string>([
    ...eventOccupied,
    ...landings,
    cellKey(origin),
    ...(reservedExtra ?? []),
  ]);

  const anchor = requestedAnchor ?? {
    x: Math.round(map.width / 2),
    y: Math.round(map.height / 2),
  };
  const adjusted =
    requestedAnchor !== undefined &&
    (!main.has(cellKey(requestedAnchor)) ||
      blocked.has(cellKey(requestedAnchor)) ||
      !isSafeGroundCell(project, map, requestedAnchor.x, requestedAnchor.y));

  const picked: Cell[] = [];
  const nearExistingDoorOrTransfer = (c: Cell): boolean =>
    (map.events ?? []).some(
      (ev) =>
        Math.abs(ev.x - c.x) + Math.abs(ev.y - c.y) <= 1 &&
        (ev.pages ?? []).some((p) => p.commands.some((cmd) => cmd.kind === "transfer")),
    );

  for (let idx = 0; idx < count; idx += 1) {
    const reachableNow = bfsDistances(project, map, origin, blocked);
    const baseSize = reachableNow.size;
    const center = picked[0] ?? anchor;
    const candidates: Array<{ readonly x: number; readonly y: number; readonly score: number }> = [];
    for (const k of reachableNow.keys()) {
      if (k === cellKey(origin) || blocked.has(k)) continue;
      const [x, y] = k.split(",").map(Number);
      if (x === undefined || y === undefined) continue;
      if (!isSafeGroundCell(project, map, x, y)) continue;
      if (nearExistingDoorOrTransfer({ x, y })) continue;
      const tooCloseToPicked = picked.some((p) => Math.abs(p.x - x) + Math.abs(p.y - y) < 2);
      if (tooCloseToPicked) continue;
      const dAnchor = Math.abs(x - center.x) + Math.abs(y - center.y);
      const score = idx === 0 ? dAnchor : Math.abs(dAnchor - (idx + 1) * 2) + dAnchor * 0.25;
      candidates.push({ x, y, score });
    }
    candidates.sort((a, b) => a.score - b.score || a.y - b.y || a.x - b.x);

    let chosen: Cell | undefined;
    for (const cand of candidates.slice(0, 60)) {
      const k = `${cand.x},${cand.y}`;
      const trial = new Set(blocked);
      trial.add(k);
      const after = bfsDistances(project, map, origin, trial);
      if (after.size !== baseSize - 1) continue;
      // 모든 이미 고른 칸들이 여전히 인접 통행 칸을 최소 1개 이상 가지는지 확인
      const allApproachable = [...picked, { x: cand.x, y: cand.y }].every((p) =>
        NEIGHBORS.some((n) => after.has(`${p.x + n.x},${p.y + n.y}`)),
      );
      if (!allApproachable) continue;
      chosen = { x: cand.x, y: cand.y };
      break;
    }
    // 만약 거리>=2 조건으로 못 찾았으면 거리>=1 로 완화해 재시도
    if (!chosen) {
      for (const k of reachableNow.keys()) {
        if (k === cellKey(origin) || blocked.has(k)) continue;
        const [x, y] = k.split(",").map(Number);
        if (x === undefined || y === undefined || !isSafeGroundCell(project, map, x, y)) continue;
        const trial = new Set(blocked);
        trial.add(k);
        const after = bfsDistances(project, map, origin, trial);
        if (after.size !== baseSize - 1) continue;
        chosen = { x, y };
        break;
      }
    }
    if (!chosen) {
      throw new ToolError(
        `맵 '${map.name}'(${map.id})에서 통행을 막지 않는 퍼즐 배치 칸(${count}칸 중 ${idx + 1}번째)을 확보하지 못했습니다.`,
        { code: "puzzle-no-safe-spot", mapId: map.id },
      );
    }
    picked.push(chosen);
    blocked.add(cellKey(chosen));
  }

  return { origin, cells: picked, adjusted };
}

/**
 * changeTile 로 바꿀 통행 가능 바닥 타일 번호를 고른다.
 * 1순위: 현재 맵 lowerTiles 에서 이미 쓰이고 있는 다른 통행 가능 바닥 타일(길·광장·석판 등 — 맵 화풍 100% 일치).
 * 2순위: 타일셋 안의 다른 통행 가능 바닥 타일.
 */
export function pickRevealLowerTile(project: Project, map: GameMap, at: Cell): number {
  const current = map.lowerTiles[at.y * map.width + at.x] ?? 0;
  const ts = project.tilesets[map.tilesetId];
  const isGoodGroundTile = (tile: number): boolean => {
    if (!ts || tile < 0 || tile >= ts.count || tile === current) return false;
    const pass = ts.passability[tile];
    if (!pass || !pass.up || !pass.down || !pass.left || !pass.right) return false;
    if ((ts.priority[tile] ?? "lower") !== "lower") return false;
    if (supportSurfaceOf(ts, tile) !== "ground") return false;
    const tags = ts.tileMeta?.[tile]?.tags ?? [];
    if (tags.includes("water") || tags.includes("wall")) return false;
    return true;
  };

  const freq = new Map<number, number>();
  for (let i = 0; i < map.lowerTiles.length; i += 1) {
    const t = map.lowerTiles[i] ?? -1;
    if (isGoodGroundTile(t)) freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  const fromMap = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (fromMap !== undefined) return fromMap;

  if (ts) {
    for (let t = 0; t < ts.count; t += 1) {
      if (isGoodGroundTile(t)) return t;
    }
  }
  return current;
}

/** cell 목록에 대해 검증된 changeTile 명령 배열을 생성한다. */
export function buildVerifiedChangeTileCommands(
  project: Project,
  map: GameMap,
  cells: readonly Cell[],
): Command[] {
  const commands: Command[] = [];
  for (const c of cells) {
    const revealTile = pickRevealLowerTile(project, map, c);
    const lowerCmd: Command = {
      kind: "changeTile",
      mapId: map.id,
      layer: "lower",
      x: c.x,
      y: c.y,
      tile: revealTile,
    };
    const issues = changeTileProblems(lowerCmd, project);
    if (issues.length > 0) {
      throw new ToolError(`${issues[0]} — ${CHANGE_TILE_USAGE}`, { code: "invalid-change-tile" });
    }
    commands.push(lowerCmd);
    const upperIdx = c.y * map.width + c.x;
    if ((map.upperTiles[upperIdx] ?? -1) >= 0) {
      const clearUpper: Command = {
        kind: "changeTile",
        mapId: map.id,
        layer: "upper",
        x: c.x,
        y: c.y,
        tile: -1,
      };
      if (changeTileProblems(clearUpper, project).length === 0) {
        commands.push(clearUpper);
      }
    }
  }
  return commands;
}

interface ResolvedPuzzleReward {
  readonly itemId: string;
  readonly itemName: string;
  readonly itemDescription: string;
  readonly gold: number;
  readonly grantCommands: readonly Command[];
  readonly summaryLabel: string;
}

/** failPenalty 인자 — 들켰을 때 벌(stealth_guard_patrol). 없는 적 그룹·맵은 거절. */
function readFailPenalty(draft: Project, raw: unknown): MechanicContext["failPenalty"] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object") throw new ToolError("failPenalty 는 {troopId?, sendTo?:{mapId,x,y}, text?} 입니다.", { code: "invalid-args" });
  const r = raw as Record<string, unknown>;
  const troopId = typeof r.troopId === "string" && r.troopId.trim() ? r.troopId.trim() : undefined;
  if (troopId && !draft.database.troops.some((t) => t.id === troopId)) throw new ToolError(`failPenalty.troopId 적 그룹이 없습니다: ${troopId}`, { code: "troop-not-found" });
  let sendTo: { mapId: string; x: number; y: number } | undefined;
  if (r.sendTo && typeof r.sendTo === "object") {
    const t = r.sendTo as Record<string, unknown>;
    const mapId = String(t.mapId ?? ""), x = Number(t.x), y = Number(t.y);
    const target = draft.maps[mapId];
    if (!target) throw new ToolError(`failPenalty.sendTo 맵이 없습니다: ${mapId}`, { code: "map-not-found" });
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= target.width || y >= target.height) throw new ToolError("failPenalty.sendTo 좌표가 맵 밖입니다.", { code: "invalid-args" });
    sendTo = { mapId, x, y };
  }
  const text = typeof r.text === "string" && r.text.trim() ? r.text.trim() : undefined;
  if (!troopId && !sendTo && !text) return undefined;
  return { ...(troopId ? { troopId } : {}), ...(sendTo ? { sendTo } : {}), ...(text ? { text } : {}) };
}

/**
 * messages 인자 — 프리셋이 깔아 둔 대사를 이 게임 말투로 바꾼다.
 * reward = 보상 줄 틀({item}·{gold} 자리표시). replace = [{from, to}] 정확히 같은 대사 상자를 바꾼다(줄바꿈 \n 가능).
 * from 이 시공된 대사에 하나도 없으면 거절한다 — 먼저 messages 없이 시공해 data.texts 로 실제 대사를 확인한다.
 */
interface PuzzleMessages {
  readonly reward?: string;
  readonly replace: ReadonlyArray<{ readonly from: string; readonly to: string }>;
}

function readPuzzleMessages(raw: unknown): PuzzleMessages | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) throw new ToolError("messages 는 {reward?, replace?:[{from,to}]} 입니다.", { code: "invalid-args" });
  const r = raw as Record<string, unknown>;
  const reward = typeof r.reward === "string" && r.reward.trim() ? r.reward : undefined;
  const replace: Array<{ from: string; to: string }> = [];
  if (r.replace !== undefined) {
    if (!Array.isArray(r.replace)) throw new ToolError("messages.replace 는 [{from, to}] 배열입니다.", { code: "invalid-args" });
    for (const it of r.replace) {
      const o = (it ?? {}) as Record<string, unknown>;
      if (typeof o.from !== "string" || !o.from || typeof o.to !== "string" || !o.to.trim()) {
        throw new ToolError("messages.replace 의 각 항목은 {from: 바꿀 대사, to: 새 대사} 입니다(빈 문자열 불가).", { code: "invalid-args" });
      }
      replace.push({ from: o.from, to: o.to });
    }
  }
  if (!reward && replace.length === 0) return undefined;
  return { ...(reward ? { reward } : {}), replace };
}

/** 대사 상자(kind text) 본문을 모두 모은다 — 선택지 가지·조건 가지 안까지. */
function collectTextBodies(commands: readonly unknown[] | undefined, out: Set<string>): void {
  for (const c of commands ?? []) {
    if (!c || typeof c !== "object") continue;
    const r = c as Record<string, unknown>;
    if (r.kind === "text" && typeof r.body === "string") out.add(r.body);
    for (const v of Object.values(r)) if (Array.isArray(v)) collectTextBodies(v, out);
  }
}

function rewriteTextBodies(commands: readonly unknown[] | undefined, table: ReadonlyMap<string, string>, hit: Set<string>): void {
  for (const c of commands ?? []) {
    if (!c || typeof c !== "object") continue;
    const r = c as Record<string, unknown>;
    if (r.kind === "text" && typeof r.body === "string") {
      const to = table.get(r.body);
      if (to !== undefined) { hit.add(r.body); r.body = to; }
    }
    for (const v of Object.values(r)) if (Array.isArray(v)) rewriteTextBodies(v, table, hit);
  }
}

/** 시공한 이벤트들의 대사를 messages.replace 로 바꾸고, 바뀐 뒤의 대사 목록을 돌려준다. */
function applyPuzzleMessages(events: readonly GameEvent[], messages: PuzzleMessages | undefined): string[] {
  if (messages && messages.replace.length > 0) {
    const table = new Map(messages.replace.map((m) => [m.from, m.to]));
    const hit = new Set<string>();
    for (const e of events) for (const pg of e.pages ?? []) rewriteTextBodies(pg.commands as unknown[], table, hit);
    const missing = messages.replace.filter((m) => !hit.has(m.from)).map((m) => m.from);
    if (missing.length > 0) {
      const now = new Set<string>();
      for (const e of events) for (const pg of e.pages ?? []) collectTextBodies(pg.commands as unknown[], now);
      throw new ToolError(
        `messages.replace 의 from 대사를 시공 결과에서 찾지 못했습니다: ${missing.map((m) => JSON.stringify(m)).join(", ")}. 실제 대사: ${[...now].map((t) => JSON.stringify(t)).join(", ")}`,
        { code: "puzzle-message-not-found" },
      );
    }
  }
  const out = new Set<string>();
  for (const e of events) for (const pg of e.pages ?? []) collectTextBodies(pg.commands as unknown[], out);
  return [...out];
}

function preparePuzzleReward(
  draft: Project,
  preset: PuzzlePresetEntry,
  rawReward: unknown,
  rewardLine?: string,
): ResolvedPuzzleReward {
  const rec = rawReward && typeof rawReward === "object" ? (rawReward as Record<string, unknown>) : {};
  const itemId =
    typeof rec.itemId === "string" && rec.itemId.trim()
      ? sanitizeId(rec.itemId.trim())
      : preset.defaultReward.itemId;
  const itemName =
    typeof rec.itemName === "string" && rec.itemName.trim()
      ? rec.itemName.trim()
      : preset.defaultReward.itemName;
  const itemDescription =
    typeof rec.itemDescription === "string" && rec.itemDescription.trim()
      ? rec.itemDescription.trim()
      : preset.defaultReward.itemDescription;
  const gold =
    typeof rec.gold === "number" && Number.isFinite(rec.gold) && rec.gold >= 0
      ? Math.floor(rec.gold)
      : preset.defaultReward.gold;

  const existing = draft.database.items.find((it) => it.id === itemId);
  if (!existing) {
    draft.database.items.push(
      normalizeItemRecord({
        id: itemId,
        name: itemName,
        description: itemDescription,
        price: 0,
        consumable: false,
        occasion: "never",
      }),
    );
  }

  const grantCommands: Command[] = [
    ...lootGrantCommands({ itemId, gold }),
    textCmd(
      rewardLine
        ? rewardLine.replaceAll("{item}", existing?.name ?? itemName).replaceAll("{gold}", String(gold))
        : `퍼즐 해독 보상! 「${existing?.name ?? itemName}」${gold > 0 ? `과(와) ${gold}G` : ""}를 획득했다!`,
    ),
  ];

  return {
    itemId,
    itemName: existing?.name ?? itemName,
    itemDescription,
    gold,
    grantCommands,
    summaryLabel: `${existing?.name ?? itemName}${gold > 0 ? ` + ${gold}G` : ""}`,
  };
}

/** 기존 출입구/전이 이벤트(gateEventId)를 solveSwitchId 로 잠그고 풀리게 연결한다. */
function wireOptionalGateEvent(
  map: GameMap,
  gateEventId: string,
  solveSwitchId: string,
  lockedLine: string,
): boolean {
  const gate = map.events.find((ev) => ev.id === gateEventId);
  const firstPage = gate?.pages?.[0];
  if (!gate || !firstPage) return false;
  const alreadyWired = (gate.pages ?? []).some((p) =>
    p.conditions.some((c) => c.kind === "switch" && c.switchId === solveSwitchId),
  );
  if (alreadyWired) return true;
  const unlockedPage: EventPage = {
    ...structuredClone(firstPage),
    id: `${firstPage.id}_puzzle_open`,
    name: `${firstPage.name || gate.name || "출입구"} (개방)`,
    conditions: [...firstPage.conditions, { kind: "switch", switchId: solveSwitchId, value: true }],
  };
  const lockedPage: EventPage = {
    ...structuredClone(firstPage),
    id: `${firstPage.id}_puzzle_locked`,
    name: `${firstPage.name || gate.name || "출입구"} (봉인)`,
    conditions: [...firstPage.conditions],
    commands: [textCmd(lockedLine)],
  };
  gate.pages = [lockedPage, ...(gate.pages ?? []).slice(1), unlockedPage];
  return true;
}

function upsertPuzzleEvent(map: GameMap, event: GameEvent): void {
  const idx = map.events.findIndex((e) => e.id === event.id);
  if (idx >= 0) map.events[idx] = event;
  else map.events.push(event);
}

/**
 * 품질 프리셋 시공: 방 창 확보 → 시공기 → 이벤트 등록 → 모형 BFS 로 해 존재·최소 수·막다른 상태 측정(해 없으면 거절)
 * → 상호작용 도달성 검증 → 최단 해를 실기 플레이 절차(playtest)로 돌려준다.
 */
function runMechanicPreset(
  draft: Project,
  map: GameMap,
  preset: PuzzlePresetEntry,
  mechanic: MechanicDef,
  opts: {
    readonly baseId: string;
    readonly solveSwitchId: string;
    readonly requestedAnchor: Cell | undefined;
    readonly landings: ReadonlySet<string>;
    readonly args: Record<string, unknown>;
  },
): ToolExecResult {
  const { baseId, solveSwitchId, args } = opts;
  const win = claimPuzzleRoomWindow(draft, map, opts.requestedAnchor, opts.landings);
  if (!win) {
    throw new ToolError(
      `「${preset.title}」은 20×15 한 화면 방 전체를 짓는 퍼즐입니다. ${map.id} 에는 비어 있는 20×15 창이 없습니다(이벤트·이동 착지점·시작점이 있거나 맵이 작음). ` +
        `create_map({width:20,height:15,tilesetId:"atlas_biome_interior"}) 로 빈 방을 만들어 거기에 시공하고, 출입은 create_transfer_pair 로 잇는다.`,
      { code: "puzzle-room-needs-empty-window", mapId: map.id },
    );
  }
  const messages = readPuzzleMessages(args.messages);
  const reward = preparePuzzleReward(draft, preset, args.reward, messages?.reward);
  const title = typeof args.title === "string" && args.title.trim() ? args.title.trim() : undefined;
  const hint = typeof args.hintText === "string" && args.hintText.trim() ? args.hintText.trim() : undefined;
  const failPenalty = readFailPenalty(draft, args.failPenalty);
  const switchIds: string[] = [solveSwitchId];
  const variableIds: string[] = [];
  const built = mechanic.build({
    draft,
    map,
    win,
    baseId,
    solveSwitchId,
    rewardCommands: reward.grantCommands,
    ...(title ? { title } : {}),
    ...(hint ? { hint } : {}),
    ...(failPenalty ? { failPenalty } : {}),
    seed: hashSeed(baseId),
    sw: (suffix, label) => {
      const id = `sw_${baseId}_${suffix}`;
      ensureNamedSwitch(draft, id, `${title ?? preset.title} · ${label}`);
      switchIds.push(id);
      return id;
    },
    v: (suffix, label) => {
      const id = `var_${baseId}_${suffix}`;
      ensureNamedVariable(draft, id, `${title ?? preset.title} · ${label}`);
      variableIds.push(id);
      return id;
    },
    evId: (suffix) => `ev_${baseId}_${suffix}`,
  });
  const analysis = analysePuzzleModel(built.model);
  if (!analysis.solvable) {
    throw new ToolError(`「${preset.title}」 시공 결과의 풀이 모형에 해가 없습니다(상태 ${analysis.reachableStates}개 전수 탐색) — 시공을 롤백합니다.`, {
      code: "puzzle-unsolvable",
      mapId: map.id,
    });
  }
  const texts = applyPuzzleMessages(built.events.map(({ event }) => event), messages);
  for (const { event } of built.events) upsertPuzzleEvent(map, event);
  const shift = (c: Cell): Cell => ({ x: c.x + win.x, y: c.y + win.y });
  const origin = shift(built.origin);
  const warnings: string[] = [];
  let wiredGateEventId: string | undefined;
  if (typeof args.gateEventId === "string" && args.gateEventId.trim()) {
    const gid = args.gateEventId.trim();
    if (wireOptionalGateEvent(map, gid, solveSwitchId, `이 통로는 '${title ?? preset.title}' 장치를 먼저 풀어야 열립니다.`)) wiredGateEventId = gid;
    else warnings.push(`gateEventId '${gid}' 를 ${map.id} 에서 찾지 못해 자체 퍼즐 문만 배치했습니다.`);
  }
  // 조사·밟기 대상은 시작점에서 닿아야 한다(자동·병렬 진행 이벤트는 벽 속에 두므로 뺀다).
  const analysisPlacement = new EventPlacementAnalysis(draft, map);
  for (const { event } of built.events) {
    const page = event.pages?.[0];
    const kind = page?.trigger.kind;
    if (kind === "auto" || kind === "parallel" || page?.priority !== "same") continue;
    if (built.stagedReach?.includes(event.id)) continue;
    if (!analysisPlacement.hasInteractionPosition(event, origin)) {
      throw new ToolError(`퍼즐 이벤트 '${event.id}'(${event.x},${event.y}) 에 시작점 (${origin.x},${origin.y}) 에서 닿을 수 없습니다 — 롤백합니다.`, {
        code: "puzzle-softlock-prevented",
        mapId: map.id,
      });
    }
  }
  const playtest = [...(built.mistakeDemo?.(analysis) ?? []), ...built.toPlaytest(analysis.solution)];
  const events = built.events.map(({ event, role }) => ({ id: event.id, name: event.name ?? event.id, mapId: map.id, x: event.x, y: event.y, role }));
  return {
    summary:
      `${map.name}(${map.id})에 품질 퍼즐 「${title ?? preset.title}」(${preset.id}) 시공 완료 — 20×15 방(창 ${win.x},${win.y}), 이벤트 ${events.length}개, ` +
      `풀이 모형 BFS: 해 있음 · 최소 ${analysis.minMoves}수 · 상태 ${analysis.reachableStates}개 · 막다른 상태 ${analysis.deadEndStates}개, 보상 ${reward.summaryLabel}`,
    data: {
      mapId: map.id,
      presetId: preset.id,
      puzzleId: baseId,
      title: title ?? preset.title,
      category: preset.category,
      solveSwitchId,
      switchIds,
      variableIds,
      origin,
      roomOrigin: win,
      events,
      texts,
      changeTileCount: built.revealCommandCount,
      reward: { itemId: reward.itemId, itemName: reward.itemName, gold: reward.gold },
      wiredGateEventId: wiredGateEventId ?? null,
      solveSteps: built.solveSteps,
      solvability: {
        solvable: analysis.solvable,
        minMoves: analysis.minMoves,
        reachableStates: analysis.reachableStates,
        deadEndStates: analysis.deadEndStates,
        truncated: analysis.truncated,
        solution: analysis.solution,
      },
      playtest,
      walkabilityVerified: true,
    },
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

const listPuzzlePresetsTool: ToolDefinition = {
  name: "list_puzzle_presets",
  description:
    "AI 조수가 맵·던전·실내에 바로 설치할 수 있는 20종 JRPG·어드벤처 퍼즐 프리셋 카탈로그(상태 공간 BFS 검증 품질 프리셋 16종 + 호환 프리셋 4종)를 조회한다. " +
    "① 떨어지는 쇠창살 감옥 회랑 레버(lever_secret_passage) ② 4레버 마스터마인드 판정(two_step_sequence) " +
    "③ 성당 오르간 5음 메아리 기억(cathedral_organ_tuning) ④ 사방 화로 관계 단서 점화(brazier_ignition_order) " +
    "⑤ 석상 밀기 발판 소코반(statue_pressure_plates) ⑥ 빙판 동굴 미끄럼(ice_conveyor_slide) " +
    "⑦ 모래시계 신전 과거↔현재(time_gate_causality) ⑧ 다이너마이트 장애물 폭파(dynamite_rock_blast) " +
    "⑨ 거짓말쟁이 상자 추론(riddle_mimic_chests) ⑩ 두 저수조 3·5칸 수위 맞추기(sluice_lava_bridge) " +
    "⑪ 초소 경비 등불 시야 잠입(stealth_guard_patrol) ⑫ 보스 결계 3×3 수정 뒤집기 라이츠아웃(boss_seal_monoliths) " +
    "⑬ 거대 바위 굴리기·구렁 메우기(rolling_boulder_chasm) ⑭ 고대 거울 빛줄기 굴절(mirror_beam_refraction) " +
    "⑮ 광산 선로 전환기 & 광차 충돌(minecart_track_switch) ⑯ 사원소 구슬 제단 배치 추론(elemental_pedestal_swap) " +
    "⑰ 무너지는 판자 다리 한붓 건너기(cracked_plank_bridge) ⑱ 서재 유물 세기 세 자리 자물쇠(number_code_lock) " +
    "⑲ 청동 저울 추 무게 맞추기(balance_scale_weights) ⑳ 뒤집히는 룬 바닥 4×3 보행(flip_floor_tiles). " +
    "조회한 presetId 를 author_map_puzzle({mapId, presetId, x?, y?}) 에 전달해 한 번에 시공한다.",
  mode: "read",
  domains: ["event", "map"],
  parameters: {
    type: "object",
    properties: {
      category: {
        type: "string",
        description:
          "카테고리 필터(mechanism|sequence|musical_astronomy|elemental|spatial|movement|time_causality|obstacle_clear|riddle|environment|stealth|boss_seal|logic|memory|navigation)",
      },
      query: {
        type: "string",
        description: "검색어(예: 레버, 마스터마인드, 오르간, 화로, 소코반, 발판, 미믹, 수조, 라이츠아웃, 판자다리, 자물쇠, 저울, 바닥)",
      },
      presetId: {
        type: "string",
        description: "특정 프리셋 id 또는 번호(1~20)",
      },
    },
    additionalProperties: false,
  },
  run(_draft, args): ToolExecResult {
    const requestedPreset = args.presetId !== undefined ? resolvePuzzlePresetId(args.presetId) : undefined;
    const category = typeof args.category === "string" ? args.category.trim().toLowerCase() : "";
    const query = typeof args.query === "string" ? args.query.trim().toLowerCase() : "";

    const filtered = PUZZLE_PRESET_CATALOG.filter((entry) => {
      if (requestedPreset && entry.id !== requestedPreset) return false;
      if (category && entry.category !== category) return false;
      if (query) {
        const hay = `${entry.id} ${entry.title} ${entry.category} ${entry.genres.join(" ")} ${entry.summary} ${entry.mechanics}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });

    return {
      summary: `퍼즐 프리셋 ${filtered.length}/${PUZZLE_PRESET_CATALOG.length}종 조회 — ${filtered.map((p) => `${p.index}.${p.id}`).join(", ")}. 시공은 author_map_puzzle({mapId, presetId}) 한 번으로 완료한다.`,
      data: {
        total: PUZZLE_PRESET_CATALOG.length,
        count: filtered.length,
        presets: filtered,
        usage: "author_map_puzzle({ mapId, presetId, x?, y?, title?, hintText?, gateEventId?, reward?, messages? })",
      },
    };
  },
};

const authorMapPuzzleTool: ToolDefinition = {
  name: "author_map_puzzle",
  description:
    "20종 퍼즐 프리셋(list_puzzle_presets) 중 하나를 대상 맵에 원자적으로 시공한다. " +
    "{mapId, presetId, puzzleId?, x?, y?, targetMapId?, gateEventId?, solveSwitchId?, title?, hintText?, reward?, messages?} — " +
    "x·y 를 생략하면 맵의 주 통행 영역에서 길·출입구·시작점을 막지 않는 안전한 바닥 클러스터를 자동으로 찾아 배치한다. " +
    "모든 프리셋은 ① 작동 전/후가 눈에 보이는 2상태 기물 그래픽(레버·화로·발판·비석·보물상자·낙석·경비병) " +
    "② 실제 타일을 바꾸는 changeTile 명령(비밀 통로·지하 계단·돌다리·광맥 바닥·결계 해제) " +
    "③ 효과음(playAudio)·화면 진동(Shake Screen)·섬광(Flash Screen)·파티클(Particle Effect) " +
    "④ 스위치/변수 배선 및 보상 아이템·골드 지급 ⑤ 시공 후 도달성·통행 무결성 검증(소프트락 0)을 한 호출로 완결한다.",
  mode: "write",
  domains: ["event", "map"],
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "퍼즐을 배치할 대상 맵 id" },
      presetId: {
        type: "string",
        enum: [...PUZZLE_PRESET_IDS],
        description: `퍼즐 프리셋 id (${PUZZLE_PRESET_IDS.join(" | ")})`,
      },
      puzzleId: { type: "string", description: "퍼즐 고유 식별자(생략 시 mapId_presetId)" },
      x: { type: "integer", description: "기준 좌표 X (생략 시 통행 안전한 바닥에 자동 배치)" },
      y: { type: "integer", description: "기준 좌표 Y (생략 시 통행 안전한 바닥에 자동 배치)" },
      targetMapId: {
        type: "string",
        description: "time_gate_causality 등 시대/맵 간 연동 시 결과가 나타날 대상 맵 id (생략 시 mapId 안의 다른 안전 구역)",
      },
      gateEventId: {
        type: "string",
        description: "퍼즐 해결 시 함께 잠금 해제할 기존 출입구/전이 이벤트 id (선택)",
      },
      solveSwitchId: {
        type: "string",
        description: "퍼즐 해결 시 켜질 스위치 id (생략 시 sw_puzzle_<puzzleId>_solved 자동 생성)",
      },
      title: { type: "string", description: "퍼즐·장치 표시 이름 (선택)" },
      hintText: { type: "string", description: "단서 비석·도입 안내 대사 커스텀 문구 (선택)" },
      rewordLines: {
        type: "array", maxItems: 40,
        description: "프리셋 대사를 그 장소 말로 바꾼다(선택). 프리셋이 쓴 대사 한 줄(from, 통째로 같아야 함) → 새 줄(to). 맞는 줄이 없으면 거절하며 이 퍼즐의 실제 대사 목록을 돌려준다 — 먼저 없이 한 번 짓고 data·대사를 보고 고치면 된다",
        items: { type: "object", additionalProperties: false, properties: { from: { type: "string" }, to: { type: "string" } }, required: ["from", "to"] },
      },
      renameObjects: {
        type: "array", maxItems: 12,
        description: "퍼즐 기물 이벤트 이름 바꾸기(선택) — [{eventId, name}]. eventId 는 이 퍼즐이 지은 이벤트(퍼즐 id 또는 ev_퍼즐 id 로 시작)",
        items: { type: "object", additionalProperties: false, properties: { eventId: { type: "string" }, name: { type: "string" } }, required: ["eventId", "name"] },
      },
      failPenalty: {
        type: "object", additionalProperties: false,
        description: "들켰을 때 벌(잠입 stealth_guard_patrol). 생략 = 입구로 쫓겨남. troopId = 먼저 그 적 그룹과 싸움(도망 불가, 져도 게임 오버 아님) · sendTo = 쫓겨나는 곳(다른 맵 가능, 예: 감방으로 다시) · text = 들킨 대사",
        properties: {
          troopId: { type: "string" },
          sendTo: { type: "object", additionalProperties: false, properties: { mapId: { type: "string" }, x: { type: "integer" }, y: { type: "integer" } }, required: ["mapId", "x", "y"] },
          text: { type: "string" },
        },
      },
      messages: {
        type: "object", additionalProperties: false,
        description:
          "프리셋 기본 대사를 게임 말투로 바꾼다(선택). reward = 보상 줄 틀, {item}·{gold} 자리표시(예: \"「{item}」와 {gold}G를 되찾았다.\"). " +
          "replace = [{from, to}] — 시공된 대사 상자 중 from 과 정확히 같은 것을 to 로 바꾼다(\\n 줄바꿈 가능). " +
          "실제 대사는 결과 data.texts 에 있다. 처음엔 messages 없이 시공해 texts 를 보고, 같은 puzzleId 로 다시 부르면 덮어쓴다. 못 찾은 from 은 거절.",
        properties: {
          reward: { type: "string" },
          replace: {
            type: "array",
            items: { type: "object", additionalProperties: false, properties: { from: { type: "string" }, to: { type: "string" } }, required: ["from", "to"] },
          },
        },
      },
      reward: {
        type: "object",
        description: "{itemId?, itemName?, itemDescription?, gold?} 커스텀 보상 (생략 시 프리셋 기본 보상)",
        properties: {
          itemId: { type: "string" },
          itemName: { type: "string" },
          itemDescription: { type: "string" },
          gold: { type: "integer" },
        },
        additionalProperties: false,
      },
    },
    required: ["mapId", "presetId"],
    additionalProperties: false,
  },
  invalidArgsExample: {
    mapId: "map_1",
    presetId: "lever_secret_passage",
    x: 12,
    y: 10,
  },
  run(draft, args): ToolExecResult {
    const result = authorMapPuzzleCore(draft, args);
    applyPuzzleWording(draft, args, result);
    return result;
  },
};

function authorMapPuzzleCore(draft: Project, args: Record<string, unknown>): ToolExecResult {
    const map = requireMap(draft, String(args.mapId ?? ""));
    const presetId = resolvePuzzlePresetId(args.presetId);
    if (!presetId) {
      throw new ToolError(
        `알 수 없는 presetId '${String(args.presetId)}' 입니다 — 허용: ${PUZZLE_PRESET_IDS.join(", ")}. list_puzzle_presets 로 카탈로그를 확인하세요.`,
        { code: "invalid-puzzle-preset", mapId: map.id },
      );
    }
    const preset = PUZZLE_PRESET_CATALOG.find((p) => p.id === presetId);
    if (!preset) {
      throw new ToolError(`프리셋 '${presetId}' 정의를 찾지 못했습니다.`, { code: "invalid-puzzle-preset" });
    }

    const baseId = sanitizeId(
      typeof args.puzzleId === "string" && args.puzzleId.trim()
        ? args.puzzleId.trim()
        : `${map.id}_${presetId}`,
    );
    const solveSwitchId =
      typeof args.solveSwitchId === "string" && args.solveSwitchId.trim()
        ? args.solveSwitchId.trim()
        : `sw_puzzle_${baseId}_solved`;
    ensureNamedSwitch(draft, solveSwitchId, `${preset.title} 해결`);

    const requestedAnchor: Cell | undefined =
      typeof args.x === "number" && typeof args.y === "number"
        ? { x: Math.trunc(args.x), y: Math.trunc(args.y) }
        : undefined;

    const landings = collectTransferLandings(draft, map.id);
    const mechanic = PUZZLE_MECHANICS[presetId];
    if (mechanic) {
      return runMechanicPreset(draft, map, preset, mechanic, { baseId, solveSwitchId, requestedAnchor, landings, args });
    }
    const stagePlan = buildDramaticPuzzleStage(
      draft,
      map,
      presetId,
      baseId,
      solveSwitchId,
      requestedAnchor,
      landings,
    );
    const cluster = stagePlan
      ? { origin: stagePlan.origin, cells: stagePlan.cells, adjusted: false }
      : pickPuzzleCluster(draft, map, requestedAnchor, preset.requiredCells);
    const cells = cluster.cells;
    const resolveChangeTiles = (fallbackCells: readonly Cell[]): Command[] =>
      stagePlan && stagePlan.changeTileCommands.length > 0
        ? [...stagePlan.changeTileCommands]
        : buildVerifiedChangeTileCommands(draft, map, fallbackCells);
    const messages = readPuzzleMessages(args.messages);
    const reward = preparePuzzleReward(draft, preset, args.reward, messages?.reward);
    const customTitle = typeof args.title === "string" && args.title.trim() ? args.title.trim() : undefined;
    const customHint = typeof args.hintText === "string" && args.hintText.trim() ? args.hintText.trim() : undefined;
    const warnings: string[] = [];
    if (cluster.adjusted && requestedAnchor) {
      warnings.push(
        `요청 좌표 (${requestedAnchor.x},${requestedAnchor.y}) 가 막혔거나 다른 요소와 겹쳐 안전한 통행 바닥 (${cells[0]!.x},${cells[0]!.y}) 일대로 자동 조정했습니다.`,
      );
    }

    const createdEvents: Array<{ readonly id: string; readonly name: string; readonly mapId: string; readonly x: number; readonly y: number; readonly role: string }> = [];
    const switchIds: string[] = [solveSwitchId];
    const variableIds: string[] = [];
    let changeTileCmds: Command[] = [];
    let solveStepsSummary: string[] = [];

    const registerEvent = (targetMap: GameMap, event: GameEvent, role: string): void => {
      upsertPuzzleEvent(targetMap, event);
      createdEvents.push({
        id: event.id,
        name: event.name ?? event.id,
        mapId: targetMap.id,
        x: event.x,
        y: event.y,
        role,
      });
    };

    switch (presetId) {
      case "lever_secret_passage": {
        const cLever = cells[0]!;
        const cGate = cells[1]!;
        const leverId = `ev_${baseId}_lever`;
        const gateId = `ev_${baseId}_passage`;
        changeTileCmds = resolveChangeTiles([cGate, cLever]);
        const leverDown = objGraphic("object2", 0, "down");
        const leverUp = objGraphic("object2", 0, "up");
        const gateClosed = objGraphic("object1", 3, "down");
        const gateOpen = objGraphic("object1", 3, "up");

        const leverEvent: GameEvent = {
          id: leverId,
          name: customTitle ?? "비밀통로 작동 레버",
          x: cLever.x,
          y: cLever.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${leverId}_p1`,
              name: "레버 (작동 전)",
              graphic: leverDown,
              commands: [
                textCmd(customHint ?? "묵직한 철제 레버다. 벽 너머의 비밀 통로와 연결되어 있는 듯하다."),
                {
                  kind: "choices",
                  prompt: "레버를 어떻게 할까?",
                  options: [
                    {
                      text: "레버를 힘껏 당긴다",
                      branch: [
                        sfx("switch-clack"),
                        { kind: "setEventGraphicPattern", eventId: leverId, pattern: leverUp.pattern ?? 0 },
                        shake(3, 500),
                        ...tintPulse("255,255,255", 0.4),
                        se("collapse1"),
                        particles("dust", 700),
                        sfx("secret-solved"),
                        ...changeTileCmds,
                        textCmd("철컥— 덜커덩! 바닥 타일이 움직이며 옆의 비밀 통로 철문이 열렸다!"),
                        ...reward.grantCommands,
                        { kind: "setSwitch", switchId: solveSwitchId, value: true },
                      ],
                    },
                    {
                      text: "손대지 않는다",
                      branch: [textCmd("레버를 그대로 두었다.")],
                    },
                  ],
                },
              ],
            }),
            makePage({
              id: `${leverId}_p2`,
              name: "레버 (작동 완료)",
              conditions: [{ kind: "switch", switchId: solveSwitchId, value: true }],
              graphic: leverUp,
              commands: [textCmd("레버가 당겨진 채 고정되어 있다. 비밀 통로가 열려 있다.")],
            }),
          ],
        };

        const gateEvent: GameEvent = {
          id: gateId,
          name: "비밀 통로 철문",
          x: cGate.x,
          y: cGate.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${gateId}_closed`,
              name: "비밀 통로 (닫힘)",
              graphic: gateClosed,
              priority: "same",
              commands: [textCmd("굳게 닫힌 비밀 통로 철문이다. 근처의 레버를 당기면 열릴 것 같다.")],
            }),
            makePage({
              id: `${gateId}_open`,
              name: "비밀 통로 (열림)",
              conditions: [{ kind: "switch", switchId: solveSwitchId, value: true }],
              graphic: gateOpen,
              priority: "below",
              overlapForbidden: false,
              commands: [textCmd("레버 장치로 개방된 비밀 통로다. 자유롭게 지나갈 수 있다.")],
            }),
          ],
        };

        registerEvent(map, leverEvent, "2상태 레버 장치");
        registerEvent(map, gateEvent, "개방되는 비밀 통로문");
        solveStepsSummary = [
          `(${cLever.x},${cLever.y}) '${leverEvent.name}' 조사 → 「레버를 힘껏 당긴다」 선택`,
          `changeTile ${changeTileCmds.length}칸 실행 및 (${cGate.x},${cGate.y}) '${gateEvent.name}' 통행 개방`,
        ];
        break;
      }

      case "two_step_sequence": {
        const cClue = cells[0]!;
        const cConsole = cells[1]!;
        const cGate = cells[2]!;
        const clueId = `ev_${baseId}_clue`;
        const consoleId = `ev_${baseId}_console`;
        const gateId = `ev_${baseId}_gate`;
        changeTileCmds = resolveChangeTiles([cGate, cConsole]);
        const consoleDown = objGraphic("object2", 0, "down");
        const consoleUp = objGraphic("object2", 0, "up");

        const clueEvent: GameEvent = {
          id: clueId,
          name: "암호 단서 비석",
          x: cClue.x,
          y: cClue.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${clueId}_p1`,
              name: "단서 비석",
              graphic: objGraphic("object2", 3, "down"),
              commands: [
                textCmd(
                  customHint ??
                    "비석에 보안 해제 순서가 새겨져 있다: 「1단계 주 레버는 [왼쪽], 2단계 보조 다이얼은 [가운데]에 맞출 것.」",
                ),
              ],
            }),
          ],
        };

        const consoleEvent: GameEvent = {
          id: consoleId,
          name: customTitle ?? "2단계 보안 콘솔",
          x: cConsole.x,
          y: cConsole.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${consoleId}_p1`,
              name: "보안 콘솔 (잠김)",
              graphic: consoleDown,
              commands: [
                textCmd("2단계 보안 잠금 장치다. 주 레버와 보조 다이얼을 순서대로 맞춰야 한다."),
                {
                  kind: "choices",
                  prompt: "1단계 — 주 레버를 어느 쪽으로 당길까?",
                  options: [
                    {
                      text: "왼쪽으로 당긴다",
                      branch: [
                        sfx("switch-clack"),
                        textCmd("철컥! 1단계 주 레버가 맞물렸다."),
                        {
                          kind: "choices",
                          prompt: "2단계 — 보조 다이얼을 어디에 맞출까?",
                          options: [
                            {
                              text: "위쪽 눈금",
                              branch: [
                                sfx("wrong"),
                                ...tintPulse("200,40,40", 0.3, 100, 400),
                                shake(3, 400),
                                textCmd("경보음이 울리며 레버가 초기 위치로 튕겨 돌아갔다!"),
                              ],
                            },
                            {
                              text: "가운데 눈금",
                              branch: [
                                se("chime2"),
                                { kind: "setEventGraphicPattern", eventId: consoleId, pattern: consoleUp.pattern ?? 0 },
                                ...tintPulse("255,255,255", 0.4),
                                shake(3, 450),
                                particles("sparkle", 800),
                                sfx("secret-solved"),
                                ...changeTileCmds,
                                textCmd("삐비빅— 「2단계 보안 인증 완료!」 철문이 열리며 바닥 잠금이 해제되었다!"),
                                ...reward.grantCommands,
                                { kind: "setSwitch", switchId: solveSwitchId, value: true },
                              ],
                            },
                            {
                              text: "아래쪽 눈금",
                              branch: [
                                sfx("wrong"),
                                ...tintPulse("200,40,40", 0.3, 100, 400),
                                textCmd("다이얼이 맞지 않는다. 처음부터 다시 조작해야 한다."),
                              ],
                            },
                          ],
                        },
                      ],
                    },
                    {
                      text: "오른쪽으로 당긴다",
                      branch: [
                        sfx("wrong"),
                        ...tintPulse("200,40,40", 0.3, 100, 400),
                        textCmd("1단계 레버 방향이 틀렸다! 단서 비석을 다시 확인하자."),
                      ],
                    },
                  ],
                },
              ],
            }),
            makePage({
              id: `${consoleId}_p2`,
              name: "보안 콘솔 (해제됨)",
              conditions: [{ kind: "switch", switchId: solveSwitchId, value: true }],
              graphic: consoleUp,
              commands: [textCmd("2단계 보안 콘솔이 푸른 불빛을 내며 열려 있다.")],
            }),
          ],
        };

        const gateEvent: GameEvent = {
          id: gateId,
          name: "보안 격벽문",
          x: cGate.x,
          y: cGate.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${gateId}_closed`,
              name: "보안 격벽문 (차단)",
              graphic: objGraphic("object1", 4, "down"),
              priority: "same",
              commands: [textCmd("2단계 보안 콘솔로 잠긴 격벽문이다.")],
            }),
            makePage({
              id: `${gateId}_open`,
              name: "보안 격벽문 (개방)",
              conditions: [{ kind: "switch", switchId: solveSwitchId, value: true }],
              graphic: objGraphic("object1", 4, "up"),
              priority: "below",
              overlapForbidden: false,
              commands: [textCmd("보안 격벽문이 완전히 개방되었다.")],
            }),
          ],
        };

        registerEvent(map, clueEvent, "단서 비석");
        registerEvent(map, consoleEvent, "2단계 보안 콘솔");
        registerEvent(map, gateEvent, "보안 격벽문");
        solveStepsSummary = [
          `(${cClue.x},${cClue.y}) 단서 비석 확인`,
          `(${cConsole.x},${cConsole.y}) '${consoleEvent.name}' → 1단계 「왼쪽으로 당긴다」 → 2단계 「가운데 눈금」 선택`,
          `changeTile ${changeTileCmds.length}칸 및 (${cGate.x},${cGate.y}) 격벽문 개방`,
        ];
        break;
      }

      case "cathedral_organ_tuning": {
        const cOrgan = cells[0]!;
        const cScore = cells[1]!;
        const cStair = cells[2]!;
        const organId = `ev_${baseId}_organ`;
        const scoreId = `ev_${baseId}_score`;
        const stairId = `ev_${baseId}_stair`;
        changeTileCmds = resolveChangeTiles([cStair, cOrgan]);

        const scoreEvent: GameEvent = {
          id: scoreId,
          name: "성가대 별자리 보면대",
          x: cScore.x,
          y: cScore.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${scoreId}_p1`,
              name: "별자리 악보",
              graphic: objGraphic("object2", 3, "down"),
              commands: [
                textCmd(
                  customHint ??
                    "성가대 보면대에 고대 악보가 놓여 있다: 「제1장: 새벽의 별 화음을 울려라. 제2장: 울림이 가시기 전에 숨은 페달을 밟으라.」",
                ),
              ],
            }),
          ],
        };

        const organEvent: GameEvent = {
          id: organId,
          name: customTitle ?? "대성당 파이프 오르간",
          x: cOrgan.x,
          y: cOrgan.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${organId}_p1`,
              name: "파이프 오르간 (조율 전)",
              graphic: objGraphic("object2", 7, "down"),
              commands: [
                textCmd("장엄한 파이프 오르간이다. 건반과 발밑의 페달이 정교한 톱니로 맞물려 있다."),
                {
                  kind: "choices",
                  prompt: "1단계 — 어떤 화음을 연주할까?",
                  options: [
                    {
                      text: "새벽의 별 화음을 연주한다",
                      branch: [
                        se("chime2"),
                        particles("magic", 700),
                        textCmd("파이프에서 은은한 별빛 화음이 성당 천장으로 울려 퍼졌다!"),
                        {
                          kind: "choices",
                          prompt: "2단계 — 화음이 울리는 동안 무엇을 조작할까?",
                          options: [
                            {
                              text: "오르간 아래 숨은 페달을 밟는다",
                              branch: [
                                se("bell"),
                                se("collapse1"),
                                ...revealInWaves(changeTileCmds, { flash: "yellow", waves: ["dust", "smoke", "sparkle"] }),
                                textCmd("쿠구구궁—! 오르간 공명과 함께 바닥 타일이 열리며 지하 비밀 계단과 성좌의 결정이 드러났다!"),
                                ...reward.grantCommands,
                                { kind: "setSwitch", switchId: solveSwitchId, value: true },
                              ],
                            },
                            {
                              text: "건반 덮개를 닫는다",
                              branch: [
                                se("cancel1"),
                                textCmd("화음이 멎었다. 처음부터 다시 연주해야 한다."),
                              ],
                            },
                          ],
                        },
                      ],
                    },
                    {
                      text: "불협화음을 내리친다",
                      branch: [
                        sfx("wrong"),
                        shake(1, 300),
                        textCmd("귀를 찌르는 소리가 울렸지만 아무 장치도 움직이지 않았다."),
                      ],
                    },
                  ],
                },
              ],
            }),
            makePage({
              id: `${organId}_p2`,
              name: "파이프 오르간 (공명 완료)",
              conditions: [{ kind: "switch", switchId: solveSwitchId, value: true }],
              graphic: objGraphic("object2", 6, "down"),
              commands: [textCmd("파이프 오르간이 성좌의 빛을 머금고 공명하고 있다. 지하 계단이 열려 있다.")],
            }),
          ],
        };

        const stairEvent: GameEvent = {
          id: stairId,
          name: "드러난 비밀 계단",
          x: cStair.x,
          y: cStair.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${stairId}_hidden`,
              name: "바닥 문양 (잠김)",
              graphic: objGraphic("object2", 2, "down"),
              priority: "below",
              overlapForbidden: false,
              commands: [textCmd("바닥 석판 아래에서 희미한 바람 소리가 들린다. 오르간을 조율하면 열릴 것 같다.")],
            }),
            makePage({
              id: `${stairId}_revealed`,
              name: "비밀 계단 (개방)",
              conditions: [{ kind: "switch", switchId: solveSwitchId, value: true }],
              graphic: objGraphic("object2", 6, "down"),
              priority: "below",
              overlapForbidden: false,
              commands: [textCmd("오르간 조율로 드러난 성당 지하 비밀 계단이다!")],
            }),
          ],
        };

        registerEvent(map, scoreEvent, "별자리 악보 단서");
        registerEvent(map, organEvent, "파이프 오르간 조율기");
        registerEvent(map, stairEvent, "지하 비밀 계단");
        solveStepsSummary = [
          `(${cScore.x},${cScore.y}) 성가대 보면대에서 악보 힌트 확인`,
          `(${cOrgan.x},${cOrgan.y}) 파이프 오르간 → 「새벽의 별 화음을 연주한다」 → 「오르간 아래 숨은 페달을 밟는다」`,
          `changeTile ${changeTileCmds.length}칸으로 (${cStair.x},${cStair.y}) 비밀 계단 개방`,
        ];
        break;
      }

      case "brazier_ignition_order": {
        const cB1 = cells[0]!;
        const cB2 = cells[1]!;
        const cB3 = cells[2]!;
        const cSeal = cells[3]!;
        const progressVar = `var_${baseId}_brazier_step`;
        ensureNamedVariable(draft, progressVar, `${preset.title} 점화 단계`);
        variableIds.push(progressVar);
        const swB1 = `sw_${baseId}_brazier_1`;
        const swB2 = `sw_${baseId}_brazier_2`;
        const swB3 = `sw_${baseId}_brazier_3`;
        ensureNamedSwitch(draft, swB1, "제1화로 점화");
        ensureNamedSwitch(draft, swB2, "제2화로 점화");
        ensureNamedSwitch(draft, swB3, "제3화로 점화");
        switchIds.push(swB1, swB2, swB3);

        changeTileCmds = resolveChangeTiles([cSeal, cB1, cB2, cB3]);
        const unlitGraphic = objGraphic("object2", 3, "down");
        const litGraphic = objGraphic("object2", 6, "down");

        const resetBraziers: Command[] = [
          sfx("wrong"),
          ...tintPulse("200,40,40", 0.3, 100, 400),
          shake(3, 400),
          { kind: "setVariable", variableId: progressVar, op: "=", value: 0 },
          { kind: "setSwitch", switchId: swB1, value: false },
          { kind: "setSwitch", switchId: swB2, value: false },
          { kind: "setSwitch", switchId: swB3, value: false },
          textCmd("불길이 역류해 모두 꺼졌다! 반드시 「제1화로 → 제2화로 → 제3화로」 순서로 점화해야 한다."),
        ];

        const makeBrazier = (idx: 1 | 2 | 3, at: Cell, swId: string): GameEvent => {
          const evId = `ev_${baseId}_brazier_${idx}`;
          const expectedPrev = idx - 1;
          const isFinal = idx === 3;
          const onCorrect: Command[] = [
            se("fire7"),
            ...tintPulse("200,40,40", 0.3, 100, 400),
            particles("fire", 1200, at),
            particles("smoke", 1200, { x: at.x, y: at.y - 1 }),
            { kind: "setVariable", variableId: progressVar, op: "=", value: idx },
            { kind: "setSwitch", switchId: swId, value: true },
            ...(stagePlan?.stepChangeTileCommands[`brazier_${idx}`] ?? []),
            shake(3, 300),
            textCmd(`화르륵! 제${idx}화로에 붉은 성화가 타올랐다! (${idx}/3)`),
            ...(isFinal
              ? [
                  se("collapse1"),
                  ...revealInWaves(changeTileCmds, { flash: "red", waves: ["fire", "smoke", "sparkle"] }),
                  textCmd("세 화로의 불길이 하나로 공명하며 화염 봉인 철창이 열렸다!"),
                  ...reward.grantCommands,
                  { kind: "setSwitch", switchId: solveSwitchId, value: true } as Command,
                ]
              : []),
          ];

          return {
            id: evId,
            name: `제${idx} 고대 화로`,
            x: at.x,
            y: at.y,
            trigger: { kind: "action" },
            commands: [],
            pages: [
              makePage({
                id: `${evId}_unlit`,
                name: `제${idx}화로 (꺼짐)`,
                graphic: unlitGraphic,
                commands: [
                  {
                    kind: "fork",
                    condition: { kind: "variable", variableId: progressVar, op: "==", value: expectedPrev },
                    then: onCorrect,
                    else: resetBraziers,
                  },
                ],
              }),
              makePage({
                id: `${evId}_lit`,
                name: `제${idx}화로 (점화됨)`,
                conditions: [{ kind: "switch", switchId: swId, value: true }],
                graphic: litGraphic,
                commands: [textCmd(`제${idx}화로가 붉은 불꽃을 뿜으며 타오르고 있다.`)],
              }),
            ],
          };
        };

        const sealId = `ev_${baseId}_seal`;
        const sealEvent: GameEvent = {
          id: sealId,
          name: customTitle ?? "화염 봉인 철창문",
          x: cSeal.x,
          y: cSeal.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${sealId}_locked`,
              name: "화염 봉인문 (잠김)",
              graphic: objGraphic("object1", 5, "down"),
              priority: "same",
              commands: [
                textCmd(
                  customHint ??
                    "차가운 철창이 길을 막고 있다. 「제1화로 → 제2화로 → 제3화로」 순서로 성화를 밝혀야 열린다.",
                ),
              ],
            }),
            makePage({
              id: `${sealId}_open`,
              name: "화염 봉인문 (개방)",
              conditions: [{ kind: "switch", switchId: solveSwitchId, value: true }],
              graphic: { transparent: true },
              priority: "below",
              overlapForbidden: false,
              commands: [textCmd("세 화로의 불길로 봉인이 풀린 통로다.")],
            }),
          ],
        };

        registerEvent(map, makeBrazier(1, cB1, swB1), "제1화로");
        registerEvent(map, makeBrazier(2, cB2, swB2), "제2화로");
        registerEvent(map, makeBrazier(3, cB3, swB3), "제3화로");
        registerEvent(map, sealEvent, "화염 봉인 철창문");
        solveStepsSummary = [
          `(${cB1.x},${cB1.y}) 제1 고대 화로 조사 점화`,
          `(${cB2.x},${cB2.y}) 제2 고대 화로 조사 점화`,
          `(${cB3.x},${cB3.y}) 제3 고대 화로 조사 점화 → changeTile ${changeTileCmds.length}칸 및 (${cSeal.x},${cSeal.y}) 봉인 개방`,
        ];
        break;
      }

      case "statue_pressure_plates": {
        const cP1 = cells[0]!;
        const cP2 = cells[1]!;
        const cGate = cells[2]!;
        const swP1 = `sw_${baseId}_plate_1`;
        const swP2 = `sw_${baseId}_plate_2`;
        ensureNamedSwitch(draft, swP1, "제1 압력 발판 작동");
        ensureNamedSwitch(draft, swP2, "제2 압력 발판 작동");
        switchIds.push(swP1, swP2);

        changeTileCmds = resolveChangeTiles([cGate, cP1, cP2]);
        const plateFresh = objGraphic("object2", 4, "down");
        const platePressed = objGraphic("object2", 2, "down");

        const unlockSequence: Command[] = [
          se("collapse1"),
          ...revealInWaves(changeTileCmds, { flash: "white", waves: ["dust", "smoke", "sparkle"] }),
          textCmd("쿠구구궁—! 모든 압력 발판이 내려앉으며 고대 유적 석문이 열렸다!"),
          ...reward.grantCommands,
          { kind: "setSwitch", switchId: solveSwitchId, value: true },
        ];

        const makePlate = (idx: 1 | 2, at: Cell, swId: string): GameEvent => {
          const evId = `ev_${baseId}_plate_${idx}`;
          return {
            id: evId,
            name: `제${idx} 석상 압력 발판`,
            x: at.x,
            y: at.y,
            trigger: { kind: "playerTouch" },
            commands: [],
            pages: [
              makePage({
                id: `${evId}_fresh`,
                name: `제${idx}발판 (미작동)`,
                graphic: plateFresh,
                trigger: "playerTouch",
                priority: "below",
                overlapForbidden: false,
                commands: [
                  sfx("switch-clack"),
                  { kind: "setSwitch", switchId: swId, value: true },
                  ...(idx === 1 ? (stagePlan?.stepChangeTileCommands.plate_1 ?? []) : []),
                  particles("dust", 1000, at),
                  shake(3, 300),
                  textCmd(`딸깍! 제${idx} 석상 발판이 바닥으로 깊숙이 눌렸다.`),
                  ...allSwitchesFork([swP1, swP2], unlockSequence),
                ],
              }),
              makePage({
                id: `${evId}_pressed`,
                name: `제${idx}발판 (눌림)`,
                conditions: [{ kind: "switch", switchId: swId, value: true }],
                graphic: platePressed,
                trigger: "action",
                priority: "below",
                overlapForbidden: false,
                commands: [textCmd(`제${idx} 압력 발판이 단단히 눌려 있다.`)],
              }),
            ],
          };
        };

        const gateId = `ev_${baseId}_gate`;
        const gateEvent: GameEvent = {
          id: gateId,
          name: customTitle ?? "고대 유적 석문",
          x: cGate.x,
          y: cGate.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${gateId}_closed`,
              name: "유적 석문 (봉인)",
              graphic: objGraphic("object1", 3, "down"),
              priority: "same",
              commands: [
                textCmd(customHint ?? "무거운 고대 석문이다. 주변 바닥의 두 압력 발판을 모두 밟아야 열린다."),
              ],
            }),
            makePage({
              id: `${gateId}_open`,
              name: "유적 석문 (개방)",
              conditions: [{ kind: "switch", switchId: solveSwitchId, value: true }],
              graphic: { transparent: true },
              priority: "below",
              overlapForbidden: false,
              commands: [textCmd("압력 발판 장치로 열린 고대 유적 석문이다.")],
            }),
          ],
        };

        registerEvent(map, makePlate(1, cP1, swP1), "제1 압력 발판(playerTouch)");
        registerEvent(map, makePlate(2, cP2, swP2), "제2 압력 발판(playerTouch)");
        registerEvent(map, gateEvent, "고대 유적 석문");
        solveStepsSummary = [
          `(${cP1.x},${cP1.y}) 제1 압력 발판 밟기(playerTouch)`,
          `(${cP2.x},${cP2.y}) 제2 압력 발판 밟기(playerTouch) → changeTile ${changeTileCmds.length}칸 및 (${cGate.x},${cGate.y}) 석문 개방`,
        ];
        break;
      }

      case "ice_conveyor_slide": {
        const cLever = cells[0]!;
        const cSlide = cells[1]!;
        const cBoulder = cells[2]!;
        const leverId = `ev_${baseId}_diverter`;
        const slideId = `ev_${baseId}_slide`;
        const boulderId = `ev_${baseId}_boulder`;
        changeTileCmds = resolveChangeTiles([cSlide, cBoulder]);
        const leverDown = objGraphic("object2", 0, "down");
        const leverUp = objGraphic("object2", 0, "up");

        const slideDir: Dir =
          Math.abs(cBoulder.x - cSlide.x) >= Math.abs(cBoulder.y - cSlide.y)
            ? cBoulder.x >= cSlide.x
              ? "right"
              : "left"
            : cBoulder.y >= cSlide.y
              ? "down"
              : "up";

        const leverEvent: GameEvent = {
          id: leverId,
          name: customTitle ?? "미끄럼 궤도 전환기",
          x: cLever.x,
          y: cLever.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${leverId}_p1`,
              name: "궤도 전환기 (전환 전)",
              graphic: leverDown,
              commands: [
                textCmd(customHint ?? "빙판·컨베이어 미끄럼 트랙의 정지 바위 궤도를 바꾸는 레버다."),
                {
                  kind: "choices",
                  prompt: "전환 레버를 당겨 미끄럼 궤도를 정렬할까?",
                  options: [
                    {
                      text: "레버를 당겨 궤도를 정렬한다",
                      branch: [
                        sfx("switch-clack"),
                        se("earth2"),
                        { kind: "setEventGraphicPattern", eventId: leverId, pattern: leverUp.pattern ?? 0 },
                        shake(3, 450),
                        ...tintPulse("255,255,255", 0.4),
                        particles("sparkle", 700),
                        sfx("secret-solved"),
                        ...changeTileCmds,
                        textCmd("철컥— 덜커덩! 미끄럼 궤도가 정렬되며 정지 바위가 치워지고 보물 통로가 열렸다!"),
                        ...reward.grantCommands,
                        { kind: "setSwitch", switchId: solveSwitchId, value: true },
                      ],
                    },
                    {
                      text: "그대로 둔다",
                      branch: [textCmd("레버를 건드리지 않았다.")],
                    },
                  ],
                },
              ],
            }),
            makePage({
              id: `${leverId}_p2`,
              name: "궤도 전환기 (정렬 완료)",
              conditions: [{ kind: "switch", switchId: solveSwitchId, value: true }],
              graphic: leverUp,
              commands: [textCmd("미끄럼 궤도가 안전하게 정렬되어 있다.")],
            }),
          ],
        };

        const slideEvent: GameEvent = {
          id: slideId,
          name: "미끄럼 트랙 패드",
          x: cSlide.x,
          y: cSlide.y,
          trigger: { kind: "playerTouch" },
          commands: [],
          pages: [
            makePage({
              id: `${slideId}_unaligned`,
              name: "미끄럼 패드 (정렬 전)",
              graphic: objGraphic("object2", 4, "down"),
              trigger: "playerTouch",
              priority: "below",
              overlapForbidden: false,
              commands: [
                se("evade1"),
                {
                  kind: "moveEvent",
                  eventId: "@player",
                  route: {
                    moves: [{ kind: "turn", dir: slideDir }],
                    repeat: false,
                    wait: true,
                    skippable: true,
                  },
                },
                textCmd("휘청! 바닥이 미끄럽다! 먼저 옆의 궤도 전환 레버를 당겨 정지 바위를 치워야 한다."),
              ],
            }),
            makePage({
              id: `${slideId}_aligned`,
              name: "미끄럼 패드 (정렬 후)",
              conditions: [{ kind: "switch", switchId: solveSwitchId, value: true }],
              graphic: objGraphic("object2", 2, "down"),
              trigger: "action",
              priority: "below",
              overlapForbidden: false,
              commands: [textCmd("정렬된 미끄럼 트랙이다. 안전하게 걸어 지나갈 수 있다.")],
            }),
          ],
        };

        const boulderEvent: GameEvent = {
          id: boulderId,
          name: "궤도 정지 바위",
          x: cBoulder.x,
          y: cBoulder.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${boulderId}_blocking`,
              name: "정지 바위 (차단)",
              graphic: objGraphic("object2", 5, "down"),
              priority: "same",
              commands: [textCmd("미끄럼 트랙 끝을 막고 있는 묵직한 정지 바위다. 전환 레버로 궤도를 바꾸면 열린다.")],
            }),
            makePage({
              id: `${boulderId}_cleared`,
              name: "정지 바위 (해제됨)",
              conditions: [{ kind: "switch", switchId: solveSwitchId, value: true }],
              graphic: objGraphic("object2", 6, "down"),
              priority: "below",
              overlapForbidden: false,
              commands: [textCmd("정지 바위가 비켜나 미끄럼 트랙 종점이 열려 있다.")],
            }),
          ],
        };

        registerEvent(map, leverEvent, "궤도 전환 레버");
        registerEvent(map, slideEvent, "미끄럼 트랙 패드");
        registerEvent(map, boulderEvent, "정지 바위");
        solveStepsSummary = [
          `(${cLever.x},${cLever.y}) '${leverEvent.name}' 조사 → 「레버를 당겨 궤도를 정렬한다」`,
          `changeTile ${changeTileCmds.length}칸으로 미끄럼 트랙 정렬 및 (${cBoulder.x},${cBoulder.y}) 정지 바위 개방`,
        ];
        break;
      }

      case "time_gate_causality": {
        const cPast = cells[0]!;
        const targetMap =
          typeof args.targetMapId === "string" && args.targetMapId.trim() && draft.maps[args.targetMapId.trim()]
            ? requireMap(draft, args.targetMapId.trim())
            : map;
        const cFuture =
          targetMap.id === map.id
            ? cells[1]!
            : pickPuzzleCluster(draft, targetMap, undefined, 1).cells[0]!;

        const seededSwitchId = `sw_${baseId}_past_seeded`;
        ensureNamedSwitch(draft, seededSwitchId, `${preset.title} 과거 공명 완료`);
        switchIds.push(seededSwitchId);

        const pastTileCmds = resolveChangeTiles([cPast]);
        const futureTileCmds = buildVerifiedChangeTileCommands(draft, targetMap, [cFuture]);
        changeTileCmds = [...pastTileCmds, ...futureTileCmds];

        const pastId = `ev_${baseId}_past_altar`;
        const futureId = `ev_${baseId}_future_chest`;
        const closedWoodChest = objGraphic("object1", 7, "down");
        const closedGoldChest = objGraphic("object1", 6, "down");
        const openedGoldChest = chestOpenedGraphic(closedGoldChest);

        const pastEvent: GameEvent = {
          id: pastId,
          name: customTitle ?? "과거의 시공 공명 제단",
          x: cPast.x,
          y: cPast.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${pastId}_dormant`,
              name: "시공 제단 (공명 전)",
              graphic: objGraphic("object2", 3, "down"),
              commands: [
                textCmd(
                  customHint ??
                    "고대의 시공 제단이다. 이곳에 시간의 씨앗과 마력을 불어넣으면 미래의 봉인된 유산 상자가 깨어난다.",
                ),
                {
                  kind: "choices",
                  prompt: "시공 제단에 마력을 불어넣어 미래로 공명을 보낼까?",
                  options: [
                    {
                      text: "시간의 씨앗과 마력을 공명시킨다",
                      branch: [
                        se("bell"),
                        ...tintPulse("255,255,255", 0.4),
                        particles("magic", 900),
                        ...changeTileCmds,
                        { kind: "setSwitch", switchId: seededSwitchId, value: true },
                        textCmd(
                          `우웅—! 시공 제단이 찬란한 보랏빛으로 깨어났다! 시대를 넘어 ${targetMap.name} (${cFuture.x},${cFuture.y})의 유산 상자가 황금빛으로 변했다!`,
                        ),
                      ],
                    },
                    {
                      text: "아직 건드리지 않는다",
                      branch: [textCmd("제단을 그대로 두었다.")],
                    },
                  ],
                },
              ],
            }),
            makePage({
              id: `${pastId}_resonating`,
              name: "시공 제단 (공명 중)",
              conditions: [{ kind: "switch", switchId: seededSwitchId, value: true }],
              graphic: objGraphic("object2", 6, "down"),
              commands: [
                textCmd(
                  `시공 제단이 시대를 넘어 공명하고 있다. 이제 ${targetMap.name} (${cFuture.x},${cFuture.y})의 깨어난 유산 상자를 열 수 있다!`,
                ),
              ],
            }),
          ],
        };

        const futureEvent: GameEvent = {
          id: futureId,
          name: "시대 연동 유산 상자",
          x: cFuture.x,
          y: cFuture.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${futureId}_sealed`,
              name: "유산 상자 (시간 봉인)",
              graphic: closedWoodChest,
              commands: [
                textCmd(
                  "시간의 풍화로 굳게 닫힌 유산 상자다. 과거의 시공 제단에서 먼저 마력을 공명시켜야 열 수 있다.",
                ),
              ],
            }),
            makePage({
              id: `${futureId}_awakened`,
              name: "유산 상자 (시공 각성)",
              conditions: [{ kind: "switch", switchId: seededSwitchId, value: true }],
              graphic: closedGoldChest,
              commands: [
                ...chestOpenCommands(futureId, closedGoldChest),
                sfx("secret-solved"),
                particles("sparkle", 800),
                textCmd("과거에서 전해진 시공의 힘으로 유산 상자의 봉인이 풀렸다!"),
                ...reward.grantCommands,
                { kind: "setSwitch", switchId: solveSwitchId, value: true },
              ],
            }),
            makePage({
              id: `${futureId}_opened`,
              name: "유산 상자 (개봉 완료)",
              conditions: [
                { kind: "switch", switchId: seededSwitchId, value: true },
                { kind: "switch", switchId: solveSwitchId, value: true },
              ],
              graphic: openedGoldChest,
              commands: [textCmd("시공을 넘어 전해진 유산 상자는 이미 비어 있다.")],
            }),
          ],
        };

        registerEvent(map, pastEvent, "과거 시공 공명 제단");
        registerEvent(targetMap, futureEvent, "미래 시대 연동 유산 상자");
        solveStepsSummary = [
          `${map.name} (${cPast.x},${cPast.y}) '${pastEvent.name}' 조사 → 「시간의 씨앗과 마력을 공명시킨다」`,
          `changeTile ${changeTileCmds.length}칸 실행 및 ${targetMap.name} (${cFuture.x},${cFuture.y}) '${futureEvent.name}' 조사 개봉`,
        ];
        break;
      }

      case "dynamite_rock_blast": {
        const cSupply = cells[0]!;
        const cBoulder = cells[1]!;
        const dynamiteItemId = `item_${baseId}_dynamite`;
        const pickedSwitchId = `sw_${baseId}_dynamite_picked`;
        ensureNamedSwitch(draft, pickedSwitchId, "광산 다이너마이트 입수");
        switchIds.push(pickedSwitchId);

        if (!draft.database.items.some((it) => it.id === dynamiteItemId)) {
          draft.database.items.push(
            normalizeItemRecord({
              id: dynamiteItemId,
              name: "광산 다이너마이트",
              description: "거대한 낙석 바위의 균열에 꽂아 폭파할 수 있는 산업용 다이너마이트.",
              price: 0,
              consumable: false,
              occasion: "never",
            }),
          );
        }

        changeTileCmds = resolveChangeTiles([cBoulder]);
        const supplyId = `ev_${baseId}_supply`;
        const boulderId = `ev_${baseId}_boulder`;
        const crateClosed = objGraphic("object1", 7, "down");
        const crateOpen = chestOpenedGraphic(crateClosed);

        const supplyEvent: GameEvent = {
          id: supplyId,
          name: "화약 보급 상자",
          x: cSupply.x,
          y: cSupply.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${supplyId}_closed`,
              name: "보급 상자 (닫힘)",
              graphic: crateClosed,
              commands: [
                ...chestOpenCommands(supplyId, crateClosed),
                ...lootGrantCommands({ itemId: dynamiteItemId }),
                textCmd("화약 보급 상자에서 「광산 다이너마이트」를 찾아냈다!"),
                { kind: "setSwitch", switchId: pickedSwitchId, value: true },
              ],
            }),
            makePage({
              id: `${supplyId}_open`,
              name: "보급 상자 (열림)",
              conditions: [{ kind: "switch", switchId: pickedSwitchId, value: true }],
              graphic: crateOpen,
              commands: [textCmd("다이너마이트를 꺼낸 빈 화약 상자다.")],
            }),
          ],
        };

        const boulderEvent: GameEvent = {
          id: boulderId,
          name: customTitle ?? "균열 간 거대 낙석",
          x: cBoulder.x,
          y: cBoulder.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${boulderId}_blocking`,
              name: "거대 낙석 (차단)",
              graphic: objGraphic("object2", 5, "down"),
              priority: "same",
              commands: [
                {
                  kind: "fork",
                  condition: { kind: "item", itemId: dynamiteItemId, present: true },
                  then: [
                    textCmd("거대 낙석의 균열에 「광산 다이너마이트」를 꽂고 도화선에 불을 붙였다!"),
                    se("fire7"),
                    { kind: "changeItem", itemId: dynamiteItemId, op: "-=", amount: 1 },
                    se("explosion1"),
                    ...revealInWaves(changeTileCmds, { flash: "red", waves: ["explosion", "smoke", "dust"] }),
                    textCmd("콰앙—!! 거대 낙석이 산산조각 나며 막혀 있던 광맥 통로가 시원하게 열렸다!"),
                    ...reward.grantCommands,
                    { kind: "setSwitch", switchId: solveSwitchId, value: true },
                  ],
                  else: [
                    textCmd(
                      customHint ??
                        "거대한 낙석 바위가 길을 막고 있다. 근처 화약 보급 상자에서 「광산 다이너마이트」를 가져오면 폭파할 수 있을 것 같다.",
                    ),
                  ],
                },
              ],
            }),
            makePage({
              id: `${boulderId}_blasted`,
              name: "거대 낙석 (폭파 완료)",
              conditions: [{ kind: "switch", switchId: solveSwitchId, value: true }],
              graphic: { transparent: true },
              priority: "below",
              overlapForbidden: false,
              commands: [textCmd("낙석이 깨끗이 폭파되어 통로가 열려 있다.")],
            }),
          ],
        };

        registerEvent(map, supplyEvent, "다이너마이트 보급 상자");
        registerEvent(map, boulderEvent, "폭파되는 거대 낙석");
        solveStepsSummary = [
          `(${cSupply.x},${cSupply.y}) '화약 보급 상자' 조사 → '광산 다이너마이트' 입수`,
          `(${cBoulder.x},${cBoulder.y}) '${boulderEvent.name}' 조사 → 다이너마이트 폭파 + changeTile ${changeTileCmds.length}칸 실행 및 바위 제거`,
        ];
        break;
      }

      case "riddle_mimic_chests": {
        const cTablet = cells[0]!;
        const cDecoy1 = cells[1]!;
        const cDecoy2 = cells[2]!;
        const cTrue = cells[3]!;
        changeTileCmds = resolveChangeTiles([cTrue]);
        const trueClosed = objGraphic("object1", 6, "down");
        const trueOpened = chestOpenedGraphic(trueClosed);
        const decoyGraphic = objGraphic("object1", 7, "down");
        const decoy2Graphic = objGraphic("object2", 7, "down");

        const tabletId = `ev_${baseId}_tablet`;
        const decoy1Id = `ev_${baseId}_chest_decoy1`;
        const decoy2Id = `ev_${baseId}_chest_decoy2`;
        const trueId = `ev_${baseId}_chest_true`;

        const tabletEvent: GameEvent = {
          id: tabletId,
          name: "수수께끼의 석판",
          x: cTablet.x,
          y: cTablet.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${tabletId}_p1`,
              name: "수수께끼 석판",
              graphic: objGraphic("object2", 3, "down"),
              commands: [
                textCmd(
                  customHint ??
                    "석판의 수수께끼: 「두 나무 상자는 미믹의 함정이며, 오직 붉고 금빛 테두리를 두른 『진실의 상자』만이 진짜 성배를 품고 있다.」",
                ),
              ],
            }),
          ],
        };

        const decoy1Event: GameEvent = {
          id: decoy1Id,
          name: "의심스러운 나무 상자 A",
          x: cDecoy1.x,
          y: cDecoy1.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${decoy1Id}_p1`,
              name: "나무 상자 A (함정)",
              graphic: decoyGraphic,
              commands: [
                se("damage2"),
                ...tintPulse("200,40,40", 0.3, 100, 400),
                shake(3, 450),
                particles("smoke", 700),
                textCmd("크아악! 상자 뚜껑에서 미믹의 날카로운 이빨이 튀어나왔다! 이 상자는 함정이다!"),
              ],
            }),
          ],
        };

        const decoy2Event: GameEvent = {
          id: decoy2Id,
          name: "의심스러운 나무 상자 B",
          x: cDecoy2.x,
          y: cDecoy2.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${decoy2Id}_p1`,
              name: "나무 상자 B (함정)",
              graphic: decoy2Graphic,
              commands: [
                sfx("wrong"),
                ...tintPulse("200,40,40", 0.3, 100, 400),
                shake(3, 400),
                textCmd("푸슉—! 상자 틈에서 마비 연기가 뿜어져 나왔다! 이 상자도 가짜다!"),
              ],
            }),
          ],
        };

        const trueChestEvent: GameEvent = {
          id: trueId,
          name: customTitle ?? "진실의 붉은 보물상자",
          x: cTrue.x,
          y: cTrue.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${trueId}_closed`,
              name: "진실의 상자 (닫힘)",
              graphic: trueClosed,
              commands: [
                ...chestOpenCommands(trueId, trueClosed),
                se("collapse1"),
                ...revealInWaves(changeTileCmds, { flash: "yellow", waves: ["dust", "smoke", "sparkle"] }),
                textCmd("수수께끼의 정답! 진실의 상자가 찬란한 빛과 함께 열렸다!"),
                ...reward.grantCommands,
                { kind: "setSwitch", switchId: solveSwitchId, value: true },
              ],
            }),
            makePage({
              id: `${trueId}_opened`,
              name: "진실의 상자 (열림)",
              conditions: [{ kind: "switch", switchId: solveSwitchId, value: true }],
              graphic: trueOpened,
              commands: [textCmd("진실의 보물상자는 이미 열어 보물을 챙겼다.")],
            }),
          ],
        };

        registerEvent(map, tabletEvent, "수수께끼 단서 석판");
        registerEvent(map, decoy1Event, "함정 미믹 상자 1");
        registerEvent(map, decoy2Event, "함정 미믹 상자 2");
        registerEvent(map, trueChestEvent, "진실의 보물상자");
        solveStepsSummary = [
          `(${cTablet.x},${cTablet.y}) 수수께끼 석판 단서 확인`,
          `함정 상자 (${cDecoy1.x},${cDecoy1.y})·(${cDecoy2.x},${cDecoy2.y}) 대신 (${cTrue.x},${cTrue.y}) '${trueChestEvent.name}' 조사 개봉`,
        ];
        break;
      }

      case "sluice_lava_bridge": {
        const cValve = cells[0]!;
        const cBridge1 = cells[1]!;
        const cBridge2 = cells[2]!;
        const valveId = `ev_${baseId}_valve`;
        const gateId = `ev_${baseId}_sluice_gate`;
        changeTileCmds = resolveChangeTiles([cBridge1, cBridge2, cValve]);
        const valveDown = objGraphic("object2", 0, "down");
        const valveUp = objGraphic("object2", 0, "up");

        const valveEvent: GameEvent = {
          id: valveId,
          name: customTitle ?? "수문·용암 수위 조절 밸브",
          x: cValve.x,
          y: cValve.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${valveId}_p1`,
              name: "수위 조절 밸브 (작동 전)",
              graphic: valveDown,
              commands: [
                textCmd(customHint ?? "거대한 수문·용암 수위를 조절하는 주철 밸브다. 돌리면 잠긴 돌다리가 드러난다."),
                {
                  kind: "choices",
                  prompt: "수위 조절 밸브를 어떻게 할까?",
                  options: [
                    {
                      text: "배수 밸브를 끝까지 돌려 다리를 개방한다",
                      branch: [
                        sfx("switch-clack"),
                        se("earth6"),
                        { kind: "setEventGraphicPattern", eventId: valveId, pattern: valveUp.pattern ?? 0 },
                        shake(6, 650),
                        ...tintPulse("255,255,255", 0.4),
                        particles("dust", 800),
                        sfx("secret-solved"),
                        ...changeTileCmds,
                        textCmd("쏴아아아— 쿠구구궁! 수위가 내려가며 잠겨 있던 돌다리와 수문이 완전히 개방되었다!"),
                        ...reward.grantCommands,
                        { kind: "setSwitch", switchId: solveSwitchId, value: true },
                      ],
                    },
                    {
                      text: "건드리지 않는다",
                      branch: [textCmd("밸브를 그대로 두었다.")],
                    },
                  ],
                },
              ],
            }),
            makePage({
              id: `${valveId}_p2`,
              name: "수위 조절 밸브 (개방 완료)",
              conditions: [{ kind: "switch", switchId: solveSwitchId, value: true }],
              graphic: valveUp,
              commands: [textCmd("배수 밸브가 끝까지 돌아가 있어 돌다리가 드러나 있다.")],
            }),
          ],
        };

        const gateEvent: GameEvent = {
          id: gateId,
          name: "수문 다리 차단기",
          x: cBridge1.x,
          y: cBridge1.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${gateId}_closed`,
              name: "수문 다리 (잠김)",
              graphic: objGraphic("object1", 5, "down"),
              priority: "same",
              commands: [textCmd("수위가 높아 다리가 잠겨 있다. 옆의 수위 조절 밸브를 돌려야 건널 수 있다.")],
            }),
            makePage({
              id: `${gateId}_open`,
              name: "수문 다리 (개방)",
              conditions: [{ kind: "switch", switchId: solveSwitchId, value: true }],
              graphic: objGraphic("object2", 2, "down"),
              priority: "below",
              overlapForbidden: false,
              commands: [textCmd("수위가 낮아져 드러난 튼튼한 돌다리다.")],
            }),
          ],
        };

        registerEvent(map, valveEvent, "수문·용암 수위 조절 밸브");
        registerEvent(map, gateEvent, "수문 돌다리 차단기");
        solveStepsSummary = [
          `(${cValve.x},${cValve.y}) '${valveEvent.name}' 조사 → 「배수 밸브를 끝까지 돌려 다리를 개방한다」`,
          `changeTile ${changeTileCmds.length}칸으로 (${cBridge1.x},${cBridge1.y})·(${cBridge2.x},${cBridge2.y}) 돌다리 부설 및 차단기 개방`,
        ];
        break;
      }

      case "stealth_guard_patrol": {
        const cBell = cells[0]!;
        const cGuard = cells[1]!;
        const cCache = cells[2]!;
        const distractedSwitchId = `sw_${baseId}_guard_distracted`;
        ensureNamedSwitch(draft, distractedSwitchId, "경비병 유인 완료");
        switchIds.push(distractedSwitchId);

        changeTileCmds = resolveChangeTiles([cGuard, cCache]);
        const bellId = `ev_${baseId}_bell`;
        const guardId = `ev_${baseId}_guard`;
        const cacheId = `ev_${baseId}_cache`;

        let guardGraphic: EventPageGraphic;
        try {
          guardGraphic = resolveGraphic({ query: "병사" }, { overrides: draft.charsetLabels });
        } catch {
          guardGraphic = charsetGraphic("tex_easyrpg_charset_people1", 0);
        }
        const guardTurnedGraphic: EventPageGraphic = {
          ...guardGraphic,
          direction: "up",
        };
        const cacheClosed = objGraphic("object1", 6, "down");
        const cacheOpened = chestOpenedGraphic(cacheClosed);

        const bellEvent: GameEvent = {
          id: bellId,
          name: customTitle ?? "유인 종 줄·연막 장치",
          x: cBell.x,
          y: cBell.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${bellId}_p1`,
              name: "유인 장치 (작동 전)",
              graphic: objGraphic("object2", 1, "down"),
              commands: [
                textCmd(customHint ?? "초소 구석에 연결된 경보 종 줄이다. 당기면 경비병의 시선을 다른 곳으로 돌릴 수 있다."),
                {
                  kind: "choices",
                  prompt: "유인 종 줄을 당겨 경비병을 유인할까?",
                  options: [
                    {
                      text: "종 줄을 당겨 소리를 낸다",
                      branch: [
                        se("bell"),
                        { kind: "showEmote", target: { eventId: guardId }, emote: "exclamation", durationMs: 650 },
                        {
                          kind: "moveEvent",
                          eventId: guardId,
                          route: {
                            moves: [{ kind: "turn", dir: "up" }],
                            repeat: false,
                            wait: true,
                            skippable: true,
                          },
                        },
                        ...changeTileCmds,
                        { kind: "setSwitch", switchId: distractedSwitchId, value: true },
                        textCmd("땡그랑—! 경비병이 놀라 뒤돌아서며 초소 통로와 기밀 보급 상자의 경계가 풀렸다!"),
                      ],
                    },
                    {
                      text: "그만둔다",
                      branch: [textCmd("조용히 손을 뗐다.")],
                    },
                  ],
                },
              ],
            }),
            makePage({
              id: `${bellId}_p2`,
              name: "유인 장치 (작동 후)",
              conditions: [{ kind: "switch", switchId: distractedSwitchId, value: true }],
              graphic: objGraphic("object2", 1, "up"),
              commands: [textCmd("이미 유인 종을 울려 경비병의 시선을 돌려놓았다.")],
            }),
          ],
        };

        const guardEvent: GameEvent = {
          id: guardId,
          name: "초소 경비병",
          x: cGuard.x,
          y: cGuard.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${guardId}_watch`,
              name: "경비병 (경계 중)",
              graphic: guardGraphic,
              priority: "same",
              commands: [
                textCmd("초소 경비병: 「멈춰라! 이 뒤의 기밀 보급함에는 누구도 접근할 수 없다!」 (주변의 유인 장치를 찾아보자)"),
              ],
            }),
            makePage({
              id: `${guardId}_distracted`,
              name: "경비병 (시선 분산)",
              conditions: [{ kind: "switch", switchId: distractedSwitchId, value: true }],
              graphic: guardTurnedGraphic,
              priority: "below",
              overlapForbidden: false,
              commands: [textCmd("초소 경비병: 「어라? 방금 저쪽에서 분명 종소리가 났는데…」 (경비병이 한눈을 팔고 있다!)")],
            }),
          ],
        };

        const cacheEvent: GameEvent = {
          id: cacheId,
          name: "초소 기밀 보급 상자",
          x: cCache.x,
          y: cCache.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${cacheId}_watched`,
              name: "보급 상자 (감시 중)",
              graphic: cacheClosed,
              commands: [
                textCmd("경비병이 두 눈을 부릅뜨고 지켜보고 있어 상자를 열 수 없다! 먼저 유인 장치를 작동시키자."),
              ],
            }),
            makePage({
              id: `${cacheId}_openable`,
              name: "보급 상자 (잠입 성공)",
              conditions: [{ kind: "switch", switchId: distractedSwitchId, value: true }],
              graphic: cacheClosed,
              commands: [
                ...chestOpenCommands(cacheId, cacheClosed),
                sfx("secret-solved"),
                particles("sparkle", 750),
                textCmd("경비병이 한눈을 판 사이에 기밀 보급 상자를 열었다!"),
                ...reward.grantCommands,
                { kind: "setSwitch", switchId: solveSwitchId, value: true },
              ],
            }),
            makePage({
              id: `${cacheId}_opened`,
              name: "보급 상자 (개봉 완료)",
              conditions: [
                { kind: "switch", switchId: distractedSwitchId, value: true },
                { kind: "switch", switchId: solveSwitchId, value: true },
              ],
              graphic: cacheOpened,
              commands: [textCmd("이미 기밀 보급 상자에서 암호문을 챙겼다.")],
            }),
          ],
        };

        registerEvent(map, bellEvent, "유인 종 장치");
        registerEvent(map, guardEvent, "시야 경비병 NPC");
        registerEvent(map, cacheEvent, "기밀 보급 상자");
        solveStepsSummary = [
          `(${cBell.x},${cBell.y}) '${bellEvent.name}' 조사 → 「종 줄을 당겨 소리를 낸다」로 경비병 유인`,
          `(${cCache.x},${cCache.y}) '초소 기밀 보급 상자' 조사 개봉`,
        ];
        break;
      }

      case "boss_seal_monoliths": {
        const cM1 = cells[0]!;
        const cM2 = cells[1]!;
        const cM3 = cells[2]!;
        const cBossGate = cells[3]!;
        const swM1 = `sw_${baseId}_monolith_1`;
        const swM2 = `sw_${baseId}_monolith_2`;
        const swM3 = `sw_${baseId}_monolith_3`;
        ensureNamedSwitch(draft, swM1, "태양의 봉인 비석 해제");
        ensureNamedSwitch(draft, swM2, "달의 봉인 비석 해제");
        ensureNamedSwitch(draft, swM3, "별의 봉인 비석 해제");
        switchIds.push(swM1, swM2, swM3);

        changeTileCmds = resolveChangeTiles([cBossGate, cM1, cM2, cM3]);
        const dormantMono = objGraphic("object2", 3, "down");
        const activeMono = objGraphic("object2", 6, "down");

        const unsealAllSequence: Command[] = [
          se("barrier"),
          se("collapse1"),
          ...revealInWaves(changeTileCmds, { flash: "purple", waves: ["magic", "smoke", "sparkle"] }),
          textCmd("쿠구구궁—!! 태양·달·별의 세 비석이 동시에 빛기둥을 쏘아 올리며 보스 봉인 결계문이 깨어졌다!"),
          ...reward.grantCommands,
          { kind: "setSwitch", switchId: solveSwitchId, value: true },
        ];

        const monoSpecs: ReadonlyArray<{ readonly idx: 1 | 2 | 3; readonly label: string; readonly at: Cell; readonly swId: string }> = [
          { idx: 1, label: "태양의 봉인 비석", at: cM1, swId: swM1 },
          { idx: 2, label: "달의 봉인 비석", at: cM2, swId: swM2 },
          { idx: 3, label: "별의 봉인 비석", at: cM3, swId: swM3 },
        ];

        for (const spec of monoSpecs) {
          const evId = `ev_${baseId}_monolith_${spec.idx}`;
          const monoEvent: GameEvent = {
            id: evId,
            name: spec.label,
            x: spec.at.x,
            y: spec.at.y,
            trigger: { kind: "action" },
            commands: [],
            pages: [
              makePage({
                id: `${evId}_dormant`,
                name: `${spec.label} (봉인)`,
                graphic: dormantMono,
                commands: [
                  se("chime2"),
                  ...tintPulse("255,255,255", 0.4),
                  particles("magic", 1200, spec.at),
                  shake(3, 300),
                  { kind: "setSwitch", switchId: spec.swId, value: true },
                  ...(stagePlan?.stepChangeTileCommands[`monolith_${spec.idx}`] ?? []),
                  textCmd(`「${spec.label}」에 손을 대자 고대 룬이 푸른 크리스탈 빛으로 깨어났다!`),
                  ...allSwitchesFork([swM1, swM2, swM3], unsealAllSequence),
                ],
              }),
              makePage({
                id: `${evId}_active`,
                name: `${spec.label} (공명 중)`,
                conditions: [{ kind: "switch", switchId: spec.swId, value: true }],
                graphic: activeMono,
                commands: [textCmd(`「${spec.label}」이 찬란한 빛을 내뿜으며 공명하고 있다.`)],
              }),
            ],
          };
          registerEvent(map, monoEvent, spec.label);
        }

        const bossGateId = `ev_${baseId}_boss_gate`;
        const bossGateEvent: GameEvent = {
          id: bossGateId,
          name: customTitle ?? "보스 봉인 결계문",
          x: cBossGate.x,
          y: cBossGate.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${bossGateId}_sealed`,
              name: "보스 결계문 (봉인)",
              graphic: objGraphic("object1", 4, "down"),
              priority: "same",
              commands: [
                textCmd(
                  customHint ??
                    "강력한 삼중 마력 결계가 보스방 입구를 막고 있다. 주변의 「태양·달·별의 봉인 비석」 3기를 모두 깨워야 열린다.",
                ),
              ],
            }),
            makePage({
              id: `${bossGateId}_unsealed`,
              name: "보스 결계문 (해제됨)",
              conditions: [{ kind: "switch", switchId: solveSwitchId, value: true }],
              graphic: objGraphic("object2", 6, "up"),
              priority: "below",
              overlapForbidden: false,
              commands: [textCmd("3비석의 공명으로 봉인 결계가 완전히 걷혔다.")],
            }),
          ],
        };

        registerEvent(map, bossGateEvent, "보스 봉인 결계문");
        solveStepsSummary = [
          `(${cM1.x},${cM1.y}) 태양의 봉인 비석 조사`,
          `(${cM2.x},${cM2.y}) 달의 봉인 비석 조사`,
          `(${cM3.x},${cM3.y}) 별의 봉인 비석 조사 → 3비석 공명 완성 + changeTile ${changeTileCmds.length}칸 및 (${cBossGate.x},${cBossGate.y}) 결계문 해제`,
        ];
        break;
      }

      case "rolling_boulder_chasm": {
        const cWinch = cells[0]!;
        const cStopper = cells[1]!;
        const cChasmGate = cells[2]!;
        const swWinch = `sw_${baseId}_winch_released`;
        ensureNamedSwitch(draft, swWinch, "바위 경사로 상부 고패 윈치 해제");
        switchIds.push(swWinch);

        changeTileCmds = resolveChangeTiles([cChasmGate, cStopper, cWinch]);
        const winchId = `ev_${baseId}_winch`;
        const stopperId = `ev_${baseId}_stopper`;
        const chasmGateId = `ev_${baseId}_chasm_gate`;

        const rollSteps: Command[] = [{ kind: "wait", ms: 260 }];
        for (let step = 1; step <= 5; step += 1) {
          const rollX = cChasmGate.x;
          const rollY = cStopper.y + step;
          rollSteps.push(
            se(step % 2 === 1 ? "earth2" : "collapse1"),
            ...(stagePlan?.stepChangeTileCommands[`boulder_step_${step}`] ?? []),
            particles("dust", 1200, { x: rollX, y: rollY - 1 }),
            particles("smoke", 1100, { x: rollX + (step % 2 === 1 ? -1 : 1), y: rollY }),
            particles("sparkle", 900, { x: rollX, y: rollY }),
            shake(step >= 4 ? 6 : 3, 220),
            { kind: "wait", ms: 60 },
          );
        }

        const winchEvent: GameEvent = {
          id: winchId,
          name: "상부 고패 윈치",
          x: cWinch.x,
          y: cWinch.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${winchId}_locked`,
              name: "고패 윈치 (고정됨)",
              graphic: objGraphic("object2", 0, "down"),
              commands: [
                { kind: "wait", ms: 200 },
                sfx("switch-clack"),
                se("earth2"),
                { kind: "setSwitch", switchId: swWinch, value: true },
                ...(stagePlan?.stepChangeTileCommands.boulder_winch ?? []),
                particles("dust", 900, cWinch),
                shake(3, 300),
                textCmd(
                  "철컥— 끼이이익! 상부 고패 윈치의 쇠사슬을 풀어 경사로 바위의 1차 구속을 해제했다! 이제 옆의 『바위 멈춤쇠 페달』을 작동시킬 수 있다.",
                ),
              ],
            }),
            makePage({
              id: `${winchId}_released`,
              name: "고패 윈치 (해제됨)",
              conditions: [{ kind: "switch", switchId: swWinch, value: true }],
              graphic: objGraphic("object2", 0, "up"),
              commands: [textCmd("상부 고패 윈치의 쇠사슬이 풀려 있다.")],
            }),
          ],
        };

        const stopperEvent: GameEvent = {
          id: stopperId,
          name: customTitle ?? "바위 경사로 멈춤쇠",
          x: cStopper.x,
          y: cStopper.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${stopperId}_ready`,
              name: "바위 멈춤쇠 (굴리기 전)",
              graphic: objGraphic("object2", 5, "down"),
              commands: [
                {
                  kind: "fork",
                  condition: { kind: "switch", switchId: swWinch, value: true },
                  then: [
                    textCmd("멈춤쇠 페달을 힘껏 밟자 고정 쐐기가 빠지며 거대 바위가 경사로 아래로 구르기 시작했다!"),
                    ...rollSteps,
                    se("explosion1"),
                    ...revealInWaves(changeTileCmds, { flash: "yellow", waves: ["explosion", "dust", "sparkle"] }),
                    textCmd(
                      "쿠구구구궁— 콰앙!! 거대 바위가 경사로를 굴러 내려와 심연 구렁을 메우며 튼튼한 돌다리와 성소 계단을 열었다!",
                    ),
                    ...reward.grantCommands,
                    { kind: "setSwitch", switchId: solveSwitchId, value: true },
                  ],
                  else: [
                    textCmd(
                      customHint ??
                        "거대한 바위 3기가 경사로 꼭대기에 버티고 있다. 먼저 왼쪽의 『상부 고패 윈치』를 돌려 쇠사슬을 풀어야 바위를 굴릴 수 있다.",
                    ),
                  ],
                },
              ],
            }),
            makePage({
              id: `${stopperId}_rolled`,
              name: "바위 멈춤쇠 (투하 완료)",
              conditions: [{ kind: "switch", switchId: solveSwitchId, value: true }],
              graphic: objGraphic("object2", 2, "down"),
              priority: "below",
              overlapForbidden: false,
              commands: [textCmd("거대 바위가 경사로를 따라 굴러 내려가 심연 구렁을 메웠다.")],
            }),
          ],
        };

        const chasmGateEvent: GameEvent = {
          id: chasmGateId,
          name: "심연 구렁 돌다리 착지점",
          x: cChasmGate.x,
          y: cChasmGate.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${chasmGateId}_blocked`,
              name: "심연 구렁 (차단)",
              graphic: objGraphic("object1", 5, "down"),
              priority: "same",
              commands: [
                textCmd("깊은 심연 구렁이 앞을 가로막고 있다. 북쪽 경사로 상단의 거대 바위를 굴려 구렁을 메워야 건널 수 있다."),
              ],
            }),
            makePage({
              id: `${chasmGateId}_bridged`,
              name: "심연 구렁 돌다리 (개방)",
              conditions: [{ kind: "switch", switchId: solveSwitchId, value: true }],
              graphic: { transparent: true },
              priority: "below",
              overlapForbidden: false,
              commands: [textCmd("거대 바위가 심연 구렁을 메워 만든 튼튼한 돌다리다.")],
            }),
          ],
        };

        registerEvent(map, winchEvent, "상부 고패 윈치");
        registerEvent(map, stopperEvent, "거대 바위 멈춤쇠");
        registerEvent(map, chasmGateEvent, "심연 구렁 돌다리");
        solveStepsSummary = [
          `(${cWinch.x},${cWinch.y}) '상부 고패 윈치' 조사로 쇠사슬 해제`,
          `(${cStopper.x},${cStopper.y}) '${stopperEvent.name}' 조사 → 5단계 바위 구름 궤적 연출 후 (${cChasmGate.x},${cChasmGate.y}) 심연 구렁 돌다리 완성`,
        ];
        break;
      }

      case "mirror_beam_refraction": {
        const cMirror1 = cells[0]!;
        const cMirror2 = cells[1]!;
        const cSeal = cells[2]!;
        const swM1 = `sw_${baseId}_mirror_1`;
        const swM2 = `sw_${baseId}_mirror_2`;
        ensureNamedSwitch(draft, swM1, "제1 태양 프리즘 거울 회전");
        ensureNamedSwitch(draft, swM2, "제2 굴절 거울 회전");
        switchIds.push(swM1, swM2);

        changeTileCmds = resolveChangeTiles([cSeal, cMirror1, cMirror2]);
        const m1Id = `ev_${baseId}_mirror_1`;
        const m2Id = `ev_${baseId}_mirror_2`;
        const sealId = `ev_${baseId}_mirror_seal`;

        const mirror1Event: GameEvent = {
          id: m1Id,
          name: "제1 태양 프리즘 거울",
          x: cMirror1.x,
          y: cMirror1.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${m1Id}_unaligned`,
              name: "제1 거울 (회전 전)",
              graphic: objGraphic("object2", 3, "down"),
              commands: [
                { kind: "wait", ms: 200 },
                se("chime2"),
                ...tintPulse("255,230,120", 0.4),
                { kind: "setSwitch", switchId: swM1, value: true },
                ...(stagePlan?.stepChangeTileCommands.mirror_1 ?? []),
                particles("sparkle", 1100, cMirror1),
                particles("magic", 1000, { x: Math.floor((cMirror1.x + cMirror2.x) / 2), y: cMirror1.y }),
                shake(3, 280),
                textCmd("스르륵— 쨍! 서쪽 프리즘 거울을 45도 회전시키자 천창의 황금 태양빛이 동쪽 굴절 거울로 뻗어 나갔다!"),
              ],
            }),
            makePage({
              id: `${m1Id}_aligned`,
              name: "제1 거울 (반사 중)",
              conditions: [{ kind: "switch", switchId: swM1, value: true }],
              graphic: objGraphic("object2", 6, "down"),
              commands: [textCmd("제1 프리즘 거울이 천창의 태양 빛줄기를 동쪽으로 반사하고 있다.")],
            }),
          ],
        };

        const mirror2Event: GameEvent = {
          id: m2Id,
          name: "제2 성소 굴절 거울",
          x: cMirror2.x,
          y: cMirror2.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${m2Id}_unaligned`,
              name: "제2 거울 (회전 전)",
              graphic: objGraphic("object2", 3, "down"),
              commands: [
                {
                  kind: "fork",
                  condition: { kind: "switch", switchId: swM1, value: true },
                  then: [
                    textCmd("동쪽 굴절 거울을 북쪽 성소 제단 각도로 맞췄다! 황금 빛줄기가 굴절되어 북쪽 암흑 결계를 직격한다!"),
                    { kind: "wait", ms: 250 },
                    se("bell"),
                    ...(stagePlan?.stepChangeTileCommands.mirror_2 ?? []),
                    particles("sparkle", 1200, cMirror2),
                    particles("magic", 1200, { x: cMirror2.x, y: cSeal.y }),
                    shake(3, 260),
                    se("barrier"),
                    se("collapse1"),
                    ...revealInWaves(changeTileCmds, { flash: "yellow", waves: ["sparkle", "magic", "smoke"] }),
                    textCmd("찬란한 태양 빛줄기가 북쪽 암흑 봉인을 산산이 정화하며 대성소 돌계단이 열렸다!"),
                    ...reward.grantCommands,
                    { kind: "setSwitch", switchId: swM2, value: true },
                    { kind: "setSwitch", switchId: solveSwitchId, value: true },
                  ],
                  else: [
                    textCmd("동쪽 굴절 거울 기둥이다. 먼저 서쪽 천창 아래의 『제1 태양 프리즘 거울』을 돌려 빛줄기를 보내야 한다."),
                  ],
                },
              ],
            }),
            makePage({
              id: `${m2Id}_aligned`,
              name: "제2 거울 (굴절 완료)",
              conditions: [{ kind: "switch", switchId: solveSwitchId, value: true }],
              graphic: objGraphic("object2", 6, "down"),
              commands: [textCmd("제2 굴절 거울이 황금 빛줄기를 북쪽 성소로 집중시키고 있다.")],
            }),
          ],
        };

        const sealEvent: GameEvent = {
          id: sealId,
          name: customTitle ?? "북쪽 암흑 봉인 제단",
          x: cSeal.x,
          y: cSeal.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${sealId}_sealed`,
              name: "암흑 봉인 제단 (잠김)",
              graphic: objGraphic("object1", 4, "down"),
              priority: "same",
              commands: [
                textCmd(
                  customHint ??
                    "어둠의 구슬 결계가 북쪽 성소 계단을 막고 있다. 서쪽과 동쪽의 거울 기둥을 차례로 돌려 태양 빛줄기를 굴절시켜야 한다.",
                ),
              ],
            }),
            makePage({
              id: `${sealId}_purified`,
              name: "암흑 봉인 제단 (정화됨)",
              conditions: [{ kind: "switch", switchId: solveSwitchId, value: true }],
              graphic: { transparent: true },
              priority: "below",
              overlapForbidden: false,
              commands: [textCmd("태양 빛줄기로 정화된 대성소 마법진이다.")],
            }),
          ],
        };

        registerEvent(map, mirror1Event, "제1 태양 프리즘 거울");
        registerEvent(map, mirror2Event, "제2 성소 굴절 거울");
        registerEvent(map, sealEvent, "북쪽 암흑 봉인 제단");
        solveStepsSummary = [
          `(${cMirror1.x},${cMirror1.y}) '제1 태양 프리즘 거울' 회전 → 동쪽 빛줄기 연결`,
          `(${cMirror2.x},${cMirror2.y}) '제2 성소 굴절 거울' 회전 → (${cSeal.x},${cSeal.y}) 암흑 봉인 파쇄 및 계단 개방`,
        ];
        break;
      }

      case "minecart_track_switch": {
        const cSwitch = cells[0]!;
        const cCart = cells[1]!;
        const cBarricade = cells[2]!;
        const swTrack = `sw_${baseId}_track_switched`;
        ensureNamedSwitch(draft, swTrack, "광산 분기 선로 전환 완료");
        switchIds.push(swTrack);

        changeTileCmds = resolveChangeTiles([cBarricade, cCart, cSwitch]);
        const switchId = `ev_${baseId}_track_switch`;
        const cartId = `ev_${baseId}_minecart`;
        const barricadeId = `ev_${baseId}_barricade`;

        const switchEvent: GameEvent = {
          id: switchId,
          name: "분기 선로 전환기",
          x: cSwitch.x,
          y: cSwitch.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${switchId}_west`,
              name: "선로 전환기 (서쪽 지선)",
              graphic: objGraphic("object2", 0, "down"),
              commands: [
                { kind: "wait", ms: 200 },
                sfx("switch-clack"),
                se("earth2"),
                { kind: "setSwitch", switchId: swTrack, value: true },
                ...(stagePlan?.stepChangeTileCommands.minecart_switch ?? []),
                particles("sparkle", 900, cSwitch),
                shake(3, 280),
                textCmd("철커덩—! 선로 전환기 레버를 당기자 막다른 서쪽 지선이 북쪽 금고 바리케이드 본선으로 연결되었다!"),
              ],
            }),
            makePage({
              id: `${switchId}_north`,
              name: "선로 전환기 (북쪽 본선)",
              conditions: [{ kind: "switch", switchId: swTrack, value: true }],
              graphic: objGraphic("object2", 0, "up"),
              commands: [textCmd("분기 선로가 북쪽 금고 바리케이드 본선으로 연결되어 있다.")],
            }),
          ],
        };

        const cartEvent: GameEvent = {
          id: cartId,
          name: "광석 적재 광차",
          x: cCart.x,
          y: cCart.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${cartId}_parked`,
              name: "광석 광차 (대기)",
              graphic: objGraphic("object2", 5, "down"),
              commands: [
                {
                  kind: "fork",
                  condition: { kind: "switch", switchId: swTrack, value: true },
                  then: [
                    textCmd("광차의 제동 걸쇠를 풀고 힘껏 밀어 출발시켰다! 광차가 불꽃을 튀기며 선로를 따라 질주한다!"),
                    { kind: "wait", ms: 250 },
                    se("earth2"),
                    ...(stagePlan?.stepChangeTileCommands.minecart_step_1 ?? []),
                    particles("sparkle", 1000, { x: cCart.x, y: cCart.y - 2 }),
                    particles("dust", 900, cCart),
                    shake(3, 200),
                    sfx("switch-clack"),
                    ...(stagePlan?.stepChangeTileCommands.minecart_step_2 ?? []),
                    particles("sparkle", 1000, { x: cCart.x, y: cCart.y - 4 }),
                    particles("smoke", 900, { x: cCart.x, y: cCart.y - 2 }),
                    shake(3, 200),
                    se("earth2"),
                    ...(stagePlan?.stepChangeTileCommands.minecart_step_3 ?? []),
                    particles("sparkle", 1100, { x: cBarricade.x, y: cBarricade.y + 2 }),
                    particles("dust", 900, { x: cCart.x + 2, y: cCart.y - 4 }),
                    shake(6, 200),
                    se("collapse1"),
                    ...(stagePlan?.stepChangeTileCommands.minecart_step_4 ?? []),
                    particles("explosion", 1100, { x: cBarricade.x, y: cBarricade.y + 1 }),
                    shake(6, 220),
                    se("explosion1"),
                    ...revealInWaves(changeTileCmds, { flash: "red", waves: ["explosion", "dust", "sparkle"] }),
                    textCmd("콰아아앙—!! 질주한 광차가 낙석 바리케이드를 정면으로 들이받아 산산조각 내고 북쪽 광산 금고를 열었다!"),
                    ...reward.grantCommands,
                    { kind: "setSwitch", switchId: solveSwitchId, value: true },
                  ],
                  else: [
                    textCmd("광석이 가득 실린 무거운 철제 광차다. 먼저 중앙의 『분기 선로 전환기』를 조작해 선로를 북쪽 본선으로 이어야 한다."),
                  ],
                },
              ],
            }),
            makePage({
              id: `${cartId}_launched`,
              name: "광석 광차 (발진 완료)",
              conditions: [{ kind: "switch", switchId: solveSwitchId, value: true }],
              graphic: { transparent: true },
              priority: "below",
              overlapForbidden: false,
              commands: [textCmd("광차가 선로를 따라 질주해 북쪽 바리케이드를 돌파했다.")],
            }),
          ],
        };

        const barricadeEvent: GameEvent = {
          id: barricadeId,
          name: customTitle ?? "북쪽 금고 낙석 바리케이드",
          x: cBarricade.x,
          y: cBarricade.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            makePage({
              id: `${barricadeId}_blocking`,
              name: "금고 바리케이드 (차단)",
              graphic: objGraphic("object2", 5, "down"),
              priority: "same",
              commands: [
                textCmd(
                  customHint ??
                    "두꺼운 낙석 바리케이드가 북쪽 금고를 막고 있다. 선로 전환기를 맞춘 뒤 남쪽의 광차를 출발시켜 충돌시키면 뚫을 수 있다.",
                ),
              ],
            }),
            makePage({
              id: `${barricadeId}_smashed`,
              name: "금고 바리케이드 (돌파됨)",
              conditions: [{ kind: "switch", switchId: solveSwitchId, value: true }],
              graphic: { transparent: true },
              priority: "below",
              overlapForbidden: false,
              commands: [textCmd("광차 충돌로 바리케이드가 시원하게 뚫린 금고 입구다.")],
            }),
          ],
        };

        registerEvent(map, switchEvent, "분기 선로 전환기");
        registerEvent(map, cartEvent, "광석 적재 광차");
        registerEvent(map, barricadeEvent, "북쪽 금고 바리케이드");
        solveStepsSummary = [
          `(${cSwitch.x},${cSwitch.y}) '분기 선로 전환기' 조사 → 북쪽 본선 연결`,
          `(${cCart.x},${cCart.y}) '광석 적재 광차' 발진 → 4단계 선로 질주 후 (${cBarricade.x},${cBarricade.y}) 바리케이드 격파`,
        ];
        break;
      }

      case "elemental_pedestal_swap": {
        const cFire = cells[0]!;
        const cIce = cells[1]!;
        const cWind = cells[2]!;
        const cEarth = cells[3]!;
        const sw1 = `sw_${baseId}_pedestal_1`;
        const sw2 = `sw_${baseId}_pedestal_2`;
        const sw3 = `sw_${baseId}_pedestal_3`;
        const sw4 = `sw_${baseId}_pedestal_4`;
        ensureNamedSwitch(draft, sw1, "화염의 룬 제단 각성");
        ensureNamedSwitch(draft, sw2, "빙결의 룬 제단 각성");
        ensureNamedSwitch(draft, sw3, "질풍의 룬 제단 각성");
        ensureNamedSwitch(draft, sw4, "대지의 룬 제단 각성");
        switchIds.push(sw1, sw2, sw3, sw4);

        changeTileCmds = resolveChangeTiles([cFire, cIce, cWind, cEarth]);
        const allPedestalSwitches = [sw1, sw2, sw3, sw4];
        const convergeSequence: Command[] = [
          se("barrier"),
          se("collapse1"),
          ...revealInWaves(changeTileCmds, { flash: "purple", waves: ["fire", "magic", "sparkle"] }),
          textCmd("쿠구구궁—!! 화·빙·풍·지 네 원소 제단의 빛이 중앙 대마법진으로 수렴하며 북쪽 성소 돌계단이 열렸다!"),
          ...reward.grantCommands,
          { kind: "setSwitch", switchId: solveSwitchId, value: true },
        ];

        const pedestalSpecs: ReadonlyArray<{
          readonly idx: 1 | 2 | 3 | 4;
          readonly label: string;
          readonly relic: string;
          readonly vfx: string;
          readonly at: Cell;
          readonly swId: string;
        }> = [
          { idx: 1, label: "화염의 룬 제단", relic: "홍련의 불꽃 성배", vfx: "fire", at: cFire, swId: sw1 },
          { idx: 2, label: "빙결의 룬 제단", relic: "만년설의 마나 결정", vfx: "magic", at: cIce, swId: sw2 },
          { idx: 3, label: "질풍의 룬 제단", relic: "천공의 폭풍 보주", vfx: "sparkle", at: cWind, swId: sw3 },
          { idx: 4, label: "대지의 룬 제단", relic: "고대 거인의 룬석", vfx: "dust", at: cEarth, swId: sw4 },
        ];

        for (const spec of pedestalSpecs) {
          const evId = `ev_${baseId}_pedestal_${spec.idx}`;
          const pedEvent: GameEvent = {
            id: evId,
            name: spec.label,
            x: spec.at.x,
            y: spec.at.y,
            trigger: { kind: "action" },
            commands: [],
            pages: [
              makePage({
                id: `${evId}_dormant`,
                name: `${spec.label} (비어 있음)`,
                graphic: objGraphic("object2", 3, "down"),
                commands: [
                  { kind: "wait", ms: 200 },
                  se("chime2"),
                  ...tintPulse("255,255,255", 0.4),
                  particles(spec.vfx, 1100, spec.at),
                  shake(3, 280),
                  { kind: "setSwitch", switchId: spec.swId, value: true },
                  ...(stagePlan?.stepChangeTileCommands[`pedestal_${spec.idx}`] ?? []),
                  textCmd(`「${spec.label}」 위에 『${spec.relic}』을(를) 안치하자 원소 룬이 찬란하게 깨어났다!`),
                  ...allSwitchesFork(allPedestalSwitches, convergeSequence),
                ],
              }),
              makePage({
                id: `${evId}_active`,
                name: `${spec.label} (공명 중)`,
                conditions: [{ kind: "switch", switchId: spec.swId, value: true }],
                graphic: objGraphic("object2", 6, "down"),
                commands: [textCmd(`「${spec.label}」 위에서 『${spec.relic}』이(가) 원소 마력을 뿜어내고 있다.`)],
              }),
            ],
          };
          registerEvent(map, pedEvent, spec.label);
        }

        solveStepsSummary = [
          `(${cFire.x},${cFire.y}) 화염의 룬 제단 조사`,
          `(${cIce.x},${cIce.y}) 빙결의 룬 제단 조사`,
          `(${cWind.x},${cWind.y}) 질풍의 룬 제단 조사`,
          `(${cEarth.x},${cEarth.y}) 대지의 룬 제단 조사 → 4원소 합일 + changeTile ${changeTileCmds.length}칸 및 성소 개방`,
        ];
        break;
      }
    }
    // 방 타일이 이미 그린 기물 위에는 보라 바위 같은 캐릭터 스프라이트를 겹치지 않는다.
    const tileDrawn = new Set((stagePlan?.tileDrawnCells ?? []).map((c) => `${c.x},${c.y}`));
    for (const evInfo of createdEvents) {
      const ev = map.events.find((e) => e.id === evInfo.id);
      if (!ev || !tileDrawn.has(`${ev.x},${ev.y}`)) continue;
      ev.pages = ev.pages?.map((page) => ({ ...page, graphic: { transparent: true } }));
    }
    for (const extra of stagePlan?.extraEvents ?? []) {
      registerEvent(map, extra.event, extra.role);
    }

    // 선택적 기존 출입구 잠금 연동
    let wiredGateEventId: string | undefined;
    if (typeof args.gateEventId === "string" && args.gateEventId.trim()) {
      const gid = args.gateEventId.trim();
      if (
        wireOptionalGateEvent(
          map,
          gid,
          solveSwitchId,
          `이 통로는 '${customTitle ?? preset.title}' 장치를 먼저 풀어야 열립니다.`,
        )
      ) {
        wiredGateEventId = gid;
      } else {
        warnings.push(`gateEventId '${gid}' 를 ${map.id} 에서 찾지 못해 자체 퍼즐 문만 배치했습니다.`);
      }
    }

    const texts = applyPuzzleMessages(
      createdEvents.flatMap((info) => draft.maps[info.mapId]?.events.filter((e) => e.id === info.id) ?? []),
      messages,
    );

    // 최종 통행·상호작용 도달성 검증(소프트락 0 보장)
    const analysis = new EventPlacementAnalysis(draft, map);
    for (const evInfo of createdEvents) {
      if (evInfo.mapId !== map.id) continue;
      const ev = map.events.find((e) => e.id === evInfo.id);
      if (ev && !analysis.hasInteractionPosition(ev, cluster.origin)) {
        throw new ToolError(
          `퍼즐 이벤트 '${ev.id}'(${ev.x},${ev.y}) 의 상호작용 위치에 시작점 (${cluster.origin.x},${cluster.origin.y}) 에서 도달할 수 없습니다 — 소프트락 방지를 위해 롤백합니다.`,
          { code: "puzzle-softlock-prevented", mapId: map.id },
        );
      }
    }

    return {
      summary: `${map.name}(${map.id})에 퍼즐 프리셋 「${preset.title}」(${presetId}) 시공 완료 — 2상태 기물 이벤트 ${createdEvents.length}개(${createdEvents.map((e) => `${e.name}@(${e.x},${e.y})`).join(", ")}), changeTile ${changeTileCmds.length}개, 해결 스위치 ${solveSwitchId}, 보상 ${reward.summaryLabel} · 소프트락 검증 PASS`,
      data: {
        mapId: map.id,
        presetId,
        puzzleId: baseId,
        title: customTitle ?? preset.title,
        category: preset.category,
        solveSwitchId,
        switchIds,
        variableIds,
        origin: cluster.origin,
        events: createdEvents,
        texts,
        changeTileCount: changeTileCmds.length,
        changeTileCommands: changeTileCmds,
        reward: {
          itemId: reward.itemId,
          itemName: reward.itemName,
          gold: reward.gold,
        },
        wiredGateEventId: wiredGateEventId ?? null,
        solveSteps: solveStepsSummary,
        walkabilityVerified: true,
      },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
}

/**
 * 프리셋 문구를 그 장소 말로 — rewordLines 는 프리셋이 쓴 대사 한 줄을 통째로 바꾸고(맞는 줄이 없으면 거절하며 있는 줄을 알려 준다),
 * renameObjects 는 퍼즐 기물 이벤트 이름을 바꾼다. 퍼즐 이벤트(퍼즐 id 로 시작)와 gateEventId 이벤트만 본다.
 */
function applyPuzzleWording(draft: Project, args: Record<string, unknown>, result: ToolExecResult): void {
  const reword = Array.isArray(args.rewordLines) ? (args.rewordLines as { from?: unknown; to?: unknown }[]) : [];
  const rename = Array.isArray(args.renameObjects) ? (args.renameObjects as { eventId?: unknown; name?: unknown }[]) : [];
  if (!reword.length && !rename.length) return;
  const map = requireMap(draft, String(args.mapId ?? ""));
  const presetId = resolvePuzzlePresetId(args.presetId) ?? "";
  const baseId = sanitizeId(typeof args.puzzleId === "string" && args.puzzleId.trim() ? args.puzzleId.trim() : `${map.id}_${presetId}`);
  const gate = typeof args.gateEventId === "string" ? args.gateEventId.trim() : "";
  const own = map.events.filter((event) => event.id.startsWith(baseId) || event.id.startsWith(`ev_${baseId}`) || (gate && event.id === gate));
  const table = new Map<string, string>();
  for (const [index, entry] of reword.entries()) {
    const from = typeof entry?.from === "string" ? entry.from.trim() : "", to = typeof entry?.to === "string" ? entry.to.trim() : "";
    if (!from || !to) throw new ToolError(`rewordLines[${index}] 는 {from, to} 입니다.`, { code: "invalid-args" });
    table.set(from, to);
  }
  const seen = new Set<string>(), all = new Set<string>();
  const walk = (cmds: unknown[]): void => {
    for (const raw of cmds) {
      const cmd = raw as Record<string, unknown>;
      if (cmd.kind === "text" && typeof cmd.body === "string") {
        all.add(cmd.body);
        const to = table.get(cmd.body.trim());
        if (to) { seen.add(cmd.body.trim()); cmd.body = to; }
      }
      if (typeof cmd.prompt === "string") { all.add(cmd.prompt); const to = table.get(cmd.prompt.trim()); if (to) { seen.add(cmd.prompt.trim()); cmd.prompt = to; } }
      for (const key of ["then", "else", "branch", "cancelBranch", "otherwiseBranch"]) if (Array.isArray(cmd[key])) walk(cmd[key] as unknown[]);
      if (Array.isArray(cmd.options)) for (const option of cmd.options as Record<string, unknown>[]) if (Array.isArray(option?.branch)) walk(option.branch as unknown[]);
    }
  };
  for (const event of own) for (const page of event.pages ?? []) walk(page.commands as unknown[]);
  const missing = [...table.keys()].filter((from) => !seen.has(from));
  if (missing.length) throw new ToolError(`rewordLines 의 줄 ${missing.length}개가 이 퍼즐 대사에 없습니다: 「${missing[0]!.slice(0, 40)}」. 있는 줄: ${[...all].map((line) => `「${line.slice(0, 50)}」`).join(" · ").slice(0, 1500)}`, { code: "puzzle-reword-unmatched", mapId: map.id });
  for (const [index, entry] of rename.entries()) {
    const id = typeof entry?.eventId === "string" ? entry.eventId.trim() : "", name = typeof entry?.name === "string" ? entry.name.trim() : "";
    const event = own.find((candidate) => candidate.id === id);
    if (!event || !name) throw new ToolError(`renameObjects[${index}] — 이 퍼즐의 이벤트 '${id}' 가 없습니다. 있는 이벤트: ${own.map((candidate) => candidate.id).join(", ")}`, { code: "puzzle-rename-unmatched", mapId: map.id });
    event.name = name;
  }
  const data = result.data as Record<string, unknown> | undefined;
  if (data) data.reworded = { lines: seen.size, renamed: rename.length };
}

export const PUZZLE_AUTHORING_TOOLS: readonly ToolDefinition[] = [
  listPuzzlePresetsTool,
  authorMapPuzzleTool,
];
