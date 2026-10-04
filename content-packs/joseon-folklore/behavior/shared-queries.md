# 감독자·skills·monsters 공유 질의 / 해소 기록

## 실제 source 확보 완료

skills 전체 적 기술12개와 monsters 전체15개를 sibling 체크아웃에서 읽었다. 정확한 경로와 SHA-256은 skills-source.json/monsters-source.json/provenance.json에 저장했다. 이 사본은 실행 입력 증거이며 등록 데이터가 아니다. 실제 기술 레코드를 새로 만들지 않았다.

첫 파일럿 기술4개만 있었던 초기 질의는 해소됐다. 최신 full source에서 엄니돌진과 한의울음에 chargeTurns=1이 생겼다. 한의울음은 전체 귀봉50%를 거는 support이며 HP피해는 없다. 청동강타는 전체 물리32/MP0/chargeTurns1이다. full 행동표와 설명은 최신 source를 따른다.

## root 통합 조정 필요: 기력0인 실제 적4종

| 적 | 현재 monsters maxMp | 실제 기술 flat비용 | 양성 검사에만 사용한 MP | 조정 소유자 |
|---|---:|---:|---:|---|
| 들쥐 | 0 | 독이빨 3 | 12 | root/monsters 또는 skills |
| 멧돼지 | 0 | 엄니돌진 3 | 12 | root/monsters 또는 skills |
| 박쥐 | 0 | 날개쌍격 4 | 16 | root/monsters 또는 skills |
| 짚도깨비 | 0 | 짚방망이 3 | 12 | root/monsters 또는 skills |

실제 원본 능력치로도 strict/gauge를 실행했다. 네 종은 조건이 맞아도 기술을 선택할 수 없어 기본 공격만 사용한다. 행동표 양성 검사에만 MP를 선언했고, 원본/타 역할 파일을 수정하지 않았다. **enemyActions를 병합하는 것만으로 네 종의 실제 게임 기술은 켜지지 않는다.** root는 최종 MP 또는 실제 비용을 정합시켜야 한다. 비용은 source 계약으로 유지했으므로 behavior가 바꾸지 않는다.

새 sandbox에서는 감독자 output/jf-workers 폴더에 쓸 수 없다. 공유 질의와 최종 보고서는 이 behavior 소유 폴더에 저장하고 root에 경로를 인계한다. 사용자 승인/정본 DB 저장/공용 등록은 이 역할의 완료 근거가 아니다.

## Git 인계

공유 Git metadata도 현재 sandbox에서 읽기 전용이라 index.lock 생성이 거절됐다. 실제 feat 커밋 객체를 임시 index/objects에 생성해 full-handoff.bundle로 전달한다. root는 full-report.md의 fetch/cherry-pick 절차로 적용한다. 공유 HEAD/refs/index는 변경하지 않는다.
