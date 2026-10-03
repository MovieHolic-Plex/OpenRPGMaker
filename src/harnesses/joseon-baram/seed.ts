/**
 * joseon-baram 시드(harness-data/joseon-baram/seed.json) 모양과 검사. 브라우저·노드 공용(파일을 읽지 않는다).
 * 파일이 실제로 있는지·해시가 맞는지는 bridge.py validate 와 node/cli.ts 가 본다.
 */
export type JoseonGate = { code: string; name: string; blocking: boolean; threshold: string; where: string };
export type JoseonMap = {
  id: string;
  name: string;
  profile: string;
  builder: string;
  builderSeed: number;
  size: [number, number];
  out: string;
  stem: string;
  sheetOrder: number;
  role: string;
  overwritesTracked: boolean;
};
export type JoseonMapGateProfile = { lawnMax: number; treeMin: number; objMin: number; depthMin: number; bldMin: number; heightsMin: number };
export type JoseonForbidden = { id: string; rule: string };

export type JoseonSeed = {
  version: 1;
  tileset: { id: string; family: string; tile: number; sheet: string; doc: string };
  toolchain: Record<string, string>;
  palette: { file: string; allowedColors: number; rampCount: number; shadow: string; previous: { file: string; allowedColors: number } };
  pieceClasses: Record<string, string>;
  terrainWithVerdict: string[];
  gates: JoseonGate[];
  verdictStatuses: string[];
  adversarial: { lenses: string[]; maxRounds: number };
  maps: JoseonMap[];
  mapFiles: string[];
  mapGate: { profiles: Record<string, JoseonMapGateProfile> };
  reviewZones: { grid: [number, number]; scale: number; lenses: string[]; outDir: string };
  characters: { sheet: string; textureId: string };
  sources: { baramScreens: { dir: string; commit: boolean; files: Record<string, { sha256: string; bytes: number }> } };
  forbidden: JoseonForbidden[];
};

const REQUIRED_TOOLCHAIN = [
  "dir", "harnessDir", "catalog", "gate", "verdict", "adversarial", "mapgate", "calibration", "piecesMeta", "verdicts",
  "adversarialRecords", "contract", "adversarialDoc", "tilesetBuilder", "rebuild", "save", "bridge",
] as const;
/** 시드가 반드시 담아야 하는 금지 조항 */
export const REQUIRED_FORBIDDEN = ["generated-images", "generated-characters", "baram-screens-commit"] as const;
const GATE_CODES = ["P", "E", "T", "L", "S", "A", "K", "TR", "V"] as const;
const VERDICT_STATUSES = ["pass", "note", "user", "redo"] as const;

function fail(message: string): never {
  throw new Error(`joseon-baram 시드: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown, where: string): string {
  if (typeof value !== "string" || value.length === 0) fail(`${where} 는 비지 않은 문자열이어야 한다`);
  return value;
}

function num(value: unknown, where: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(`${where} 는 숫자여야 한다`);
  return value;
}

export function validateSeed(raw: unknown): JoseonSeed {
  if (!isRecord(raw)) fail("객체가 아니다");
  if (raw.version !== 1) fail("version 은 1 이어야 한다");

  const tileset = raw.tileset;
  if (!isRecord(tileset)) fail("tileset 이 없다");
  if (tileset.id !== "joseon_baram") fail("tileset.id 는 joseon_baram 이어야 한다(다른 타일셋은 별도 하네스)");
  if (tileset.tile !== 16) fail("tileset.tile 은 16");
  str(tileset.sheet, "tileset.sheet");
  str(tileset.doc, "tileset.doc");
  str(tileset.family, "tileset.family");

  const toolchain = raw.toolchain;
  if (!isRecord(toolchain)) fail("toolchain 이 없다");
  for (const key of REQUIRED_TOOLCHAIN) str(toolchain[key], `toolchain.${key}`);

  const palette = raw.palette;
  if (!isRecord(palette)) fail("palette 가 없다");
  str(palette.file, "palette.file");
  if (num(palette.allowedColors, "palette.allowedColors") < 1) fail("palette.allowedColors 는 1 이상");
  num(palette.rampCount, "palette.rampCount");
  if (!/^#[0-9a-f]{6}$/.test(str(palette.shadow, "palette.shadow"))) fail("palette.shadow 는 #rrggbb");
  if (!isRecord(palette.previous)) fail("palette.previous 가 없다");

  if (!isRecord(raw.pieceClasses) || Object.keys(raw.pieceClasses).length === 0) fail("pieceClasses 가 없다");
  if (!Array.isArray(raw.terrainWithVerdict) || raw.terrainWithVerdict.some((v) => typeof v !== "string")) fail("terrainWithVerdict 는 문자열 목록");

  if (!Array.isArray(raw.gates)) fail("gates 가 없다");
  const codes = raw.gates.map((gate, index) => {
    if (!isRecord(gate)) fail(`gates[${index}] 가 객체가 아니다`);
    str(gate.name, `gates[${index}].name`);
    str(gate.threshold, `gates[${index}].threshold`);
    if (typeof gate.blocking !== "boolean") fail(`gates[${index}].blocking 은 boolean`);
    return str(gate.code, `gates[${index}].code`);
  });
  if (new Set(codes).size !== codes.length) fail("gates 코드 중복");
  for (const code of GATE_CODES) if (!codes.includes(code)) fail(`gates 에 관문 ${code} 가 없다`);

  if (!Array.isArray(raw.verdictStatuses) || [...raw.verdictStatuses].sort().join() !== [...VERDICT_STATUSES].sort().join()) {
    fail(`verdictStatuses 는 ${VERDICT_STATUSES.join("·")} 여야 한다(verdict.py 와 같아야 함)`);
  }
  const adversarial = raw.adversarial;
  if (!isRecord(adversarial) || !Array.isArray(adversarial.lenses) || adversarial.lenses.join() !== "culture,view") fail("adversarial.lenses 는 [culture, view]");

  if (!Array.isArray(raw.maps) || raw.maps.length === 0) fail("maps 가 없다");
  const mapIds = new Set<string>();
  const orders = new Set<number>();
  const profiles = isRecord(raw.mapGate) && isRecord(raw.mapGate.profiles) ? raw.mapGate.profiles : fail("mapGate.profiles 가 없다");
  raw.maps.forEach((map, index) => {
    if (!isRecord(map)) fail(`maps[${index}] 가 객체가 아니다`);
    const id = str(map.id, `maps[${index}].id`);
    if (mapIds.has(id)) fail(`지도 id 중복: ${id}`);
    mapIds.add(id);
    str(map.builder, `maps[${index}].builder`);
    str(map.out, `maps[${index}].out`);
    str(map.stem, `maps[${index}].stem`);
    if (!Array.isArray(map.size) || map.size.length !== 2 || map.size.some((v) => !Number.isInteger(v) || (v as number) <= 0)) fail(`maps[${index}].size 는 [칸w, 칸h]`);
    const order = num(map.sheetOrder, `maps[${index}].sheetOrder`);
    if (orders.has(order)) fail(`sheetOrder 중복: ${order}`);
    orders.add(order);
    const profile = str(map.profile, `maps[${index}].profile`);
    if (!isRecord(profiles[profile])) fail(`지도 ${id} 의 profile ${profile} 이 mapGate.profiles 에 없다`);
  });
  if (!isRecord(profiles.default)) fail("mapGate.profiles.default 가 없다");
  for (const [name, profile] of Object.entries(profiles)) {
    if (!isRecord(profile)) fail(`mapGate.profiles.${name} 가 객체가 아니다`);
    for (const key of ["lawnMax", "treeMin", "objMin", "depthMin", "bldMin", "heightsMin"]) num(profile[key], `mapGate.profiles.${name}.${key}`);
  }
  if (!Array.isArray(raw.mapFiles) || raw.mapFiles.length === 0) fail("mapFiles 가 없다");

  const zones = raw.reviewZones;
  if (!isRecord(zones) || !Array.isArray(zones.grid) || zones.grid.length !== 2) fail("reviewZones.grid 는 [열, 행]");
  if (num(zones.scale, "reviewZones.scale") < 1) fail("reviewZones.scale 은 1 이상");
  str(zones.outDir, "reviewZones.outDir");

  const characters = raw.characters;
  if (!isRecord(characters) || !/Actor1/.test(str(characters.sheet, "characters.sheet"))) fail("characters.sheet 는 Actor1 이어야 한다(캐릭터 생성 금지)");

  const sources = raw.sources;
  const baram = isRecord(sources) && isRecord(sources.baramScreens) ? sources.baramScreens : fail("sources.baramScreens 가 없다");
  if (baram.commit !== false) fail("sources.baramScreens.commit 은 false 여야 한다(바람의나라 스크린샷 커밋 금지)");
  if (!isRecord(baram.files) || Object.keys(baram.files).length === 0) fail("sources.baramScreens.files 에 해시가 없다");
  for (const [name, info] of Object.entries(baram.files)) {
    if (!isRecord(info) || !/^[0-9a-f]{64}$/.test(String(info.sha256))) fail(`baramScreens.files.${name}.sha256 은 64자 hex`);
  }

  if (!Array.isArray(raw.forbidden)) fail("forbidden 이 없다");
  const forbiddenIds = raw.forbidden.map((rule, index) => {
    if (!isRecord(rule)) fail(`forbidden[${index}] 가 객체가 아니다`);
    str(rule.rule, `forbidden[${index}].rule`);
    return str(rule.id, `forbidden[${index}].id`);
  });
  for (const id of REQUIRED_FORBIDDEN) if (!forbiddenIds.includes(id)) fail(`forbidden 에 ${id} 가 없다`);

  return raw as unknown as JoseonSeed;
}
