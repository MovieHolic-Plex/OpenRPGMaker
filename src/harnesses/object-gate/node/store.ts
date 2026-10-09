/** 영수증·프로필 파일 저장소(노드). 경로 규칙은 seed.json 과 Python object_gate 가 같이 쓴다. */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { PNG } from 'pngjs';
import { objectGatePixelSha256, type ObjectGateProfileRecord, type ObjectGateReceipt } from '../../_core/objectGate';

export const GATE_DATA = resolve(process.env.OBJECT_GATE_DATA ?? 'harness-data/object-gate');
const receiptPath = (sha: string) => resolve(GATE_DATA, 'receipts', sha.slice(0, 2), `${sha}.json`);

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
