// MCGA 핵심 도메인 타입 — 클라이언트/엔진/Edge Function 공통.
// DB 스키마(mcga)와 1:1 매핑. 스펙 docs/specs/2026-06-25-mcga-design.md 참고.

// ── 열거형 ──────────────────────────────────────────────

/** 8개 역사 세력 (동아시아 14~16세기). */
export type FactionId =
  | "chosun" // 조선 — 플레이어 기본, 균형·방어 강함
  | "myung" // 명(明) — 거대 제국, 느림
  | "yeojin" // 여진/건주 — 기병·약탈 강함
  | "wae" // 왜(일본) — 해전·침략 공격적
  | "ryukyu" // 류큐 — 교역 강함, 군 약함
  | "annam" // 안남/베트남 — 게릴라 방어, 쌀 생산
  | "champa" // 참파 — 해상 교역 소국
  | "mongol"; // 몽골/북원 — 기병 최강, 내란 많음

/** 왕 성격 — MVP 3종 (역사적 왕 매핑). */
export type KingPersonality = "cruel" | "benevolent" | "paranoid";

/** 신하 부문 — MVP 2개. */
export type Office = "interior" | "military"; // 영의정(내정) / 병조판서(군사)

/** 행동 카드 종류 — 내정 4 + 군사 4. */
export type ActionKind =
  // 내정
  | "tax_raise" // 세율 올림
  | "grain_levy" // 곡물 징수
  | "infrastructure" // 치수·양잠
  | "relief" // 진휼(기민 구제)
  // 군사
  | "conscript" // 징병
  | "train" // 훈련
  | "attack" // 출병 (전시만)
  | "defend"; // 철수/수비

/** 왕의 판결. GPT가 제안, 코드가 승인. */
export type Verdict =
  | "reward" // 포상
  | "punish" // 징벌(강등/투옥/몰수)
  | "execute" // 사약(사형) — 명분 점수 임계치 도달 시만
  | "dismiss"; // 방기

// ── 핵심 엔티티 (DB 행 매핑) ────────────────────────────

export interface Nation {
  id: FactionId;
  name: string;
  color: string; // SVG 색 (예: "#2a7fff")
  king_id: string;
  capital_territory_id: string;
  archetype: string; // 문명식 보너스 설명 (참고용)
  eliminated: boolean;
}

export interface King {
  id: string;
  nation_id: FactionId;
  name: string; // 역사적 왕 이름 (예: "세종")
  personality: KingPersonality;
  is_bot: boolean;
  alive: boolean;
}

export interface Subject {
  id: string;
  nation_id: FactionId;
  user_id: string | null; // null = 봇
  nickname: string;
  office: Office;
  territory_id: string | null; // 수령으로 통치하는 고을 (없으면 null)
  fame: number; // 공명(명성)
  is_bot: boolean;
  alive: boolean;
}

export interface Territory {
  id: string;
  nation_id: FactionId | null; // null = 미개척/무주공산
  name: string;
  population: number;
  grain: number;
  troops: number;
  combat_power: number; // 0~100, 훈련 수치
  q: number; // 헥스 좌표 (axial)
  r: number;
}

export interface War {
  id: string;
  attacker_nation_id: FactionId;
  defender_nation_id: FactionId;
  territory_id: string; // 공격 대상 고을
  status: "active" | "resolved";
  attacker_troops: number;
  created_tick: number;
}

// ── 숏 & 사건 ──────────────────────────────────────────

export type EventType =
  | "invasion" // 침공 (전쟁 발생)
  | "famine" // 기근
  | "rebellion" // 반란
  | "tax_proposal" // 세금 건의 (내정 숏)
  | "war_report" // 전쟁 보고 (군사 숏)
  | "royal_decree"; // 왕의 일상 명령

export interface GameEvent {
  id: string;
  season_id: number;
  tick_at: number;
  type: EventType;
  payload: Record<string, unknown>;
  affected_subject_ids: string[];
}

export type ShortStatus = "pending" | "resolved";

export interface ShortTicket {
  id: string;
  subject_id: string;
  event_id: string;
  status: ShortStatus;
  created_at: string;
  // 플레이어가 제출한 행동 + 결과 (해결 후 채워짐)
  chosen_action?: ActionKind;
}

// ── 시즌 ────────────────────────────────────────────────

export interface Season {
  id: number;
  start_at: string;
  end_at: string | null;
  winner_nation_id: FactionId | null;
}

// ── 엔진 연산 결과 ──────────────────────────────────────

/** 전투 해석 결과 — 결정론적 (GPT 안 씀). */
export interface CombatResult {
  winner: "attacker" | "defender";
  attacker_losses: number;
  defender_losses: number;
  territory_captured: boolean; // 수비 패배 → 고을 점령
  defender_nation_eliminated: boolean; // 마지막 고을 상실 → 멸만
}

/** 세계 틱 1회 분량의 전체 적용 결과. */
export interface TickResult {
  tick: number;
  resource_updates: number; // 적용된 고을 수
  combats_resolved: number;
  nations_eliminated: FactionId[];
  territory_ownership_changes: { territory_id: string; from: FactionId | null; to: FactionId | null }[];
}

// ── 숏 DTO (Edge Function ↔ 클라이언트) ─────────────────

export interface ShortOption {
  kind: ActionKind;
  label: string;
  hint: string;
}

export interface ShortData {
  short_id: string;
  event_id: number | null;
  type: EventType;
  briefing: string;
  territory?: {
    id: string;
    name: string;
    troops: number;
    grain: number;
    population: number;
  };
  options: ShortOption[];
  tick: number;
}

export interface ActionSubmissionResult {
  result: {
    action: ActionKind;
    territory: Territory;
    summary: string;
    fame_delta: number;
    new_fame: number;
  };
  verdict: {
    kind: Verdict;
    king_line: string;
  } | null; // STEP 3에서 채워짐
}

export interface EnterResult {
  user_id: string;
  subject: Subject;
  reassigned: boolean;
}
