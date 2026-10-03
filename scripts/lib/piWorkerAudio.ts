// Headless tools lack Vite's installed-file define. Seed the same runtime
// availability list from this host's media files before presenting music choices.
import { readdir } from 'node:fs/promises';
import { setInstalledBgmFiles } from '../../src/assets/installedBgm';

export async function preparePiWorkerAudio(): Promise<void> {
  const directory = new URL('../../public/assets/cc0/audio/catalog/', import.meta.url);
  let files: string[];
  try { files = await readdir(directory); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    files = [];
  }
  setInstalledBgmFiles(files.filter(file => file.endsWith('.mp3')));
}
