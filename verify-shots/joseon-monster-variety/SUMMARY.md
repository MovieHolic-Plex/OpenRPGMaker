# 멧돼지 재저작·조선 설화 몬스터 확장

## 즉시 확인

- `boar.png`: 실제 저장본의 기존 도깨비/멧돼지 조우. 수정한 멧돼지의 긴 몸통과 네 다리.
- `new-four.png`: 신규4종의 실제 출하 렌더러 검토 편성. 능력치/기술 그대로, tall left/top 배치.
- `native-toad-victory.png`: 저장된 들판 jb_hunt_9 접촉 → 독두꺼비 단독 전투 → 실제 승리·EXP18·금8.
- 각 `<slug>.mp4`: 실제 플레이어 녹화에서 잘라낸5개 기술 장면. 소리 없는 영상이다.

## 결과

멧돼지는 낮고 긴 몸통·긴 주둥이·엄니·짧은 네 다리로 재저작했다.
독두꺼비·방아토끼·장승귀·옹기귀를 새로 만들었다. 각 native64 RGBA 192×192, 3×3 9자세,
대기 초상은 첫 칸과 동일하다. 5종은 전체13/14/14/14/12색·알파0/255의 직접 저작 격자다.
기존14종 PNG는 바이트까지 같고, 맵의 지형/이벤트·Actor1·기존 DB 레코드·세션을 보존했다.
공용 팩은 일반16/보스3·총19종·171자세·19초상, 기술44·연출7·아이콘104다.

실제 키보드 방어12회에서 독침뱉기/공이찍기/장승울림/뚜껑닫기가 모두 자연스럽게 선택됐다.
독두꺼비는 투사체와 피해, 방아토끼는 도약/접촉/복귀와 피해, 장승귀는 전체 균열과 파티 피해,
옹기귀는 자기 방어 연출과 쇠숨 적용 문장을 보였다. 기존2종 조우는 방어21회 후 F 자동 전투로
승리·EXP57·금22·멧돼지 어금니·4인 레벨업을 보였다. F는 강제 승리가 아니다.
각 최종 실행의 페이지 오류0·HTTP 누락0이다.

## 저장·배포

- 정본 ID `f84dfa19-5b71-43f1-8523-b10910d23be7`.
- 폴더 `/home/main/z-project/rpg-zzu/.oprn-projects/joseon-starter-preset-20261004`.
- revision9 → 10(레코드/스폰) → **revision11**(소재 이름4개), SHA `c9e7b7b1de4e65bbbe002021dcc904d432d34189b076ba2755bc4d61e874f80a`.
- SQLite API 저장 → 닫기 → 같은 폴더 재오픈, 추가4종/4트룹/4기술/4연출·스폰4곳 확인, 참조 오류0.
- 들판 jb_hunt_8/9, 동굴 jb_cave_2/7의 troopId만 교체. 출현 좌표/수/그래픽은 같음.
- 새 프리셋19종/44기술/스폰을 확인. 기존 프로젝트 누락16레코드만 추가·반복 추가0·저자 수정 보존.
- player 빌드 성공, 내보내기6맵·2828자산·3236ZIP항목·외부 대체0.
- 서비스18345의 기존 디렉터리에 내보낸 파일을 갱신. 실제 게임은 `http://mdc-server:18345/player.html`.
- 조선 지도/조각 하네스 validate FAIL0/WARN0. 타일과 지도 지형은 재굽지 않았다.

## 근거와 한계

`records-storage-proof.json`, `storage-proof.json`, `pack-proof.json`, `asset-proof.json`, `preservation-proof.json`,
`boar-runtime-proof.json`, `new-four-runtime-proof.json`, `native-spawn-proof.json`,
`clip-provenance.json`, `visualization-proof.json`을 본다.
작업자2명은 격리 워크트리에서 GPT 6.1 sol high로 원본을 저작했고 루트가 시트를 직접 확인했다.
저작 과정/남은 시각 결함은 `content-packs/joseon-folklore/art-direction/wave2/`에 있다.

전투 캡처는 revision10이며 최종revision11과 DB/맵/세션이 같다. 마지막 저장은 소재 목록 이름4개만 추가했다.
신규4종을 동시에 모은 편성은 동작 검토용이다. 실제 사냥터는 해당4곳의 단독 조우를 사용한다.
최초4종 검토 편성의 이름표 겹침은 종 순서를 바꿔 해결하고 최종 편성으로 다시 녹화했다.
초기 과부하로 부팅 시간 제한에 걸려 녹화를 직렬화하고 navigation timeout120초로 조정했다.
승리 창은 마운트 직후 alpha0 검사가 먼저 실행돼 waitForVisible 조건으로 수정했다.
이들은 최종 정상 실행과 구별되는 QA 재시도다.
전체19종의 장시간 밸런스나 사용자 그림 승인을 뜻하지 않는다. gates/Vitest/전체 typecheck는 실행하지 않았다.
