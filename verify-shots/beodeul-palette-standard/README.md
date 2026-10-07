# 따뜻한 황록 · 공용 색 기준 정리

## 반영 내용

- 사용자 선택 `warm`: 나무 형태·뿌리·그림자를 고정한 색 비교에서 선택한 따뜻한 황록.
- `tiledata/beodeul-ground/PALETTE-STANDARD.md`: 나뭇잎·밝은 원본 잔디·원본 기와/목재·건물별 벽 재질의 역할과 적용 순서.
- `tiledata/beodeul-ground/palette-standard/standard.json`: 전체 RGBA 색 치환표. 대표색 세 개는 실제 픽셀 분포 표본이며 색 수 제한이 아니다.
- 공용 번들 `src/assets/beodeulGroundReferences.json`: 문서 5개와 정상/오류 이미지 2개. 기본 참고문서 생성기는 이 fragment를 보존한다.
- 새 프로젝트에 쓰는 city/ground 생성 함수와 기존 정본의 두 타일셋에서 해당 문서/이미지의 내용 일치를 확인했다.

## 정본 저장·별도 프로세스 재로드

- project id: `3dd2427f-38dc-46e5-925b-a717dbe5bb03`
- 저장 대상: `/home/main/.local/share/oprn/assistant-house-entry-e7d2-20261004/project.sqlite`
- 최종 revision: `20`
- SHA-256: `0fb84cb66753500a8330a3cd7647ccffc11b2add9bb387b9ba49be66551cd927`
- 증거: `canonical-proof.json`, `fresh-proof.json`.
- 모든 맵·이벤트·시작점과 두 타일셋의 참고문서 이외 전체 메타데이터를 revision 18 원본과 대조해 일치를 확인했다.

기존 `ensureBeodeulGroundReferences` 호출은 표시 우선순위까지 갱신했다. revision 19에서 발견한 이 부수 변경은 revision 20에서 원본 메타데이터로 복구했다. 저장 스크립트도 참고문서만 병합하도록 수정했다. 최종 재로드 검사는 우선순위뿐 아니라 참고문서 이외 전체 타일셋 필드를 대조한다.

## 그림 검수와 범위

`public/assets/beodeul-ground/palette-standard-error.png`를 직접 열었다. 왼쪽은 선택한 정상 색, 오른쪽은 색조 공식을 바닥 잔디까지 잘못 적용한 실제 변조다. 실제 픽셀 차이를 기록했으며 나무 본체 안에서만 색을 치환해야 하는 이유를 보여 준다.

이번 반영 범위는 공용 색 기준과 조수 참고문서다. 게임 아틀라스의 나무 픽셀은 후속 그림 적용 대상이며 이번 저장에서 교체하지 않았다. 전체 gates/vitest/typecheck는 실행하지 않았다.
