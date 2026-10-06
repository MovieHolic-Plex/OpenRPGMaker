import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createNativeSceneProject, type NativeSceneProjectInput } from './nativeScene';
import { serialize } from '../../../project/io/serialize';

/** Wand-only portable draft authoring; no catalog or canonical writes. */
export function writeWandRuntimeDraft(packetDir: string) {
  const dir = resolve(packetDir);
  const manifest = JSON.parse(readFileSync(join(dir, 'input-manifest.json'), 'utf8')) as {
    inputFingerprint: string; files: Record<string, { sha256: string }>;
  };
  const verify = () => {
    for (const [file, record] of Object.entries(manifest.files)) {
      if (createHash('sha256').update(readFileSync(file)).digest('hex') !== record.sha256) throw new Error(`Frozen source changed: ${file}`);
    }
  };
  verify();
  const input = JSON.parse(readFileSync(join(dir, 'authoring-input.json'), 'utf8')) as NativeSceneProjectInput;
  const bytes = serialize(createNativeSceneProject(input)) + '\n';
  const projectFile = join(dir, 'project.oprn.json');
  if (existsSync(projectFile)) throw new Error('Use a new draft output directory');
  verify();
  writeFileSync(projectFile, bytes, { flag: 'wx' });
  const proof = { status: 'prepared-not-approved', draftId: `native_wand_${manifest.inputFingerprint.slice(0, 16)}`,
    projectFile, sha256: createHash('sha256').update(bytes).digest('hex'), inputFingerprint: manifest.inputFingerprint,
    authoringValid: true, runtimePassed: false, publicRegistered: false, canonicalReload: false,
    shelfRemovalResolved: false, externalDoorDestinationResolved: false };
  writeFileSync(join(dir, 'draft-project-proof.json'), JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
  return proof;
}
