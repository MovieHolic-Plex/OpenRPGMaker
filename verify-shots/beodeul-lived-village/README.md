# 버들쉼터 · 길과 마당 구도 보정

## 정본 저장

- Project id: `3dd2427f-38dc-46e5-925b-a717dbe5bb03`
- 저장 대상: `/home/main/.local/share/oprn/assistant-house-entry-e7d2-20261004/project.sqlite`
- 맵: `map_beodeul_rest`, 54×30
- 저장 후 같은 LocalProjectStore를 닫고 다시 열어 전체 프로젝트 동등 비교: 성공
- Revision 12, SHA256 `124c2768b96efe3d2bec03b697f324374d442340c32aedcacab25f7de3b86d2d`

## 변경

원본 집 5채와 교회의 원점/3층 전체 그림은 동일하다. 문, 출입 이벤트, 시작점, 기존 문 열림/실내 출입 시험의 두 맵도 그대로다.
옛 포석 샛길 176칸을 정리하고 큰길과 우물/교회 광장, 흙 접근로와 마당을 구분했다. 포석의 반복 연석을 제거했다.
cream 집 곁에 작은 텃밭, brick 집 곁에 빨래 마당, 나무 주변에 관목/풀 군락을 적용했다. 기존 기초·뿌리·접촉/투사 그림자는 보존했다.

공용 source beodeul_ground 368칸, 기존 304칸 픽셀 불변. `naturalize_beodeul_hamlet` 조수 도구/참고문서와 신규 houseCount 시공 경로에 배선했다.
새/기존 프로젝트 모두 ground/city에서 새 MD와 정상/오류 그림을 갖는 것을 확인했다. 모든 새 지면 칸은 lower 우선순위·통행 true다.
지원 범위는 전체 집 배열/원점이 확인되는 평지 작은 마을 템플릿이다. 임의 마을을 지우는 일반 재시공 도구가 아니다.

## 화면과 확인

- `before.png`: SQLite r11의 실제 맵, 2배 최근접 확대
- `village-overview.png`: 저장 후 SQLite r12를 재로드해 실제 맵 렌더러로 그린 전체 그림, 2배 최근접 확대
- `canonical-proof.json`: 정본 저장/재로드, 모든 건물·기존 이벤트/출입 시험 유지, 반복 호출 no-op
- `common-proof.json`: 새/기존 공용 칸/문서와 저장 상한 확인
- `runtime/SUMMARY.md`: 전용 player.html, 9개 비트 실패 0, 오류 없음

런타임에서는 잔디를 가로질러 문 앞까지 지름길로 가지 않고 포장/흙/디딤돌/광장 칸으로 제한한 canMove 경로를 실제로 걸었다. 민가 5곳과 교회 문 앞, 우물 복귀를 확인했다.
SUMMARY에서 즉시 확인으로 고른 house-1/house-2 샷을 직접 열어 기존 집 보존·마당·텃밭·디딤돌·빨랫줄을 확인했다.
기계 통과는 미적 합격을 뜻하지 않는다. 지면 경계는 16px 타일 단위이며 완전한 자유 곡선이 아니다.

하네스 build/validate/review 성공. 전체 gates/vitest/typecheck는 세션 AGENTS 규칙에 따라 실행하지 않았다.
