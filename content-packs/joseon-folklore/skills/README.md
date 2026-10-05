# 조선 설화 기술 팩 · 전체판

2026-10-05: 엄니돌진·짚방망이·한의울음의 현재 배포 연출은
`enemy-choreographies.json`의 프로젝트 레코드 3종과 `skillBindings`다.
공용 생성기가 이 연결을 적용한다. 초기 `data.json`의 기본 계약은 원본으로 보존한다.
피해·기력·타수·귀봉 확률은 바꾸지 않고 접근·타격·복귀와 파동만 저작했다.
화면 근거: `verify-shots/joseon-enemy-motion/`. 다른 9개 적 기술의 연출 승인을 뜻하지 않는다.

직업24·적12 기술, 예약 상태6·기본 상태4, 속성5, 원본32px 아이콘36개다. `data.json`은 실제 `normalizeSkillRecord`·`normalizeStateRecord`·`normalizeElementRecords`를 거친 배열이다. 이 폴더에 파일 기반 후보를 저장했다. public 등록, 실제 직업/적 연결, 프로젝트 정본 저장과 출하 플레이어 검토는 감독자 담당이다.

## 직업 습득 계약

각 칸은 **이름 / 기력 소모**다. MP 필드를 사용하며 resource2를 쓰지 않는다. 학습 연결은 `design.json.learnedSkills`에 있으며 실제 직업 레코드 변경은 포함하지 않는다.

| 직업 | 레벨1 | 레벨3 | 레벨5 | 레벨8 | 레벨12 | 레벨16 |
|---|---|---|---|---|---|---|
| 전사 | 장작가름 / 4 | 쇠숨 / 5 | 돌개베기 / 8 | 땅가르기 / 12 | 피의서약 / 12 | 산의수호 / 16 |
| 도적 | 쌍바늘 / 4 | 독묻힌날 / 5 | 그림자걸음 / 7 | 급소찌르기 / 10 | 연막장막 / 13 | 달빛쌍참 / 16 |
| 주술사 | 잿불부 / 6 | 서리부 / 7 | 벼락부 / 9 | 혼빨기 / 10 | 귀봉부 / 12 | 하늘불 / 22 |
| 도사 | 생명수 / 6 | 맑힘부 / 5 | 호신부 / 8 | 되살림 / 12 | 봄비 / 16 | 하늘복 / 18 |

물리·불·얼음·번개·영성 계약 ID를 유지한다. 위력은 최종 피해가 아니다. 땅가르기·달빛쌍참·하늘불은 `chargeTurns:1`로 예고 후 다음 자기 차례에 발동한다. 피의서약은 최대HP12% 대가(HP1 하한)가 있다.

쌍바늘은 위력10 계산에 `hitSequence:[0.65,0.65]`를 적용하는 실제2타다. 공격40/대상방어20 표본은 **13+13**이다. 달빛쌍참은 위력44 계산의75%씩2타, 날개쌍격은 위력14 계산의60%씩 대상마다2타다. 원본 FX 타수를 새 레코드에 복사하지 않는다.

## 적 기술과 예고

| 기술 | 기력 | 실제 효과 | 예고 |
|---|---:|---|---|
| 엄니돌진 | 3 | 단일 물리20·1타·명중90% | 1자기차례 |
| 짚방망이 | 3 | 단일 물리18·1타·명중95% | 없음 |
| 한의울음 | 5 | 상대전체 귀봉 기본50% | 1자기차례 |
| 청동강타 | 0 | 상대전체 물리32·각1타·명중95% | 1자기차례 |
| 독이빨 | 3 | 단일 물리12·1타·명중95% + 독 기본45% | 없음 |
| 날개쌍격 | 4 | 상대전체 물리14 계산의60%씩각2타·명중95% | 없음 |
| 혼불 | 5 | 상대전체 불 정신력22·각1타·명중100% | 없음 |
| 물귀손 | 4 | 단일 영성 정신력26·1타·명중100% + 귀봉 기본35% | 없음 |
| 무덤저주 | 4 | 단일 여우홀림 기본55% | 없음 |
| 여우홀림 | 6 | 상대전체 여우홀림 기본45% | 없음 |
| 돌내리치기 | 5 | 단일 물리36·1타·명중90% | 1자기차례 |
| 대채찍 | 4 | 단일 물리20·1타·명중95% | 없음 |

적15종 제안 연결과 보스3종 표본은 `design.json`에 있다. 청동도깨비→청동강타, 신부원혼→한의울음, 산호랑이→엄니돌진이다. 공유 기술이므로 멧돼지와 처녀귀신도 같은 예고를 사용한다. 행동표는 감독자/behavior 담당이 연결한다. shared steering의 초반 적 maxMp 부족 수정은 monsters 담당 범위다. 위 비용 이상 MP를 확보해야 실제 선택할 수 있다.

## 기본 상태와 부활: 통합 시 누락만 추가

읽기 전용 prototype에서 `state_poison`, `state_deep_poison`, `state_silence`는 **실제 존재**, `state_death` 레코드는 **없음**을 확인했다. snapshot SHA-256은 `design.json.baseStateDefaults`와 `smoke-results.json`에 있다. 빈 프로젝트에서도 참조가 정상 load/save되도록 기본4개를 `data.states`에 `normalizeStateRecord` 실제 출력으로 저장했다.

| 기본 ID | 저장한 기본 정의 |
|---|---|
| `state_death` | 행동/기술 불가·전투불능, 자연/피격 회복0%, 전투 종료 시 유지, 부활로 제거 |
| `state_poison` | snapshot 독: 최대HP6% 자기차례 피해·HP1 하한, 3차례부터 자연회복20%, 전투 후 유지 |
| `state_deep_poison` | snapshot 맹독: 최대HP12% 자기차례 피해, 4차례부터 자연회복10%, 전투 후 유지 |
| `state_silence` | snapshot 침묵: 모든 기술 사용 불가, 3차례부터 자연회복30%, 전투 종료 시 제거 |

**기존 대상의 같은 ID 상태는 원래 레코드를 보존한다.** ID upsert로 덮어쓰면 안 된다. `merge-state-defaults.mts`는 기존 순서·레코드를 복제 보존하고 없는 ID만 뒤에 추가한다. prototype28행 전체 보존, 반복 적용, 별도 저자 정의 사망 상태 보존을 검사했다. 예약 상태도 같은 누락 추가 정책으로 통합할 수 있다. 기존 저자 정의가 기본값과 다른 경우 해당 프로젝트 효과를 따른다.

도사 **되살림은 레벨8 실제 기술**이다. `effect:{kind:'healing',statistic:'mind',affects:'hp'}`, `damageFormula:'60'`, `stateEffects:[{stateId:'state_death',operation:'remove',chance:100}]`를 사용한다. 실제 죽은 아군 타겟으로 HP0→60, 사망 제거, 기력12 소모를 확인했다. `ownskill_jf_item_*`는 작성하지 않았다.

## 지원 효과와 확률

- 쇠숨: 물리 방어 계산1.6배. 그림자걸음/연막장막: 물리 명중률30%p 차감, 마법 회피 없음.
- 호신부: 아군전체 물리·마법 방어 계산1.4배. 산의수호: 쇠숨+호신부를 함께 부여해 물리2.24배·마법1.4배. 고정 최종 피해감소율이 아니다.
- 귀봉: 모든 기술 사용을 막으며 기본 공격·아이템·방어는 허용한다. 2번째 자기 차례 시작에 해제된다. 여우홀림: 공격 계산0.75배, 조종/혼란 없음.
- 하늘복/피의서약: 공격·방어1.2배, 자기 차례 최대HP5% 재생. 지원 상태와 여우홀림은 3번째 자기 차례 시작 해제, 재생은 해제 직전에도 적용된다. 전역 라운드 수가 아니다.
- 맑힘부는 독·맹독·침묵·귀봉·여우홀림 제거. 봄비는 살아 있는 아군전체 HP40 회복과 독 제거만 한다. 서리부에는 빙결/행동 봉쇄가 없다.
- 부여확률은 **기본 chance × 대상 상태 저항**이다. 기존 배우의 독C=60%이므로 독묻힌날 기본60%→실제36%, 독이빨 기본45%→실제27%다. 피해기술 상태 부여는 명중 뒤 적용한다. 제거는 정의가 있으면 결정적이다. 명중 표기는 회피 적용 전이다.
- RM2003 정신력 공격도 기본 방어 항은 대상 `defense`다. 상태의 물리/마법 방어 배율 선택은 공격 통계(`attack`/`mind`)에 따른다. 새 속성 이름으로 계산식을 바꾸지 않았다.

## 원본 그림·연출 출처

- 아이콘36개: GPT 6.1 sol high가 `draw-icons.py`의 정수 좌표·고정 팔레트로 직접 저작했다. 투명 RGBA32×32, 알파0/255인 신규 도트다. 외부 그림과 이미지 생성 API를 사용하지 않았다. 원본 `icons/*.png`, SHA-256 `art-hashes.json`, 등록용 resourceId/path `art.json`.
- 전투 FX: 저장소 `src/assets/retroClassSkills.ts`, `src/assets/retroMonsterSkills.ts`, `src/assets/retroRosterSkills/{a1,b3,b5,m4,p1,p5}.ts`와 `public/assets/generated/pixel-fx/*.png` 원본 재사용. 실제 기술ID·레이어·앵커·원본 경로·SHA-256은 `choreography-sources.json`. 기존 저장소 FX 출처를 승계하며 새 FX 저작물로 주장하지 않는다.
- 실제 연결 필드는 **`retroChoreographyId`**. 위력·기력·타수·상태는 신규 레코드에 정의했다. SkillRecord에 아이콘 필드가 없어 `art.json`에만 기록했다. 감독자가 public 리소스를 등록한다.
- 원본 PNG를 이미지 도구로 직접 검토했다. `review/icons-native.png`, `icons-4x.png`와 원본 FX의 native 프레임 표본을 사용했다. 땅가르기를 불꽃 낙하→지면 균열로 수정하고 호신부를 전체아군 결계 연출/범위로 맞췄다. 검토 해시·관찰·한계는 `visual-review.json`. 정적 시트는 런타임 녹화가 아니다.

## 검사와 한계

`smoke-results.json` 개별90건: 정상화, 계약 ID/습득 수준, 기존 상태 보존, 실제 serialize→로컬 파일 저장→deserialize 재로드(참조 오류0), 기술36개의 피해/회복/타수/상태 확률/HP대가/흡수 표본, 실제 엔진의 직업24·적12 기력·대상·타수, 죽은 아군 부활, 보스3종 strict/gauge 예고→발동. 능력치는 검사 fixture이며 통합된 성장곡선 검증은 아니다.

SQLite·Supabase·다른 프로젝트·core·registry·계약을 수정하지 않았다. public 등록, 실제 게임 통합/정본 재로드, 플레이어 연출, 오프라인 출하, 최종 밸런스는 감독자 단계다. 전체 빌드/gates/vitest/npm test/전체 typecheck는 실행하지 않았다. `status.ready:true`는 **전체 파일 저장·개별 검사·조수 시각 점검 완료**이며 사용자 승인이 아니다(`userApproved:false`). 상세 보고는 `REPORT.md`.

## 재생성

저장소 루트, Python Pillow와 저장소 esbuild를 사용한다. 번들/로컬 왕복 fixture는 소유 폴더의 무시되는 `.cache/`에만 쓴다.

```bash
node_modules/.bin/esbuild content-packs/joseon-folklore/skills/author-data.mts --bundle --platform=node --format=esm --packages=external --alias:@=./src --outfile=content-packs/joseon-folklore/skills/.cache/author.mjs
node content-packs/joseon-folklore/skills/.cache/author.mjs
python3 content-packs/joseon-folklore/skills/draw-icons.py
node_modules/.bin/esbuild content-packs/joseon-folklore/skills/smoke.mts --bundle --platform=node --format=esm --packages=external --alias:@=./src --outfile=content-packs/joseon-folklore/skills/.cache/smoke.mjs
node content-packs/joseon-folklore/skills/.cache/smoke.mjs
```

author는 ready를 false로 돌린다. 실제 PNG를 재검토하고 `visual-review.json` 해시와 보고서를 저장한 뒤 `node content-packs/joseon-folklore/skills/finalize.mjs`로 status를 **마지막에** 저장한다. 재생성만으로 시각 재검토나 사용자 승인을 얻지 않는다.
