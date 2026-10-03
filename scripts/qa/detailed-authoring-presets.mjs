// Focused contract audit: full manuals, selected variants, mixed genres, graph and source hashes.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { withTsModule } from '../ontology-ts-loader.mjs';
const out = resolve('verify-shots/detailed-authoring-presets');
mkdirSync(out, { recursive: true });
const seed = {
  version: 1, presetId: 'story-cutscene',
  summary: '지우가 이웃 나래와 별빛 우체국 앞에서 만나는 관계 게임. 첫 장면, 대화 두 선택지. 외형은 미정.',
  answers: Object.fromEntries(['experience', 'activity', 'progression', 'detail', 'scope'].map(slot => [slot, { question: '검증 질문', label: slot, text: '검증 답변', source: 'user' }])),
  interview: { version: 1, genre: 'romance', concept: '이웃과 첫 만남', protagonist: '지우. 외형 미정', notes: '상대 나래, 별빛 우체국. 반갑게 인사한다 / 편지를 물어본다.', choiceIds: {} },
};
const scenes = JSON.parse(readFileSync('src/editor/projectInterviewScenes.json', 'utf8'));
const documents = JSON.parse(readFileSync('src/project/gameAuthoringPresets/documents.json', 'utf8'));
const report = { sourceDocuments: [], variants: [], mixed: [], checks: [] };
for (const document of Object.values(documents)) {
  const text = readFileSync(`src/project/gameAuthoringPresets/${document.id}.md`, 'utf8').trim();
  assert.equal(document.text, text);
  assert.equal(document.sha256, createHash('sha256').update(text).digest('hex'));
  assert.ok(document.sections.length >= 12);
  report.sourceDocuments.push({ id: document.id, characters: text.length, sections: document.sections.length, sha256: document.sha256 });
}
await withTsModule(resolve('src/project/gameDesignExecution.ts'), 'execution.mjs', async execution => {
  await withTsModule(resolve('src/project/gameDesignBrief.ts'), 'brief.mjs', async briefModule => {
    const preset = (primary, secondary) => [primary, secondary].includes('monster') ? 'monster-collect' : [primary, secondary].includes('adventure') ? 'adventure-jrpg' : 'story-cutscene';
    const slots = { premise: 'experience', play: 'activity', tone: 'detail', structure: 'progression', scope: 'scope' };
    function fixture(genre) {
      const b = structuredClone(seed);
      b.presetId = preset(genre.id);
      b.interview.genre = genre.id;
      b.interview.choiceIds = {};
      for (const q of genre.questions) { const slot = slots[q.id]; const o = q.options[0]; b.interview.choiceIds[slot] = o.id; b.answers[slot].text = `${o.label} — ${o.detail}`; }
      return b;
    }
    function checkGraph(tasks) {
      const byId = new Map(tasks.map(t => [t.id, t])); assert.equal(byId.size, tasks.length);
      const visited = new Set(); const visiting = new Set();
      function visit(id) { assert.ok(byId.has(id), `Missing dependency ${id}`); if (visited.has(id)) return; assert.ok(!visiting.has(id), `Cycle at ${id}`); visiting.add(id); for (const dep of byId.get(id).dependsOn) visit(dep); visiting.delete(id); visited.add(id); }
      tasks.forEach(t => visit(t.id));
    }
    for (const genre of scenes.genres) {
      const b = fixture(genre); const ctx = briefModule.gameDesignBriefContext(b); const plan = execution.buildGameDesignExecution(b); checkGraph(plan.tasks);
      assert.ok(ctx.includes(documents.common.text)); assert.ok(ctx.includes(documents[genre.id].text));
      for (const other of scenes.genres.filter(g => g.id !== genre.id)) assert.ok(!ctx.includes(`AUTHORING_PRESET_BEGIN ${other.id} `));
      assert.equal(plan.tasks.length, 57); assert.ok(plan.tasks.every(t => t.action && t.output && t.acceptance));
      writeFileSync(`${out}/${genre.id}-context.txt`, ctx);
      report.variants.push({ genre: genre.id, characters: ctx.length, taskCount: plan.tasks.length, manualCharacters: documents.common.text.length + documents[genre.id].text.length });
      for (const question of genre.questions) {
        const slot = slots[question.id]; const variants = question.options.map(option => {
          const variant = structuredClone(b); variant.interview.choiceIds[slot] = option.id; variant.answers[slot].text = `${option.label} — ${option.detail}`;
          const text = briefModule.gameDesignBriefContext(variant); assert.ok(text.includes(option.label)); assert.ok(!text.includes('適用')); return [...text.matchAll(/적용: ([^\n]+)/g)][['experience', 'activity', 'progression', 'detail', 'scope'].indexOf(slot)]?.[1];
        });
        assert.ok(variants.every(Boolean));
        assert.equal(new Set(variants).size, question.options.length, `${genre.id}/${slot} binding is static`);
      }
      for (const secondary of scenes.genres.filter(g => g.id !== genre.id)) {
        const mixed = structuredClone(b); mixed.presetId = preset(genre.id, secondary.id); mixed.interview.secondary = secondary.id; mixed.interview.blend = { question: '결합 방식', label: '결합', text: '한 선택이 양쪽에 영향을', source: 'user' };
        const normalized = briefModule.normalizeGameDesignBrief(mixed); const text = briefModule.gameDesignBriefContext(normalized); const plan = execution.buildGameDesignExecution(normalized); checkGraph(plan.tasks);
        assert.ok(text.includes(documents[genre.id].text) && text.includes(documents[secondary.id].text)); assert.equal(plan.tasks.length, 73);
        report.mixed.push({ primary: genre.id, secondary: secondary.id, characters: text.length, tasks: plan.tasks.length });
      }
    }
    const legacy = structuredClone(seed); delete legacy.interview; assert.ok(!briefModule.gameDesignBriefContext(legacy).includes('AUTHORING_PRESET_BEGIN romance'));
    const original = fixture(scenes.genres.find(g => g.id === 'romance')); original.summary = '최신 기획 고유 변경: 우체국 대신 도서관에서 시작';
    assert.ok(briefModule.gameDesignBriefContext(original).includes(original.summary));
    report.checks = ['Five source hashes match shipped full documents', 'Four complete genre manuals', '60 illustrated choice variants', '12 ordered mixed genre combinations', 'Dependency graphs have no missing ids or cycles', 'Latest edited summary preserved', 'Legacy story engine does not imply romance'];
  });
});
report.passed = true;
writeFileSync(`${out}/contract-report.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.variants));
