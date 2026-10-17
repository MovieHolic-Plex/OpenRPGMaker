/** 영수증·프로필 파일 저장소(노드). 경로 규칙은 seed.json 과 Python object_gate 가 같이 쓴다. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PNG } from 'pngjs';
import { OBJECT_GATE_PROFILE, objectGatePixelSha256, objectGateProfileHash, type ObjectGateFrontPropApproval, type ObjectGateProfileRecord, type ObjectGateReceipt, type ObjectGateStyleKind } from '../../_core/objectGate';

export const GATE_DATA = resolve(process.env.OBJECT_GATE_DATA ?? 'harness-data/object-gate');
const receiptPath = (sha: string) => resolve(GATE_DATA, 'receipts', sha.slice(0, 2), `${sha}.json`);

const approvalPath = (sha: string) => resolve(GATE_DATA, 'approvals', 'front_prop', sha.slice(0, 2), `${sha}.json`);
export function readApproval(sha: string): ObjectGateFrontPropApproval | null {
  const path = approvalPath(sha);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as ObjectGateFrontPropApproval : null;
}
export function writeApproval(approval: ObjectGateFrontPropApproval): string {
  const path = approvalPath(approval.pixelSha256);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(approval, null, 1)}\n`);
  return path;
}
export function removeApproval(sha: string): boolean {
  const path = approvalPath(sha);
  if (!existsSync(path)) return false;
  unlinkSync(path); return true;
}
export function listApprovals(): ObjectGateFrontPropApproval[] {
  const root = resolve(GATE_DATA, 'approvals', 'front_prop');
  if (!existsSync(root)) return [];
  return readdirSync(root).flatMap(dir => readdirSync(resolve(root, dir)).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(resolve(root, dir, f), 'utf8')) as ObjectGateFrontPropApproval));
}

export function readPng(path: string): { width: number; height: number; data: Uint8Array; png: Buffer } {
  const png = readFileSync(path);
  const image = PNG.sync.read(png);
  return { width: image.width, height: image.height, data: new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.length), png };
}

export async function pngPixelSha256(path: string): Promise<string> {
  const { width, height, data } = readPng(path);
  return objectGatePixelSha256(width, height, data);
}

export function readReceipt(sha: string): ObjectGateReceipt | null {
  const path = receiptPath(sha);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as ObjectGateReceipt : null;
}

export function writeReceipt(receipt: ObjectGateReceipt): string {
  const path = receiptPath(receipt.pixelSha256);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(receipt, null, 1)}\n`);
  return path;
}

export function listReceipts(): ObjectGateReceipt[] {
  const root = resolve(GATE_DATA, 'receipts');
  if (!existsSync(root)) return [];
  return readdirSync(root).flatMap(dir => readdirSync(resolve(root, dir)).filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(readFileSync(resolve(root, dir, f), 'utf8')) as ObjectGateReceipt));
}

export function readProfiles(): ObjectGateProfileRecord[] {
  const root = resolve(GATE_DATA, 'profiles');
  if (!existsSync(root)) return [];
  return readdirSync(root).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(resolve(root, f), 'utf8')) as ObjectGateProfileRecord);
}

export function calibratedProfiles(): Set<string> {
  return new Set(readProfiles().filter(p => p.status === 'calibrated').map(p => p.profileHash));
}

export function writeProfile(record: ObjectGateProfileRecord): string {
  const path = resolve(GATE_DATA, 'profiles', `${record.profileHash}.json`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(record, null, 1)}\n`);
  return path;
}

/** 화풍 기준 그림 목록(종류별 PNG 경로, 이름순) + 화소 해시. build_style_refs.py 가 manifest.json 을 쓴다. */
export type StyleRef = { name: string; path: string; sha256: string };
export function styleRefs(kind: ObjectGateStyleKind): StyleRef[] {
  const manifestPath = resolve(GATE_DATA, 'style-refs', 'manifest.json');
  if (!existsSync(manifestPath)) throw Error(`화풍 기준 그림이 없다 — python3 src/harnesses/object-gate/tools/build_style_refs.py (${manifestPath})`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, Record<string, { sha256: string }>>;
  return Object.entries(manifest[kind] ?? {}).sort(([a], [b]) => a.localeCompare(b))
    .map(([name, meta]) => ({ name, path: resolve(GATE_DATA, 'style-refs', kind, `${name}.png`), sha256: meta.sha256 }));
}

/** 현재 프로필 = 규칙(rules.ts) + 화풍 기준 그림 해시. 기준 그림이 바뀌어도 프로필 해시가 바뀐다. */
export function gateProfile(): Record<string, unknown> {
  const manifestPath = resolve(GATE_DATA, 'style-refs', 'manifest.json');
  const refs = existsSync(manifestPath)
    ? Object.fromEntries(Object.entries(JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, Record<string, { sha256: string }>>)
      .map(([kind, items]) => [kind, Object.fromEntries(Object.entries(items).map(([name, meta]) => [name, meta.sha256]))]))
    : {};
  const hashOf = (name: string) => { const f = resolve(GATE_DATA, name); return existsSync(f) ? createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 16) : null; };
  return { ...OBJECT_GATE_PROFILE, styleRefs: refs, view34Guide: hashOf('view34-guide.png'), view34Pairs: hashOf('view34-pairs.png') };
}
export const gateProfileHash = () => objectGateProfileHash(gateProfile());

/** 답 캐시 키 — 프롬프트에 영향 주는 것(판정자·지시문·출력 형식·기준 그림·확대 배율)만 묶는다. 합치기 규칙·하한만 바뀌면 캐시를 그대로 쓴다(--offline 재계산). */
// front_prop(규칙 v8)의 뜻은 그 종류로 선언한 그림의 사용자 문구에만 들어가므로 다른 종류의 프롬프트 해시에서 뺀다(그 종류의 답 캐시는 -fp 로 따로).
export const gatePromptHash = (half: 'view34' | 'style' | 'eye' = 'view34') => {
  const p = gateProfile() as Record<string, unknown>;
  if (half === 'eye') return objectGateProfileHash({ half, judges: p.judges, eyeRubric: p.eyeRubric, eyeOutputFormat: p.eyeOutputFormat, view34Pairs: p.view34Pairs, magnify: p.magnify });
  return objectGateProfileHash(half === 'view34'
    ? { half, judges: p.judges, factsVersion: p.factsVersion, rubric: p.rubric, outputFormat: p.outputFormat, view34Guide: p.view34Guide, view34Pairs: p.view34Pairs, magnify: p.magnify, kinds: Object.fromEntries(Object.entries(p.kinds as Record<string, { meaning: string }>).filter(([k]) => k !== 'front_prop').map(([k, v]) => [k, v.meaning])) }
    : { half, judges: p.judges, factsVersion: p.factsVersion, styleRubric: p.styleRubric, styleOutputFormat: p.styleOutputFormat, styleKinds: p.styleKinds, styleRefs: p.styleRefs });
};
