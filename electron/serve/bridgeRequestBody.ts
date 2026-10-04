import type { IncomingMessage } from 'node:http';
import { createGunzip } from 'node:zlib';
import { OPRN_CHANNELS } from '../shared/channels';

export const BRIDGE_BODY_LIMIT = 64 * 1024 * 1024;
export const PROJECT_SAVE_BODY_LIMIT = 256 * 1024 * 1024;

export class BridgeRequestBodyError extends Error {
  constructor(message: string, readonly statusCode: 400 | 413 | 415) { super(message); }
}

/** Call only after origin, member and bridge-token authentication. No handlers run here. */
export async function readBridgeRequestBody(request: IncomingMessage): Promise<{ channel: string; payload?: unknown }> {
  const channelHint = request.headers['x-oprn-channel'];
  if (channelHint !== undefined && (typeof channelHint !== 'string' || !channelHint || channelHint.length > 100)) {
    request.resume();
    throw new BridgeRequestBodyError('invalid bridge channel header', 400);
  }
  const encodingHeader = request.headers['content-encoding'];
  const encoding = typeof encodingHeader === 'string' ? encodingHeader.trim().toLowerCase() : encodingHeader === undefined ? 'identity' : '';
  if (encoding !== 'identity' && encoding !== 'gzip') {
    request.resume();
    throw new BridgeRequestBodyError('unsupported bridge content-encoding', 415);
  }
  // The hint grants only a bounded transport allowance; it must match the parsed envelope.
  // Creation carries a full serialized seed, including the same shared assets
  // and reference documents as a later save. Keep its allowance equally bounded.
  // A map patch carries whatever changed since the last save — after load normalization that is
  // most tilesets and assets, i.e. nearly the whole document (2026-09-26: 96MB decoded on an 85MB
  // project), and a stale base resends the full base as well. Under 64MB decoded every such first
  // save failed with 413 and was retried forever, so it gets the same bound as a full save.
  const projectDocument = channelHint === OPRN_CHANNELS.projectSave || channelHint === OPRN_CHANNELS.startCreateProject
    || channelHint === OPRN_CHANNELS.projectSaveMapPatch;
  const decodedLimit = projectDocument ? PROJECT_SAVE_BODY_LIMIT : BRIDGE_BODY_LIMIT;
  // 문서 채널은 gzip 전송량도 해제 상한까지 허용한다 — 해제량을 스트리밍 중에 따로 자르므로 이 값이 느슨해도
  // 받는 양은 늘지 않는다. 실측(2026-09-28): 새 프로젝트 첫 전체 저장이 해제 187MB · gzip 69MB 였고
  // 예전 gzip 64MiB 상한에서 413 이 나 재시도마다 같은 413 을 받았다(SQLite 에 아무것도 남지 않았다).
  const wireLimit = encoding === 'gzip' && !projectDocument ? BRIDGE_BODY_LIMIT : decodedLimit;
  const declaredLength = Number(request.headers['content-length']);
  if (Number.isFinite(declaredLength) && declaredLength > wireLimit) {
    request.resume();
    throw new BridgeRequestBodyError(`request exceeds ${wireLimit} encoded bytes`, 413);
  }
  const text = await new Promise<string>((resolve, reject) => {
    const gunzip = encoding === 'gzip' ? createGunzip() : null;
    const decoded = gunzip ?? request;
    const chunks: Buffer[] = [];
    let wireBytes = 0, decodedBytes = 0, settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true; chunks.length = 0;
      if (gunzip) { request.unpipe(gunzip); gunzip.destroy(); }
      request.resume();
      reject(error);
    };
    request.on('data', (chunk: Buffer) => {
      if (settled) return;
      wireBytes += chunk.length;
      if (wireBytes > wireLimit) fail(new BridgeRequestBodyError(`request exceeds ${wireLimit} encoded bytes`, 413));
    });
    request.once('error', error => fail(error));
    request.once('aborted', () => fail(new BridgeRequestBodyError('aborted bridge request', 400)));
    decoded.on('data', (chunk: Buffer) => {
      if (settled) return;
      decodedBytes += chunk.length;
      if (decodedBytes > decodedLimit) { fail(new BridgeRequestBodyError(`request exceeds ${decodedLimit} decoded bytes`, 413)); return; }
      chunks.push(chunk);
    });
    decoded.once('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks, decodedBytes).toString('utf8'));
      chunks.length = 0;
    });
    if (gunzip) {
      gunzip.once('error', () => fail(new BridgeRequestBodyError('invalid gzip bridge request', 400)));
      request.pipe(gunzip);
    }
  });
  let body: unknown;
  try { body = JSON.parse(text); }
  catch { throw new BridgeRequestBodyError('invalid bridge JSON', 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof (body as { channel?: unknown }).channel !== 'string') {
    throw new BridgeRequestBodyError('invalid bridge request envelope', 400);
  }
  const envelope = body as { channel: string; payload?: unknown };
  if (channelHint !== undefined && channelHint !== envelope.channel) throw new BridgeRequestBodyError('bridge channel header/body mismatch', 400);
  return envelope;
}
