// map-vqa 의 말뭉치 읽기: 게임 통판 실행 폴더(project/project.sqlite) · 맵 깔기 실행 폴더(summary.json + jobs/<id>/after.json.gz) · 프로젝트 JSON(.oprn.json 장소 견본 포함).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { deserialize } from '../../../../project/io/serialize';
import type { Project } from '../../../../project/types';
import { readProjectSqlite } from '../../../../../scripts/content/read-project-sqlite.mts';
import { addRenderAssetRoot } from '../../../../../scripts/qa-game/render.mts';
import { allCommands } from '../smallJobs/checkSupport';
import { isBlankMap } from './facts';

export type MapItem = {
  /** 폴더 이름으로 쓰는 id(소문자·숫자·하이픈). */
  id: string;
  /** 묶음: A:<통판 실행> · B:<맵 깔기 요청> · good:<견본> · decoy:<심은 결함>. */
  group: string;
  label: string;
  project: Project; mapId: string;
  standalone: boolean;
  /** 검수자에게 주는 한 줄 배경(요청 문장·게임 제목). */
  context: string;
  /** 조수가 칠하지 않은 빈 맵(빈 프로젝트의 시작 맵이 그대로 남은 것). 깔기 결함은 보지만(플레이어가 거기서 시작한다) 없는 그림은 묻지 않는다. */
  blank?: boolean;
};

const slug = (text: string): string => text.normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/gu, '').toLowerCase().slice(0, 40) || 'map';
/** 그 맵이 다른 맵과 이어져 있나(자기에서 나가는 이동이나 자기로 들어오는 이동). */
function linked(project: Project, mapId: string): boolean {
  const maps = Object.values<any>((project as any).maps);
  const transfers = (map: any) => (map.events ?? []).flatMap((event: any) => allCommands(event)).filter((command: any) => command.kind === 'transfer' && command.mapId);
  return transfers((project as any).maps[mapId]).some((command: any) => command.mapId !== mapId) || maps.some(map => map.id !== mapId && transfers(map).some((command: any) => command.mapId === mapId));
}

function fromWholeGame(dir: string): MapItem[] {
  const run = basename(dir), project = readProjectSqlite(resolve(dir, 'project')) as any;
  addRenderAssetRoot(resolve(dir, 'project/assets'));
  const prompt = (() => { try { return /prompt=(.*?)\s+started=/u.exec(readFileSync(resolve(dir, 'RUN.txt'), 'utf8'))?.[1] ?? ''; } catch { return ''; } })();
  return Object.values<any>(project.maps).map(map => ({ id: `${slug(run)}--${slug(map.name ?? map.id)}-${String(map.id).slice(-4)}`, group: `A:${run}`, label: `${run} · ${map.name ?? map.id}`, project, mapId: map.id, standalone: !linked(project, map.id),
    context: `Part of the game «${project.meta?.title ?? ''}» that the assistant built from the request «${prompt}».` }));
}

function fromLayRun(dir: string): MapItem[] {
  const summary = JSON.parse(readFileSync(resolve(dir, 'summary.json'), 'utf8')), out: MapItem[] = [];
  for (const job of summary.jobs as any[]) {
    const projectDir = resolve(dir, 'jobs', job.id, 'project');
    if (!existsSync(resolve(projectDir, 'project.sqlite')) || !job.maps?.length) continue;
    addRenderAssetRoot(resolve(projectDir, 'assets'));
    // 저장 정본(project.sqlite)을 읽는다. after.json.gz 는 타일셋 본문을 뺀 사본이라, 조수가 턴 중에 타일셋에 붙인 칸(나무 수관·천막·키트 조각)이
    // 빈 프로젝트의 타일셋에는 없어 그림에 구멍이 난다(2026-11-11: 야영지 풀밭이 통째로 «안 칠한 칸»으로 그려져 가짜 blocker 가 붙었다).
    const project = readProjectSqlite(projectDir) as Project;
    for (const map of job.maps as any[]) {
      const saved = (project as any).maps[map.id];
      if (!saved) continue;
      const blank = isBlankMap(saved), isStart = (project as any).startMapId === map.id, isLinked = linked(project, map.id);
      // 칠하지 않은 빈 맵이 시작 맵도 아니고 어디와도 이어지지 않았으면 플레이어가 볼 일이 없다 — 검수 대상이 아니다.
      if (blank && !isStart && !isLinked) continue;
      out.push({ id: `lay-${job.id}--${slug(map.name)}-${String(map.id).slice(-4)}`, group: `B:${job.id}`, label: `맵 깔기 ${job.id} · ${map.name}`, project, mapId: map.id, standalone: !isLinked, ...(blank ? { blank: true } : {}),
        context: `The user asked the assistant (in Korean): «${job.request}»${job.status === 'timeout' ? ' (the assistant ran out of time; this is what was saved)' : ''}.${blank ? ' NOTE: this is the empty map the project started with. The assistant painted nothing on it but left it in the game' + (isStart ? ' as the map where the game starts.' : '.') : ''}` });
    }
  }
  return out;
}

function fromProjectJson(file: string): MapItem[] {
  const project = deserialize(readFileSync(file, 'utf8')) as any, name = basename(file).replace(/(\.oprn)?\.json$/u, '');
  return Object.values<any>(project.maps).filter(map => (map.lowerTiles ?? []).some((tile: number) => tile >= 0)).map(map => ({ id: `${slug(name)}--${slug(map.name ?? map.id)}-${String(map.id).slice(-4)}`, group: `good:${name}`, label: `${name} · ${map.name ?? map.id}`, project, mapId: map.id,
    standalone: !linked(project, map.id), context: 'A stand-alone place sample.' }));
}

/** 말뭉치 지정 하나(폴더·파일)를 맵 목록으로. */
export function loadCorpusEntry(entry: string): MapItem[] {
  const path = resolve(entry);
  if (!existsSync(path)) throw Error(`말뭉치 ${entry}: 없다`);
  if (statSync(path).isFile()) return fromProjectJson(path);
  if (existsSync(resolve(path, 'project/project.sqlite'))) return fromWholeGame(path);
  if (existsSync(resolve(path, 'summary.json')) && JSON.parse(readFileSync(resolve(path, 'summary.json'), 'utf8')).kind === 'assistant-map-laying-run') return fromLayRun(path);
  throw Error(`말뭉치 ${entry}: 게임 통판 실행 폴더(project/project.sqlite)도 맵 깔기 실행 폴더(summary.json)도 프로젝트 JSON 도 아니다`);
}

/** `--corpus a,b,c` 또는 `--corpus whole-games:<상위 폴더>`(그 밑의 v2 통판 실행 전부). */
export function loadCorpus(spec: string): MapItem[] {
  const items: MapItem[] = [];
  for (const entry of spec.split(',').map(part => part.trim()).filter(Boolean)) {
    if (entry.startsWith('whole-games:')) {
      const parent = resolve(entry.slice('whole-games:'.length));
      for (const name of readdirSync(parent).sort()) {
        const dir = resolve(parent, name);
        if (!existsSync(resolve(dir, 'project/project.sqlite'))) continue;
        // v1 조수가 만든 실행은 뺀다(RUN.txt 의 ver=).
        try { if (/ver=v1\b/u.test(readFileSync(resolve(dir, 'RUN.txt'), 'utf8'))) continue; } catch { /* RUN.txt 없음 — 넣는다 */ }
        items.push(...fromWholeGame(dir));
      }
    } else items.push(...loadCorpusEntry(entry));
  }
  const seen = new Set<string>();
  for (const item of items) { if (seen.has(item.id)) throw Error(`말뭉치: 맵 id ${item.id} 가 겹친다`); seen.add(item.id); }
  return items;
}

/** 말뭉치에 든 맵 깔기 실행의 요청마다 결과 한 줄 — 아무것도 안 깔린 요청은 맵이 없어 검수 목록에 안 나오므로 따로 적는다. */
export function layJobsOf(spec: string): Array<{ id: string; request: string; status: string; complete: boolean | null; maps: number; wantedMaps: number; toolCalls: number; toolErrors: number; minutes: number }> {
  const out: ReturnType<typeof layJobsOf> = [];
  for (const entry of spec.split(',').map(part => part.trim()).filter(part => part && !part.startsWith('whole-games:'))) {
    const file = resolve(entry, 'summary.json');
    if (!existsSync(file)) continue;
    const summary = JSON.parse(readFileSync(file, 'utf8'));
    if (summary.kind !== 'assistant-map-laying-run') continue;
    for (const job of summary.jobs as any[]) out.push({ id: job.id, request: job.request, status: job.status, complete: job.complete, maps: job.maps.length, wantedMaps: job.wantedMaps, toolCalls: job.toolCallCount, toolErrors: job.toolErrors, minutes: Math.round(job.wallMs / 6000) / 10 });
  }
  return out;
}

/** 말뭉치의 실행마다 턴 기록 폴더(도구가 적은 «그림이 없다» 신고를 읽는 곳). 맵을 하나도 못 깐 요청도 들어간다. */
export function corpusSessions(spec: string): Array<{ group: string; label: string; sessionDir: string }> {
  const out: Array<{ group: string; label: string; sessionDir: string }> = [];
  const wholeGame = (dir: string) => { if (existsSync(resolve(dir, 'session/turns'))) out.push({ group: `A:${basename(dir)}`, label: basename(dir), sessionDir: resolve(dir, 'session') }); };
  for (const entry of spec.split(',').map(part => part.trim()).filter(Boolean)) {
    if (entry.startsWith('whole-games:')) {
      const parent = resolve(entry.slice('whole-games:'.length));
      for (const name of readdirSync(parent).sort()) {
        const dir = resolve(parent, name);
        if (!existsSync(resolve(dir, 'project/project.sqlite'))) continue;
        try { if (/ver=v1\b/u.test(readFileSync(resolve(dir, 'RUN.txt'), 'utf8'))) continue; } catch { /* 넣는다 */ }
        wholeGame(dir);
      }
      continue;
    }
    const path = resolve(entry);
    if (existsSync(resolve(path, 'project/project.sqlite'))) wholeGame(path);
    else if (existsSync(resolve(path, 'summary.json'))) {
      const summary = JSON.parse(readFileSync(resolve(path, 'summary.json'), 'utf8'));
      if (summary.kind === 'assistant-map-laying-run') for (const job of summary.jobs as any[]) out.push({ group: `B:${job.id}`, label: `맵 깔기 ${job.id}`, sessionDir: resolve(path, 'jobs', job.id, 'session') });
    }
  }
  return out;
}
