# 조선 설화 행동 AI · 첫 샘플

파일럿 4종만 실제 행동표를 저작했다. 일반 12종/보스 3종 전체 수량은 `design.json`의 설계 윤곽이다. 다른 역할의 레코드, 엔진, 등록기, 계약, live SQLite/Supabase는 수정하지 않았다.

## 행동표

| 적 | 기본 공격 | 기술 조건 / 우선순위 | 예고와 실제 효과 | 플레이어 대응 |
|---|---|---|---|---|
| 산멧돼지 | 항상 / 1 | `tusk-charge`, 차례 2+3n / 80 | 샘플 `chargeTurns=1`, 다음 자기 차례 단일 물리 HP 피해 | 준비 중 회복·방어 또는 집중 처치. 예고 문장은 단일 표적을 알려 주지 않는다. |
| 짚도깨비 | 항상 / 1 | `straw-club`, 차례 2+2n / 70 | 샘플 모으기 없음, 단일 물리 HP 피해 | 짝수 주기 전에 방어·회복. 넘어짐/불 약점을 가정하지 않는다. |
| 처녀귀신 | 항상 / 1 | `sorrow-cry`, 차례 2+3n / 80 | 샘플 `chargeTurns=1`, 다음 자기 차례 단일 mind HP 피해 | 준비 중 회복·방어. 공포·성불 조건은 없다. |
| 청동도깨비 | 항상 / 1 | `bronze-smash`, 차례 2+4n / 80; HP 0~40% / 95 | 샘플 `allEnemies`, `chargeTurns=1`; 낮은 HP에서는 주기 밖에도 준비/발동 반복 | 전체 예고 시 파티 방어/회복. HP 40% 진입 전에 HP 정비. |

- `condition`은 현재 `EnemyActionPattern` 단일 조건 그대로다. 복합 `and`, 가짜 phase 필드, 새 스위치/상태/기술 ID가 없다.
- 우선순위는 `priority*10 + 효용`의 점수다. 확률/절대 우선권이 아니다. 저HP 마무리 효용 때문에 기본 공격이 이길 수 있다.
- `turn` 조건은 **전투 차례**를 센다(strict 라운드, gauge 사이클). `chargeTurns`는 **자기 차례**를 센다. 속도와 행동불가에 따라 대응 순서는 달라진다.
- 기본 공격 `skillId:""`는 현재 엔진의 정상 표기다. `skillIds`는 normalizeEnemyRecord의 기존 투영을 따른다. 청동 기술 ID가 두 번 있는 것은 주기/HP 두 행동을 투영한 결과다.
- HP 조건은 양끝 포함이다. 40.01% 밖 / 40% 안. 이미 준비한 기술은 발동 시 행동 조건을 다시 평가하지 않는다.
- 청동의 HP 변화는 공격 선택 빈도 변화다. 새로운 능력치/변신/면역 효과를 약속하지 않는다.
- 예고 기술을 `reactions`에 넣지 않았다. 차례 밖 반격은 `chargeTurns`를 우회한다.

## 산출물과 검사

- `data.json`: 감독자가 기존 적 레코드에 병합할 `enemyActions` 4행, 행동 9개.
- `design.json`: 파일럿 조건·대응법, 일반 12/보스 3의 윤곽, 기술 의존 계약과 한계.
- `smoke-results.json`: **실제 src/battle/runtime.ts**의 메모리 실행 기록. strict/gauge 각각 4종, 실제 플레이어 공격으로 보스 HP 40% 진입, 기술 누락 fallback = 12개.
- `provenance.json`: 원본 이미지·입력·결과 SHA-256, 코드 저작 진입점, 재생성 명령.
- `status.json`: 마지막에 저장한 파일럿 준비 상태. `ready`는 산출물 준비이며 사용자 승인/통합/정본 게임 저장을 뜻하지 않는다.
- `public/assets/joseon-folklore/behavior/pilot-review.png`: 실제 행동 기록을 배치한 검토판. **출하 게임 화면이 아니다.**
- `source-poses-nearest.png`: 원본 native 9포즈를 nearest neighbor 2배로 검토하는 그림.

집중 스모크는 원본 읽기 전용 `prototype-database.json`을 메모리에 정상화한다. 긴 기록을 위해 배우 HP2000/MP100/공격20/민첩60, 장비 비움, 적 HP120/100/100/640 등의 명시적 fixture를 사용했다. HP 경계 시나리오는 첫 배우 공격140이다. 피해 비교는 원본 배우의 레벨1 HP120을 기준으로 계산한다. 기력 비용은 샘플 0, 명중100, 분산0이다. 무방어→방어의 샘플 첫 배우 피해는 멧돼지24→12, 짚17→8, 처녀21→10, 청동32→16이다. 이는 최종 기술·성장·장비 밸런스의 합격 판정이 아니다.

정상화 후 JSON 재로드에서 행동/skillIds 보존, HP 경계, 예고→발동, 청동 전체 대상 4명, 낮은 HP 주기 밖 준비, 누락 기술 기본 공격, 방어 피해 감소를 검사했다. gates/vitest/npm test/전체 typecheck는 실행하지 않았다.

## 감독자 통합 의존

실제 skills 역할의 파일은 이 체크아웃에 없다. 스모크는 `design.skillRequirements`의 **샘플 기술 fixture**를 사용하며 기술 레코드를 팩에 중복 등록하지 않는다. 기술 담당과 다음을 대조한다.

| 계약 ID | 샘플 scope | 필요한 예고 |
|---|---|---|
| `skill_jf_enemy_tusk_charge` | enemy | chargeTurns=1 |
| `skill_jf_enemy_straw_club` | enemy | 없음 |
| `skill_jf_enemy_sorrow_cry` | enemy | chargeTurns=1 |
| `skill_jf_enemy_bronze_smash` | allEnemies | chargeTurns=1 필수 |

위력/기력/범위가 실제 레코드와 다르면 데이터와 설명을 실제 효과에 맞춰 조정하고 재실행해야 한다. 특히 bronze-smash가 allEnemies/chargeTurns=1이 아니면 이 샘플의 전체 예고 계약을 충족하지 못한다. 새 몬스터 그림은 monsters 역할 담당이며, 여기의 원본 참고 그림을 이름만 바꿔 등록하지 않는다. public 등록·게임 저장·게임 화면 QA·사용자 선택은 감독자가 한다.

## 저작 출처와 재생성

새 행동/설계/검사/검토판은 이 세션 behavior 작업자의 코드 저작이다. 이미지 생성 API를 쓰지 않았다. 기존 도트 `boar-tusk`, `goblin-scout`, `ghost-pale`, `goblin-brute`를 원본 그대로 직접 열어 보고 검토판에 표시했다. 원본은 `public/assets/generated/pixel-enemies/`, 코드 진입점은 `scripts/asset-gen/pixel-enemy/redraw/{organic,humanoid,arcane}.py`다. 새 그림의 저작권이나 외부 재배포 권한을 주장하지 않는다. 정확한 입력과 이미지 해시는 `provenance.json`이다.

저장소 루트에서 실행한다(Pillow, Node, 저장소 esbuild 필요):

```bash
python3 scripts/content/joseon-folklore/behavior/author-pilot.py
node scripts/content/joseon-folklore/behavior/run-smoke.mjs
python3 scripts/content/joseon-folklore/behavior/render-review.py
```

원본 DB 경로가 다르면 `run-smoke.mjs --prototype=/absolute/path/prototype-database.json`을 쓴다. 스모크는 번들 하나를 `/tmp`에 만들고 지우므로 공유 node_modules의 Vite 캐시를 쓰지 않는다. 재생성 후 PNG를 직접 검토하고 `status.json`을 마지막에 갱신한다. 기존 ready 파일을 새 검토 승인으로 해석하지 않는다.
