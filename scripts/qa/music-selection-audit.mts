#!/usr/bin/env bun
/**
 * 고강도 음악 선택 블라인드 감사 러너 (Gemini 4 Neon 최종 청취 검증용)
 *
 * 사용법:
 *   bun scripts/qa/music-selection-audit.mts generate --out <dir> [--seed 20261127] [--only c01,c02]
 *   bun scripts/qa/music-selection-audit.mts score --dir <dir> --verdicts <dir>/verdicts.json
 *
 * 원칙:
 *   - 실제 store.openrpgmaker.com 609곡과 프로덕션 autoStoreBgm / scoreStoreMusic 경로를 그대로 실행한다.
 *   - blind-packet.json 에는 곡 제목·팩 이름·oprnMusic 메타·점수·디코이 여부를 절대 적지 않는다.
 *   - 전체 묶음에 숨긴 디코이 10건을 섞고, score 단계에서 디코이를 1건이라도 PASS 시키면 라운드 전체를 무효 처리한다.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { StoreItemSummary, StorePackManifest } from "@/assetStore/format";
import {
  inferStoreMusicScene,
  normalizeStoreMusicScene,
  projectHintLines,
  scoreStoreMusic,
  storeMusicTracks,
  type StoreMusicQuery,
  type StoreMusicTrack,
} from "@/assetStore/storeMusicPick";
import {
  buildAutoMusicWant,
  inferMapStoreScene,
  pickSeededStoreTracks,
  tilesetMusicHint,
  type AutoStoreBgmMapHint,
} from "@/ai/v2/place/autoStoreBgm";
import { recommendMapBgm } from "@/assets/bgmThemeRecommendation";
import { BGM_CATALOG } from "@/assets/bgmCatalog";
import type { StoreMusicScene } from "@/assets/storeMusicMeta";
import { mulberry32 } from "@/util/rng";

const STORE_BASE = process.env.OPRN_STORE_URL?.trim() || "https://store.openrpgmaker.com";
const FFMPEG = existsSync("/home/main/.local/bin/ffmpeg") ? "/home/main/.local/bin/ffmpeg" : "ffmpeg";
const FFPROBE = existsSync("/home/main/.local/bin/ffprobe") ? "/home/main/.local/bin/ffprobe" : "ffprobe";

interface AuditCaseSpec {
  readonly id: string;
  readonly axis: "label-trap" | "compound-mood" | "game-ref-role" | "multi-game";
  readonly mode: "auto" | "search";
  readonly prompt: string;
  readonly context: string;
  readonly scene?: StoreMusicScene;
  readonly mapName?: string;
  readonly tilesetId?: string;
  readonly tilesetFamily?: string;
  readonly blueprintText?: string;
  readonly hint?: AutoStoreBgmMapHint;
  readonly query?: string;
  readonly mood?: string;
  readonly gameGroup?: string;
  readonly seedKey?: string;
}

interface DecoySpec {
  readonly id: string;
  readonly prompt: string;
  readonly context: string;
  readonly scene: StoreMusicScene;
  readonly reason: string;
  readonly pickTrack: (tracks: readonly StoreMusicTrack[]) => StoreMusicTrack | undefined;
}

const STRESS_CASES: readonly AuditCaseSpec[] = [
  // ── Axis 1: Pack-Label Traps (10) ──
  {
    id: "c01", axis: "label-trap", mode: "auto",
    prompt: "폐교 2층 공포 교실 맵을 만들어 줘",
    context: "자동 맵 생성(modern_campus) · 폐교 공포 교실 · town 장면",
    mapName: "폐교 2층 공포 교실", tilesetId: "modern_campus", tilesetFamily: "oprn-modern",
    blueprintText: "폐교에 갇힌 학생들의 학교 괴담 공포 게임", hint: { indoor: true },
  },
  {
    id: "c02", axis: "label-trap", mode: "auto",
    prompt: "이브(Ib) 스타일의 공포 미술관 1층 전시실",
    context: "자동 맵 생성(modern_city) · 공포 미술관 · town 장면",
    mapName: "붉은 그림의 미술관", tilesetId: "modern_city", tilesetFamily: "oprn-modern",
    blueprintText: "이브 느낌의 기괴한 공포 미술관 탈출 RPG", hint: { indoor: true },
  },
  {
    id: "c03", axis: "label-trap", mode: "search",
    prompt: "언더테일 느낌의 8비트 칩튠 마을 음악",
    context: "조수 검색(store_find_music) · 8비트 칩튠 마을",
    scene: "town", query: "언더테일 8비트 칩튠", mood: "아기자기 경쾌",
  },
  {
    id: "c04", axis: "label-trap", mode: "search",
    prompt: "언더테일 8비트 칩튠 지하 던전 음악",
    context: "조수 검색(store_find_music) · 8비트 칩튠 던전",
    scene: "dungeon", query: "언더테일 8비트 칩튠", mood: "미스터리",
  },
  {
    id: "c05", axis: "label-trap", mode: "search",
    prompt: "심포닉 판타지 최종 보스전 음악",
    context: "조수 검색(store_find_music) · 웅장한 오케스트라 판타지 보스전",
    scene: "boss", query: "심포닉 판타지 오케스트라", mood: "웅장 비장",
  },
  {
    id: "c06", axis: "label-trap", mode: "auto",
    prompt: "평화로운 판타지 시작 마을 버들 마을",
    context: "자동 맵 생성(beodeul_town) · 평화로운 시작 마을",
    mapName: "버들 마을", tilesetId: "beodeul_town", tilesetFamily: "oprn-atlas",
    blueprintText: "평화로운 시작 마을에서 떠나는 판타지 모험", hint: { specType: "village" },
  },
  {
    id: "c07", axis: "label-trap", mode: "search",
    prompt: "기묘하고 차가운 전자음 인더스트리얼 지하 연구실",
    context: "조수 검색(store_find_music) · 기묘한 미니멀 전자음 던전(재즈바 금지)",
    scene: "dungeon", query: "기묘한 인더스트리얼 차가운 전자음 공포", mood: "으스스 불안",
  },
  {
    id: "c08", axis: "label-trap", mode: "search",
    prompt: "슈퍼패미컴 16비트 레트로 감성의 판타지 필드",
    context: "조수 검색(store_find_music) · 16비트 레트로 필드(어쿠스틱 단독 금지)",
    scene: "field", query: "16비트 슈퍼패미컴 레트로", mood: "모험 경쾌",
  },
  {
    id: "c09", axis: "label-trap", mode: "search",
    prompt: "학교 괴담 밤의 복도 긴장감 있는 공포 BGM",
    context: "조수 검색(store_find_music) · 학교 공포 tense(따뜻한 일상 피아노 금지)",
    scene: "tense", query: "학교 괴담 학교 공포 교실", mood: "으스스 오싹 긴장",
  },
  {
    id: "c10", axis: "label-trap", mode: "search",
    prompt: "아기자기 인디 8비트 칩튠 일반 전투 음악",
    context: "조수 검색(store_find_music) · 8비트 인디 RPG 전투",
    scene: "battle", query: "8비트 칩튠 아기자기 인디", mood: "경쾌 신나는",
  },

  // ── Axis 2: Compound & Contradictory Moods (10) ──
  {
    id: "c11", axis: "compound-mood", mode: "auto",
    prompt: "비 오는 밤의 고요하고 쓸쓸한 조선 한옥 마을",
    context: "자동 맵 생성(joseon_baram) · 비 오는 밤 조선 마을",
    mapName: "비 내리는 한옥 마을", tilesetId: "joseon_baram", tilesetFamily: "oprn-joseon",
    blueprintText: "조선 시대 밤안개와 빗속의 고요한 한옥 마을", hint: { specType: "village" },
  },
  {
    id: "c12", axis: "compound-mood", mode: "search",
    prompt: "밝고 귀여워 보이지만 어딘가 섬뜩한 잔혹 동화 인형의 집",
    context: "조수 검색(store_find_music) · 잔혹 동화 오르골 왈츠 기괴한 귀여움",
    scene: "town", query: "잔혹 동화 오르골 왈츠 기괴한 귀여움 공포", mood: "기묘 으스스",
  },
  {
    id: "c13", axis: "compound-mood", mode: "search",
    prompt: "슬프고 애절한 비극적 최종 보스전",
    context: "조수 검색(store_find_music) · 비극적·애절한 오케스트라 보스전",
    scene: "boss", query: "오케스트라 멜로드라마", mood: "슬픈 애절 비장",
  },
  {
    id: "c14", axis: "compound-mood", mode: "auto",
    prompt: "활기차고 정겨운 낮의 조선 한양 저잣거리",
    context: "자동 맵 생성(joseon_baram) · 활기찬 낮 조선 장터",
    mapName: "한양 저잣거리", tilesetId: "joseon_baram", tilesetFamily: "oprn-joseon",
    blueprintText: "상인과 행인이 북적이는 활기찬 조선 장터", hint: { specType: "village" },
  },
  {
    id: "c15", axis: "compound-mood", mode: "search",
    prompt: "긴박한 현대 도시 학교 옥상 결전 전투",
    context: "조수 검색(store_find_music) · 현대 배경 긴박한 전투",
    scene: "battle", query: "현대 도시", mood: "긴박 강렬",
  },
  {
    id: "c16", axis: "compound-mood", mode: "auto",
    prompt: "별빛 아래 평화로운 사막 오아시스 마을",
    context: "자동 맵 생성(desert_east) · 이국적 사막 오아시스 마을",
    mapName: "오아시스 휴식처", tilesetId: "desert_east", tilesetFamily: "oprn-atlas",
    blueprintText: "모래 사막 한가운데 별빛이 비치는 평화로운 오아시스", hint: { specType: "village" },
  },
  {
    id: "c17", axis: "compound-mood", mode: "auto",
    prompt: "신비롭고 경건한 고대 하늘 신전 유적",
    context: "자동 맵 생성(sky_island) · 구름 위 고대 신전 던전",
    mapName: "고대 하늘 신전", tilesetId: "sky_island", tilesetFamily: "oprn-atlas",
    blueprintText: "구름 위 떠 있는 신비롭고 경건한 고대 신전", hint: { specType: "dungeon" },
  },
  {
    id: "c18", axis: "compound-mood", mode: "auto",
    prompt: "쓸쓸하고 황량한 종말 후 폐허 황무지",
    context: "자동 맵 생성(wasteland_ruins) · 황무지 필드",
    mapName: "잿빛 폐허 황무지", tilesetId: "wasteland_ruins", tilesetFamily: "oprn-atlas",
    blueprintText: "문명이 무너진 뒤의 쓸쓸하고 어두운 황무지", hint: { specType: "field" },
  },
  {
    id: "c19", axis: "compound-mood", mode: "auto",
    prompt: "따뜻하고 포근한 현대 연애 일상 카페",
    context: "자동 맵 생성(modern_campus) · 연애 일상 카페 실내",
    mapName: "햇살 골목 카페", tilesetId: "modern_campus", tilesetFamily: "oprn-modern",
    blueprintText: "주인공과 히로인이 만나는 따뜻하고 설레는 연애 일상물", hint: { indoor: true },
  },
  {
    id: "c20", axis: "compound-mood", mode: "auto",
    prompt: "어둡고 웅장한 스팀펑크 지하 보일러실",
    context: "자동 맵 생성(steampunk_city) · 스팀펑크 지하 보일러실 던전",
    mapName: "지하 대보일러실", tilesetId: "steampunk_city", tilesetFamily: "oprn-atlas",
    blueprintText: "거대한 톱니와 증기가 뿜어져 나오는 어두운 스팀펑크 기관실", hint: { specType: "dungeon" },
  },

  // ── Axis 3: Game References & 7 Audio Roles (10) ──
  {
    id: "c21", axis: "game-ref-role", mode: "search",
    prompt: "투더문 느낌의 잔잔하고 감성적인 피아노 엔딩곡",
    context: "조수 검색 · 게임 레퍼런스(투더문) + ending 역할",
    scene: "ending", query: "투더문 느낌", mood: "잔잔 감성 여운",
  },
  {
    id: "c22", axis: "game-ref-role", mode: "search",
    prompt: "아오오니처럼 괴물에게 쫓기는 공포 추격 음악",
    context: "조수 검색 · 게임 레퍼런스(아오오니) + chase 역할",
    scene: "chase", query: "아오오니 추격 공포", mood: "긴박 공포",
  },
  {
    id: "c23", axis: "game-ref-role", mode: "search",
    prompt: "크로노트리거 느낌의 설레는 모험 필드 음악",
    context: "조수 검색 · 게임 레퍼런스(크로노트리거) + field 역할",
    scene: "field", query: "크로노트리거 느낌", mood: "모험 희망",
  },
  {
    id: "c24", axis: "game-ref-role", mode: "search",
    prompt: "포켓몬 체육관 관장과의 뜨거운 보스전 음악",
    context: "조수 검색 · 게임 레퍼런스(포켓몬) + boss 역할",
    scene: "boss", query: "포켓몬 체육관 관장", mood: "박진감 열정",
  },
  {
    id: "c25", axis: "game-ref-role", mode: "search",
    prompt: "테일즈런너처럼 신나고 경쾌한 캐주얼 레이싱 필드",
    context: "조수 검색 · 게임 레퍼런스(테일즈런너) + field 역할",
    scene: "field", query: "테일즈런너처럼", mood: "신나는 경쾌",
  },
  {
    id: "c26", axis: "game-ref-role", mode: "search",
    prompt: "위쳐 느낌의 다크 포크 민속 주막 마을 음악",
    context: "조수 검색 · 게임 레퍼런스(위쳐) + town 역할",
    scene: "town", query: "위쳐 느낌 주막", mood: "민속 투박",
  },
  {
    id: "c27", axis: "game-ref-role", mode: "search",
    prompt: "유메닛키처럼 몽환적이고 초현실적인 꿈 세계 필드",
    context: "조수 검색 · 게임 레퍼런스(유메닛키) + field 역할",
    scene: "field", query: "유메닛키 느낌", mood: "몽환 초현실",
  },
  {
    id: "c28", axis: "game-ref-role", mode: "search",
    prompt: "마녀의 집 느낌의 잔혹 동화 오르골 왈츠 저택",
    context: "조수 검색 · 게임 레퍼런스(마녀의 집) + town 역할",
    scene: "town", query: "마녀의 집 느낌", mood: "기괴 오르골",
  },
  {
    id: "c29", axis: "game-ref-role", mode: "search",
    prompt: "파이널판타지 느낌의 웅장한 판타지 RPG 타이틀 화면",
    context: "조수 검색 · 게임 레퍼런스(파이널판타지) + title 역할",
    scene: "title", query: "파이널판타지 느낌", mood: "웅장 서사",
  },
  {
    id: "c30", axis: "game-ref-role", mode: "search",
    prompt: "몬스터 수집 RPG 전투 승리 팡파르 징글",
    context: "조수 검색 · 몬스터 수집 + victory 역할(짧은 승리 팡파르)",
    scene: "victory", query: "포켓몬 몬스터", mood: "승리 경쾌",
  },

  // ── Axis 4: Full-Game Multi-Map Cohesion & Role Separation (10 = 2 games × 5 roles) ──
  // Game A: 무협 강호 RPG
  {
    id: "c31", axis: "multi-game", mode: "auto", gameGroup: "murim-game",
    prompt: "무협 RPG 첫 마을 낙양성 객잔 거리",
    context: "[무협 풀게임 1/5] 마을(town) · murim_wuxia",
    mapName: "낙양성 객잔 거리", tilesetId: "murim_wuxia", tilesetFamily: "oprn-murim",
    blueprintText: "강호의 협객이 모이는 무협 RPG", hint: { specType: "village" },
  },
  {
    id: "c32", axis: "multi-game", mode: "auto", gameGroup: "murim-game",
    prompt: "무협 RPG 안개 낀 검림 대나무 숲 필드",
    context: "[무협 풀게임 2/5] 필드(field) · murim_wuxia",
    mapName: "검림 대나무 숲", tilesetId: "murim_wuxia", tilesetFamily: "oprn-murim",
    blueprintText: "강호의 협객이 모이는 무협 RPG", hint: { specType: "field" },
  },
  {
    id: "c33", axis: "multi-game", mode: "auto", gameGroup: "murim-game",
    prompt: "무협 RPG 혈교 지하 비밀 동굴 던전",
    context: "[무협 풀게임 3/5] 던전(dungeon) · murim_wuxia",
    mapName: "혈교 지하 동굴", tilesetId: "murim_wuxia", tilesetFamily: "oprn-murim",
    blueprintText: "강호의 협객이 모이는 무협 RPG", hint: { specType: "dungeon" },
  },
  {
    id: "c34", axis: "multi-game", mode: "search", gameGroup: "murim-game",
    prompt: "무협 RPG 강호 일반 전투 음악",
    context: "[무협 풀게임 4/5] 일반 전투(battle) · projectLines 상속",
    scene: "battle", query: "무협", mood: "박진감 결투",
  },
  {
    id: "c35", axis: "multi-game", mode: "search", gameGroup: "murim-game",
    prompt: "무협 RPG 마교 교주 최종 보스전 음악",
    context: "[무협 풀게임 5/5] 보스전(boss) · projectLines 상속",
    scene: "boss", query: "무협", mood: "비장 웅장 최종결전",
  },

  // Game B: SF 우주 정거장 스릴러
  {
    id: "c36", axis: "multi-game", mode: "auto", gameGroup: "sf-game",
    prompt: "SF 우주 정거장 거주 구역 허브",
    context: "[SF 풀게임 1/5] 마을/거점(town) · sf_station",
    mapName: "궤도 정거장 거주 구역", tilesetId: "sf_station", tilesetFamily: "oprn-scifi",
    blueprintText: "심우주 궤도 정거장을 배경으로 한 SF 스릴러 RPG", hint: { specType: "village" },
  },
  {
    id: "c37", axis: "multi-game", mode: "auto", gameGroup: "sf-game",
    prompt: "SF 외우주 성운 탐사 섹터 필드",
    context: "[SF 풀게임 2/5] 필드(field) · sf_station",
    mapName: "성운 외곽 탐사 구역", tilesetId: "sf_station", tilesetFamily: "oprn-scifi",
    blueprintText: "심우주 궤도 정거장을 배경으로 한 SF 스릴러 RPG", hint: { specType: "field" },
  },
  {
    id: "c38", axis: "multi-game", mode: "auto", gameGroup: "sf-game",
    prompt: "SF 감염된 폐쇄 격리 구역 던전",
    context: "[SF 풀게임 3/5] 던전(dungeon) · sf_station",
    mapName: "폐쇄 격리 지하 구역", tilesetId: "sf_station", tilesetFamily: "oprn-scifi",
    blueprintText: "심우주 궤도 정거장을 배경으로 한 SF 스릴러 RPG", hint: { specType: "dungeon" },
  },
  {
    id: "c39", axis: "multi-game", mode: "search", gameGroup: "sf-game",
    prompt: "SF 우주 정거장 침입자 긴급 추격 음악",
    context: "[SF 풀게임 4/5] 추격전(chase) · projectLines 상속",
    scene: "chase", query: "SF 우주", mood: "긴박 위기",
  },
  {
    id: "c40", axis: "multi-game", mode: "search", gameGroup: "sf-game",
    prompt: "SF 폭주한 AI 코어 최종 보스전 음악",
    context: "[SF 풀게임 5/5] 보스전(boss) · projectLines 상속",
    scene: "boss", query: "SF 우주", mood: "강렬 사이버 최종전",
  },
];

const DECOY_SPECS: readonly DecoySpec[] = [
  {
    id: "d01", scene: "town",
    prompt: "폐교 2층 공포 교실 맵을 만들어 줘",
    context: "자동 맵 생성(modern_campus) · 폐교 공포 교실 · town 장면",
    reason: "공포 폐교에 밝고 따뜻한 연애 일상 곡 투입",
    pickTrack: (ts) => ts.find((t) => t.music.genre === "romance" && t.music.scenes.includes("town") && /밝|따뜻|경쾌|설레/u.test(t.music.summaryKo + t.music.mood.join(" "))),
  },
  {
    id: "d02", scene: "town",
    prompt: "평화로운 판타지 시작 마을 버들 마을",
    context: "자동 맵 생성(beodeul_town) · 평화로운 시작 마을",
    reason: "평화로운 시작 마을에 격렬한 보스전 전투곡 투입",
    pickTrack: (ts) => ts.find((t) => t.music.scenes[0] === "boss" && t.music.energy >= 4),
  },
  {
    id: "d03", scene: "town",
    prompt: "언더테일 느낌의 8비트 칩튠 마을 음악",
    context: "조수 검색(store_find_music) · 8비트 칩튠 마을",
    reason: "8비트 칩튠 요청에 어쿠스틱 켈틱 하프/오보에 곡 투입",
    pickTrack: (ts) => ts.find((t) => t.music.genre === "chiptune-indie-rpg" && /하프|오보에|harp|oboe/iu.test(t.music.summaryKo + t.music.feelTags.join(" "))),
  },
  {
    id: "d04", scene: "town",
    prompt: "활기차고 정겨운 낮의 조선 한양 저잣거리",
    context: "자동 맵 생성(joseon_baram) · 활기찬 낮 조선 장터",
    reason: "활기찬 조선 장터에 SF 우주 다크 던전 전자음 투입",
    pickTrack: (ts) => ts.find((t) => t.music.genre === "scifi" && t.music.scenes.includes("dungeon")),
  },
  {
    id: "d05", scene: "chase",
    prompt: "아오오니처럼 괴물에게 쫓기는 공포 추격 음악",
    context: "조수 검색 · 게임 레퍼런스(아오오니) + chase 역할",
    reason: "긴박한 공포 추격전에 느긋하고 포근한 카페/마을 휴식곡 투입",
    pickTrack: (ts) => ts.find((t) => t.music.genre === "piano-story" && t.music.scenes.includes("town") && t.music.energy <= 2),
  },
  {
    id: "d06", scene: "boss",
    prompt: "심포닉 판타지 최종 보스전 음악",
    context: "조수 검색(store_find_music) · 웅장한 오케스트라 판타지 보스전",
    reason: "웅장한 최종 보스전에 밝고 신나는 캐주얼 레이싱 로비곡 투입",
    pickTrack: (ts) => ts.find((t) => t.music.genre === "casual-race" && t.music.scenes.includes("town")),
  },
  {
    id: "d07", scene: "ending",
    prompt: "투더문 느낌의 잔잔하고 감성적인 피아노 엔딩곡",
    context: "조수 검색 · 게임 레퍼런스(투더문) + ending 역할",
    reason: "잔잔한 피아노 엔딩에 강렬한 추격 호러/보스 전투곡 투입",
    pickTrack: (ts) => ts.find((t) => t.music.genre === "chase-horror" && t.music.scenes.includes("chase")),
  },
  {
    id: "d08", scene: "boss",
    prompt: "포켓몬 체육관 관장과의 뜨거운 보스전 음악",
    context: "조수 검색 · 게임 레퍼런스(포켓몬) + boss 역할",
    reason: "뜨거운 체육관 관장전에 어둡고 느린 공포 앰비언트 투입",
    pickTrack: (ts) => ts.find((t) => t.music.genre === "horror" && t.music.scenes.includes("dungeon") && t.music.energy <= 2),
  },
  {
    id: "d09", scene: "town",
    prompt: "따뜻하고 포근한 현대 연애 일상 카페",
    context: "자동 맵 생성(modern_campus) · 연애 일상 카페 실내",
    reason: "따뜻한 연애 카페에 으스스한 공포 던전/긴장곡 투입",
    pickTrack: (ts) => ts.find((t) => t.music.genre === "horror" && t.music.scenes.includes("tense")),
  },
  {
    id: "d10", scene: "town",
    prompt: "비 오는 밤의 고요하고 쓸쓸한 조선 한옥 마을",
    context: "자동 맵 생성(joseon_baram) · 비 오는 밤 조선 마을",
    reason: "고요한 비 오는 밤 한옥 마을에 들뜨고 신나는 캐주얼 레이싱 필드곡 투입",
    pickTrack: (ts) => ts.find((t) => t.music.genre === "casual-race" && t.music.scenes.includes("field") && t.music.energy >= 4),
  },
];

async function fetchStoreCatalog(cacheDir: string): Promise<StoreMusicTrack[]> {
  mkdirSync(cacheDir, { recursive: true });
  const cachePath = resolve(cacheDir, "store-music-tracks.json");
  if (existsSync(cachePath)) {
    const cached = JSON.parse(readFileSync(cachePath, "utf8")) as { fetchedAt: string; tracks: StoreMusicTrack[] };
    if (Array.isArray(cached.tracks) && cached.tracks.length > 500) {
      console.log(`[cache] Loaded ${cached.tracks.length} tracks from ${cachePath}`);
      return cached.tracks;
    }
  }
  console.log(`[store] Fetching live music packs from ${STORE_BASE}/api/v1/items?kind=music ...`);
  const listRes = await fetch(`${STORE_BASE}/api/v1/items?kind=music&limit=100`);
  if (!listRes.ok) throw new Error(`store items HTTP ${listRes.status}`);
  const listJson = (await listRes.json()) as { items?: StoreItemSummary[] };
  const items = listJson.items ?? [];
  const allTracks: StoreMusicTrack[] = [];
  for (const item of items) {
    const mRes = await fetch(`${STORE_BASE}/api/v1/items/${encodeURIComponent(item.slug)}/versions/${item.latestVersion}/manifest`);
    if (!mRes.ok) continue;
    const manifest = (await mRes.json()) as StorePackManifest;
    allTracks.push(...storeMusicTracks(item, manifest));
  }
  writeFileSync(cachePath, JSON.stringify({ fetchedAt: new Date().toISOString(), packCount: items.length, tracks: allTracks }, null, 2));
  console.log(`[store] Fetched ${items.length} packs / ${allTracks.length} tracks.`);
  return allTracks;
}

async function ensureBlob(blobHash: string, blobDir: string): Promise<string> {
  mkdirSync(blobDir, { recursive: true });
  const safe = blobHash.replace(/[^a-zA-Z0-9_-]/g, "_");
  const outPath = resolve(blobDir, `${safe}.ogg`);
  if (existsSync(outPath)) return outPath;
  const url = `${STORE_BASE}/api/v1/blobs/${encodeURIComponent(blobHash)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`blob fetch failed ${res.status} for ${blobHash}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, buf);
  return outPath;
}

function probeDurationSec(audioPath: string): number {
  const res = spawnSync(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", audioPath], { encoding: "utf8" });
  const val = Number.parseFloat((res.stdout ?? "").trim());
  return Number.isFinite(val) ? Math.round(val * 10) / 10 : 0;
}

function makeAuditionClip(rawPath: string, clipPath: string, durationSec: number): void {
  if (durationSec <= 32) {
    copyFileSync(rawPath, clipPath);
    return;
  }
  // 처음 25초(인트로+메인 전개)를 깨끗하게 잘라 빠른 블라인드 청취용 클립을 만든다.
  const res = spawnSync(FFMPEG, [
    "-y", "-v", "error", "-i", rawPath,
    "-t", "26",
    "-c:a", "libvorbis", "-q:a", "4",
    clipPath,
  ], { encoding: "utf8" });
  if (res.status !== 0) {
    copyFileSync(rawPath, clipPath);
  }
}

function runMechanicalGuardrails(tracks: readonly StoreMusicTrack[]): { passed: boolean; checks: { name: string; ok: boolean; detail: string }[] } {
  const checks: { name: string; ok: boolean; detail: string }[] = [];

  // 1. Offline CC0 fallback must NEVER assign battle/title/victory to peaceful/normal maps
  const offlineTests = [
    { name: "버들 마을", theme: "village" },
    { name: "푸른 숲", theme: "forest" },
    { name: "고요한 호숫가", theme: "field" },
    { name: "햇살 카페", theme: "everyday" },
    { name: "이름없는 미지의 장소 XYZ", theme: undefined },
    { name: "밤의 산책로", theme: "night" },
  ];
  const badOffline: string[] = [];
  for (const t of offlineTests) {
    for (let seed = 1; seed <= 5; seed += 1) {
      const id = recommendMapBgm(t.name, seed, undefined, { fallbackTheme: t.theme });
      const meta = BGM_CATALOG.find((x) => x.id === id);
      if (meta && /전투|보스|타이틀|승리/u.test(meta.category)) {
        badOffline.push(`${t.name}(seed ${seed}) -> ${id} (${meta.category})`);
      }
    }
  }
  checks.push({
    name: "offline-cc0-no-battle-title-leak",
    ok: badOffline.length === 0,
    detail: badOffline.length === 0 ? "30 offline trials: 0 battle/title/victory leaks" : badOffline.join("; "),
  });

  // 2. Non-victory scenes should always pick loopable tracks (or >=20s)
  const sceneCheckScenes: StoreMusicScene[] = ["town", "field", "dungeon", "battle", "boss", "tense", "chase"];
  const nonLoopableHits: string[] = [];
  for (const sc of sceneCheckScenes) {
    const scored = tracks
      .map((t) => ({ t, s: scoreStoreMusic(t, { scene: sc, query: "판타지" }) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s);
    const top = scored[0]?.t;
    if (!top || !top.music.loopable) {
      nonLoopableHits.push(`${sc}: ${top?.titleKo ?? "none"} (loopable=${top?.music.loopable})`);
    }
  }
  checks.push({
    name: "non-victory-top-loopable",
    ok: nonLoopableHits.length === 0,
    detail: nonLoopableHits.length === 0 ? "7/7 loop scenes select loopable top track" : nonLoopableHits.join("; "),
  });

  // 3. Horror ask must NEVER pick cozy/romantic/night-bar jazz
  const horrorQueries = [
    { scene: "town" as const, query: "폐교 공포 교실" },
    { scene: "town" as const, query: "이브 공포 미술관" },
    { scene: "tense" as const, query: "학교 괴담 공포" },
    { scene: "dungeon" as const, query: "기묘한 공포 지하실" },
  ];
  const horrorCozyLeaks: string[] = [];
  for (const hq of horrorQueries) {
    const top = tracks
      .map((t) => ({ t, s: scoreStoreMusic(t, hq) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)[0]?.t;
    const heard = `${top?.music.mood.join(" ")} ${top?.music.feelTags.join(" ")} ${top?.music.summaryKo}`;
    if (!top || (/평온|따뜻|낭만|재즈|야간\s*바|카페/u.test(heard) && !/공포|으스스|기괴|불안|긴장|미스터리/u.test(heard))) {
      horrorCozyLeaks.push(`${hq.query} -> ${top?.slug}/${top?.titleKo}`);
    }
  }
  checks.push({
    name: "horror-no-cozy-jazz-leak",
    ok: horrorCozyLeaks.length === 0,
    detail: horrorCozyLeaks.length === 0 ? "4/4 horror queries clean" : horrorCozyLeaks.join("; "),
  });

  // 4. Fantasy multi-project diversity (10 distinct projects shouldn't collapse to 1 track)
  const fantasyWinners = new Set<string>();
  for (let i = 1; i <= 10; i += 1) {
    const hint = tilesetMusicHint("beodeul_town", "oprn-atlas", i * 97, false);
    const want = buildAutoMusicWant(hint, `판타지 모험 ${i}`, "판타지 RPG", `마을 ${i}`, false);
    const picked = pickSeededStoreTracks(tracks, { scene: "town", query: want.query, mood: want.mood }, `proj-${i}:map1`, 1);
    if (picked[0]) fantasyWinners.add(`${picked[0].slug}/${picked[0].assetId}`);
  }
  checks.push({
    name: "fantasy-multi-project-diversity",
    ok: fantasyWinners.size >= 6,
    detail: `${fantasyWinners.size}/10 unique town tracks across 10 fantasy projects`,
  });

  return { passed: checks.every((c) => c.ok), checks };
}

function selectTrackForCase(
  spec: AuditCaseSpec,
  tracks: readonly StoreMusicTrack[],
  groupUsed: Map<string, Set<string>>,
  groupLineCounts: Map<string, Record<string, number>>,
): { track: StoreMusicTrack; scene: StoreMusicScene; score: number; want: StoreMusicQuery; runnerUps: string[] } {
  const used = spec.gameGroup ? (groupUsed.get(spec.gameGroup) ?? new Set<string>()) : new Set<string>();
  if (spec.gameGroup && !groupUsed.has(spec.gameGroup)) groupUsed.set(spec.gameGroup, used);

  const lineCounts = spec.gameGroup ? (groupLineCounts.get(spec.gameGroup) ?? {}) : {};
  if (spec.gameGroup && !groupLineCounts.has(spec.gameGroup)) groupLineCounts.set(spec.gameGroup, lineCounts);
  const totalLines = Object.values(lineCounts).reduce((a, b) => a + b, 0);
  const storedLines: Record<string, number> = totalLines > 0
    ? Object.fromEntries(Object.entries(lineCounts).map(([k, v]) => [k, v / totalLines]))
    : {};

  let scene: StoreMusicScene;
  let want: StoreMusicQuery;
  let picked: StoreMusicTrack[];

  const available = tracks.filter((t) => !used.has(`${t.slug}/${t.assetId}`));

  if (spec.mode === "auto") {
    scene = inferMapStoreScene({ name: spec.mapName ?? spec.prompt, mapRole: undefined }, spec.hint);
    const projSeed = Number.parseInt(createHash("sha256").update(spec.gameGroup ?? spec.id).digest("hex").slice(0, 8), 16);
    const hint = tilesetMusicHint(spec.tilesetId, spec.tilesetFamily, projSeed, scene === "dungeon");
    const hasStoredLine = Object.keys(storedLines).length > 0;
    const autoWant = buildAutoMusicWant(hint, spec.prompt, spec.blueprintText ?? "", spec.mapName ?? "", hasStoredLine);
    const hintLines = hasStoredLine ? {} : projectHintLines([spec.blueprintText ?? "", spec.mapName ?? "", spec.prompt]);
    want = {
      scene,
      query: autoWant.query || undefined,
      mood: autoWant.mood || undefined,
      projectLines: autoWant.hasExplicitGenre
        ? undefined
        : (hasStoredLine ? storedLines : (Object.keys(hintLines).length > 0 ? hintLines : undefined)),
    };
    picked = pickSeededStoreTracks(available, want, `${spec.gameGroup ?? spec.id}:${spec.id}`, 4);
  } else {
    scene = normalizeStoreMusicScene(spec.scene) ?? inferStoreMusicScene(spec.prompt, spec.query, spec.mood) ?? "town";
    want = {
      scene,
      query: spec.query,
      mood: spec.mood,
      projectLines: Object.keys(storedLines).length > 0 ? storedLines : undefined,
    };
    const scored = available
      .map((t, index) => ({ t, index, s: scoreStoreMusic(t, want) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s || a.index - b.index);
    picked = scored.slice(0, 4).map((r) => r.t);
  }

  const winner = picked[0];
  if (!winner) throw new Error(`No track selected for case ${spec.id}`);
  const score = scoreStoreMusic(winner, want);

  if (spec.gameGroup) {
    used.add(`${winner.slug}/${winner.assetId}`);
    lineCounts[winner.music.genre] = (lineCounts[winner.music.genre] ?? 0) + 1;
  }

  return {
    track: winner,
    scene,
    score,
    want,
    runnerUps: picked.slice(1, 4).map((t) => `${t.slug}/${t.assetId}(${t.titleKo || t.name})`),
  };
}

async function cmdGenerate(outDir: string, seedNum: number, onlyIds?: Set<string>) {
  mkdirSync(outDir, { recursive: true });
  const cacheDir = resolve(outDir, "cache");
  const blobDir = resolve(cacheDir, "blobs");
  const rawDir = resolve(outDir, "raw");
  const clipDir = resolve(outDir, "clips");
  mkdirSync(rawDir, { recursive: true });
  mkdirSync(clipDir, { recursive: true });

  const tracks = await fetchStoreCatalog(cacheDir);
  const guardrails = runMechanicalGuardrails(tracks);
  console.log("\n=== Axis 5: Mechanical Guardrails ===");
  for (const c of guardrails.checks) {
    console.log(`  [${c.ok ? "PASS" : "FAIL"}] ${c.name} — ${c.detail}`);
  }

  const groupUsed = new Map<string, Set<string>>();
  const groupLineCounts = new Map<string, Record<string, number>>();

  interface PendingEntry {
    isDecoy: boolean;
    caseId: string;
    axis: string;
    mode: string;
    prompt: string;
    context: string;
    scene: StoreMusicScene;
    track: StoreMusicTrack;
    score?: number;
    want?: StoreMusicQuery;
    runnerUps?: string[];
    decoyReason?: string;
    gameGroup?: string;
  }

  const entries: PendingEntry[] = [];

  for (const spec of STRESS_CASES) {
    // Always run multi-game cases in order so projectLines accumulate properly even when --only is set
    const res = selectTrackForCase(spec, tracks, groupUsed, groupLineCounts);
    if (onlyIds && !onlyIds.has(spec.id)) continue;
    entries.push({
      isDecoy: false,
      caseId: spec.id,
      axis: spec.axis,
      mode: spec.mode,
      prompt: spec.prompt,
      context: spec.context,
      scene: res.scene,
      track: res.track,
      score: res.score,
      want: res.want,
      runnerUps: res.runnerUps,
      gameGroup: spec.gameGroup,
    });
  }

  // Add hidden decoys (scaled to subset if --only is given, otherwise all 10)
  const decoyList = onlyIds
    ? DECOY_SPECS.slice(0, Math.max(3, Math.ceil(entries.length * 0.25)))
    : DECOY_SPECS;

  for (const d of decoyList) {
    const track = d.pickTrack(tracks);
    if (!track) throw new Error(`Decoy ${d.id} could not find matching store track`);
    entries.push({
      isDecoy: true,
      caseId: d.id,
      axis: "decoy",
      mode: "decoy",
      prompt: d.prompt,
      context: d.context,
      scene: d.scene,
      track,
      decoyReason: d.reason,
    });
  }

  // Deterministic Fisher-Yates shuffle so decoys are completely hidden
  const rng = mulberry32(seedNum);
  for (let i = entries.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [entries[i], entries[j]] = [entries[j]!, entries[i]!];
  }

  // Download blobs & prepare blind files
  const blindItems = [];
  const answerKey: Record<string, unknown> = {};

  console.log(`\n[audio] Downloading & preparing ${entries.length} blind samples (${entries.filter((e) => !e.isDecoy).length} real + ${entries.filter((e) => e.isDecoy).length} hidden decoys)...`);

  for (let i = 0; i < entries.length; i += 1) {
    const e = entries[i]!;
    const sampleId = `s${String(i + 1).padStart(2, "0")}`;
    const blobPath = await ensureBlob(e.track.blob, blobDir);
    const rawPath = resolve(rawDir, `${sampleId}.ogg`);
    const clipPath = resolve(clipDir, `${sampleId}.ogg`);
    copyFileSync(blobPath, rawPath);
    const durationSec = probeDurationSec(rawPath);
    makeAuditionClip(rawPath, clipPath, durationSec);

    blindItems.push({
      sampleId,
      prompt: e.prompt,
      context: e.context,
      scene: e.scene,
      durationSec,
      loopable: e.track.music.loopable,
      clipPath,
      rawPath,
    });

    answerKey[sampleId] = {
      sampleId,
      isDecoy: e.isDecoy,
      caseId: e.caseId,
      axis: e.axis,
      mode: e.mode,
      gameGroup: e.gameGroup ?? null,
      prompt: e.prompt,
      scene: e.scene,
      score: e.score ?? null,
      want: e.want ?? null,
      decoyReason: e.decoyReason ?? null,
      slug: e.track.slug,
      packTitle: e.track.packTitle,
      assetId: e.track.assetId,
      titleKo: e.track.titleKo,
      name: e.track.name,
      durationSec,
      loopable: e.track.music.loopable,
      genre: e.track.music.genre,
      genreKo: e.track.music.genreKo,
      scenes: e.track.music.scenes,
      mood: e.track.music.mood,
      feelTags: e.track.music.feelTags,
      summaryKo: e.track.music.summaryKo,
      runnerUps: e.runnerUps ?? [],
      rawPath,
      clipPath,
    };
  }

  // Check multi-game duplicate counts
  const multiGameDupes: string[] = [];
  for (const [grp, set] of groupUsed.entries()) {
    const expected = STRESS_CASES.filter((c) => c.gameGroup === grp).length;
    if (set.size < expected) multiGameDupes.push(`${grp}: ${set.size}/${expected} unique`);
  }

  writeFileSync(resolve(outDir, "blind-packet.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    seed: seedNum,
    totalSamples: blindItems.length,
    note: "BLIND PACKET: Do NOT read answer-key.json until verdicts are saved.",
    items: blindItems,
  }, null, 2));

  writeFileSync(resolve(outDir, "answer-key.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    seed: seedNum,
    guardrails,
    multiGameDupes,
    entries: answerKey,
  }, null, 2));

  console.log(`\n[done] Wrote blind packet: ${resolve(outDir, "blind-packet.json")}`);
  console.log(`[done] Answer key sealed at: ${resolve(outDir, "answer-key.json")} (DO NOT READ BEFORE VERDICTS)`);
  console.log(`[done] Multi-game uniqueness: ${multiGameDupes.length === 0 ? "100% unique per game" : multiGameDupes.join("; ")}`);
}

interface VerdictRow {
  readonly sampleId: string;
  readonly score: number;
  readonly pass: boolean;
  readonly heard: string;
  readonly reason: string;
  readonly failCode?: string;
}

function cmdScore(dir: string, verdictsPath: string) {
  const keyDoc = JSON.parse(readFileSync(resolve(dir, "answer-key.json"), "utf8")) as {
    guardrails: { passed: boolean; checks: { name: string; ok: boolean; detail: string }[] };
    multiGameDupes: string[];
    entries: Record<string, any>;
  };
  const verdictsDoc = JSON.parse(readFileSync(verdictsPath, "utf8")) as { verdicts: VerdictRow[] } | VerdictRow[];
  const rows = Array.isArray(verdictsDoc) ? verdictsDoc : verdictsDoc.verdicts;
  const byId = new Map(rows.map((r) => [r.sampleId, r]));

  const allIds = Object.keys(keyDoc.entries).sort();
  const missing = allIds.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    console.error(`ERROR: Missing verdicts for ${missing.length} samples: ${missing.join(", ")}`);
    process.exit(1);
  }

  const decoyResults: any[] = [];
  const realResults: any[] = [];

  for (const id of allIds) {
    const truth = keyDoc.entries[id]!;
    const v = byId.get(id)!;
    const effectivePass = v.pass && v.score >= 3.5;
    const merged = { ...truth, verdict: v, effectivePass };
    if (truth.isDecoy) decoyResults.push(merged);
    else realResults.push(merged);
  }

  const leakedDecoys = decoyResults.filter((d) => d.effectivePass);
  const batchValid = leakedDecoys.length === 0;

  console.log("\n========================================================");
  console.log(`  BLIND AUDIT SCORING — ${batchValid ? "VALID BATCH (100% DECOY CATCH)" : "INVALID BATCH (DECOY LEAKED!)"}`);
  console.log("========================================================");
  console.log(`Decoys caught: ${decoyResults.length - leakedDecoys.length} / ${decoyResults.length}`);
  if (leakedDecoys.length > 0) {
    console.log("\n!! LEAKED DECOYS (BATCH INVALID) !!");
    for (const d of leakedDecoys) {
      console.log(`  - ${d.sampleId} (${d.caseId}): scored ${d.verdict.score} | decoyReason=${d.decoyReason} | track=${d.slug}/${d.titleKo}`);
    }
  }

  const passedReal = realResults.filter((r) => r.effectivePass);
  const failedReal = realResults.filter((r) => !r.effectivePass);
  const avgReal = realResults.reduce((sum, r) => sum + r.verdict.score, 0) / Math.max(1, realResults.length);

  console.log(`\nReal cases passed: ${passedReal.length} / ${realResults.length} (${((passedReal.length / Math.max(1, realResults.length)) * 100).toFixed(1)}%) | Mean score: ${avgReal.toFixed(2)} / 5.00`);

  const axes = ["label-trap", "compound-mood", "game-ref-role", "multi-game"];
  console.log("\n--- By Axis ---");
  for (const ax of axes) {
    const sub = realResults.filter((r) => r.axis === ax);
    if (!sub.length) continue;
    const p = sub.filter((r) => r.effectivePass).length;
    const avg = sub.reduce((s, r) => s + r.verdict.score, 0) / sub.length;
    console.log(`  ${ax.padEnd(15)} ${String(p).padStart(2)}/${String(sub.length).padEnd(2)} PASS (${((p / sub.length) * 100).toFixed(0)}%) | avg ${avg.toFixed(2)}`);
  }

  if (failedReal.length > 0) {
    console.log(`\n--- FAILED REAL CASES (${failedReal.length}) ---`);
    for (const f of failedReal) {
      console.log(`\n  [${f.caseId} / ${f.sampleId}] (${f.axis}) score=${f.verdict.score} code=${f.verdict.failCode ?? "untagged"}`);
      console.log(`    Prompt : ${f.prompt}`);
      console.log(`    Picked : ${f.slug} / ${f.assetId} — "${f.titleKo || f.name}" (score=${f.score}, scenes=${f.scenes.join(",")})`);
      console.log(`    Meta   : genre=${f.genre} (${f.genreKo}) | mood=[${f.mood.join(", ")}] | feel=[${f.feelTags.join(", ")}]`);
      console.log(`    Summary: ${f.summaryKo}`);
      console.log(`    Heard  : ${f.verdict.heard}`);
      console.log(`    Reason : ${f.verdict.reason}`);
    }
  }

  const borderline = passedReal.filter((r) => r.verdict.score === 3.5);
  if (borderline.length > 0) {
    console.log(`\n--- BORDERLINE PASSES (3.5/5, ${borderline.length}) ---`);
    for (const b of borderline) {
      console.log(`  [${b.caseId} / ${b.sampleId}] "${b.prompt}" -> ${b.slug}/${b.titleKo} | ${b.verdict.reason}`);
    }
  }

  const graded = {
    gradedAt: new Date().toISOString(),
    batchValid,
    decoyTotal: decoyResults.length,
    decoyCaught: decoyResults.length - leakedDecoys.length,
    realTotal: realResults.length,
    realPassed: passedReal.length,
    realPassRate: realResults.length ? passedReal.length / realResults.length : 0,
    realMeanScore: Number(avgReal.toFixed(2)),
    guardrails: keyDoc.guardrails,
    realResults,
    decoyResults,
  };
  writeFileSync(resolve(dir, "graded-report.json"), JSON.stringify(graded, null, 2));
  console.log(`\n[saved] ${resolve(dir, "graded-report.json")}`);
  if (!batchValid) process.exit(2);
}

// ── CLI ──
const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

if (cmd === "generate") {
  const out = resolve(flag("out") ?? "qa-runs/music-audit-r1");
  const seed = Number.parseInt(flag("seed") ?? "20261127", 10);
  const onlyRaw = flag("only");
  const onlySet = onlyRaw ? new Set(onlyRaw.split(",").map((s) => s.trim()).filter(Boolean)) : undefined;
  await cmdGenerate(out, seed, onlySet);
} else if (cmd === "score") {
  const dir = resolve(flag("dir") ?? "qa-runs/music-audit-r1");
  const verdicts = resolve(flag("verdicts") ?? resolve(dir, "verdicts.json"));
  cmdScore(dir, verdicts);
} else {
  console.error("Usage:\n  bun scripts/qa/music-selection-audit.mts generate --out <dir> [--seed N] [--only c01,c02]\n  bun scripts/qa/music-selection-audit.mts score --dir <dir> --verdicts <file>");
  process.exit(1);
}
