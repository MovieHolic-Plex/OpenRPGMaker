// 오프닝 도구군 선언 크기 측정(test/aiToolCatalogBudget.test.ts 와 같은 식). 테스트 실행이 아니다.
import { estimateContextTokens } from '../../src/ai/contextCompaction';
import { allTools, toOpenAiTools } from '../../src/editor/tools/toolRegistry';
const opening = toOpenAiTools(allTools()).filter(e => e.function.name.includes('opening'));
console.log(estimateContextTokens([{ role: 'system', content: JSON.stringify(opening) }] as never));
