// 영문 id 맵 이름을 플레이어가 읽는 낱말로 — 「beodeul_city」「dungeon_cave」가 목표 꼬리 「(dungeon_cave 입구: 북쪽)」·출구 라벨 「→ beodeul_city」에 그대로 나왔다
// (2026-10-29 vm4 flash jrpg 「마을→동굴 길 안내 없음」). 맵 이름·청사진 장소·대사 글의 같은 낱말을 함께 바꾼다. 이벤트·맵 id 는 건드리지 않는다.
import type { Project } from "@/project/types";

const ID_LIKE = /^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$/u;
const TOKEN_NOUN: ReadonlyArray<[RegExp, string]> = [
  [/^(cave|cavern|grotto)s?$/u, "동굴"],
  [/^(dungeon|labyrinth|maze)s?$/u, "던전"],
  [/^(castle|palace|keep|fortress)s?$/u, "성"],
  [/^(forest|woods?|grove)s?$/u, "숲"],
  [/^towers?$/u, "탑"],
  [/^ruins?$/u, "유적"],
  [/^(temple|shrine|church)s?$/u, "신전"],
  [/^(harbor|harbour|port|dock)s?$/u, "항구"],
  [/^(house|home|interior|inn|shop|room)s?$/u, "집"],
  [/^(field|plains?|meadow|road)s?$/u, "들판"],
  [/^(mountain|peak)s?$/u, "산"],
  [/^(city|town|village|beodeul)s?$/u, "마을"],
];

/** 맵 이름이 영문 id 꼴이면 뜻 낱말(없으면 undefined). 낱말이 여럿이면 뒤쪽(뜻을 정하는 말)이 이긴다 — dungeon_cave → 동굴. */
function nounFor(name: string): string | undefined {
  if (!ID_LIKE.test(name)) return undefined;
  for (const token of name.split(/[_-]/u).reverse()) {
    const hit = TOKEN_NOUN.find(([re]) => re.test(token));
    if (hit) return hit[1];
  }
  return undefined;
}

const replaceIn = (value: unknown, from: RegExp, to: string, key = ""): unknown => {
  if (typeof value === "string") return /id$/iu.test(key) ? value : value.replace(from, to);
  if (Array.isArray(value)) { for (let i = 0; i < value.length; i += 1) value[i] = replaceIn(value[i], from, to, key); return value; }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const k of Object.keys(record)) record[k] = replaceIn(record[k], from, to, k);
  }
  return value;
};

/** 영문 id 맵 이름을 뜻 낱말로 바꾼다(제자리). 바꾼 「옛 → 새」 목록. */
export function humanizeMapNames(project: Project): string[] {
  const taken = new Set(Object.values(project.maps).map((m) => String(m.name ?? "")));
  const notes: string[] = [];
  for (const map of Object.values(project.maps)) {
    const old = String(map.name ?? "");
    const noun = nounFor(old);
    if (!noun || String((map as { displayName?: string }).displayName ?? "").trim()) continue;
    let name = noun;
    for (let n = 2; taken.has(name); n += 1) name = `${noun} ${n}`;
    taken.delete(old);
    taken.add(name);
    map.name = name;
    // 낱말 경계 — 「dungeon_cave」가 다른 id 의 일부일 때는 바꾸지 않는다.
    const pattern = new RegExp(`(?<![A-Za-z0-9_-])${old.replace(/[-]/gu, "\\-")}(?![A-Za-z0-9_-])`, "gu");
    for (const step of project.gameBlueprint?.steps ?? []) if (step.place === old) step.place = name;
    for (const other of Object.values(project.maps)) for (const event of other.events ?? []) {
      for (const page of event.pages ?? []) if (page.commands) replaceIn(page.commands, pattern, name);
    }
    notes.push(`${old} → ${name}`);
  }
  return notes;
}
