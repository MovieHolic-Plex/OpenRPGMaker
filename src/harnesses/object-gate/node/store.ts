/** 영수증·프로필 파일 저장소(노드). 경로 규칙은 seed.json 과 Python object_gate 가 같이 쓴다. */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { homedir } from 'node:os';
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PNG } from 'pngjs';
import { OBJECT_GATE_PROFILE, objectGatePixelSha256, objectGateProfileHash, type ObjectGateFinal, type ObjectGateFinalProfileRecord, type ObjectGateFrontPropApproval, type ObjectGateHoldDecision, type ObjectGateProfileRecord, normalizeObjectGateImage, objectGateHoldPayload, type ObjectGateReceipt, type ObjectGateStyleKind } from '../../_core/objectGate';

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

/**
 * 보류(refer) 판정의 사람 결정 기록 — 검토 화면(`serve-holds`)의 서버만 쓴다.
 * 서명 키는 저장소 밖(~/.config/oprn/object-gate-hold.key, 0600)에 있고, 기록에는 HMAC 서명이 붙는다.
 * 손으로 쓴 파일·다른 경로로 만든 파일은 서명이 맞지 않아 없는 것과 같다(TS·Python 출구가 둘 다 서명을 확인한다).
 */
export const HOLD_KEY_PATH = resolve(process.env.OBJECT_GATE_HOLD_KEY ?? resolve(homedir(), '.config', 'oprn', 'object-gate-hold.key'));
export function holdKey(create = false): Buffer | null {
  if (!existsSync(HOLD_KEY_PATH)) {
    if (!create) return null;
    mkdirSync(dirname(HOLD_KEY_PATH), { recursive: true, mode: 0o700 });
    writeFileSync(HOLD_KEY_PATH, randomBytes(32).toString('hex'), { mode: 0o600 });
  }
  const hexKey = readFileSync(HOLD_KEY_PATH, 'utf8').trim();
  return /^[0-9a-f]{64}$/.test(hexKey) ? Buffer.from(hexKey, 'hex') : null;
}
const holdPath = (sha: string) => resolve(GATE_DATA, 'approvals', 'hold', sha.slice(0, 2), `${sha}.json`);
export const holdSignature = (key: Buffer, d: ObjectGateHoldDecision) => createHmac('sha256', key).update(objectGateHoldPayload(d)).digest('hex');
/** 서명이 맞는 기록만 돌려준다(키가 없거나 서명이 틀리면 null). */
export function readHoldDecision(sha: string): ObjectGateHoldDecision | null {
  const path = holdPath(sha);
  if (!existsSync(path)) return null;
  const d = JSON.parse(readFileSync(path, 'utf8')) as ObjectGateHoldDecision;
  const key = holdKey();
  if (!key || typeof d.sig !== 'string' || d.sig.length !== 64) return null;
  const want = Buffer.from(holdSignature(key, d), 'hex'), got = Buffer.from(d.sig, 'hex');
  return got.length === want.length && timingSafeEqual(got, want) ? d : null;
}
/** 검토 화면 서버 전용. 다른 곳에서 부르지 않는다. */
export function writeHoldDecision(d: Omit<ObjectGateHoldDecision, 'sig'>): string {
  const key = holdKey(true)!;
  const signed = { ...d, sig: '' } as ObjectGateHoldDecision;
  signed.sig = holdSignature(key, signed);
  const path = holdPath(d.pixelSha256);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(signed, null, 1)}\n`);
  return path;
}

/** 보류 영수증의 그림(정규화한 PNG). 검토 화면이 보여 주고, 서버가 결정을 받을 때 해시를 다시 잰다. */
const heldImagePath = (sha: string) => resolve(GATE_DATA, 'held-images', sha.slice(0, 2), `${sha}.png`);
export function writeHeldImage(sha: string, width: number, height: number, data: Uint8Array): void {
  const path = heldImagePath(sha);
  if (existsSync(path)) return;
  const n = normalizeObjectGateImage(width, height, data);
  const png = new PNG({ width: n.width, height: n.height });
  png.data = Buffer.from(n.rgba);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, PNG.sync.write(png));
}
/** 저장된 그림이 있고 화소 해시가 맞을 때만 경로를 돌려준다. */
export async function heldImage(sha: string): Promise<string | null> {
  const path = heldImagePath(sha);
  if (!existsSync(path)) return null;
  return (await pngPixelSha256(path)) === sha ? path : null;
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
    : { half, judges: p.judges, factsVersion: p.factsVersion, styleFactsVersion: p.styleFactsVersion, styleRubric: p.styleRubric, styleOutputFormat: p.styleOutputFormat, styleKinds: p.styleKinds, styleRefs: p.styleRefs });
};

/**
 * 사람 검토 대기열의 묶음(queue/<id>.json). `enqueue` 가 쓴다 — 묶음에 든 그림의 해시·종류·표식만 적고, 판정은 영수증, 결정은 서명 기록이 따로 갖는다.
 * 묶음은 검토 화면에서 거르고 「이 묶음 전부 허용」을 누르는 단위일 뿐 효력은 없다(허용은 그림마다 서명 기록이 따로 생긴다).
 */
export type ObjectGateQueueBatch = {
  schema: 'oprn-object-gate-queue/1'; id: string; title: string; note?: string; createdAt: string;
  /** 선택 — 검토하는 사람에게 「이 묶음이 무엇이고 어디에 쓰이는지」 보여 줄 그림(queue/ 안 파일 이름, png)과 쉬운 말 한 단락. 효력은 없다. */
  explainImage?: string; explainText?: string;
  items: Array<{ sha: string; kind: string; label: string; source?: string }>;
};
const queueDir = () => resolve(GATE_DATA, 'queue');
export function listQueueBatches(): ObjectGateQueueBatch[] {
  if (!existsSync(queueDir())) return [];
  return readdirSync(queueDir()).filter(f => f.endsWith('.json')).sort().map(f => JSON.parse(readFileSync(resolve(queueDir(), f), 'utf8')) as ObjectGateQueueBatch);
}
/** 묶음 설명 그림의 경로 — queue/ 바로 아래의 png 파일 이름만 받는다(경로 이동 금지). 없으면 null. */
export function queueExplainImagePath(name: string | undefined): string | null {
  if (!name || !/^[a-z0-9][-a-z0-9_.]{0,120}\.png$/.test(name)) return null;
  const path = resolve(queueDir(), name);
  return existsSync(path) ? path : null;
}
export function writeQueueBatch(batch: ObjectGateQueueBatch): string {
  if (!/^[a-z0-9][-a-z0-9_.]{0,80}$/.test(batch.id)) throw Error(`묶음 id 는 영문 소문자·숫자·-_. 만: ${batch.id}`);
  const path = resolve(queueDir(), `${batch.id}.json`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(batch, null, 1)}\n`);
  return path;
}

/** Opus 최종 판정 기록(2026-10-21) — final/<해시 앞 2자>/<화소 해시>.json, 최종 프로필 final-profiles/<해시>.json. */
const finalPath = (sha: string) => resolve(GATE_DATA, 'final', sha.slice(0, 2), `${sha}.json`);
export function readFinal(sha: string): ObjectGateFinal | null {
  const path = finalPath(sha);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as ObjectGateFinal : null;
}
export function writeFinal(record: ObjectGateFinal): string {
  const path = finalPath(record.pixelSha256);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(record, null, 1)}\n`);
  return path;
}
export function listFinals(): ObjectGateFinal[] {
  const root = resolve(GATE_DATA, 'final');
  if (!existsSync(root)) return [];
  return readdirSync(root).flatMap(dir => readdirSync(resolve(root, dir)).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(resolve(root, dir, f), 'utf8')) as ObjectGateFinal));
}
export function readFinalProfiles(): ObjectGateFinalProfileRecord[] {
  const root = resolve(GATE_DATA, 'final-profiles');
  if (!existsSync(root)) return [];
  return readdirSync(root).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(resolve(root, f), 'utf8')) as ObjectGateFinalProfileRecord);
}
export function calibratedFinalProfiles(): Set<string> {
  return new Set(readFinalProfiles().filter(p => p.status === 'calibrated').map(p => p.profileHash));
}
export function writeFinalProfile(record: ObjectGateFinalProfileRecord): string {
  const path = resolve(GATE_DATA, 'final-profiles', `${record.profileHash}.json`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(record, null, 1)}\n`);
  return path;
}
/** 출구 입력 한 벌(영수증·승인·사람 결정·Opus 최종) — 노드 출구가 같은 것을 넘기게. */
export function exitInputs(sha: string) {
  return { receipt: readReceipt(sha), approval: readApproval(sha), hold: readHoldDecision(sha), final: readFinal(sha), calibratedProfiles: calibratedProfiles(), calibratedFinalProfiles: calibratedFinalProfiles() };
}
