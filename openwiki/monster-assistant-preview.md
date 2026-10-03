# 고정 조수 개선 미리보기 (2026-10-03)

이 워크트리의 dist와 oh-my-pi-worker.ts를 루트의 scripts/serve-opening-assistant-preview.mjs가 사용한다.
18364는 기존9888의 저장 API를 통해 같은 프로젝트를 연다. 운영 autosweep는 변경하지 않는다.
기존 host joseon/modern/jp 및 Ultrabrain/cutscene 기능을 보존하고 실제 Pi 오프닝 생성·그림 전달·완료 검사만 통합했다.

기존 별빛섬 프로젝트가 참조하는 tex_monster_*가 host 기준선에 없어서 지도 렌더링에 실패했다.
이미 제작된 monster-kit 7장 PNG 및 카탈로그를 원래 제작 브랜치에서 함께 옮겨 frame count와16열 geometry를 등록했다.
새 프로젝트 기본값·DB 정규화는 변경하지 않았다. 신규 타일 저작이 아니라 기존 정본 의존성의 배포 보완이다.
그림은 타일 저작 하네스의 손 도트 결과이며, 원본의 조립/출처 지침은 아래 문서에 있다.
