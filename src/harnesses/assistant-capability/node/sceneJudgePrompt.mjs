// 시각 판정자(새 Opus) 지시문 — 한 시도의 요청·요구·교훈과 실제로 볼 그림 목록(해시 포함)을 만든다.
//   node sceneJudgePrompt.mjs --out <실행 폴더> --case <id> [--attempt 1]  → attempt-N/judge-input.json + 지시문 출력
// 판정자는 그림만 보고 판정한다. 조수의 완료 보고·자기평가는 근거로 주지 않는다.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
const option = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : fallback; };
const root = resolve(option('out')), caseId = option('case'), attempt = option('attempt', '1');
const manifest = JSON.parse(readFileSync(resolve(root, 'experiment.json'), 'utf8'));
const entry = manifest.cases.find(c => c.id === caseId);
const dir = resolve(root, caseId, `attempt-${attempt}`);
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const images = [];
const add = (file, role) => { if (existsSync(file)) images.push({ file, role, sha256: sha(file) }); };
const renderDir = resolve(dir, 'render', 'render');
if (existsSync(renderDir)) for (const name of readdirSync(renderDir).filter(n => n.endsWith('.png')).sort()) add(resolve(renderDir, name), `1x map render ${name.replace('.png', '')} (event markers: coloured boxes; green = start)`);
add(resolve(dir, 'after.png'), 'editor screenshot right after the assistant turn (assistant panel with its last answer)');
add(resolve(dir, 'reloaded.png'), 'editor screenshot after canonical reload');
const frames = resolve(dir, 'film', 'frames');
if (existsSync(frames)) for (const name of readdirSync(frames).filter(n => n.endsWith('.png')).sort()) add(resolve(frames, name), `shipped player.html frame ${name} (one every 2 s)`);
const dense = resolve(dir, 'film', 'dense');
if (existsSync(dense)) for (const name of readdirSync(dense).filter(n => n.endsWith('.png')).sort()) add(resolve(dense, name), `shipped player.html close-up frame ${name} (interaction ${name.slice(1, name.indexOf('_'))}, one every 0.5 s from 1 s before the observer reached the event)`);
const battle = resolve(dir, 'film', 'battle');
if (existsSync(battle)) for (const name of readdirSync(battle).filter(n => n.endsWith('.png')).sort()) add(resolve(battle, name), `shipped player.html battle screenshot ${name} (real page screenshot taken each time the observer pressed Enter in battle)`);
const score = existsSync(resolve(dir, 'score.json')) ? JSON.parse(readFileSync(resolve(dir, 'score.json'), 'utf8')) : null;
const filmLog = existsSync(resolve(dir, 'film', 'film-log.json')) ? JSON.parse(readFileSync(resolve(dir, 'film', 'film-log.json'), 'utf8'))
  .filter(e => ['target', 'arrived', 'blocked-step', 'no-target', 'error'].includes(e.kind)).map(e => ({ kind: e.kind, mapId: e.mapId, eventId: e.eventId, name: e.name, planned: e.planned ?? e.reached, arrived: e.arrived, dir: e.dir, at: e.at, message: e.message })) : [];
const input = { caseId, attempt: Number(attempt), prompt: entry.prompt, requirements: entry.requirements, lessons: entry.lessons, images,
  maps: score?.maps ?? [], filmTour: filmLog };
writeFileSync(resolve(dir, 'judge-input.json'), JSON.stringify(input, null, 2));
console.log(`You are an independent, harsh visual QA judge for an RPG editor's AI assistant. You did not build this; judge only what the images show.

The user typed this request into the editor assistant (Korean):
"""${entry.prompt}"""

Requirements fixed before the run: ${JSON.stringify(entry.requirements)}
Lessons this case tests (from three demo games fixed by hand): ${JSON.stringify(entry.lessons)}
Maps in the saved project: ${JSON.stringify(input.maps)}
Automated play tour log (which events the observer walked to; walks with real arrow keys tile by tile and talks with the real action key, no teleport): ${JSON.stringify(filmLog)}

Read EVERY image below with the Read tool (they are 1x pixel renders and real game frames; do not upscale claims beyond what you see):
${images.map((im, i) => `${i + 1}. ${im.file} — ${im.role}`).join('\n')}

Judge at 1x like a player would. Fail on any of: request not visibly fulfilled; wrong place type; broken tile assembly (cut-off roofs, floating walls, grey dither bands or floor-coloured specks outside rooms, objects on wrong layer); doors/exits not visible or trigger obviously off the door art; NPC vanishing in place / stacked actors / dialogue box jumping position (if frames show it); portraits not facing each other when asked; props that are clearly not what was asked (e.g. a cabinet called a vending machine); empty or barren maps where the request implies content. Do not fail for things the images cannot show; mark those "unverified".
Conventions of this engine (do not count these as defects): wall-embedded doors/elevators/stairs on 3/4 interiors have a walk-on threshold cell drawn directly below the art — a trigger on that threshold cell IS on the door art; a trigger on the second row below the art is not. A doorway between two rooms of a hand-built interior is a 1-tile gap in the partition: the gap cell is a dark lintel (ceiling-coloured, thin frame lines) drawn over a walkable cell, with the open door frame on the two wall rows below — that is a doorway, not an unfloored hole; judge it unreachable only if the play frames show the hero failing to pass. The project's unused default map "빈 맵"(map_blank_start, plain grass) is left by the template, not by the assistant. The first frames (loading, title, the template's painted intro slideshow) are the template's, not the assistant's. The observer presses the action key about every half second while a dialogue is open, so a choice window can open and be confirmed with its default option between two 2-second frames: when the frames go straight from a question to one branch's line, that branch was the default (cursor) option — read the default from which branch followed instead of failing for a missing choice window. The page video drops many battle frames (and some transition frames) to full black or half-black tears — a recording artefact, not the game: judge battles from the battle screenshots, which are real page captures. Before calling two characters stacked or drawn in the wrong order, crop and zoom the frame (the character on the lower row is drawn in front).
Separate MAJOR defects (the request or a tested lesson is visibly broken, or the scene would look broken to a player) from MINOR ones (polish). Verdict is "pass" only when every requirement is pass (or unverified because the images cannot show it while nothing contradicts it) and there is no MAJOR defect.

Reply with ONLY a JSON object, no prose before/after:
{"verdict":"pass"|"fail","score":0-10,"requirements":[{"requirement":"...","status":"pass"|"fail"|"unverified","evidence":"image # and what you saw"}],"major":["concrete defect with image # and location"],"minor":["..."],"notes":"one or two sentences"}`);
