# 조선 설화 기술 팩 · 첫 샘플

이 폴더만 소유하는 파일 기반 콘텐츠 후보다. `data.json`은 현재 `normalizeSkillRecord`·`normalizeStateRecord`·`normalizeElementRecords`로 만든 실제 레코드다. public 등록, 직업/적 연결, 실제 프로젝트 저장과 출하 플레이어 검토는 감독자 담당이다. SQLite·Supabase에 쓰지 않았다.

## 저장한 내용

| 직업 | 레벨1 | 레벨3 | 기력 소모 |
|---|---|---|---|
| 전사 | 장작가름: 물리 위력20 단일1타 | 쇠숨: 자기 물리 방어 계산1.6배 | 4 / 5 |
| 도적 | 쌍바늘: 위력10 계산 × 0.65 두 타 | 독묻힌 날: 물리14 + 명중 후 기본60% 독 | 4 / 5 |
| 주술사 | 잿불부: 불 위력28 | 서리부: 얼음 위력30 | 6 / 7 |
| 도사 | 생명수: HP45 회복 | 맑힘부: 독·맹독·침묵·귀봉·여우홀림 해제 | 6 / 5 |

적 기술4개: 엄니들이받기20(기력3), 짚방망이18(기력3), 한맺힌 울음(기력5, 상대전체 기본50% 귀봉), 청동내리울림32(기력0, 전체, `chargeTurns:1`). 위력은 최종 피해 숫자가 아니다. 피해는 능력치·방어·상성·방어 명령에 따라 달라진다.

예약 상태6개와 속성5개를 정의했다. 파일럿에서 부여하는 신규 상태는 쇠숨·귀봉이다. 그림자걸음·호신부·여우홀림·하늘복은 후속 기술/아이템 담당이 계약 ID로 참조할 수 있는 실제 상태 정의이며, 파일럿의 추가 습득 기술은 아니다. 상세 효과·획득·지역은 `design.json`에 있다.

## 연출·그림 출처

- 신규32px 아이콘12개: GPT 6.1 sol high가 `draw-icons.py`의 정수 좌표·고정 팔레트로 직접 저작했다. 기존 그림에 이름만 붙인 아이콘이 아니다. 원본은 `icons/*.png`, 해시는 `art-hashes.json`. 투명 RGBA이며 알파는 0/255, 개별 아이콘8색 내외다. 생성 이미지 API를 사용하지 않았다. 이 프로젝트용 신규 저작물로 외부 그림 출처는 없다.
- 전투 FX: 저장소의 `src/assets/retroClassSkills.ts`, `src/assets/retroRosterSkills/m4.ts`, `src/assets/retroMonsterSkills.ts` 및 `public/assets/generated/pixel-fx/*.png` 원본을 참조한다. `choreography-sources.json`에 기술·레이어·앵커·실제 원본 경로·SHA-256을 남겼다. 새 FX 그림을 저작했다고 주장하지 않는다.
- 실제 필드는 **`retroChoreographyId`**. 위력·기력·타수·상태는 신규 레코드의 값이며 원본 기술의 mechanic을 복사하지 않았다. 스킬 아이콘 필드는 `SkillRecord`에 없으므로 `art.json`에만 기록했다. 감독자는 원본 아이콘을 `assets/joseon-folklore/skills/<slug>.png`로 등록할 수 있다.
- 그림 검토는 `review/icons-native.png`(native), `review/icons-4x.png`(4배 nearest), `review/borrowed-fx-*.png`(원본 픽셀 샘플)에서 했다. 실제 PNG를 이미지 도구로 열었다. 원본 `mon_slam_hit.png`, `mon_wail_sky.png`, `mage_fire_burst.png`도 직접 열었다. 프레임 샘플 시트는 런타임 녹화가 아니다.

## 효과 근거와 한계

`smoke.mts`는 읽기 전용 prototype DB를 기본 프로젝트 메모리 fixture에 합쳐 확인한다. 실제 게임 DB와 다른 프로젝트는 수정하지 않는다. `smoke-results.json`의 개별20건은 정상화 왕복, 원본FX 해시, 기력 소모8기술, 2타, 상태 효과·정화·HP45회복, 적4기술, strict/gauge 청동강타 예고→발동, 부활 계약을 확인한 결과다. 부활 프로브는 메모리 전용 ID이며 배포 배열에 포함하지 않았다.

- 봉인은 **모든 기술 사용**을 막는다. 기본 공격·아이템·방어를 막지 않는다. 귀봉은 두 번째 자기 차례 시작에 풀린다. 쇠숨·지원 상태는 세 번째 자기 차례 시작에 풀린다. 라운드 전체 N턴을 보장한다는 뜻이 아니다.
- 회피는 물리 명중률에서 30%p 차감하며 마법 회피가 아니다. 호신부는 방어 계산 배율이며 최종 피해40% 감소라고 설명하지 않는다. 여우홀림은 공격0.75배이고 조종/혼란을 구현하지 않는다.
- 독은 기존 `state_poison`의 최대HP6% 턴 피해·HP1 하한·자연 회복/전투 후 유지 계약이다. 기존 상태를 새 팩에서 덮어쓰지 않는다. 기술의 상태확률은 대상 저항에 따라 달라진다.
- 부활은 엔진의 healing + `state_death` remove 계약을 확인했다(죽은 아군 HP0→40). 직업 부활은 레벨8 후속판이며 파일럿에는 넣지 않았다. consumables의 `ownskill_jf_item_*`는 작성하지 않았다.
- 기존 테스트용 `battle-v3.json`은 누락 리소스 때문에 deserialize에 실패해 쓰지 않았다. 최종 프로브는 `createBlankProject()`와 읽기 전용 prototype 레코드로 만든다. 기존 코드/fixture를 수정하지 않았다.
- 공유 node_modules가 읽기 전용이므로 vite-node 기본 실행의 `.vite-temp` 쓰기가 실패했다. 아래 esbuild 번들은 이 폴더의 무시되는 `.cache/`만 사용한다. 전체 빌드·gates·vitest·npm test·전체 typecheck를 실행한 근거는 없다.
- 실제 통합 밸런스·시전자 포즈·재생 타이밍·오프라인 패키지·정본 저장/재로드는 아직 감독자가 검토해야 한다. 메모리 프로브는 실제 게임 통합 완료 증거가 아니다.
- `status.ready`는 첫 샘플 파일 저장·개별 스모크·조수 시각 점검 완료의 뜻이다. **사용자 승인 아님**. `visual-review.json`에 검토자와 `userApproved:false`를 기록했다.

## 재생성

저장소 루트에서 실행한다. Python Pillow와 저장소 esbuild가 필요하다.

```bash
node_modules/.bin/esbuild content-packs/joseon-folklore/skills/author-data.mts --bundle --platform=node --format=esm --packages=external --alias:@=./src --outfile=content-packs/joseon-folklore/skills/.cache/author.mjs
node content-packs/joseon-folklore/skills/.cache/author.mjs
python3 content-packs/joseon-folklore/skills/draw-icons.py
node_modules/.bin/esbuild content-packs/joseon-folklore/skills/smoke.mts --bundle --platform=node --format=esm --packages=external --alias:@=./src --outfile=content-packs/joseon-folklore/skills/.cache/smoke.mjs
node content-packs/joseon-folklore/skills/.cache/smoke.mjs
```

`author-data.mts`는 ready를 false로 돌린다. PNG를 실제 이미지로 재검토하고 `visual-review.json`의 검토 해시를 갱신한 뒤 `node content-packs/joseon-folklore/skills/finalize.mjs`로 status를 **마지막에** 저장한다. 자동 재생성만으로 사용자 승인이나 시각 재검토를 얻는 것은 아니다.
