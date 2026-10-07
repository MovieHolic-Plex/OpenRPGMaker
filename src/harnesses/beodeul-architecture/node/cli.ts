import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

export async function run(argv: string[]): Promise<number> {
  const stage = argv[0];
  if (!['build', 'validate', 'review'].includes(stage ?? '')) throw new Error('build | validate | review');
  const source = path.resolve('src/harnesses/beodeul-architecture/node');
  const result = spawnSync('python3', [path.join(source, stage === 'build' ? 'build.py' : 'inspect.py'), ...(stage === 'review' ? ['--review'] : [])], { stdio: 'inherit' });
  if(result.status!==0)return result.status??1;
  if(stage==='build'){
    for(const script of [path.resolve('scripts/content/build-beodeul-ground.py'),path.join(source,'lightground.py'),path.join(source,'hamletground.py'),path.join(source,'woodland.py')]){
      const ground=spawnSync('python3',[script],{stdio:'inherit'});if(ground.status!==0)return ground.status??1;
    }
  }
  const forms=spawnSync('python3',[path.join(source,'forms.py'),...(stage==='build'?[]:[stage==='review'?'--review':'--validate'])],{stdio:'inherit'});
  if(forms.status!==0)return forms.status??1;
  fs.mkdirSync('harness-data/beodeul-architecture', { recursive: true });
  return result.status ?? 1;
}
