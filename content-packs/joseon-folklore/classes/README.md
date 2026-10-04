# 조선 설화 직업 첫 샘플

초보·전사·도적·주술사·도사 5개 **ClassRecord 데이터**다. `data.json`의 최상위 키는 `classes` 하나이며 신규 배우·고급 직업·엔진 필드를 정의하지 않는다.

## 파일

- `data.json`: 실제 정상화 가능한 직업 5개. 초보의 전직 경로 4개, 기본 공격 1개, 네 직업 기술 24개 연결.
- `design.json`: 역할·레벨별 수치·전직 규칙·격리 체험 설계·감독자 통합 항목·외부 의존성.
- `actor1-reference.png`: 기존 Actor1 원본 해상도 참조. 배경색 키만 투명 처리, 전경 RGB 그대로.
- `classes-preview.png`: 동일 하람 그림과 실제 직업 수치를 조립한 비교 PNG. 게임 실행 화면이 아니다.
- `provenance.json`: 읽기 전용 입력·고정 계약·원본 그림·생성기·결과 파일 SHA-256.
- `smoke-proof.json`: 실제 정상화·전직·능력치·명령·습득·장비 권한 엔진 함수 실행 결과.
- `REVIEW.md`: 실제 그림 검토, 완료 범위와 한계.
- `status.json`: 첫 샘플 최종 저장 상태. `ready`는 파일 준비 상태이며 사용자 승인/실게임 통합 판정이 아니다.

## 성장과 전직

플레이 범위는 레벨 1~20이다. 엔진 정규화가 20칸 배열을 기본값으로 교체하므로 모든 능력치는 **99칸**으로 저장하며 21~99는 20레벨 값을 반복한다. 실제 배우의 `maxLevel:20`은 감독자가 설정해야 한다. 클래스에 가짜 `maxLevel` 필드를 넣지 않는다.

초보 Lv1에서 무료로 네 직업 중 하나를 확정한다. `promoteActor`의 `toClassId`는 매 선택지에 명시한다. 생략하면 첫 조건 충족 직업인 전사가 선택된다. 네 직업은 후속 전직 경로가 없다. HP/기력은 전직 시 회복하지 않으며 새 최대치를 넘으면 제한된다.

`skillIds`는 엔진의 `learnedSkills`에서 파생되는 목록이다. 습득 레벨은 네 직업 모두 **1/3/5/8/12/16**이다. 초보는 `skill_attack`만 Lv1에 익힌다. 기술 이름과 효과 정의는 skills 담당이 소유한다.

`equipmentPermissions.actorIds`와 `classIds`는 빈 목록이다. 네 직업의 `equipmentIds`는 해당 직업 초급 무기/의복 2개만 포함한다. 초보는 신규 직업 장비 허용이 없다. 장비 측에서 직업을 허용하는 경우도 OR로 허용되므로 실제 장비의 제한도 감독자가 함께 확인한다.

## 재생성

저장소 루트에서 실행한다. Python 3 + Pillow + `/usr/share/fonts/truetype/nanum/NanumGothic.ttf`가 필요하다. PNG의 원본 픽셀은 정수 좌표로 자르고 확대에는 nearest neighbor만 쓴다.

```bash
python content-packs/joseon-folklore/classes/build.py --prototype /path/to/prototype-database.json
JF_CLASSES_PROTOTYPE=/path/to/prototype-database.json node content-packs/joseon-folklore/classes/run-smoke.mjs
```

이번 입력은 `/home/main/z-project/rpg-zzu-codex-joseon-dialogue-codex-jf-content/output/jf-workers/prototype-database.json`이다. 입력을 읽기만 한다. 생성기는 `data/design/PNG/provenance`만 쓰며 `status.ready`를 자동으로 올리지 않는다. 재생성 후 PNG와 증거 해시를 다시 확인하고 status를 마지막으로 갱신한다.

전용 실행기는 `configFile:false`, `envFile:false`, HTTP/HMR/WebSocket 비활성화, `/tmp`의 독립 캐시를 쓴다. 앱 Vite 설정과 저장 브리지 플러그인을 로드하지 않는다. 첫 시도의 vite-node CLI는 `--script`가 config 옵션을 버려 읽기 전용 node_modules 쓰기에서 실패했으며, 최종 전용 실행기 실행은 exit 0이다.

## 저작·그림 출처

- 직업 레코드/수치/한국어 설계/검토 레이아웃/생성·smoke 코드: 이번 classes 담당 GPT 6.1 sol high 저작.
- 기존 그림: `public/assets/easyrpg/charset/Actor1.png`.
- 저작자: **Marina Navarro Travesset (base), VictorSena (edit)**.
- 라이선스: **CC BY 4.0**. 저장소 출처: `public/assets/easyrpg/AUTHORS.md`, `COPYING`, `public/assets/ATTRIBUTION.md`의 EasyRPG scoped runtime import 절.
- EasyRPG RTP 원본 판본: `993d88cbc78c658d348bbfa74a3b424d393d27e5`.
- 원본 SHA-256: `f20c4fffc707332d5766c816fa3a270d6b0d813c6d95e0a85466ac9d7f2a08be`.
- 새 캐릭터 sprite는 **0개**다. 참조 PNG는 원본 배경색 키를 알파 0으로 바꾸는 표시용 사본이다. 비교 PNG는 첫 하람 셀의 중앙 프레임 `(24,0)-(48,32)`를 3배 확대한다. 원본 자산은 수정하지 않는다.
- 클래스에는 그림 필드가 없으므로 새로운 resourceId나 public 등록을 만들지 않는다. 기존 엔진 의미 아이콘 선택을 그대로 사용한다.

## 통합 시 필수 확인

1. 5개 클래스를 합치고 하람 `actor_hero.classId`를 `class_jf_novice`로 바꾼다. 배우 능력치 곡선·경험치 곡선·초기 습득은 `design.integration.actorChangesRequired`에 따라 복사한다. `classId`만 바꾸면 명시적 전직 전에는 배우 자체 곡선을 사용한다.
2. `actor_scout/mage/cleric`의 초기 직업과 배우 곡선도 해당 직업 값으로 맞춘다. 기존 sprite/얼굴은 유지한다.
3. 기존 직업 선택 이벤트의 옛 클래스 ID를 계약 ID와 명시적 `promoteActor.toClassId`로 바꾼다. 확정 전 체험은 세션 복제본에서만 수행한다. 실제 세션을 왕복 전직하면 체험 기술이 영구 보존되므로 취소가 되지 않는다.
4. 전직은 기존 장비를 자동 해제한다고 가정하지 않는다. 필요하면 감독자가 옛 장비를 반환·해제하고 새 직업 초급 장비를 지급·장착한다.
5. skills 첫 샘플의 8개 직업 기술 + equipment 첫 샘플의 8개 장비를 결합한다. **나머지 16개 기술은 예약 참조**다. 엄격한 전체 참조 검증/레벨 5 이후 기술 실행은 후속 정의가 필요하다.
6. 실제 게임 전투 밸런스와 SQLite 저장·재로드는 감독자 통합 단계다. 이번 준비 완료를 정본 저장 또는 사용자 승인으로 표시하지 않는다.
