import { resolve } from 'node:path';
import { runMatrixUiAll } from './matrixUiAll';

const root = process.argv[2];
if (!root) throw Error('matrixUiAllEntry: output root required');
process.exit(await runMatrixUiAll(resolve(root)));
