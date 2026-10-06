import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createNativeSceneProject } from './nativeScene';
import type { NativeSceneProjectInput } from './nativeScene';
import { serialize } from '../../../project/io/serialize';

/** Author only: explicit frozen packet in, normalized portable draft out. */
export function writeNativeRuntimeDraft(packetDir: string) {
  const dir = resolve(packetDir);
  const manifest = JSON.parse(readFileSync(join(dir, 'input-manifest.json'), 'utf8')) as {
    inputFingerprint: string; files: Record<string, { sha256: string }>;
  };
  const verify = () => {
    for (const [path, record] of Object.entries(manifest.files)) {
      if (createHash('sha256').update(readFileSync(path)).digest('hex') !== record.sha256) {
        throw new Error(`Frozen source changed: ${path}`);
      }
    }
  };
  verify();
  const input = JSON.parse(readFileSync(join(dir, 'authoring-input.json'), 'utf8')) as NativeSceneProjectInput;
  const project = createNativeSceneProject(input);
  const bytes = serialize(project) + '\n';
  const file = join(dir, 'project.oprn.json');
  if (existsSync(file)) throw new Error('Draft project already exists; use a new packet directory');
  verify();
  writeFileSync(file, bytes, { flag: 'wx' });
  const proof = { status: 'prepared-not-approved', draftId: `native_potions_${manifest.inputFingerprint.slice(0, 16)}`, projectFile: file,
    sha256: createHash('sha256').update(bytes).digest('hex'), inputFingerprint: manifest.inputFingerprint,
    authoringValid: true, mapIds: Object.keys(project.maps), runtimePassed: false,
    canonicalReload: false, publicRegistered: false, stairDestinationResolved: false };
  writeFileSync(join(dir, 'draft-project-proof.json'), JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
  return proof;
}
