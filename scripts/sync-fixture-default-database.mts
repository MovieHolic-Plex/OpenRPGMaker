import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defaultEquipmentRecords } from "../src/project/defaults/defaultDatabaseEquipmentRecords";
import { defaultItemRecords } from "../src/project/defaults/defaultDatabaseItemRecords";
import {
  defaultBattleAnimationRecords,
  defaultSkillRecords,
  defaultStateRecords,
} from "../src/project/defaults/defaultDatabaseStarterRecords";
import { DERIVED_DATABASE_TABLES, syncDefaultRecords, type DerivedTable } from "./lib/fixtureDefaultDatabase.mts";

const FIXTURE_PATH = fileURLToPath(
  new URL("../src/project/defaults/fixtures/dew-village-demo.json", import.meta.url),
);

type Row = { id: string };
type Fixture = { database: Record<DerivedTable, Row[]> };

const codeRecordsByTable: Record<DerivedTable, () => Row[]> = {
  items: () => defaultItemRecords() as unknown as Row[],
  equipment: () => defaultEquipmentRecords() as unknown as Row[],
  skills: () => defaultSkillRecords() as unknown as Row[],
  states: () => defaultStateRecords() as unknown as Row[],
  battleAnimations: () => defaultBattleAnimationRecords() as unknown as Row[],
};

const raw = await readFile(FIXTURE_PATH, "utf8");
const fixture = JSON.parse(raw) as Fixture;

const lines: string[] = [];
for (const table of DERIVED_DATABASE_TABLES) {
  const { records, report } = syncDefaultRecords(fixture.database[table], codeRecordsByTable[table]());
  fixture.database[table] = records;
  lines.push(
    `${table}: 총 ${records.length}개 (추가 ${report.added.length}, 코드값으로 갱신 ${report.refreshed.length}, 저작 전용 보존 ${report.authoredKept.length})`,
  );
  if (report.refreshed.length > 0) {
    const shown = report.refreshed.slice(0, 12);
    const remaining = report.refreshed.length - shown.length;
    lines.push(`  코드값으로 갱신: ${shown.join(", ")}${remaining > 0 ? ` ... (+${remaining})` : ""}`);
  }
  if (report.authoredKept.length > 0) lines.push(`  저작 전용 보존: ${report.authoredKept.join(", ")}`);
}

const next = `${JSON.stringify(fixture, null, 2)}\n`;
if (next === raw) console.log("픽스처가 이미 코드 기본값과 같다. 쓰지 않았다.");
else {
  await writeFile(FIXTURE_PATH, next, "utf8");
  console.log(`픽스처를 갱신했다: ${FIXTURE_PATH}`);
}
for (const line of lines) console.log(line);
