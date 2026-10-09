import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync, renameSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { PNG } from 'pngjs';
import { createInterviewScenePlan, INTERVIEW_SCENE_CATALOG_SIGNATURE, INTERVIEW_SCENE_STYLE_VERSION } from '../../../editor/interviewScenePlan';

const root = resolve(import.meta.dirname, '../../../..');
const dataDir = resolve(root, 'harness-data/interview-scene-bank');
const candidates = resolve(root, 'qa-runs/harnesses/interview-scene-bank');
const seed = JSON.parse(readFileSync(resolve(dataDir, 'seed.json'), 'utf8'));
const ledgerPath = resolve(dataDir, 'ledger.json');
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
type Review = { sourceSha256: string; promptSha256: string; checks: Record<string, boolean>; findings: string[]; reviewer: string };
type EditContract = { version: 1; kind: 'native-edit'; specPromptSha256: string; sourceSha256: string };
type Candidate = { file: string; sha256: string; promptSha256: string; generationPromptSha256: string; attempt: number; requestContract?: EditContract; review?: Review; gate?: Gate };
type Gate = { ok: boolean; width: number; height: number; colors: number; findings: string[] };
type Ledger = { version: number; entries: Record<string, Candidate[]> };
const readLedger = (): Ledger => existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : { version: 1, entries: {} };
const writeJson = (path: string, value: unknown) => {
  writeFileSync(path + '.tmp', JSON.stringify(value, null, 2) + '\n'); renameSync(path + '.tmp', path);
};

function gate(file: string): Gate {
  const image = PNG.sync.read(readFileSync(file));
  const { width, height, data } = image;
  const colors = new Set<number>();
  let opaque = true;
  for (let i = 0; i < data.length; i += 4) {
    colors.add((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!);
    if (data[i + 3] !== 255) opaque = false;
  }
  const findings: string[] = [];
  if (Math.abs(width / height - seed.aspectRatio) > seed.aspectTolerance) findings.push('인터뷰 전체 배경의 16:9 비율과 맞지 않는다.');
  if (!opaque) findings.push('전체 배경에 투명 픽셀이 있다.');
  return { ok: findings.length === 0, width, height, colors: colors.size, findings };
}

export async function run(argv: string[]): Promise<number> {
  mkdirSync(dataDir, { recursive: true }); mkdirSync(candidates, { recursive: true });
  const plan = createInterviewScenePlan();
  if (plan.length !== seed.expectedScenes || new Set(plan.map(s => s.key)).size !== seed.expectedScenes) throw Error('장면 수/키 중복 오류');
  const lookup = new Map(plan.map(s => [s.key, s]));
  const ledger = readLedger();
  const arg = (name: string) => { const i = argv.indexOf(name); if (i < 0 || !argv[i + 1]) throw Error(`${name} 필요`); return argv[i + 1]!; };
  const latest = (key: string) => ledger.entries[key]?.at(-1);
  const sourceFile = (key: string, c: Candidate) => {
    const original = resolve(root, c.file);
    return existsSync(original) ? original : resolve(root, 'public/assets/harnesses/interview-scene-bank', `${key}-${c.sha256.slice(0, 12)}.png`);
  };
  const requestFile = (c: Candidate) => {
    const original = resolve(candidates, `${c.generationPromptSha256}.prompt.txt`);
    return existsSync(original) ? original : resolve(dataDir, 'requests', `${c.generationPromptSha256}.txt`);
  };
  const matchesRequest = (key: string, prompt: string, contract?: EditContract) => {
    const spec = lookup.get(key); if (!spec) return false;
    if (!contract) return prompt.startsWith(spec.prompt) || prompt.startsWith(
      spec.prompt.replace(/^Use case: stylized-concept\./, 'Use case: precise-object-edit.'));
    // Native edits retain the exact selected-facts block without contradictory
    // generation-only camera/reference instructions. Bind them to this same key.
    if (contract.version !== 1 || contract.kind !== 'native-edit' || contract.specPromptSha256 !== sha(spec.prompt)) return false;
    const source = ledger.entries[key]?.find(c => c.sha256 === contract.sourceSha256);
    const facts = spec.prompt.slice(spec.prompt.indexOf('GENRE:'));
    if (!source || source.promptSha256 !== sha(spec.prompt) || !facts.startsWith('GENRE:') ||
      !(prompt.startsWith('Use case: precise-object-edit. Image 1 is the EXACT SAME KEY pixel-art scene to EDIT,') ||
        prompt.startsWith('Use case: precise-object-edit. Asset type: ONE game-maker interview background, not gameplay or a spritesheet.\nEDIT the attached EXACT SAME KEY native as the sole target.')) ||
      !prompt.includes(facts) || !prompt.includes(`Target SHA256=${contract.sourceSha256}.`)) return false;
    const archived = resolve(dataDir, 'edit-sources', `${source.sha256}.png`);
    const original = existsSync(archived) ? archived : sourceFile(key, source);
    const request = requestFile(source);
    return existsSync(original) && sha(readFileSync(original)) === source.sha256 &&
      existsSync(request) && sha(readFileSync(request)) === source.generationPromptSha256;
  };
  const register = (key: string, imagePath: string, prompt: string, requestContract?: EditContract) => {
    const spec = lookup.get(key); if (!spec) throw Error('모르는 장면');
    if (!matchesRequest(key, prompt, requestContract)) throw Error('생성 요청이 현재 장면 프롬프트와 맞지 않는다.');
    const bytes = readFileSync(resolve(imagePath)); PNG.sync.read(bytes);
    const hash = sha(bytes); const history = ledger.entries[key] ??= [];
    if (history.some(c => c.sha256 === hash)) throw Error('같은 후보를 재등록할 수 없다.');
    const file = resolve(candidates, `${key}-${history.length + 1}-${hash.slice(0, 12)}.png`);
    const requestHash = sha(prompt);
    writeFileSync(file, bytes); writeFileSync(resolve(candidates, `${requestHash}.prompt.txt`), prompt);
    if (requestContract) {
      const source = history.find(c => c.sha256 === requestContract.sourceSha256)!;
      const archives = resolve(dataDir, 'edit-sources'); const requests = resolve(dataDir, 'requests');
      mkdirSync(archives, { recursive: true }); mkdirSync(requests, { recursive: true });
      const archived = resolve(archives, `${source.sha256}.png`);
      if (!existsSync(archived)) copyFileSync(sourceFile(key, source), archived);
      const durableRequest = resolve(requests, `${source.generationPromptSha256}.txt`);
      const originalRequest = requestFile(source);
      if (originalRequest !== durableRequest) copyFileSync(originalRequest, durableRequest);
    }
    history.push({ file: relative(root, file), sha256: hash, promptSha256: sha(spec.prompt), generationPromptSha256: requestHash, attempt: history.length + 1, ...(requestContract ? { requestContract } : {}) });
    return { key, attempt: history.length, sha256: hash };
  };
  const approved = (key: string) => {
    const c = latest(key); const spec = lookup.get(key); if (!c || !spec) return false;
    const source = sourceFile(key, c); const request = requestFile(c);
    if (c.promptSha256 !== sha(spec.prompt) || !existsSync(source) || sha(readFileSync(source)) !== c.sha256 || !existsSync(request)) return false;
    const actualRequest = readFileSync(request, 'utf8');
    if (sha(actualRequest) !== c.generationPromptSha256 || !matchesRequest(key, actualRequest, c.requestContract)) return false;
    const r = c.review;
    return c.gate?.ok === true && r?.sourceSha256 === c.sha256 && r.promptSha256 === c.promptSha256 && r.findings.length === 0 && seed.visualChecks.every((k: string) => r.checks[k] === true);
  };
  switch (argv[0]) {
    case 'plan': {
      writeJson(resolve(candidates, 'plan.json'), plan);
      console.log(JSON.stringify({ scenes: plan.length, genres: 4, perGenre: 364, prefixesPerGenre: 363, opening: 1, output: relative(root, resolve(candidates, 'plan.json')) })); return 0;
    }
    case 'batch': {
      const jobs = [...plan].sort((a, b) => a.depth - b.depth).filter(s => {
        const c = latest(s.key); if (approved(s.key)) return false;
        return !c || c.promptSha256 !== sha(s.prompt) || c.gate?.ok === false ||
          !!c.review && (c.review.findings.length > 0 || seed.visualChecks.some((k: string) => c.review!.checks[k] !== true));
      })
        .filter(s => (ledger.entries[s.key]?.filter(c => c.promptSha256 === sha(s.prompt)).length ?? 0) < seed.maxAttemptsPerBatch).slice(0, seed.batchSize)
        .map(s => {
          const findings = [...(latest(s.key)?.gate?.findings ?? []), ...(latest(s.key)?.review?.findings ?? [])];
          return { ...s, attempt: (latest(s.key)?.attempt ?? 0) + 1, prompt: s.prompt + (findings.length ? `\nPREVIOUS REJECTION — REDRAW, do not reuse: ${findings.join(' ')}` : '') };
        });
      writeJson(resolve(candidates, 'next-batch.json'), jobs); console.log(JSON.stringify({ jobs: jobs.length, output: relative(root, resolve(candidates, 'next-batch.json')) })); return 0;
    }
    case 'import': {
      const result = register(arg('--key'), arg('--image'), readFileSync(resolve(arg('--prompt')), 'utf8'));
      writeJson(ledgerPath, ledger); console.log(JSON.stringify(result)); return 0;
    }
    case 'import-batch': {
      const records: { key: string; path: string; prompt: string; requestContract?: EditContract }[] = JSON.parse(readFileSync(resolve(arg('--records')), 'utf8'));
      const results = records.map(r => register(r.key, r.path, r.prompt, r.requestContract));
      writeJson(ledgerPath, ledger); console.log(JSON.stringify(results)); return 0;
    }
    case 'gate': {
      const hashes = new Map<string, string>();
      for (const spec of plan) {
        const c = latest(spec.key); if (!c) continue;
        const file = sourceFile(spec.key, c);
        c.gate = existsSync(file) ? gate(file) : { ok: false, width: 0, height: 0, colors: 0, findings: ['등록한 원본 파일이 없다.'] };
        if (existsSync(file) && sha(readFileSync(file)) !== c.sha256) c.gate.findings.push('등록 이후 원본 해시가 바뀌었다.');
        const duplicate = hashes.get(c.sha256); if (duplicate) c.gate.findings.push(`다른 장면 ${duplicate}의 원본을 재탕했다.`);
        hashes.set(c.sha256, spec.key); c.gate.ok = c.gate.findings.length === 0;
      }
      writeJson(ledgerPath, ledger); console.log(JSON.stringify(Object.fromEntries(Object.entries(ledger.entries).map(([k, v]) => [k, v.at(-1)!.gate])))); return 0;
    }
    case 'review': {
      const key = arg('--key'); const c = latest(key); if (!c) throw Error('후보가 없다.');
      const review: Review = JSON.parse(readFileSync(resolve(arg('--verdict')), 'utf8'));
      if (review.sourceSha256 !== c.sha256 || review.promptSha256 !== c.promptSha256) throw Error('판정이 현재 원본/프롬프트 해시에 묶이지 않았다.');
      if (!Array.isArray(review.findings) || typeof review.reviewer !== 'string' || !review.reviewer.trim() || !seed.visualChecks.every((k: string) => typeof review.checks?.[k] === 'boolean')) throw Error('실제 시각 판정 필드가 빠졌다.');
      c.review = review; writeJson(ledgerPath, ledger); console.log(JSON.stringify({ key, accepted: approved(key) })); return 0;
    }
    case 'review-batch': {
      const records: { key: string; sha256: string; review: Review }[] = JSON.parse(readFileSync(resolve(arg('--records')), 'utf8'));
      for (const record of records) {
        const c = ledger.entries[record.key]?.find(c => c.sha256 === record.sha256); const r = record.review;
        if (!c || r.sourceSha256 !== c.sha256 || r.promptSha256 !== c.promptSha256) throw Error('판정이 원본/프롬프트 해시에 묶이지 않았다.');
        if (!Array.isArray(r.findings) || !r.reviewer?.trim() || !seed.visualChecks.every((k: string) => typeof r.checks?.[k] === 'boolean')) throw Error('시각 판정 필드 오류');
        c.review = r;
      }
      writeJson(ledgerPath, ledger); console.log(JSON.stringify({ reviewed: records.length })); return 0;
    }
    case 'build': {
      const dest = resolve(root, 'public/assets/harnesses/interview-scene-bank'); mkdirSync(dest, { recursive: true });
      const requests = resolve(dataDir, 'requests'); mkdirSync(requests, { recursive: true });
      const scenes: Record<string, { url: string; sha256: string; promptSha256: string }> = {};
      const hashes = new Set<string>();
      const approvedKeys = new Set(plan.filter(spec => approved(spec.key)).map(spec => spec.key));
      // A rejected earlier answer must not leave an unreachable approved child in the app.
      const reachable = (key: string) => key.split('--').every((_, index, parts) =>
        approvedKeys.has(parts.slice(0, index + 1).join('--')));
      for (const spec of plan) if (reachable(spec.key)) {
        const c = latest(spec.key)!;
        // Recheck bytes at publication, never trust an old gate receipt.
        const source = sourceFile(spec.key, c);
        if (!gate(source).ok || hashes.has(c.sha256)) throw Error('배포 시 원본 규격/중복 관문 실패');
        hashes.add(c.sha256);
        const name = `${spec.key}-${c.sha256.slice(0, 12)}.png`; const published = resolve(dest, name);
        if (source !== published) copyFileSync(source, published);
        const request = requestFile(c); const durableRequest = resolve(requests, `${c.generationPromptSha256}.txt`);
        if (request !== durableRequest) copyFileSync(request, durableRequest);
        scenes[spec.key] = { url: `/assets/harnesses/interview-scene-bank/${name}`, sha256: c.sha256, promptSha256: c.promptSha256 };
      }
      writeJson(resolve(root, 'src/editor/interviewSceneBank.json'), { version: 1, styleVersion: INTERVIEW_SCENE_STYLE_VERSION, catalogSignature: INTERVIEW_SCENE_CATALOG_SIGNATURE, planned: plan.length, scenes });
      console.log(JSON.stringify({ planned: plan.length, published: Object.keys(scenes).length, complete: Object.keys(scenes).length === plan.length })); return 0;
    }
    case 'status': {
      const counts = { planned: plan.length, missing: 0, outdated: 0, rejected: 0, waitingGate: 0, waitingReview: 0, accepted: 0, exhausted: 0 };
      for (const s of plan) {
        const c = latest(s.key);
        const attempts = ledger.entries[s.key]?.filter(c => c.promptSha256 === sha(s.prompt)).length ?? 0;
        if (!c) counts.missing++;
        else if (c.promptSha256 !== sha(s.prompt)) counts.outdated++;
        else if (approved(s.key)) counts.accepted++;
        else if (!c.gate) counts.waitingGate++;
        else if (!c.gate.ok || c.review?.findings.length || c.review && seed.visualChecks.some((k: string) => c.review!.checks[k] !== true)) counts.rejected++;
        else counts.waitingReview++;
        if (attempts >= seed.maxAttemptsPerBatch && !approved(s.key)) counts.exhausted++;
      }
      console.log(JSON.stringify(counts)); return 0;
    }
    default: throw Error('plan | batch | import --key K --image PNG | gate | review --key K --verdict JSON | build | status');
  }
}
