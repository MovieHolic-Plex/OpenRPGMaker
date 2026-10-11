import { resolve } from 'node:path';
import { runMatrixTools } from './matrixTools';

const root = process.argv[2];
if (!root) throw Error('matrixToolsEntry: output root required');
process.exit(runMatrixTools(resolve(root)));
