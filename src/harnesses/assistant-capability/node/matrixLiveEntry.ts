import { resolve } from 'node:path';
import { runMatrixLive } from './matrixLive';

const root = process.argv[2];
if (!root) throw Error('matrixLiveEntry: output root required');
process.exit(await runMatrixLive(resolve(root)));
