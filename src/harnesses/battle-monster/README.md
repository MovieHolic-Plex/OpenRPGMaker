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
선택은 파일 준비와 별도로 즉시 반영한다. 포장 중 Modify/Deny로 변경할 수 있고,
Allow에는 현재 선택한 종별 버전 하나, Deny에는 제외한 결과, 지난 결과에는 옛 버전을 표시한다.
전체 suite의 실제 현재 검수가 같은 원본 해시를 포함하면 poses/idle을 다시 모델에 보내지 않는다.
연구용 `references/*.png`는 저작 모델에 첨부할 수 있으며 게임 에셋/팩에는 포함하지 않는다.
`review`는 AI/개발자 진단용이며 에디터 공방 배선과 게임 설치는 별도다.

## 동시 GIF 검토와 인간형 적

사용자 화면은 8개 실제 GIF(대기/공격/피격/쓰러짐/스킬/독/기절/수면)를 동시에 보여 준다.
AI는 `wave`에서 격리된 18자세 후보를 만들고 독립 검수 후 게시한다.
기본 9자세는 `source/poses/`, 추가 9자세는 `source/actions/`이며 `suite`로 검사한다.
모든 GIF의 다시 읽은 픽셀이 원본과 일치해야 한다. 사람은 Allow/Modify/Deny로 선택한다.
