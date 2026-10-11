import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Project } from '../../src/project/types';

/**
 * 조수용 ffmpeg. 쉘 없이 execFile, 입력은 리소스 id → 임시 파일, 출력은 한 파일 → 리소스.
 * 네트워크·임의 파일 읽기(concat/subfile/movie=/subtitles/파이프)·덤프를 인자 단계에서 막는다.
 */
export const FFMPEG_OUTPUT_KINDS = { picture: 'png', backdrop: 'png', movie: 'mp4', music: 'wav', sound: 'wav' } as const;
export type FfmpegOutputKind = keyof typeof FFMPEG_OUTPUT_KINDS;
const MIME: Record<string, string> = { png: 'image/png', mp4: 'video/mp4', wav: 'audio/wav' };
const MAX_OUT = 48 * 1024 * 1024, TIMEOUT_MS = 120_000;
const FORBIDDEN = /(?:^|[^a-z])(?:file|http|https|tcp|udp|rtmp|rtsp|ftp|pipe|concat|subfile|data|crypto|async):|:\/\/|\b(?:a?movie|subtitles|ass|sendcmd|zmq|ladspa|frei0r|lavfi_dumpgraph)=|fontfile|textfile|filter_complex_script|filter_script|-attach|-report|-dump|-dump_attachment|-protocol_whitelist|-f\s+(?:lavfi|concat)|\.\.\//iu;
const dataBytes = (dataUrl: string): Buffer => Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
const extOf = (dataUrl: string): string => /^data:(?:image\/png)/.test(dataUrl) ? 'png' : /^data:image\/jpe?g/.test(dataUrl) ? 'jpg' : /^data:video\/mp4/.test(dataUrl) ? 'mp4' : /^data:video\/webm/.test(dataUrl) ? 'webm' : /^data:audio\/(?:x-)?wav|^data:audio\/wave/.test(dataUrl) ? 'wav' : /^data:audio\/mpeg/.test(dataUrl) ? 'mp3' : /^data:audio\/ogg/.test(dataUrl) ? 'ogg' : 'bin';

export type FfmpegRequest = { readonly inputs?: readonly string[]; readonly args: readonly string[]; readonly output: { readonly id: string; readonly name: string; readonly kind: FfmpegOutputKind } };
export type FfmpegResult = { readonly resourceId: string; readonly name: string; readonly kind: FfmpegOutputKind; readonly dataUrl: string; readonly bytes: number; readonly log: string };

export function validateFfmpegArgs(args: readonly string[]): string | undefined {
  if (!args.length || args.length > 80) return 'args는 1~80개여야 합니다.';
  for (const a of args) {
    if (typeof a !== 'string' || a.length > 1200) return 'args 항목이 문자열이 아니거나 너무 깁니다.';
    if (FORBIDDEN.test(a)) return `허용되지 않는 ffmpeg 인자입니다: ${a.slice(0, 60)}`;
    if (/^\/|^~/.test(a)) return '절대 경로는 쓸 수 없습니다. {in0}·{out} 자리표시자만 쓰세요.';
  }
  if (!args.includes('{out}')) return '출력은 반드시 {out} 자리표시자 한 번으로 지정하세요.';
  return undefined;
}

export async function runFfmpegHost(project: Project, request: FfmpegRequest, signal?: AbortSignal): Promise<FfmpegResult> {
  const bad = validateFfmpegArgs(request.args);
  if (bad) throw new Error(bad);
  const ext = FFMPEG_OUTPUT_KINDS[request.output.kind];
  if (!ext) throw new Error('output.kind는 picture/backdrop/movie/music/sound 중 하나여야 합니다.');
  const dir = await mkdtemp(join(tmpdir(), 'oprn-ffmpeg-'));
  try {
    const inputs: string[] = [];
    for (const [i, id] of (request.inputs ?? []).slice(0, 8).entries()) {
      const dataUrl = project.assets.uploaded[id]?.dataUrl;
      if (!dataUrl?.startsWith('data:')) throw new Error(`입력 리소스 ${id}의 파일 데이터가 없습니다(list_opening_media의 id를 쓰세요).`);
      const path = join(dir, `in${i}.${extOf(dataUrl)}`);
      await writeFile(path, dataBytes(dataUrl));
      inputs.push(path);
    }
    const out = join(dir, `out.${ext}`);
    const argv = request.args.map(a => a.replace(/\{in(\d)\}/g, (_, n) => inputs[Number(n)] ?? (() => { throw new Error(`{in${n}} 입력이 없습니다.`); })()).replace('{out}', out));
    const log = await new Promise<string>((resolve, reject) => {
      const child = execFile('ffmpeg', ['-hide_banner', '-nostdin', '-y', '-protocol_whitelist', 'file', ...argv], { cwd: dir, timeout: TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 }, (error, _o, stderr) => {
        if (error) reject(new Error(`ffmpeg 실패: ${String(stderr).split('\n').slice(-8).join(' ').slice(0, 600)}`)); else resolve(String(stderr).split('\n').slice(-4).join(' ').slice(0, 300));
      });
      signal?.addEventListener('abort', () => child.kill('SIGKILL'), { once: true });
    });
    const bytes = await readFile(out);
    if (!bytes.length) throw new Error('ffmpeg 출력이 비어 있습니다.');
    if (bytes.length > MAX_OUT) throw new Error(`출력이 ${Math.floor(MAX_OUT / 1048576)}MB를 넘습니다. 해상도·길이·비트레이트를 줄이세요.`);
    return { resourceId: request.output.id, name: request.output.name, kind: request.output.kind, dataUrl: `data:${MIME[ext]};base64,${bytes.toString('base64')}`, bytes: bytes.length, log };
  } finally { await rm(dir, { recursive: true, force: true }); }
}
