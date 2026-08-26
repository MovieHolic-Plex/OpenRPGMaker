// 서로 다른 칩셋에서 **픽셀이 완전히 같은** 타일이 서로 다른 라벨을 받았는지 검사한다.
//
// 왜: 같은 인덱스에 같은 바이트가 들어 있는 타일은 같은 그림이다. 두 시트의 판독자가 그 타일에
// 다른 이름을 붙였다면 최소한 한쪽은 아트를 잘못 읽었다. 커버리지 검증기도, 픽셀 근거 감사도
// 이 모순은 보지 못한다 — 각각 한 시트 안에서만 판단하기 때문이다.
//
// 실측 픽셀 동일 쌍 (같은 인덱스, RGBA 완전 일치):
//   retro_exterior ↔ retro_house  343칸
//   retro_exterior ↔ retro_world   47칸
//   retro_house    ↔ retro_world   47칸
//   ship           ↔ world         27칸
// (retro_dungeon 은 다른 시트와 겹치는 타일이 없다.)
//
// 주의: 계획 단계에서 "retro_house ↔ retro_exterior 478/480 동일"로 기록했던 수치는 틀렸다.
// 휘도 상관을 구할 때 알파를 곱해 투명 영역을 양쪽 모두 0으로 만들었고, 그래서 투명 비중이 큰
// 타일끼리 상관이 부풀려졌다. 실제 구조 동일은 349/480 이며 차이는 각 행의 오른쪽 6열에 몰려 있다.
// 이 스크립트는 상관이 아니라 바이트 일치만 쓰므로 그 함정이 없다.
//
// 사용:
//   vite-node scripts/audit-tile-semantics-consistency.mts
//   vite-node scripts/audit-tile-semantics-consistency.mts --json

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const COLS = 30;
const TILE = 16;

const SHEETS: Record<string, string> = {
  retro_dungeon: "public/assets/easyrpg-chipset-retro-dungeon-transparent.png",
  retro_exterior: "public/assets/easyrpg-chipset-retro-exterior-transparent.png",
  retro_world: "public/assets/easyrpg-chipset-retro-world-transparent.png",
  ship: "public/assets/easyrpg-chipset-ship-transparent.png",
  world: "public/assets/easyrpg-chipset-world-transparent.png",
};
SHEETS.retro_house = "public/assets/easyrpg-chipset-retro-house-transparent.png";

interface Entry { index: number; label: string; role: string; passage: string }

function loadEntries(sheet: string): Map<number, Entry> {
  const dir = path.join(".omo/evidence/tile-semantics", sheet);
  const out = new Map<number, Entry>();
  if (!fs.existsSync(dir)) return out;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    for (const e of JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as Entry[]) out.set(e.index, e);
  }
  return out;
}

function tileHashes(pngPath: string): string[] {
  const png = PNG.sync.read(fs.readFileSync(pngPath));
  const out: string[] = [];
  for (let slot = 0; slot < COLS * 16; slot += 1) {
    const row = Math.floor(slot / COLS);
    const col = slot % COLS;
    const buf = Buffer.alloc(TILE * TILE * 4);
    let o = 0;
    for (let y = 0; y < TILE; y += 1) {
      for (let x = 0; x < TILE; x += 1) {
        const i = ((row * TILE + y) * png.width + (col * TILE + x)) * 4;
        buf[o] = png.data[i]!; buf[o + 1] = png.data[i + 1]!; buf[o + 2] = png.data[i + 2]!; buf[o + 3] = png.data[i + 3]!;
        o += 4;
      }
    }
    out.push(crypto.createHash("sha1").update(buf).digest("hex"));
  }
  return out;
}

interface Disagreement { index: number; a: string; b: string; labelA: string; labelB: string; roleA: string; roleB: string }

function main(): void {
  const asJson = process.argv.includes("--json");
  const names = Object.keys(SHEETS);
  const hashes: Record<string, string[]> = {};
  const entries: Record<string, Map<number, Entry>> = {};
  for (const s of names) {
    hashes[s] = tileHashes(SHEETS[s]!);
    entries[s] = loadEntries(s);
  }

  const report: { pair: string; compared: number; disagreements: Disagreement[] }[] = [];
  for (let i = 0; i < names.length; i += 1) {
    for (let j = i + 1; j < names.length; j += 1) {
      const a = names[i]!, b = names[j]!;
      const disagreements: Disagreement[] = [];
      let compared = 0;
      for (let tile = 0; tile < COLS * 16; tile += 1) {
        if (hashes[a]![tile] !== hashes[b]![tile]) continue;
        const ea = entries[a]!.get(tile), eb = entries[b]!.get(tile);
        if (!ea || !eb) continue;
        compared += 1;
        // 라벨 문자열 일치는 요구하지 않는다 — 독립 판독자는 같은 타일을 "밝은 점무늬 초원" 과
        // "푸른 잔디 평지" 처럼 다르게 부른다(동의어). 실측: 그 기준으로는 불일치율이 100% 였다.
        // 결과가 갈리는 것은 통행성이다. 같은 그림인데 칩셋마다 충돌 판정이 다르면 그건 모순이다.
        if (ea.passage !== eb.passage) {
          disagreements.push({ index: tile, a, b, labelA: ea.label, labelB: eb.label, roleA: `${ea.role}/${ea.passage}`, roleB: `${eb.role}/${eb.passage}` });
        }
      }
      if (compared > 0) report.push({ pair: `${a} ↔ ${b}`, compared, disagreements });
    }
  }

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const r of report) {
      const rate = r.compared > 0 ? (r.disagreements.length / r.compared) * 100 : 0;
      console.log(`\n${r.pair}: 픽셀 동일 ${r.compared}칸 중 통행성 모순 ${r.disagreements.length}칸 (${rate.toFixed(1)}%)`);
      for (const d of r.disagreements.slice(0, 15)) {
        console.log(`  ${String(d.index).padStart(3)}  "${d.labelA}" [${d.roleA}]   vs   "${d.labelB}" [${d.roleB}]`);
      }
      if (r.disagreements.length > 15) console.log(`  ... 그리고 ${r.disagreements.length - 15}건 더`);
    }
    if (report.length === 0) console.log("비교 가능한 픽셀 동일 타일쌍이 아직 없다 (프래그먼트 미완성).");
  }

  // 보고용 지표다 — 게이트가 아니다. 어떤 시트가 잎는지는 픽셀만으로 정해지지 않는다.
  // 실상 판정 예: 366-371(테듀리 있는 어두운 면)은 retro_exterior(terrain/solid)와
  // retro_world(water/solid)가 통행 불가로 일지하고 retro_house(floor/passable)가 소수다.
  // 반대로 372/373(자주·분홍 잡석)은 retro_house 의 wall/solid 가 retro_exterior 의
  // plant/passable 보다 방어 가능하다. 즉 한쪽 시트를 일괄 신뢰할 근거가 없다.
  const total = report.reduce((sum, r) => sum + r.disagreements.length, 0);
  const compared = report.reduce((sum, r) => sum + r.compared, 0);
  console.log(`\n요약: 픽셀 동일 ${compared}칸 중 통행성 모순 ${total}칸. 이 목록은 알려진 한계로 기록한다.`);
  process.exit(0);
}

main();
