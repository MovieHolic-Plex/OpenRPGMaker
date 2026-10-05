# battle-monster

일반 JRPG/RM2003 전투 몬스터의 기본 자세와 9자세 직접 도트 저작 하네스.

- 매니페스트: `harness.ts`
- CLI: `node/cli.ts` → `node/pipeline.py` (Python 3/Pillow)
- 검토 화면: `node/review.html` (실제 후보를 넣어 자체 포함 fragment/standalone 출력)
- 사용자 대시보드: `node/dashboard.py` + `dashboard.html/css/js` (Allow/Modify/Deny, 지속 작업 큐)
- 시드/선택: `harness-data/battle-monster/`
- 상세 계약: [OpenWiki](../../../openwiki/harnesses/battle-monster.md)

```bash
npm run harness -- battle-monster pilot
npm run harness -- battle-monster serve --host 0.0.0.0 --port 18346
npm run harness -- battle-monster --help
```

AI는 GPT high 저작·기계 검사·독립 검수·패킹을 맡는다. 사용자는 결과 그림을 보고
Allow/Modify/Deny를 선택한다. Modify는 원본을 보존한 새 후보를 만들어 다시 제시한다.
`review`는 AI/개발자 진단용이며 에디터 공방 배선과 게임 설치는 별도다.
