import { resolve } from 'node:path';
import { runMatrixNative } from './matrixNative';

const root = process.argv[2];
if (!root) throw new Error('matrix-native: output root required');
const timeout = Number(process.env.MATRIX_NATIVE_TIMEOUT_MS ?? 240000);
process.exitCode = await runMatrixNative(resolve(root), timeout);

