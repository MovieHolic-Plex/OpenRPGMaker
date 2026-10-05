# battle-monster

일반 JRPG/RM2003 전투 몬스터의 기본 자세와 9자세 직접 도트 저작 하네스.

- 매니페스트: `harness.ts`
- CLI: `node/cli.ts` → `node/pipeline.py` (Python 3/Pillow)
- 검토 화면: `node/review.html` (실제 후보를 넣어 자체 포함 fragment/standalone 출력)
- 시드/선택: `harness-data/battle-monster/`
- 상세 계약: [OpenWiki](../../../openwiki/harnesses/battle-monster.md)

```bash
npm run harness -- battle-monster pilot
npm run harness -- battle-monster review
npm run harness -- battle-monster --help
```

기본 자세 선택 → GPT high의 나머지 자세 저작 → 기계 검사 → 독립 검수 →
사용자의 현재 해시 선택 → 선택 팩. 에디터 UI/AI 도구 배선과 게임 설치는 별도다.
