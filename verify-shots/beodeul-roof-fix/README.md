> 철회된 시안: 사용자가 지적한 것은 기와가 아니라 stone의 박공 벽이었다. 기와는 이전으로 복원했고 현재 근거는 ../beodeul-gable-fix/README.md다.

# 버들항 지붕 기와/면 명암 보정

기와마다 반복되던 큰 밝은 줄/점, 박공 양면의 금색-자주색 분리, 성당 지붕의 밝은 가로 띠를 줄였다. 민가 5종/성당의 기존 지붕 면·실루엣·굴뚝·문/창문을 유지하고 명시적 roof mask 안에서만 6px 폭/4px 줄의 엇갈린 기와를 저작했다. 이전 revision 15 화면과 비교한 변경 픽셀은 6종 모두 해당 마스크 안이다.

## 화면

- [민가 전후](roof-comparison.png): 위 이전 / 아래 수정. 실제 정본 맵의 동일 구역/정수 2배 렌더.
- [교회 전후](church-comparison.png): 왼쪽 이전 / 오른쪽 수정.
- [전체 마을](village-overview.png): SQLite 저장 후 재로드한 프로젝트.
- [지붕 밖 픽셀 보존](roof-only-proof.json).
- [실제 플레이어 SUMMARY](runtime/SUMMARY.md): 9비트 모두 통과, 오류 0, 여섯 문앞/우물 복귀. 성당 문앞 샷에는 첨탑이 화면 밖이며 전체 지붕은 전체 마을/교회 전후에서 확인한다.

## 정본 저장

- project id: `3dd2427f-38dc-46e5-925b-a717dbe5bb03`
- 저장 대상: `/home/main/.local/share/oprn/assistant-house-entry-e7d2-20261004` 의 `project.sqlite`와 `assets/`
- revision: 16
- SHA-256: `63cc2e115090b415fba118e94339cec7a9caa9a5d2c84b921674d0a065be0870`
- 같은 API로 저장, 닫기, 재열기, loadSnapshot 전체 deepEqual 확인.
- 기존 모든 맵/층/이벤트, 시작점, 타일 통행/우선순위/graft/source 336칸 불변.
- [저장/재로드 근거](canonical-proof.json).

## 공용 배포

beodeul-architecture 하네스 build → validate → review를 실행하고 실제 비교 그림을 열었다. source 그림/카탈로그/공용 참고문서와 작은 마을/공동마당 학습 그림을 다시 생성했다. 새 프로젝트와 기존 정본 양쪽 city/ground에 새 지붕 계약이 있고 MD당 12만자 이하, 이미지 바이트를 번들 JSON에 넣지 않았음을 확인했다. 전체 테스트/게이트는 실행하지 않았다.
