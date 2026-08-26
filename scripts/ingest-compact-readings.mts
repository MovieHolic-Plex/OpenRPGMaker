// 판독자의 compact 한 줄 포맷을 판정 파이프라인이 먹는 JSON 으로 바꾼다.
//
// 왜 compact 인가 (실측): 120칸 x 6필드 JSON(약 18KB)을 요구하면 자식이 출력 도중 끊겨
// "child turn produced no assistant output" 로 끝나는 비율이 높았다(16명 중 10명).
// 한 줄 40바이트 파이프 포맷(약 5KB)이면 같은 정보를 3분의 1 크기로 낸다.
//
// 입력 한 줄:  <index>|<명사>|<role>|<passage>|<confidence>|<partOf(생략 가능)>
//   120|어두운 바다|water|solid|high|
//   144|긴 목재 기둥 상단|prop|solid|medium|목재 기둥
// # 로 시작하는 줄과 빈 줄은 무시한다.
//
// 입력: .omo/evidence/tile-reaudit/read/<sheet>/rows-<a>-<b>.<R>.txt
// 출력: .omo/evidence/tile-reaudit/read/<sheet>/rows-<a>-<b>.<R>.json
//
// 사용: vite-node scripts/ingest-compact-readings.mts

import fs from "node:fs";
import path from "node:path";

const READ_ROOT = ".omo/evidence/tile-reaudit/read";
const ROLES = new Set([
  "terrain", "floor", "water", "wall", "door", "roof", "window", "stairs",
  "furniture", "prop", "tree", "plant", "fence", "gate", "cliff", "rock", "decoration", "empty",
]);

interface Entry {
  index: number;
  noun: string;
  role: string;
  passage: "passable" | "solid";
  confidence: string;
  partOf: string;
}

function parse(file: string): { entries: Entry[]; problems: string[] } {
  const problems: string[] = [];
  const entries: Entry[] = [];
  const seen = new Set<number>();
  const text = fs.readFileSync(file, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length < 5) {
      problems.push(`필드 부족: ${line.slice(0, 60)}`);
      continue;
    }
    const index = Number(parts[0]);
    if (!Number.isInteger(index)) {
      problems.push(`인덱스 아님: ${line.slice(0, 60)}`);
      continue;
    }
    if (seen.has(index)) {
      problems.push(`중복 인덱스 ${index}`);
      continue;
    }
    const role = parts[2]!;
    if (!ROLES.has(role)) {
      problems.push(`알 수 없는 role "${role}" (index ${index})`);
      continue;
    }
    const passage = parts[3] === "passable" ? "passable" : "solid";
    seen.add(index);
    entries.push({
      index,
      noun: parts[1] || "빈 슬롯",
      role,
      passage,
      confidence: parts[4] || "medium",
      partOf: parts[5] ?? "",
    });
  }
  entries.sort((a, b) => a.index - b.index);
  return { entries, problems };
}

function main(): void {
  if (!fs.existsSync(READ_ROOT)) {
    console.log("판독 디렉터리가 없다");
    return;
  }
  let converted = 0;
  for (const sheet of fs.readdirSync(READ_ROOT)) {
    const dir = path.join(READ_ROOT, sheet);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir).sort()) {
      if (!file.endsWith(".txt")) continue;
      const src = path.join(dir, file);
      const { entries, problems } = parse(src);
      const dest = src.replace(/\.txt$/, ".json");
      const m = /rows-(\d+)-(\d+)\./.exec(file);
      const expect = m ? { lo: Number(m[1]) * 30, hi: Number(m[2]) * 30 + 29 } : null;
      const gaps: number[] = [];
      if (expect) {
        const have = new Set(entries.map((e) => e.index));
        for (let i = expect.lo; i <= expect.hi; i += 1) if (!have.has(i)) gaps.push(i);
      }
      fs.writeFileSync(dest, `${JSON.stringify(entries, null, 1)}\n`);
      converted += 1;
      const status = gaps.length === 0 && problems.length === 0 ? "OK" : "불완전";
      console.log(`${sheet}/${file} -> ${entries.length}칸 ${status}${gaps.length ? ` 빠진칸 ${gaps.length}개(${gaps.slice(0, 6).join(",")}${gaps.length > 6 ? "..." : ""})` : ""}${problems.length ? ` 문제 ${problems.length}건: ${problems.slice(0, 3).join("; ")}` : ""}`);
    }
  }
  console.log(`${converted}개 변환`);
}

main();
