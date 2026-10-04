# 조선 설화 적3종 추가 교정 — 2026-10-05

사용자 지시: **“숲은 현재가 낫고, 적은 후보가 낫다. 적이나 좀 더 고치자.”**
현재 숲을 유지하고 후보의 비례·도트 방향으로 산멧돼지·볏짚 도깨비·처녀귀신3종을 교정했다.
요청한 GPT 6.1 sol high 작업자의 격자 원본을 감독자가 직접 열어 검토하고 공용 팩에 통합했다.

## 바로 볼 화면

- `01-before-three.png`: 수정 전3종, 실제 전투 렌더러의 비교용 편성.
- `02-refined-three.png`: 교정3종, 같은 배경·편성·플레이어 설정. 임시3종 편성은 SQLite에 저장하지 않았다.
- `03-shipped-encounter.png`: 내보낸 정본 게임에 원래 저작된 도깨비+멧돼지2종 조우. 그림 요청을 가로채지 않았다.
- `04-battle-result.png`: 교정3종이 실제 공격/피격/쓰러짐을 거친 전투 결과.

교정 전투/수정 전/자세 선택·공격 재생:
http://100.73.251.77:8811/2026/10/04/01a10467-e079-7e92-83c5-234af352260e/joseon-enemy-refinement.view.html

플레이 미리보기: http://mdc-server:18345/player.html

## 그림 변경

각3종은 native64 RGBA,192×192의3×3 시트와64×64 초상이다.
대기3칸 → 준비/이동/공격 → 회복/피격/쓰러짐의27개 자세를 문자 격자로 직접 저작했다.
얼굴·엄니·볏짚·손·주름을 정리하고 포즈 사이 몸통 틈과 손잡이 단절을 수정했다.
공용 리소스 ID·전투 수치·행동·나머지12종·지형을 유지한다.

공용 저작 원본은 `content-packs/joseon-folklore/art-direction/monsters/refinement/`.
`monsters/source/refined-grids/`와 `refined.py`를 기존 `draw.py`에 연결해 재생성도 새 그림을 사용한다.
기존 worker의 검토/상태는 과거 기록으로 보존하고 새 근거와 구분했다.

## 정본 저장/재로드

- Project ID: `f84dfa19-5b71-43f1-8523-b10910d23be7`
- 저장 대상: `/home/main/z-project/rpg-zzu/.oprn-projects/joseon-starter-preset-20261004/project.sqlite`
- SQLite store API로 revision5 문서를 그대로 저장하고 닫은 뒤 다시 열었다: **revision6**.
- 문서 SHA: `87f5c3ed9d61b69bf429e75927f66cd274094c209cd095906d893b92afb0a4dc` (변경 없음).
- `serializeForComparison` 일치, 참조 오류0. 공용 builtin 경로가 그림을 소유하므로 프로젝트별 업로드가 필요 없다.
- `storage-proof.json`, `preservation-proof.json`: 보호한112개 파일이 같고3종의 배포 PNG가 원본과 일치한다.
- 재로드한 게임으로 웹 내보내기를 재생성하고 미리보기 서비스에 반영했다.

## 확인

- `asset-contract.json`: 기존 PNG 검증으로15시트/135자세/15초상 원본 재현, 경계·알파·9개 고유 자세·ID를 확인했다. 그래픽 품질 판정과 구분한다.
- `runtime-proof.json`: 출하 player.html에서3종 비교와 원래2종 조우 각3비트. 런타임 오류/404/비트 실패0.
- 비교 전투에서는10번의 키보드 방어 뒤 F 자동 전투를 사용했다.3종 모두 준비·이동·공격·회복·피격·쓰러짐 칸이 실제 DOM에서 관측됐다. 단순 강제 승리나 셀 이미지 합성이 아니다.
- HTTP로 읽은3종 시트 SHA가 public 원본과 일치한다.
- `visual-proof.json`, `pose-visual-proof.json`:736/320px,3탭에서 로드·넘침·JS 오류 없음. 각3종9칸이 실제로 바뀌고 공격 재생 후 대기로 돌아온다.
- `npm run build:player` 완료. SDK artifact `c2a4f5ac97b77a87`, source `859e4feb89e0efaa`, schema4,407파일+36런타임 에셋.
- gates/Vitest/전체 typecheck는 이번 지시에 없어 실행하지 않았다.

## 한계

이번 교정은3종이다. 나머지12종의 그림 완성도와 장시간 게임 밸런스까지 합격으로 확대하지 않는다.
멧돼지의 조각 같은 털 명암, 얕은 도깨비 얼굴 회전과 망토처럼 읽힐 수 있는 볏짚, 귀신의 겹친 소매는
작업자 `REVIEW.md`에 구체적으로 남겨뒀다. 최종 사용자 그림 승인과 동작 확인은 별개다.

전투 캡처는 키보드 입력을 확인했다. 이 뷰포트에서 방어 버튼의 포인터 클릭은 메뉴 컨테이너에
가로막혔고 키보드 Enter로 실행했다. 포인터 입력 전체를 통과했다고 주장하지 않는다.
