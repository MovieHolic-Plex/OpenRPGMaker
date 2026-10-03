# joseon-baram — 조선(바람의나라풍) 칩셋 제작 하네스

번들 타일셋 `joseon_baram`(16px, 3/4 시점)의 조각(기와집·초가·문루·정자·담·성벽·나무·소품·다리)과 지도 15장(마을 20호·국내성·국내성 원작 규모·사냥터·동굴·실내 방 6·궁 내부 4)을
만드는 **기존 도구를 한 입구로 묶었다.** 새로 쓴 것은 입구(`node/cli.ts`)와 얇은 다리(`bridge.py`, 점검·목록·16구역 묶음)뿐이고,
팔레트 잠금·게이트·판정·지도 관문·빌더·재굽기는 `scripts/content/lib/joseon/` 와 `scripts/content/` 에 **제자리 그대로** 있다.
타일셋·번들 배선·참고문서·통행 규칙은 `openwiki/joseon-baram.md`. 이 문서는 **작업 순서와 함정**이다.

## 이럴 때 쓴다 / 쓰지 않는다
- 쓴다: 조선 조각을 그리거나 고친 뒤 게이트·판정을 돌릴 때 · 조선 지도를 다시 굽거나 번들(시트·타일셋·참고문서)을 재생성할 때 · 독립 리뷰어에게 적대 검수시킬 때.
- 쓰지 않는다: 버들항(`beodeul_city`)·`jp_city`·`modern4`·포켓몬풍 야외 — 타일셋마다 별도 하네스다. 에디터 화면·조수 도구는 아직 없다(`entrypoints` 는 CLI 만 true).
- 그림을 **생성하지 않는다.** 조각은 코드 도트(`tk.py`·`blocks.py`)로만 그린다. 이 하네스는 그림을 만들어 주지 않고 **그린 것을 거르고 굽는다.**

## 단계 (`npm run harness -- joseon-baram <단계>`)
| 단계 | 하는 일 | 쓰는 기존 도구 | 시간 |
|---|---|---|---|
| `palette` | 팔레트 잠금 검사: `allowed` == 램프 합집합 ∪ 그림자, 시드 색 수 일치, 옛 잠금 보존. **파일을 쓰지 않는다.** | `harness/palette.json` | 1초 |
| `validate [--deep]` | 시드가 가리키는 파일·지도 크기·조각 메타 분류·`gate.py`/`verdict.py`/`adversarial.py` 와의 시드 대조·지도 관문 임계 4프로필 대조·바람의나라 스크린샷 추적 여부. `--deep` 은 카탈로그와 판정 목록 대조 | `mapgate.py` 를 프로필별로 import | 1초 / 20초 |
| `list [pieces\|maps]` | 조각(분류·**기록된** 판정·적대 리뷰 기록)·지도(크기·산출물). `--class` `--status` `--adv` 로 거름 | `pieces_meta.json` `verdicts.json` `adversarial.json` | 1초 |
| `gate` | 조각 관문 P·E·T·L·S·A·K·TR·V. `--candidate` 는 A 만 건너뜀, `--sheets` 는 기준 옆 검수 시트, `--piece a,b` 로 좁힘, `--all` 은 ok 줄도 | `harness/gate.py` 의 `run()` | 20초 |
| `verdict <조각> <상태> "<한 줄>"` | 시트를 눈으로 본 뒤 한 줄 판정을 **현재 그림 해시**에 묶어 기록. 기록은 ledger 에도 남는다. `--dry` 는 쓰지 않음 | `harness/verdict.py` | 17초 |
| `build` | 번들 재굽기: 시트 합치기 → 참고문서 → 저장·재로드 증명 → 장소 카드 → 축소본. `--dry` 는 계획·입력·팔레트 점검만 | `scripts/content/rebuild-joseon.sh` | 70초 |
| `map <id>` | 지도 빌더 + 조각 게이트 + 지도 관문 M1~M7. 게이트 우회 환경변수(`JS_SKIPGATE`·`JS_FORCE`)가 있으면 거부 | `demo20.py` `demo_gungnae.py` `demo_gungnae_full.py` `demo_field.py` `demo_cave.py` `demo_interior.py` `demo_palace_in.py` | 40~수 분 |
| `review zones <지도id>` | 지도를 4×4 = **16구역** 원 해상도(×2) 크롭으로 자르고 구역×렌즈별 프롬프트를 쓴다 | `ADVERSARIAL.md` 의 렌즈 절을 그대로 읽는다 | 2초 |
| `review pieces` | 조각 6배 그림·기준 시트·렌즈 프롬프트 묶음(`--piece a,b` 또는 `--blocked --limit N`) | `adversarial.py` · `gate.sheets` | 20초 |
| `review record <json>` | 리뷰어 출력을 조각 현재 해시에 묶어 기록(게이트 A 입력) | `adversarial.py record` | 17초 |
| `status [--fresh]` | 팔레트·판정·적대 리뷰·번들 칸 수·지도·ledger 현황. `--fresh` 는 게이트를 돌려 현재 해시 기준으로 센다 | 위 전부 | 1초 / 20초 |

## 실내·궁 내부 키트 (조각 접두 `in_` · `pal_`)
- 방 맵(민가·주막·대장간·약방·서당·관아 + 궁 어좌전·회랑·침전·서고)은 `scripts/content/lib/joseon/demo_interior.py` · `demo_palace_in.py` 가 평면도 문자열에서 만든다(`interior_room.Room`, 벽·천장·바닥 그늘·문 밖 마당·접지 그림자를 자동 유도). 산출은 `tiledata/joseon-interior/<방id>/`(형식 `harness/EXTRA_FORMAT.md`), 방별 계획은 그 폴더 `PLAN.md`, 1차 적대 검수 목록은 `QA_ROUND1.md`.
- 합격선은 `mapgate.py` interior 프로필(`JS_PROFILE=interior`)의 I1~I7(출입구 도달·기물 접근·복제 쌍/일렬·벽 규칙·맨바닥 연속/직사각형·문 밖 마당·외곽 벽·접지 그림자·인물 위치 — 점검 본체는 `interior_checks.py`).
- 조각 판정은 같은 `gate`/`verdict` 이고, 여러 개를 한 번에 쓰려면 `in_verdict_batch.py`. 새 조각의 메타·통행은 `in_register.py`(실내 `in_meta` + 궁 `palace.meta_and_walk`)로 합친다. 검수 시트(v5 기준 옆)는 `in_review.py`.

## 시드와 기록
| 경로 | 쓰는 이 | 내용 |
|---|---|---|
| `harness-data/joseon-baram/seed.json` | 사람 | 타일셋·도구 경로·팔레트 잠금(색 수)·조각 분류·관문 목록·지도 15장(프로필·빌더·크기·시트순번)·지도 관문 임계·16구역 설정·**쓰지 말 것**·바람의나라 스크린샷 해시 |
| `harness-data/joseon-baram/ledger.json` | 하네스 | verdict·build·map·review 이력(시각·결과·해시). 손으로 고치지 않는다 |
| `scripts/content/lib/joseon/harness/{pieces_meta,verdicts,adversarial}.json` | 도구 | 조각 메타·판정·적대 리뷰 — **정본은 여기**이고 시드에 복사하지 않는다. 손으로 고치지 않는다 |
| `qa-runs/harnesses/joseon-baram/` | 하네스 | 16구역 크롭·프롬프트·지도 후보 산출(gitignore) |

환경변수: `JOSEON_BARAM_LEDGER`(ledger 경로) · `JOSEON_BARAM_RUNS`(산출 폴더) — 시험이 커밋된 기록을 건드리지 않게 하는 용도.

## 작업 순서 (조각을 고쳤을 때)
```bash
npm run harness -- joseon-baram palette                 # 0) 잠금이 멀쩡한가
npm run harness -- joseon-baram gate --candidate --piece giwa_house_6 --sheets   # 1) 기계 관문 + 검수 시트
#   → tiledata/joseon-demo/review/giwa_house_6.png 를 열어 [내 조각 | 버들항 기준 ×3] 을 같은 배율로 눈으로 본다
npm run harness -- joseon-baram verdict giwa_house_6 note "뒷사면 밝고 앞사면 어둡다, 벽 두 행. 처마 끝 들림이 기준보다 약하다"   # 2) 판정
npm run harness -- joseon-baram review pieces --piece giwa_house_6   # 3) 독립 리뷰어에게 줄 묶음 → 새 리뷰어 2명(culture·view)
npm run harness -- joseon-baram review record 리뷰어출력.json         # 4) 두 렌즈 keep 이어야 A 통과
npm run harness -- joseon-baram gate --piece giwa_house_6              # 5) A 포함 전체 관문
npm run harness -- joseon-baram map joseon_v20 --candidate             # 6) 지도(추적 파일을 안 덮음, qa-runs 로)
npm run harness -- joseon-baram review zones joseon_v20                # 7) 16구역 적대 검수
npm run harness -- joseon-baram build --dry && npm run harness -- joseon-baram build   # 8) 번들 재굽기
```
기준 실측(2026-10-03): 전체 게이트 FAIL 294/315 — 전부 `A`(적대 리뷰 기록이 20개뿐이라 현재 해시에 없음). `--candidate` 는 FAIL 0 · WARN 49.
그래서 지도 빌더(`gungnae*` 는 A 를 항상 건너뜀, `demo20` 은 `--candidate` 필요)와 번들 재굽기는 지금 A 없이 돈다.

## 지도 id 15장 (시드 `maps`, 시트순번 = 합치는 순서)
| id | 이름 | 칸 | 출력(= rebuild 입력) | 프로필 | 시트순번 |
|---|---|---|---|---|---|
| `joseon_v20` | 조선 마을 20호 | 64×56 | `tiledata/joseon-village20` | village20 | 0 (기준 시트) |
| `gungnae` | 국내성 | 96×96 | `tiledata/joseon-gungnae` | gungnae | 1 |
| `gungnae_full` | 국내성 원작 규모 | 200×208 | `tiledata/joseon-gungnae-full` | gungnae_full | 2 |
| `joseon_field` | 조선 사냥터 | 96×96 | `tiledata/joseon-field` | field | 3 |
| `joseon_cave` | 조선 동굴 | 48×48 | `tiledata/joseon-cave` | cave | 4 |
| `joseon_in_house` `_inn` `_smith` `_pharmacy` `_school` `_office` | 민가·주막·대장간·약방·서당·관아 실내 | 15×15 · 22×16 · 12×10 · 12×10 · 16×14 · 17×15 | `tiledata/joseon-interior/<id>` | interior | 5~10 |
| `joseon_in_throne` `_corridor` `_bedchamber` `_library` | 궁 어좌전·회랑·침전·서고 | 24×24 · 34×10 · 16×14 · 20×12 | `tiledata/joseon-interior/<id>` | interior | 11~14 |
- `map <id>` 는 실내 방이면 빌더에 방 이름(`<id>`)을 인자로 준다(`demo_interior.py`·`demo_palace_in.py`). 사냥터·동굴은 `demo_field.py`·`demo_cave.py` 인자 없음. 전부 추적 산출물을 덮어쓰므로 `--write` 가 필요하다.
- 합칠 때 새 조각 이름 접두어는 사냥터 `fld_`·동굴 `cav_`·실내 `in_`·궁 `pal_`이다. 새 지형(`fld_*`·`cav_*`·`in_*`·`pal_*`)의 이웃·가장자리 규칙은 `tiledata/joseon-village/piece-walk-overrides.json` 의 `terrain` 에 있다.
- 실내 방은 출입문 안쪽 칸(`extra.start`)에서 모든 걷는 칸·출입문·기물 둘레 칸에 닿아야 하고(벽에 걸린 것 제외), 사냥터는 북쪽 성문 출구 (47,0)에서, 동굴은 입구 (24,44)에서 모든 걷는 칸에 닿아야 한다(`save-joseon-baram.mjs`).

## 지도 빌드 주의 (`map`)
- 지도 출력 폴더가 `rebuild-joseon.sh` 의 **입력**이다(위 표). `joseon_v20` 은 기본이 `qa-runs/…/map-joseon_v20`(JS_OUT)이라 안전하고, 국내성 둘은 빌더가 폴더를 못 바꿔 **`--write` 로 덮어쓰기를 확인**해야 돈다(`--dry` 는 계획만).
- 마을 20호는 **기준 시트**다. `--write` 로 다시 굽거나 `build --regen-village` 를 하면 기준 시트 칸 번호가 바뀌어 이미 배포된 칸이 어긋난다(2026-10-03 실측 12,928 → 13,184칸). 새 조각은 합치기 규칙이 꼬리에 덧붙이므로 기준을 다시 구울 필요가 없다.
- 지도 관문(M1 맨 잔디 · M2 수관 · M3 물체 · M4 나무 반복 · M5 겹침 · M6 건물 밀도 · M7 나무 키)은 프로필마다 임계가 다르다(시드 `mapGate.profiles`, `validate` 가 `mapgate.py` 와 대조). 임계를 풀어 통과시키지 않는다 — 풀 때는 사유를 `mapgate.py` 주석에 적는다.

## 16구역 적대 검수 (`review zones`)
- 지도 한 장을 4×4 로 잘라 구역마다 **새 독립 리뷰어**에게 주고(렌즈 culture·view 각각), 전체 그림 한 장으로 판정받지 않는다. 프롬프트의 렌즈·출력 절은 `ADVERSARIAL.md` 를 그대로 읽어 만든다 — 문서가 바뀌면 프롬프트도 따라간다.
- 묶음은 `manifest.json` 의 `sourceSha256`(지도 그림 해시)에 묶인다. 지도가 다시 구워지면 낡은 것이다. ledger 에 지도 해시가 남는다.
- 구역 검수는 **조언**이다(게이트 A 는 조각 단위). 결함의 좌표를 감독자가 원본 해상도에서 직접 확인하고 조각을 고친 뒤 조각 단위로 다시 `review record` 한다.

## 함정
- **판정 해시 무효화.** 판정(V)·적대 리뷰(A)는 조각의 **현재 픽셀 해시**에 묶인다. 그림이 한 화소라도 바뀌면, 팔레트를 다시 잠그면(색이 바뀐다) 전부 무효가 되어 다시 써야 한다. `verdicts.json` 의 `hash` 를 손으로 맞추지 마라 — 그건 눈으로 본 적 없는 판정을 통과시키는 일이다.
- **검수 ✓ 는 보증이 아니다.** 시트를 안 본 판정, 점수 숫자 하나에 기댄 통과를 믿지 마라. 점수는 **±1 흔들린다**(같은 조각을 다시 보면 달라진다). 결함 목록과 위치를 원본 해상도에서 직접 확인한다. 같은 리뷰어를 재사용하지 말고(최대 3라운드) 3라운드 뒤에도 안 되면 사용자에게 올린다.
- **`verdict` 는 시트 없이 쓰지 못하게 막지 않고 경고만 한다.** 정면 소품(장승·솟대·석등)은 `user` 로 두어 사용자 판정을 기다린다 — 감독자가 대신 `pass` 로 올리지 않는다.
- **`/tmp` 소멸.** `/tmp/j8*` 작업물·`/tmp/vqa20`·`/tmp/joseon-reloaded.json`·`/tmp/oprn-joseon-baram-proof` 는 사라진다(2026-09-28 실측). 소스·결과는 저장소에 두고, 재굽기 증명 폴더는 매번 새로 만들어진다.
- **팔레트 문서가 둘이다.** `CONTRACT.md` 는 옛 버들항 잠금 **267색**을 말하지만 지금 `palette.json` 은 바람의나라 군집 램프 **91색**(밝은 판)이다. 옛 잠금은 `palette_beodeul.json`. 다시 잠글 때는 `python3 scripts/content/lib/joseon/harness/lock_palette_baram.py --bright` 후 시드 `palette.allowedColors` 를 고치고 V 를 전부 다시 쓴다(하네스는 다시 잠그지 않는다).
- **`gate --sheets` 는 `pieces_meta.json` 에 `refs` 가 있는 조각만** 시트를 만든다. 26개 조각은 메타가 없어 게이트는 기본값으로 돈다(경고 출력, `validate --deep` 이 센다).
- **`gate` 는 매번 카탈로그를 처음부터 굽는다(약 16~20초).** `list`·`status` 의 판정은 **기록된 값**이지 현재 해시와의 일치가 아니다. 낡았는지는 `status --fresh` 나 `gate`.
- **바람의나라 원본**(`~/third-party-assets/baram/`)은 참조 전용이다. 시드에는 해시만 있고, `validate` 가 추적 파일 중 같은 해시가 있으면 실패한다. 이 기계에 원본이 없어도 정상이다.
- **캐릭터는 생성 금지.** `public/assets/easyrpg/charset/Actor1.png` 24×32 프레임을 `people.py` 로 그대로 쓴다. 칩셋 시트에는 넣지 않는다.
- **병렬 에이전트 금지.** `build`·`map --write` 는 추적 산출물을 덮어쓴다. 워크트리 한 곳에서 한 번에 하나만 돌린다.
- 게이트·vitest 를 에이전트가 임의로 돌리지 않는다는 저장소 규칙은 그대로다(`AGENTS.md`). 이 하네스의 `gate` 는 **조선 조각 관문**이지 저장소 `npm run gates` 가 아니다.

## 파일
| 경로 | 역할 |
|---|---|
| `src/harnesses/joseon-baram/harness.ts` | 매니페스트(범위·단계·입구) |
| `src/harnesses/joseon-baram/seed.ts` | 시드 모양과 검사(브라우저·노드 공용, 파일을 안 읽음) |
| `src/harnesses/joseon-baram/node/cli.ts` | `run(argv)` — 단계 → 기존 python/bash 스폰 · 판정·재굽기·지도 ledger 기록 |
| `src/harnesses/joseon-baram/node/{paths,ledger}.ts` | 경로(환경변수 돌림) · ledger 덧붙이기 |
| `src/harnesses/joseon-baram/bridge.py` | palette·validate·list·gate·status·review 다리(기존 모듈을 import 해서 부른다) |
| `test/harnesses/joseonBaram.test.ts` | 매니페스트·시드·CLI·가벼운 단계 실행·`--dry` 계획 시험 |
