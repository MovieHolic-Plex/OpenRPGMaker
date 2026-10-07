// Actual assistant-authored content, exported only after canonical SQLite reload.
// Every transfer is triggered by walking; no teleport debug operation is used.
import fs from 'node:fs';
import path from 'node:path';
const flag = process.argv.indexOf('--project');
const projectFixture = flag >= 0 ? process.argv[flag + 1] : 'output/assistant-house-entry/reloaded-project.json';
const proof = JSON.parse(fs.readFileSync(path.join(path.dirname(projectFixture),'proof.json'),'utf8'));
const walk = (moves,to) => [{kind:'playerRoute',moves},{kind:'waitForPosition',...to,timeoutMs:30000}];
const stable = [{kind:'pauseFrames'},{kind:'stepFrames',frames:40,deltaMs:16},{kind:'resumeFrames'}];
export default {
 id:'assistant-house-entry',projectFixture,
 beats:[
  {id:'title',expect:{testidPresent:['title-screen']}},
  {id:'01-outside',note:'AI 조수가 지정한 시작점 — 버들항 집 앞',shot:true,
   ops:[{kind:'key',key:'Enter'},{kind:'waitForRuntime'}],
   expect:{...proof.start,playerSpriteTextureLoaded:true,testidAbsent:['title-screen','dialogue-box']}},
  {id:'02-entered',note:'문 앞까지 실제로 걸어 실내에 진입 — 즉시 되돌아가지 않는 착지',shot:true,
   ops:[...walk(proof.entryWalk,proof.enter.to),...stable],
   expect:{...proof.enter.to,playerSpriteTextureLoaded:true}},
  {id:'03-inside-walk',note:'현관에서 실내 안쪽으로 걸어 이동',shot:true,
   ops:walk(proof.roam.moves,proof.roam.to),expect:{...proof.roam.to,playerSpriteTextureLoaded:true}},
  {id:'04-returned',note:'실내 출구까지 걸어서 같은 집 앞으로 복귀',shot:true,
   ops:[...walk(proof.exitWalk,proof.exit.to),...stable],
   expect:{...proof.exit.to,playerSpriteTextureLoaded:true}},
 ]
};
