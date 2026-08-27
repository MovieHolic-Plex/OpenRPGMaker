// 교정된 칸 하나하나에 대해 "무엇이 바뀌었고 누가 무엇을 보고 그렇게 말했는가" 를 남긴다.
//
// 왜 필요한가: 이 테이블은 두 번 틀렸고 두 번 다 근거가 사후 검증 불가능했다. 1차는 비전 없는
// 모델이 픽셀 통계로 119칸을 추론했고(그 사실이 완료 보고에만 적혀 있었다), 2차는 3x2 크롭만
// 보고 벽을 침대로 고쳤다. 어느 쪽도 "이 칸을 왜 그렇게 적었나" 를 나중에 따라갈 수 없었다.
//
// 그래서 교정 근거를 파일로 남긴다. 리뷰어가 확인할 수 있어야 하는 건 세 가지다:
//   1. 이전 라벨이 무엇이었나 (baseline 스냅샷)
//   2. 몇 명이 무엇이라 읽었나, 확신도는 (판독 기록)
//   3. 그 판정을 눈으로 확인할 그림이 어디 있나 (아틀라스 경로 + 열/행 좌표)
//
// 아틀라스 PNG 자체는 커밋하지 않는다(약 8MB, 커밋된 스크립트와 커밋된 시트 PNG 로 결정론적으로
// 재생성된다). 대신 어느 파일 어느 좌표를 보면 되는지를 칸마다 적는다. 사람이 고배율로 직접
// 확정한 칸은 그 크롭 PNG 를 커밋한다 — 그건 재생성 대상이 아니라 판정 그 자체이기 때문이다.
//
// 출력: .omo/evidence/tile-reaudit/corrections.md
// 사용: vite-node scripts/report-tile-corrections.mts

import fs from "node:fs";
import path from "node:path";

interface Shipped {
  readonly index: number;
  readonly label: string;
  readonly role: string;
  readonly passage: string;
  readonly tags: readonly string[];
}
interface Reading {
  readonly index: number;
  readonly noun: string;
  readonly role: string;
  readonly confidence: string;
  readonly partOf?: string;
}
interface Override {
  readonly sheet: string;
  readonly index: number;
  readonly label: string;
  readonly role: string;
}

const SHEETS = ["retro_dungeon", "retro_exterior", "retro_house", "retro_world", "ship", "world"] as const;
const BLOCKS = ["00-03", "04-07", "08-11", "12-15"] as const;
const READ_ROOT = ".omo/evidence/tile-reaudit/read";
const BASELINE_ROOT = ".omo/evidence/tile-reaudit/baseline";
const FRAGMENT_ROOT = ".omo/evidence/tile-semantics";
const OUT = ".omo/evidence/tile-reaudit/corrections.md";

// 픽셀이 사실상 같은 시트는 판독을 공유한다 — apply-tile-verdicts.mts 와 같은 규칙.
const DUPLICATE_GROUPS: readonly (readonly string[])[] = [["retro_exterior", "retro_house"]];
const groupOf = (sheet: string): readonly string[] => DUPLICATE_GROUPS.find((g) => g.includes(sheet)) ?? [sheet];

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function blockOf(index: number): string {
  const row = Math.floor(index / 30);
  return row < 4 ? "00-03" : row < 8 ? "04-07" : row < 12 ? "08-11" : "12-15";
}

function main(): void {
  const overrides = new Map<string, Override>();
  for (const o of readJson<Override[]>(".omo/evidence/tile-reaudit/overrides.json", [])) {
    overrides.set(`${o.sheet}:${o.index}`, o);
  }

  // 사람이 확정한 칸을 어느 크롭에서 봤는지 (파일명에 열/행 범위가 들어 있다).
  const cropDir = ".omo/evidence/tile-reaudit/verified";
  const crops: Record<string, string[]> = {};
  if (fs.existsSync(cropDir)) {
    for (const sheet of fs.readdirSync(cropDir)) {
      const d = path.join(cropDir, sheet);
      if (fs.existsSync(d) && fs.statSync(d).isDirectory()) crops[sheet] = fs.readdirSync(d).filter((f) => f.endsWith(".png"));
    }
  }

  const lines: string[] = [];
  lines.push("# 교정된 타일 근거표");
  lines.push("");
  lines.push("각 줄은 한 칸이다. `이전` 은 재감사 전 출하 라벨, `채택` 은 이번에 넣은 라벨,");
  lines.push("`판독` 은 그림을 본 판독자들이 각각 무엇이라 말했는가다(`*` 는 저신뢰 표기).");
  lines.push("");
  lines.push("판정을 눈으로 확인하려면 해당 시트의 블록 아틀라스를 다시 만든다:");
  lines.push("");
  lines.push("```");
  lines.push("vite-node scripts/gen-chipset-blocks.mts --sheet <시트> --rows <a>-<b> --scale 6");
  lines.push("# 특정 칸만 크게 보려면");
  lines.push("vite-node scripts/gen-chipset-blocks.mts --sheet <시트> --rows <a>-<b> --cols <c>-<d> --scale 14");
  lines.push("```");
  lines.push("");
  lines.push("아틀라스 PNG 는 커밋하지 않는다 — 커밋된 시트 PNG 에서 결정론적으로 재생성되므로");
  lines.push("저장소에 8MB 를 넣을 이유가 없다. 사람이 직접 확정한 칸의 크롭만 커밋한다.");
  lines.push("");

  let totalFixed = 0;
  let totalOverride = 0;

  for (const sheet of SHEETS) {
    const base = new Map(readJson<Shipped[]>(path.join(BASELINE_ROOT, `${sheet}.json`), []).map((e) => [e.index, e]));
    const now = new Map<number, Shipped>();
    for (const blk of BLOCKS) {
      for (const e of readJson<Shipped[]>(path.join(FRAGMENT_ROOT, sheet, `rows-${blk}.json`), [])) now.set(e.index, e);
    }

    // 이 시트(및 중복 묶음)의 모든 판독을 인덱스별로 모은다.
    const votes = new Map<number, { sheet: string; reader: string; r: Reading }[]>();
    for (const peer of groupOf(sheet)) {
      for (const blk of BLOCKS) {
        for (const reader of ["A", "B", "C"]) {
          for (const r of readJson<Reading[]>(path.join(READ_ROOT, peer, `rows-${blk}.${reader}.json`), [])) {
            const list = votes.get(r.index) ?? [];
            list.push({ sheet: peer, reader, r });
            votes.set(r.index, list);
          }
        }
      }
    }

    const rows: string[] = [];
    for (let index = 0; index < 480; index += 1) {
      const before = base.get(index);
      const after = now.get(index);
      if (!after) continue;
      const ov = overrides.get(`${sheet}:${index}`);
      const changed = !before || before.label !== after.label || before.role !== after.role;
      if (!changed) continue;

      const said = (votes.get(index) ?? [])
        .map((v) => `${v.r.noun}\`${v.r.role}\`${v.r.confidence === "low" ? "*" : ""}`)
        .join(" · ");
      const col = index % 30;
      const row = Math.floor(index / 30);
      const source = ov
        ? `**사람 확정** (${(crops[sheet] ?? []).join(", ") || "크롭 참조"})`
        : `block-${blockOf(index)} c${col} r${row}`;
      if (ov) totalOverride += 1;
      else totalFixed += 1;
      const beforeText = before ? `${before.label} \`${before.role}\`` : "(없음)";
      rows.push(`| ${index} | ${beforeText} | ${after.label} \`${after.role}\` | ${said || "-"} | ${source} |`);
    }

    lines.push(`## ${sheet} — 교정 ${rows.length}칸`);
    lines.push("");
    if (rows.length === 0) {
      lines.push("변경 없음.");
      lines.push("");
      continue;
    }
    lines.push("| idx | 이전 | 채택 | 판독 | 근거 위치 |");
    lines.push("|---|---|---|---|---|");
    lines.push(...rows);
    lines.push("");
  }

  lines.splice(
    2,
    0,
    `총 교정 ${totalFixed + totalOverride}칸 — 판독 다수결 ${totalFixed}칸, 사람이 고배율로 확정 ${totalOverride}칸.`,
    "",
  );

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${lines.join("\n")}\n`);
  console.log(`${OUT} — 교정 ${totalFixed + totalOverride}칸 기록 (다수결 ${totalFixed} / 사람 확정 ${totalOverride})`);
}

main();
