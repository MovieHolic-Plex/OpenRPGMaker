# 절벽 교정 — 큰 폭포 아래 마을 기준

잘못된 v1은 얇은 폐곡선 테두리와 2행 남면을 사용했고 좌우 사선 몸통을 구분하지 않았다.
기준 맵은 upper의 윗선→반복 면→평행 이동한 밑단이며 좌우 몸통도 다르다. 계단은 lower에서 전체 높이를 내려온다.

- `source-pixels.json`: 기준 맵 아틀라스 10칸이 번들 retro-world 원본과 RGBA 픽셀까지 동일함.
- `tiledata/forest-villages/diverse/cliff-source.json`: 기준 맵의 왼쪽/정면/오른쪽 열 전체 두 레이어 배열, 실제 좌표와 원본 프로젝트/맵 ID.
- `validation.json`: 수정 지도 3개 성공, 기존 5종과 절벽 방향·밑단·계단 끊김 3종의 정확한 오류 좌표.
- `storage-proof.json`: 정본 프로젝트 `44d88b94-58eb-4dee-a11a-88737da7001b`, `.oprn-projects/village-diversity-20260923`, revision6 저장·공식 API 재로드 및 맵/이식/문서 동일.
- `../village-diversity/distribution-proof.json`: 새 프로젝트, 정확한 기존 v1 교체, 편집된 v1 보존+v2 추가, 공유 포인터 보존, 세 다운로드 왕복.
- `../village-diversity/*-region.png`, `reference-panel.png`, `reference-errors.png`: 실제 지역/문서 화면. AI 전체 행 조회와 다운로드는 저장본과 일치하고 첨부 누락 없음.
- `visual-*.png`: 실제 지도 수정 전/후/참고 및 산촌·포구 비교. 360px 화면 넘침·스크립트 오류 없음.

공용 지역 revision2 / 용도 `diverse-villages-cliff-v2`, 34 MD/13 이미지/225개 사용 타일.
일부 집 원점과 소품은 새 절벽 면을 피하도록 재배치했다. 집·숲 원본 그림은 바꾸지 않았다.
이슬여울 및 기준 큰 폭포 아래 마을의 지도·타일셋은 수정하지 않았다.
검증 범위는 정확한 표본·열 조립·타일 통행이며 이벤트 실행이나 미적 승인 판정은 아니다.
게이트·vitest·전체 typecheck는 로컬에서 실행하지 않았다.
