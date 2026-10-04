# 조선 설화 monsters — 첫 샘플

파일럿 4종, 일반 적 3종 + 초반 보스 1종. 최종 목표인 일반 12종 + 보스 3종 중 나머지 11종은 설계만 있으며 PNG/DB 레코드는 만들지 않았다.

| slug | 적 ID | 셀 / 시트 | 이동 | 레벨 / HP | 드롭 |
|---|---|---|---|---|---|
| wild-boar | enemy_jf_wild_boar | 64 / 192×192 | dash | 2 / 110 | boar-tusk 35% |
| straw-dokkaebi | enemy_jf_straw_dokkaebi | 64 / 192×192 | stomp | 3 / 140 | straw-knot 45% |
| maiden-ghost | enemy_jf_maiden_ghost | 64 / 192×192 | float | 5 / 145 | ghost-ash 40% |
| bronze-dokkaebi | enemy_jf_bronze_dokkaebi | 96 / 288×288 | stomp | 6 / 680 | bronze-shard 100% |

모든 드롭은 `ids.json`의 재료 ID, 승리 후 1개 드롭이다. 재료 정의/가격은 consumables 담당 소유다. 적 행동은 전원 `skill_attack` 하나, always/priority 50. 전용 스킬·상태·예고 공격은 아직 연결하지 않았다. behavior 담당이 actions를 교체한다.

## 파일과 감독자 인계

- `assets/<slug>.png`: 실제 투명 native PNG, 3×3 9포즈.
- `assets/portraits/<slug>.png`: idle_a의 픽셀을 그대로 잘라낸 일반 초상. 시트 전체를 초상으로 표시하지 않는다.
- `sheets.json`: 엔진의 PixelEnemySheet 필드 `resourceId,path,cell,motion,idleFrameMs` 배열.
- `data.json`: ProjectDatabaseInput의 `enemies` / `troops` 배열. 단독 트룹 4개, 자동 배치, 포획 불가.
- `design.json`: 지역·레벨·드롭·원본 디자인과 일반12/보스3의 설계 윤곽. `planned-only`는 미제작이다.
- `review/*-poses.png`: 격자/체커를 붙인 nearest neighbor 3배 검토본. 게임 자산으로 사용하지 않는다.
- `review/art-manifest.json`: 원본 코드 해시, 실제 PNG SHA-256, 각 포즈 픽셀 해시·색 수·알파·bounds.
- `review/asset-smoke.json`, `review/normalize-smoke.json`: 개별 스크립트 확인 근거.
- `review/VISUAL-REVIEW.md`: 작업자 직접 이미지 관찰과 한계.
- `status.json`: 모든 파일 저장 후 마지막으로 쓴 로컬 인계 상태. ready는 사용자 승인/게임 통합 완료를 뜻하지 않는다.

`sheets.json`의 path는 **향후 public 기준 경로**다. 현재 실제 PNG는 이 폴더의 `assets/`에 있다. 감독자가 원본 시트를 `public/assets/joseon-folklore/monsters/<slug>.png`에 복사하고, 초상은 별도 `portraits/`에 복사해 시트/초상 등록·내보내기를 배선해야 한다. 이 작업자는 public·레지스트리·편집기·런타임·실제 프로젝트 DB를 수정하지 않았다. 등록 전 현재 엔진이 `jf-enemy-*`를 공용 시트로 해석한다고 주장하지 않는다.

`ids.json`에는 트룹 ID 예약이 없어 `troop_jf_<slug의 하이픈을 밑줄로 바꾼 값>`을 사용했다. 기존 `troop_jb_*`는 수정하지 않는다. `battle-scenery-forest`는 실제 기존 배경 ID다.

## 원본·출처·재생성

저작: GPT 6.1 sol high monsters 작업자. 이 작업에서 직접 작성한 `source/draw.py`의 종별 좌표·면·선으로 그렸다. 최종 64/96 격자에 바로 저작했으며, 기존 고블린/몬스터 코드·그림·상용 게임 픽셀·외부 글꼴·이미지 생성 API를 사용하지 않았다. Pillow는 PNG 저장과 정수 좌표 래스터 그리기, 검토본 확대에 사용했다. 초상만 idle_a에서 정확히 잘랐다. 조선 옷/설화는 창작 모티프이며 역사 복원 도판은 아니다.

저장소 루트에서 실행:

```bash
python content-packs/joseon-folklore/monsters/source/draw.py
python content-packs/joseon-folklore/monsters/source/data.py
python content-packs/joseon-folklore/monsters/source/asset-smoke.py
node content-packs/joseon-folklore/monsters/source/run-smoke.mjs
```

필요한 환경: Python 3 + Pillow, 저장소의 기존 node_modules. 첫 두 명령은 이 monsters 폴더 안 파일만 덮어쓴다. 마지막 두 명령은 자기 데이터/그림만 검사하며 실제 프로젝트 저장이나 사용자 승인 처리를 하지 않는다. `run-smoke.mjs`는 리스너 없이 ViteNode로 실제 normalize 함수를 실행하고, main Vite config/env를 로드하지 않으며 캐시는 `/tmp`에 둔다. CLI의 `--script`가 `--config`를 지워 읽기 전용 node_modules에 캐시를 쓰려던 첫 시도는 실패했고 이 격리 실행기로 해결했다.

재저작 후 이전 `status.ready`와 시각 검토 기록을 그대로 신뢰하지 않는다. 새 PNG를 직접 열고 해시에 대응하는 검토/스모크 근거를 갱신한 후 마지막에 status를 봉인해야 한다.

## 확인 범위와 남은 일

최종 native 시트 4장을 작업자가 각각 `view_image`로 직접 열었고 확대본도 확인했다. PNG 재로드/소스 재현 36포즈, 색 14/15/16/17색, 알파 0/255, 시트/초상 픽셀, 기본 공격·드롭·stats 정상화와 JSON 왕복을 확인했다. 전체 테스트/게이트 통과 주장이나 사용자 그림 승인으로 대체하지 않는다.

실제 RM2003 플레이 화면, 등록/내보내기, 최종 직업 성장과 장비를 넣은 난도 검증은 감독자 통합 후 남는다. 청동 보스 권장 파티 5–7레벨 → 신부 11–14레벨 → 호랑이 18–20레벨이다. 신부/호랑이의 능력치·PNG는 이번 샘플에 없다. 도깨비 얼굴에는 정면 성격이 남아 있어 최종 측면성/그림 품질은 사람 검토가 필요하다.

현재 체크아웃에는 `project.sqlite`/`.mcp.json`이 없고 브라우저 IndexedDB에 연결된 도구도 없다. 이 작업의 사용자 원문/범위는 전달된 요청·고정 계약·매 작업 단위에 다시 읽은 steering 파일을 따랐다. 실제 SQLite/Supabase/다른 프로젝트는 연결하거나 쓰지 않았고, 읽기 전용 prototype-database.json의 기본 공격/적·트룹 구조를 참고했다.
