# 굽은 지형·숲과 실제 마을 입구

- 세 공용 지역 revision4: 산촌/절벽/포구. 이슬여울과 큰 폭포 아래 마을 원본은 변경하지 않았다.
- 504–559–505 완전한 잔디 마감. 기본 바닥240 및 기존 파생 시트9칸 픽셀 유지,559만 추가. alpha/명암 변환의 정확한 출처는 `grass-joins-source.json`.
- 절벽 points에 골/돌출부를 지정하고 계단 폭2는 평탄하게 유지. 숲은 plateau 일괄 금지 대신 군집/빈터 밀도장을 사용하며 기존3행 몸통을 그대로 조립한다.
- `layout-proof.json`: 입구에서 역방향 엔진 BFS로 문앞·계단·부두·동굴·폭3 진입로 전부 도달. 7/8/8집과86/89/87오브젝트. 나무 그림 변경 없음.
- `validation.json`: 정상3종, 의도적 오류12종 정확한 좌표 검출. 새 오류는 빠진559와 막힌 맵 입구. 임의 맵 미적 품질이나 NPC 이벤트 검증은 아니다.
- `storage-proof.json`: SQLite 프로젝트44d88b94-58eb-4dee-a11a-88737da7001b, `.oprn-projects/village-diversity-20260923`, revision10. 공식 API 저장 후 닫기/재오픈, 전체 JSON 동일. 개인 DB는 git 미포함.
- `../village-diversity/`: 실제 지역3종 미리보기·다운로드·AI 행 동일, 현재 참고문서35 MD/19 이미지, 첨부 누락0·브라우저 오류0. 새/기존 프로젝트 자동 보충·편집 문서 보존·공유 포인터 보호·다운로드 왕복 확인.
- `visual-proof.json`: 실제 이미지6가지 선택, 도로/입구 표시,360px 넘침0·오류0. `crest.png`/`cliff.png`는 실제 렌더 확대이며 그림을 재생성한 것이 아니다.
- 연구3편과 적용/미구현 범위: `tiledata/forest-villages/diverse/research-layout.md`. WFC/유전 알고리즘/생태 시뮬레이터 전체를 구현했다고 주장하지 않는다.

로컬 gates/vitest/전체 typecheck는 실행하지 않았다. 참고 맵은 타일 통행 출입구를 제공하며 다른 맵으로 이동하는 이벤트는 포함하지 않는다.
