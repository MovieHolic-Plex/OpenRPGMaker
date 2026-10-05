# 조수 기능 검증

전체 10 · 통과 1 · 실패 8 · 환경 차단 1 · 미검증 0 · 미실행 0

| 기능 | 최종 | 실제 실행 | 요구 | 보존·반례 | 플레이 | 저장 | 시각 |
|---|---|---|---|---|---|---|---|
| 조회만 하기 | 환경 차단 | 통과 | 통과 | 통과 | 해당 없음 | 환경 차단 | 통과 |
| 계획만 세우기 | 통과 | 통과 | 통과 | 통과 | 해당 없음 | 통과 | 통과 |
| 첫 대사만 수정 | 실패 | 실패 | 통과 | 실패 | 통과 | 통과 | 실패 |
| 기존 NPC 이동 | 실패 | 통과 | 통과 | 실패 | 통과 | 통과 | 통과 |
| 대상 NPC만 삭제 | 실패 | 통과 | 통과 | 실패 | 통과 | 환경 차단 | 통과 |
| 아이템 가격만 수정 | 실패 | 통과 | 통과 | 실패 | 해당 없음 | 통과 | 통과 |
| 맵 이름만 수정 | 실패 | 환경 차단 | 통과 | 실패 | 해당 없음 | 통과 | 통과 |
| 숙박 요금과 안내 일치 | 실패 | 통과 | 통과 | 실패 | 통과 | 통과 | 통과 |
| 선택지 양쪽과 취소 | 실패 | 통과 | 통과 | 실패 | 실패 | 통과 | 실패 |
| 보상 한 번과 재대화 | 실패 | 통과 | 통과 | 실패 | 통과 | 통과 | 통과 |

최초 실제 모델 과제 10/10. 입력 전 기동 장애 3건은 attempts에 별도 보존한다. 재관측은 모델 재실행이 아니다.

- inspect-readonly: /home/main/.codex/worktrees/50a6/rpg-zzu/qa-runs/harnesses/assistant-capability/20261005-core-r3 (시도 3개)
- plan-readonly: /home/main/.codex/worktrees/50a6/rpg-zzu/qa-runs/harnesses/assistant-capability/20261005-core-r3 (시도 1개)
- npc-line: /home/main/.codex/worktrees/50a6/rpg-zzu/qa-runs/harnesses/assistant-capability/20261005-core-r3 (시도 1개)
- npc-move: /home/main/.codex/worktrees/50a6/rpg-zzu/qa-runs/harnesses/assistant-capability/20261005-core-r3 (시도 1개)
- npc-delete: /home/main/.codex/worktrees/50a6/rpg-zzu/qa-runs/harnesses/assistant-capability/20261005-core-r3 (시도 1개)
- item-price: /home/main/.codex/worktrees/50a6/rpg-zzu/qa-runs/harnesses/assistant-capability/20261005-item-r4 (시도 2개)
- map-rename: /home/main/.codex/worktrees/50a6/rpg-zzu/qa-runs/harnesses/assistant-capability/20261005-core-r3 (시도 1개)
- inn-price: /home/main/.codex/worktrees/50a6/rpg-zzu/qa-runs/harnesses/assistant-capability/20261005-core-r3 (시도 1개)
- dialogue-choice: /home/main/.codex/worktrees/50a6/rpg-zzu/qa-runs/harnesses/assistant-capability/20261005-core-r3 (시도 1개)
- reward-once: /home/main/.codex/worktrees/50a6/rpg-zzu/qa-runs/harnesses/assistant-capability/20261005-core-r3 (시도 1개)

## 실패·미검증 근거

- inspect-readonly: persistence: 재로드 중 공용 라이브러리 판본이 바뀌었다. 게임 내용은 같지만 동일 판본의 저장 게이트는 판정할 수 없다.
- npc-line: execution: no-model-errors: Generation failed with finish reason: PROHIBITED_CONTENT / adversarial: protected-document: 허용 범위 밖 변경: maps.map_ash_pass.upperTiles.58, maps.map_ash_pass.upperTiles.291, maps.map_ash_pass.upperTiles.308, maps.map_mist_forest.upperTiles.1, maps.map_mist_forest.upperTiles.2, maps.map_mist_forest.upperTiles.3, maps.map_mist_forest.upperTiles.4, maps.map_mist_forest.upperTiles.5, maps.map_mist_forest.upperTiles.6, maps.map_mist_forest.upperTiles.7, maps.map_mist_forest.upperTiles.8, maps.map_mist_forest.upperTiles.9, maps.map_mist_forest.upperTiles.10, maps.map_mist_forest.upperTiles.11, maps.map_mist_forest.upperTiles.12, maps.map_mist_forest.upperTiles.13, maps.map_mist_forest.upperTiles.17, maps.map_mist_forest.upperTiles.18, maps.map_mist_forest.upperTiles.19, maps.map_mist_forest.upperTiles.20 / visual: 변경 화면·새 context 렌더 완료 지도·플레이를 직접 읽었다. 플레이의 동문에서 만나자 대사와 캐릭터·대화창은 읽히고 잘림이 없다. 재캡처 지도는 E 마커와 잔디가 정상이다. 원래 적용 화면의 조수 답변이 중간에서 잘리고 PROHIBITED_CONTENT 오류가 노출돼 해당 표시를 시각 실패로 기록한다.
- npc-move: adversarial: protected-document: 허용 범위 밖 변경: maps.map_ash_pass.upperTiles.58, maps.map_ash_pass.upperTiles.291, maps.map_ash_pass.upperTiles.308, maps.map_mist_forest.upperTiles.1, maps.map_mist_forest.upperTiles.2, maps.map_mist_forest.upperTiles.3, maps.map_mist_forest.upperTiles.4, maps.map_mist_forest.upperTiles.5, maps.map_mist_forest.upperTiles.6, maps.map_mist_forest.upperTiles.7, maps.map_mist_forest.upperTiles.8, maps.map_mist_forest.upperTiles.9, maps.map_mist_forest.upperTiles.10, maps.map_mist_forest.upperTiles.11, maps.map_mist_forest.upperTiles.12, maps.map_mist_forest.upperTiles.13, maps.map_mist_forest.upperTiles.17, maps.map_mist_forest.upperTiles.18, maps.map_mist_forest.upperTiles.19, maps.map_mist_forest.upperTiles.20
- npc-delete: adversarial: protected-document: 허용 범위 밖 변경: tilesets.shared_paw_modern_interiors.$blob, tilesets.shared_refmap_crayon.$blob, tilesets.shared_refmap_snow.$blob, tilesets.shared_refmap_town_outside.$blob, maps.map_ash_pass.upperTiles.58, maps.map_ash_pass.upperTiles.291, maps.map_ash_pass.upperTiles.308, maps.map_mist_forest.upperTiles.1, maps.map_mist_forest.upperTiles.2, maps.map_mist_forest.upperTiles.3, maps.map_mist_forest.upperTiles.4, maps.map_mist_forest.upperTiles.5, maps.map_mist_forest.upperTiles.6, maps.map_mist_forest.upperTiles.7, maps.map_mist_forest.upperTiles.8, maps.map_mist_forest.upperTiles.9, maps.map_mist_forest.upperTiles.10, maps.map_mist_forest.upperTiles.11, maps.map_mist_forest.upperTiles.12, maps.map_mist_forest.upperTiles.13 / persistence: 재로드 중 공용 라이브러리 판본이 바뀌었다. 게임 내용은 같지만 동일 판본의 저장 게이트는 판정할 수 없다.
- item-price: adversarial: protected-document: 허용 범위 밖 변경: maps.map_ash_pass.upperTiles.58, maps.map_ash_pass.upperTiles.291, maps.map_ash_pass.upperTiles.308, maps.map_mist_forest.upperTiles.1, maps.map_mist_forest.upperTiles.2, maps.map_mist_forest.upperTiles.3, maps.map_mist_forest.upperTiles.4, maps.map_mist_forest.upperTiles.5, maps.map_mist_forest.upperTiles.6, maps.map_mist_forest.upperTiles.7, maps.map_mist_forest.upperTiles.8, maps.map_mist_forest.upperTiles.9, maps.map_mist_forest.upperTiles.10, maps.map_mist_forest.upperTiles.11, maps.map_mist_forest.upperTiles.12, maps.map_mist_forest.upperTiles.13, maps.map_mist_forest.upperTiles.17, maps.map_mist_forest.upperTiles.18, maps.map_mist_forest.upperTiles.19, maps.map_mist_forest.upperTiles.20
- map-rename: execution: 모델 요청 영수증은 있으나 원본 SSE done 기록이 누락되어 실행 증거를 완성할 수 없다. 이전 실행기 재시작 관측 장애는 보존·요구 판정과 구분한다. / adversarial: protected-document: 허용 범위 밖 변경: maps.map_ash_pass.upperTiles.58, maps.map_ash_pass.upperTiles.291, maps.map_ash_pass.upperTiles.308, maps.map_mist_forest.upperTiles.1, maps.map_mist_forest.upperTiles.2, maps.map_mist_forest.upperTiles.3, maps.map_mist_forest.upperTiles.4, maps.map_mist_forest.upperTiles.5, maps.map_mist_forest.upperTiles.6, maps.map_mist_forest.upperTiles.7, maps.map_mist_forest.upperTiles.8, maps.map_mist_forest.upperTiles.9, maps.map_mist_forest.upperTiles.10, maps.map_mist_forest.upperTiles.11, maps.map_mist_forest.upperTiles.12, maps.map_mist_forest.upperTiles.13, maps.map_mist_forest.upperTiles.17, maps.map_mist_forest.upperTiles.18, maps.map_mist_forest.upperTiles.19, maps.map_mist_forest.upperTiles.20
- inn-price: adversarial: protected-document: 허용 범위 밖 변경: maps.map_ash_pass.upperTiles.58, maps.map_ash_pass.upperTiles.291, maps.map_ash_pass.upperTiles.308, maps.map_mist_forest.upperTiles.1, maps.map_mist_forest.upperTiles.2, maps.map_mist_forest.upperTiles.3, maps.map_mist_forest.upperTiles.4, maps.map_mist_forest.upperTiles.5, maps.map_mist_forest.upperTiles.6, maps.map_mist_forest.upperTiles.7, maps.map_mist_forest.upperTiles.8, maps.map_mist_forest.upperTiles.9, maps.map_mist_forest.upperTiles.10, maps.map_mist_forest.upperTiles.11, maps.map_mist_forest.upperTiles.12, maps.map_mist_forest.upperTiles.13, maps.map_mist_forest.upperTiles.17, maps.map_mist_forest.upperTiles.18, maps.map_mist_forest.upperTiles.19, maps.map_mist_forest.upperTiles.20
- dialogue-choice: adversarial: protected-document: 허용 범위 밖 변경: maps.map_ash_pass.upperTiles.58, maps.map_ash_pass.upperTiles.291, maps.map_ash_pass.upperTiles.308, maps.map_mist_forest.upperTiles.1, maps.map_mist_forest.upperTiles.2, maps.map_mist_forest.upperTiles.3, maps.map_mist_forest.upperTiles.4, maps.map_mist_forest.upperTiles.5, maps.map_mist_forest.upperTiles.6, maps.map_mist_forest.upperTiles.7, maps.map_mist_forest.upperTiles.8, maps.map_mist_forest.upperTiles.9, maps.map_mist_forest.upperTiles.10, maps.map_mist_forest.upperTiles.11, maps.map_mist_forest.upperTiles.12, maps.map_mist_forest.upperTiles.13, maps.map_mist_forest.upperTiles.17, maps.map_mist_forest.upperTiles.18, maps.map_mist_forest.upperTiles.19, maps.map_mist_forest.upperTiles.20 / visual: 실제 변경·재로드 지도와 새 플레이 그림을 읽었다. 동문·여관 선택지 두 개와 여관에서 쉬자 대사가 정상으로 보인다. 실제 Esc 취소 뒤 동문에서 만나자 대화창과 다음 표시가 남아 종료 요구의 시각 실패다. 질문의 선행 대사 표현은 허용했다. / runtime: cancel: op waitFor 실패: page.waitForFunction: Timeout 10000ms exceeded.; testid 잔존: dialogue-box
- reward-once: adversarial: protected-document: 허용 범위 밖 변경: maps.map_ash_pass.upperTiles.58, maps.map_ash_pass.upperTiles.291, maps.map_ash_pass.upperTiles.308, maps.map_ember_village.events.0.pages.0.footprint, maps.map_ember_village.events.0.pages.0.animationType, maps.map_ember_village.events.0.pages.1.animationType, maps.map_ember_village.events.0.pages.1.footprint, maps.map_mist_forest.upperTiles.1, maps.map_mist_forest.upperTiles.2, maps.map_mist_forest.upperTiles.3, maps.map_mist_forest.upperTiles.4, maps.map_mist_forest.upperTiles.5, maps.map_mist_forest.upperTiles.6, maps.map_mist_forest.upperTiles.7, maps.map_mist_forest.upperTiles.8, maps.map_mist_forest.upperTiles.9, maps.map_mist_forest.upperTiles.10, maps.map_mist_forest.upperTiles.11, maps.map_mist_forest.upperTiles.12, maps.map_mist_forest.upperTiles.13

## 아직 측정하지 않은 기능

- 타일·선택 영역 저작
- 실내 생성
- 맵 간 이동 저작
- 전투
- 장기 연속 지시
- 중단·저장 충돌 복구
- 모호한 지시
- 표현·모델별 반복 성공률
