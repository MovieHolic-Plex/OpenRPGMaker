import { readFileSync } from 'node:fs';
import { inspectRomanceScene } from '../runtime';
import { deserialize } from '../../../project/io';

export async function run(argv: string[]): Promise<number> {
  const path = argv[argv.indexOf('--project') + 1];
  if (argv[0] !== 'inspect' || !argv.includes('--project') || !path) throw Error('inspect --project <project.json>');
  const result = inspectRomanceScene(deserialize(readFileSync(path, 'utf8')));
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  return result.ok ? 0 : 1;
}
