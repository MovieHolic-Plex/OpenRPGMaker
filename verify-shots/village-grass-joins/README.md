# 잔디 경계 개정3

사용자 확정: 지금 바닥색 유지, 504/505 사선과498/499/528/529 경계 색 맞춤.

- 공용 새 시트 `forest_harmony_grass_joins`: 16px·9열·9칸. 모든 새/기존 프로젝트에 등록하고 forest_harmony의 AI 문서를 공유한다.
- 기존 바닥240 원본과 아틀라스는 그대로. 504/505 알파와 모서리 그림의 비잔디 부분은 보존한다. 오른쪽712의 기존 미보정 팔레트는711에 맞춘다. 부품 출처/색 변환은 `tiledata/forest-villages/diverse/grass-joins-source.json`.
- `composition-proof.json`: 세 지도 상위 배열 동일, 바닥240 픽셀 동일, 사선 받침240 보존. 산촌12/절벽14/포구7칸. 받침 누락 좌표 검출.
- `validation.json`: 정상 세 지도와 방향/색 불일치를 포함한 의도적 오류10종의 정확한 좌표 검출. 미적 품질/실내 이벤트의 검증은 아니다.
- `storage-proof.json`: 프로젝트 `44d88b94-58eb-4dee-a11a-88737da7001b`, `.oprn-projects/village-diversity-20260923`, 공식 SQLite API revision8 저장→닫기→재오픈. 지도/타일셋/문서 전체 일치.
- `../village-diversity/`: 실제 지역3개 미리보기·다운로드·AI 전체 행 일치, 실제 AI 문서 화면(35MD/17이미지), 첨부 누락0, 페이지 오류0. 새/기존 프로젝트 및 편집본 보존, 문서 v3 교체와 세 다운로드 왕복.
- `left-after.png`, `left-before.png`, `right-after.png`, `full-*.png`, `pine.png`, `reed.png`: 실제 타일 비교 화면. 선택7개 및360px 폭 정상, 오류0.

기존 이슬여울과 큰 폭포 아래 마을의 데이터/이미지는 변경하지 않았다. 로컬 gates/vitest/전체 typecheck는 실행하지 않았다.
