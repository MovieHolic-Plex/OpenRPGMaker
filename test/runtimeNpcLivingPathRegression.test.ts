import { describe, it } from 'vitest';
import { livingPathCases, runLivingPathCase } from '../scripts/qa/living-path-regression';
describe('7차 생활 NPC 길찾기',()=>{
 for(const [name,run] of Object.entries(livingPathCases)) it(name,()=>runLivingPathCase(run));
});
