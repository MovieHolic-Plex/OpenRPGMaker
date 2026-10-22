// 검증된 방 예제 찾기 — 조수가 빈 상자 대신 합격한 방의 평면·구역·가구 짜임에서 시작하게 한다.
//
// 왜(2026-10-22 조수 실내 시험): 같은 요청을 코딩 에이전트는 Opus 적대 검수 8 안팎까지 올렸고 조수는 5~7에 머물렀다.
// 코딩 에이전트는 비슷한 방(폴른 r28·v5 예제)을 옆에 두고 평면을 깎았고, 조수는 매번 빈 평면에서 시작해 첫 짓기에 4~6분을 썼다.
// 그래서 요청 낱말로 가장 가까운 합격 방을 골라 build_hand_interior_room 인자 그대로(평면·바닥·벽·구역·가구) 시스템 프롬프트에 붙인다.
// 출처:
//   - 폴른 스타 r28 세 방(src/project/flagship/fallenStarRooms.ts, 독립 Opus 검수 8.1~8.2)
//   - 손 도트 실내 v5 예제 맵(src/assets/sharedHandInteriorReferences.json 의 hand-interior-v5-map-*, 원본 합성과 픽셀 차 0)
// 「RPG 실내 23곳」(#1419)은 폐기된 EasyRPG 칩셋으로 지은 판이라 넣지 않는다.
import references from "@/assets/sharedHandInteriorReferences.json";
import { FALLEN_ROOM_SPECS } from "@/project/flagship/fallenStarRooms";

export interface RoomExemplar {
  readonly id: string;
  readonly name: string;
  readonly source: string;
  readonly keywords: readonly string[];
  /** build_hand_interior_room 인자(JSON 문자열). */
  readonly args: string;
}

const FALLEN_META: Record<keyof typeof FALLEN_ROOM_SPECS, { name: string; keywords: string[] }> = {
  observatory: { name: "별빛 천문대(둥근 관측 홀 + 아래 서고·현관·서재)", keywords: ["천문대", "망원경", "관측", "둥근", "돔", "서고", "서재", "별"] },
  gate: { name: "네 화로의 방(가운데 돌 단의 화로 넷 · 남쪽 사당 · 양옆 벽감)", keywords: ["화로", "석실", "돌 단", "단 위", "사당", "벽감", "고대", "불씨", "퍼즐"] },
  vault: { name: "옛 별지기의 지하 방(북쪽 렌즈 성소 · 가운데 홀 · 곁방)", keywords: ["지하", "별지기", "성소", "곁방", "렌즈", "석실", "홀"] },
};

// v5 예제마다 요청에서 흔히 쓰는 낱말(제목 낱말은 따로 뽑는다).
const V5_EXTRA: Record<string, string[]> = {
  bakery: ["빵", "빵집", "제과"], pharmacy: ["약국", "약방", "약초"], fish: ["생선", "어물"], butcher: ["정육", "고기"],
  smithy: ["대장간", "모루", "화덕", "용광로", "대장장이", "무기"], chapel: ["교회", "예배당", "성당", "제단", "신전"],
  scholar: ["서재", "학자", "책장", "서가", "도서관", "책"], tailor: ["재단", "옷", "양복"], tavern: ["선술집", "술집", "주점", "바"],
  manor_1f: ["저택", "귀족", "응접"], manor_2f: ["저택", "침실"], hobbit: ["굴", "호빗"], inn: ["여관", "숙소", "객실", "식당", "주막"],
  dwarf: ["드워프", "석굴"], elf: ["엘프", "궁정"], mead: ["연회", "연회장", "만찬"], throne: ["알현실", "왕좌", "왕실", "성"],
  tower: ["마법", "마법사", "탑", "마법진", "연구"], dungeon: ["감옥", "지하 감옥", "던전", "감방"], mine: ["광산", "갱도"],
  magitek: ["기계", "마도", "공장"], opera: ["극장", "오페라", "무대"], casino: ["카지노", "도박"], stable: ["마구간", "말"],
  museum: ["박물관", "미술관", "전시"], ship: ["배", "선실", "선장실"], ship_hold: ["화물칸", "배"],
};

type RefDoc = { id: string; name: string; markdown: string };

function v5Exemplars(): RoomExemplar[] {
  const docs = ((references as unknown as Array<{ category: { documents: RefDoc[] } }>)[0]?.category.documents ?? []);
  const out: RoomExemplar[] = [];
  for (const doc of docs) {
    const m = /^hand-interior-v5-map-(.+)$/u.exec(doc.id);
    if (!m) continue;
    const key = m[1]!;
    const args = /build_hand_interior_room 인자[^\n]*\n(?:[^\n]*\n)*?```json\n([\s\S]*?)\n```/u.exec(doc.markdown)?.[1];
    if (!args) continue;
    const title = /^# 예제 — (.+)$/mu.exec(doc.markdown)?.[1] ?? doc.name;
    const words = title.split(/[^\p{Script=Hangul}A-Za-z]+/u).filter((w) => w.length >= 2);
    out.push({ id: `v5:${key}`, name: title, source: `손 도트 실내 v5 예제(${doc.id})`, keywords: [...new Set([...words, ...(V5_EXTRA[key] ?? [])])], args });
  }
  return out;
}

function fallenExemplars(): RoomExemplar[] {
  return (Object.keys(FALLEN_ROOM_SPECS) as Array<keyof typeof FALLEN_ROOM_SPECS>).map((key) => {
    const spec = FALLEN_ROOM_SPECS[key];
    const meta = FALLEN_META[key];
    return { id: `fallen:${key}`, name: meta.name, source: "폴른 스타 r28(독립 Opus 검수 8.1~8.2)", keywords: meta.keywords, args: JSON.stringify({ name: meta.name, ...spec }) };
  });
}

let cache: RoomExemplar[] | undefined;
export function roomExemplars(): readonly RoomExemplar[] {
  cache ??= [...fallenExemplars(), ...v5Exemplars()];
  return cache;
}

/** 요청 낱말이 많이 겹치는 예제부터. 겹침이 없으면 빈 배열. */
export function findRoomExemplars(task: string, limit = 2): RoomExemplar[] {
  const text = task.toLowerCase();
  return roomExemplars()
    .map((ex) => ({ ex, score: ex.keywords.reduce((n, w) => n + (w.length >= 2 && text.includes(w.toLowerCase()) ? (w.length >= 3 ? 2 : 1) : 0), 0) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.ex);
}

/** 시스템 프롬프트에 붙이는 예제 단락. 예제가 없으면 빈 문자열. */
export function roomExemplarPrompt(task: string, limit = 2): string {
  const found = findRoomExemplars(task, limit);
  if (!found.length) return "";
  return [
    "[검증된 방 예제] 이 요청과 가장 가까운 합격 방이다. 손 도트 실내(build_hand_interior_room)로 지을 때는 빈 평면에서 시작하지 말고, 아래 예제의 평면 모양·방 나눔·구역·가구 무리 짜임을 출발점으로 삼아 요청에 맞게 고친다(크기·방 이름·가구는 요청대로 바꾼다). 좌표를 그대로 복사해 다른 장소를 만들지는 않는다.",
    ...found.map((ex) => `■ ${ex.name} — 출처: ${ex.source}\n${ex.args}`),
    "다른 종류의 방이 더 가깝다면 read_tileset_reference 로 hand-interior-v5-map-* 예제를 연다.",
  ].join("\n");
}
