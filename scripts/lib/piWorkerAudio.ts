// Headless tools lack Vite's installed-file define. Seed the same runtime
// availability list from this host's media files before presenting music choices.
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setInstalledBgmFiles } from '../../src/assets/installedBgm';
import { setInstalledStillPackFiles } from '../../src/assets/installedStillPack';
import { listInstalledStillPackFiles } from './stillPackDelivery';

export async function preparePiWorkerAudio(): Promise<void> {
  const directory = new URL('../../public/assets/cc0/audio/catalog/', import.meta.url);
  let files: string[];
  try { files = await readdir(directory); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    files = [];
  }
  setInstalledBgmFiles(files.filter(file => file.endsWith('.mp3')));
  // 오프닝 스틸 팩도 같은 이유로 디스크에서 시드한다(설치 전이면 조수 목록에서 팩 스틸이 빠진다).
  setInstalledStillPackFiles(listInstalledStillPackFiles(fileURLToPath(new URL('../../public/assets/stills/pack/', import.meta.url))));
}
