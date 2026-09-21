# 공용 숲마을 타일 참고문서 증거

- fresh: createBlankProject()의 기본 타일셋으로 생성한 새 SQLite 프로젝트. 문서를 별도로 주입하지 않았다.
- existing: 기존 마을 프로젝트의 공용 forest_harmony에 누락된 기본 용도만 추가했다. 29개 맵은 불변.
- 양쪽 모두 공식 SQLite 저장소 API로 저장, 닫고 재개방하여 내용 확인.
- 실제 배포 UI에서 공용 forest_harmony를 선택, MD 2개와 이미지 8개의 디코딩/바이트 일치 확인.
- 기존 사용자 문서와 업로드 타일셋 보존 확인. 앱 빌드 완료.
- 요청하지 않은 gates/Vitest/전체 typecheck 및 GitHub CI는 실행하지 않았다.
