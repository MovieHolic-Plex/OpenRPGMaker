import { resolve } from 'node:path';
import { runMatrixScore } from './matrixScore';

const root=process.argv[2];
if(!root) throw Error('matrixScoreEntry: output root required');
process.exit(await runMatrixScore(resolve(root)));
