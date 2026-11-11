// map-vqa 의 말뭉치 읽기: 게임 통판 실행 폴더(project/project.sqlite) · 맵 깔기 실행 폴더(summary.json + jobs/<id>/after.json.gz) · 프로젝트 JSON(.oprn.json 장소 견본 포함).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createBlankProject } from '../../../../project/defaults';
import { deserialize } from '../../../../project/io/serialize';
import type { Project } from '../../../../project/types';
import { readProjectSqlite } from '../../../../../scripts/content/read-project-sqlite.mts';
import { addRenderAssetRoot } from '../../../../../scripts/qa-game/render.mts';
import { allCommands } from '../smallJobs/checkSupport';

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
    const after = resolve(dir, 'jobs', job.id, 'after.json.gz');
    if (!existsSync(after)) continue;
    addRenderAssetRoot(resolve(dir, 'jobs', job.id, 'project/assets'));
    const project = Object.assign(createBlankProject() as any, JSON.parse(gunzipSync(readFileSync(after)).toString('utf8'))) as Project;
    for (const map of job.maps as any[]) {
      if (!(project as any).maps[map.id]) continue;
      out.push({ id: `lay-${job.id}--${slug(map.name)}-${String(map.id).slice(-4)}`, group: `B:${job.id}`, label: `맵 깔기 ${job.id} · ${map.name}`, project, mapId: map.id, standalone: !linked(project, map.id),
        context: `The user asked the assistant (in Korean): «${job.request}»${job.status === 'timeout' ? ' (the assistant ran out of time; this is what was saved)' : ''}.` });
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
