// 최종 판정(adjudicated/*.txt)을 overrides.json 으로 합친다.
//
// 이 단계가 필요한 이유: 판독 3인이 갈린 칸은 다수결로 깰 수 없다. 그 칸만 골라
// 사전 렌더한 고배율 크롭 하나를 주고 다시 판정하게 한 결과가 adjudicated/ 다.
//
// **저신뢰 판정은 오버라이드로 승격하지 않는다.** 이미 세 명이 갈린 칸에 네 번째가
// "잘 모르겠다"를 붙인 것은 근거가 아니다. 그런 칸은 보류로 남기고 사람 확인 목록에 올린다.
// 못 가린 것을 가린 척하는 것이 이 테이블을 두 번 무너뜨린 원인이다.
//
// 픽셀이 같은 중복 시트로는 판정을 이관한다 — 같은 그림이면 같은 답이어야 한다.
// 단 타일 단위로 픽셀을 대조해 정말 같은 칸만 옮긴다(retro_exterior/retro_house 는
// 전체로는 0.4% 다르고, 실제로 146 은 두 시트에서 다른 그림이다).
//
// 사용: vite-node scripts/merge-adjudications.mts

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

interface Override {
  sheet: string;
  index: number;
  label: string;
  role: string;
  passage: "passable" | "solid";
  tags?: string[];
}

const ADJ_DIR = ".omo/evidence/tile-reaudit/adjudicated";
const OVERRIDES = ".omo/evidence/tile-reaudit/overrides.json";
const NEEDS_HUMAN = ".omo/evidence/tile-reaudit/needs-human.txt";

const SHEET_PNG: Record<string, string> = {
  retro_dungeon: "public/assets/easyrpg-chipset-retro-dungeon-transparent.png",
  retro_exterior: "public/assets/easyrpg-chipset-retro-exterior-transparent.png",
  retro_house: "public/assets/easyrpg-chipset-retro-house-transparent.png",
  retro_world: "public/assets/easyrpg-chipset-retro-world-transparent.png",
  ship: "public/assets/easyrpg-chipset-ship-transparent.png",
  world: "public/assets/easyrpg-chipset-world-transparent.png",
};
const DUPLICATE_GROUPS: readonly (readonly string[])[] = [["retro_exterior", "retro_house"]];

const cache = new Map<string, PNG>();
function sheetImage(sheet: string): PNG | null {
  if (cache.has(sheet)) return cache.get(sheet)!;
  const file = SHEET_PNG[sheet];
  if (!file || !fs.existsSync(file)) return null;
  const img = PNG.sync.read(fs.readFileSync(file));
  cache.set(sheet, img);
  return img;
}

/** 두 시트의 같은 인덱스 타일이 픽셀까지 같은가. */
function sameTile(a: string, b: string, slot: number): boolean {
  const A = sheetImage(a);
  const B = sheetImage(b);
  if (!A || !B || A.width !== B.width) return false;
  const r0 = Math.floor(slot / 30) * 16;
  const c0 = (slot % 30) * 16;
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const i = ((r0 + y) * A.width + (c0 + x)) * 4;
      const aClear = A.data[i + 3]! <= 8;
      const bClear = B.data[i + 3]! <= 8;
      if (aClear && bClear) continue;
      if (aClear !== bClear) return false;
      if (A.data[i] !== B.data[i] || A.data[i + 1] !== B.data[i + 1] || A.data[i + 2] !== B.data[i + 2]) return false;
    }
  }
  return true;
}

const ROLES = new Set([
  "terrain", "floor", "water", "wall", "door", "roof", "window", "stairs",
  "furniture", "prop", "tree", "plant", "fence", "gate", "cliff", "rock", "decoration", "empty",
]);

function main(): void {
  if (!fs.existsSync(ADJ_DIR)) {
    console.log("판정 디렉터리가 없다");
    return;
  }
  const existing = JSON.parse(fs.readFileSync(OVERRIDES, "utf8")) as Override[];
  const seen = new Set(existing.map((o) => `${o.sheet}:${o.index}`));

  const added: Override[] = [];
  const lowConf: string[] = [];
  let parsed = 0;
  let badRole = 0;

  for (const file of fs.readdirSync(ADJ_DIR).sort()) {
    if (!file.endsWith(".txt")) continue;
    const sheet = /^([a-z_]+)-r/.exec(file)?.[1];
    if (!sheet || !SHEET_PNG[sheet]) {
      console.log(`시트를 알 수 없는 파일: ${file}`);
      continue;
    }
    for (const raw of fs.readFileSync(path.join(ADJ_DIR, file), "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length < 5) continue;
      const index = Number(parts[0]);
      if (!Number.isInteger(index)) continue;
      const role = parts[2]!;
      if (!ROLES.has(role)) { badRole += 1; continue; }
      parsed += 1;
      const confidence = parts[4] ?? "medium";
      if (confidence === "low") {
        lowConf.push(`${sheet} ${index}: ${parts[1]} (${role}) — 4번째 판정도 저신뢰. 사람이 볼 칸.`);
        continue; // 저신뢰는 승격하지 않는다
      }
      const tags = ["최종판정", role];
      if (parts[5]) tags.push(parts[5]);
      const entry: Override = {
        sheet,
        index,
        label: parts[1] || "빈 슬롯",
        role,
        passage: parts[3] === "passable" ? "passable" : "solid",
        tags,
      };
      if (!seen.has(`${sheet}:${index}`)) {
        added.push(entry);
        seen.add(`${sheet}:${index}`);
      }
      // 중복 시트로 이관 — 픽셀이 같은 칸만.
      const group = DUPLICATE_GROUPS.find((g) => g.includes(sheet));
      if (group) {
        for (const peer of group) {
          if (peer === sheet) continue;
          if (seen.has(`${peer}:${index}`)) continue;
          if (!sameTile(sheet, peer, index)) continue;
          added.push({ ...entry, sheet: peer, tags: [...tags, "중복시트 이관"] });
          seen.add(`${peer}:${index}`);
        }
      }
    }
  }

  fs.writeFileSync(OVERRIDES, `${JSON.stringify([...existing, ...added], null, 1)}\n`);
  if (lowConf.length) fs.writeFileSync(NEEDS_HUMAN, `${lowConf.join("\n")}\n`);

  console.log(`판정 ${parsed}줄 읽음${badRole ? ` (role 불량 ${badRole}줄 버림)` : ""}`);
  console.log(`오버라이드 승격 ${added.length}칸 (중복시트 이관 포함) -> 총 ${existing.length + added.length}`);
  console.log(`저신뢰라 승격 보류 ${lowConf.length}칸${lowConf.length ? ` -> ${NEEDS_HUMAN}` : ""}`);
}

main();
