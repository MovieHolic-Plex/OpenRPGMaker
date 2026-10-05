# 검객 전면 폐기 후 새 원안 · 2026-10-05

## 사용자 요청과 삭제

요청 원문: 「검객 다 지우고 다시만들어바」.
이전 검객7후보(motions-v1, reference-v3, silhouette-sd-a, silhouette-wuxia-b,
eyes-v4, eyes-sd-a, eyes-wuxia-b)를 활성 대시보드와 커밋된 저작 후보에서 제거했다.
폐기 요청은 각 실제 binding의 discard로 남겼으며, 옛 그림을 새 모델의 참고나 몸체로 쓰지 않았다.
이전3웨이브의 staging도 제거해 재게시를 막았다. 과거 원문/기록은 로컬 복구 기록에 보존한다.

실제 브라우저의 검토 대기·Allow·Deny·지난 결과 네 필터에서 옛 검객이 없음을 확인했다.
eyes-v4/reference-v3 이미지 URL도409로 거절된다. 다른 종의 Allow8개는 버전까지 보존했다.
근거: retirement-proof.json, retirement-browser-proof.json, old-candidates-removed.png.

## 새 원안과 완성 동작

- fresh-gat-v1: 실제 GPT6.1sol/high가 EMPTY source에서 팔레트와64개 격자 행을 직접 저작했다.
  검은 갓·회청색 긴 도포·검푸른 쾌자·붉은 띠, 넓은3/4 얼굴과 분리된 두 눈/눈썹을 새로 잡았다.
  parent가 없으며 폐기된 원본/팔레트를 복사하지 않았다. 네 실제 PNG로 별도 high 검수도 받았다.
- [CyanGlaz의 CC0 공개 samurai 시트](https://cyanglaz.itch.io/samuri-spritesheet-64x64)를 실제로 보고
  팔-손-검 연결과 옷의 큰 명암 면을 연구했다. 갓·도포·얼굴은 별도 저작이다.
  외부 이미지 바이트는 커밋/배포하지 않고 URL·출처·해시만 보존한다.
- fresh-gat-complete-v1: 이 새 원안의 palette/idle_a를 바이트 그대로 보존하고 나머지17자세를
  실제 GPT6.1sol/high로 직접 저작했다. 각 자세의 명시적 행과 짧은 좌표 수정 기록을 보존했다.
  전체 프레임 이동/회전/트윈이나 알고리즘 몸체 생성은 사용하지 않았다.
- 검 뽑기 → 앞으로 내딛기 → 수평 베기 → 검 거두기, 피격 반동, 몸이 실제로 누운 쓰러짐,
  낮춘 검의 기 모으기 → 칼끝과 이어진 초승달 → 흩어지는 잔광을 별도로 그렸다.
  독은 구부린 몸/독 기운, 기절은 처진 팔/움직이는 별, 수면은 닫힌 눈/낮춘 검으로 구별한다.
- 대기·공격·피격·쓰러짐·스킬·독·기절·수면의 실제 native64 GIF8개를 동시에 보여 준다.

## 사람의 선택

완성 후보는 검토 대기이며 Allow/Modify/Deny는 사용자에게 있다.
기본 자세가 아직 pending임을 확인한 뒤 제작 중간본을 활성 목록에서 내려 완성 후보 하나로
대체했다. 중간본 source와 실제 job/검수는 보존한다. 임의의 사용자 Allow는 기록하지 않았다.
이전7후보와의 비교 화면은 새 후보에 연결하지 않았다. 다른 종의 결정/현재 버전도 보존했다.
이 후보들을 게임 정본/공용 적 DB에 설치한 것으로 보고하지 않는다.

## 확인

- 하네스: 원본18개64행/64열·색 수·alpha0/255·투명 테두리·idle 접지 검사 통과.
- 첫 독립 검수는 공격의 사각 칼끝/축소된 칼집을 rework로 지적했다.
  실제 high 저작으로 그 두 군데만 다시 그렸고 다른17자세/팔레트의 바이트를 보존했다.
  이어진 검수의 검 뽑기 축/내딛기 칼날 길이 문제도 해당 두 자세에서 고쳤다.
  그때의 다른16자세/팔레트와 얼굴/갓은 보존했다.
  이전 실제 rework/공격·검 뽑기·내딛기 입력/수정 job도 보존한다.
- 실제 별도 high 재검수의 job/result/현재 binding/첨부 PNG 해시 일치 확인.
  독립 검수 추천: keep. 이는 사용자의 그림 선택이나 전투 승인과 다르다.
- 임시 게시 스크립트가 images 없는 pixels 리포트로 검수 일치를 확인하려다 한 번 실패했다.
  실제 저작/검수 결과는 보존하고 bake 리포트로 확인하여 복구했다. 실패 호출을 성공 기록으로 바꾸지 않았다.
- 원본 source 보존 후 재디코드로 동일 binding 확인. 새 idle/팔레트의 바이트 동일함도 확인했다.
- GIF8개의 모든 프레임 RGBA와 노출 시간을 원본/시간표와 다시 대조했다.
- 실제 서비스의 Allow8종/버전이 기본 자세 공개 때와 같고 옛7후보는 계속 없다.
- 실제 브라우저:1440/375/320px, GIF8개 모두 실제64px 이미지, 전체 정지/재생,
  JS 오류와 가로 overflow0. 사용자 선택 버튼은 누르지 않았다.
- 중간본:1360/375/320px의 기본 자세·Allow 안내·원본64px/표시256px 확인.
- gates/Vitest/전체 typecheck, 완성 동작 Modify 왕복과 실제 전투/정본 설치는 실행하지 않았다.

## 즉시 확인할 증거

- full18-desktop.png: 현재 완성 후보의 실제8GIF 대시보드.
- full18-paused.png: 전체 정지 후8상태의 대표 자세.
- full18-light.png: 하네스가 굽는 원본18자세의 밝은 배경 시트.
- attack.gif / skill.gif: 실제native64 원본과 시간으로 구운 공격/월광베기.
- complete-browser-proof.json: 현재 후보/선택 보존·실제 이미지·정지/재생·오류 근거.
- fresh-review.png / fresh-native.png: 빈 source에서 다시 그린 기본 자세의 얼굴 확대와1×.
- browser-proof.json / fresh-desktop.png / fresh-375.png / fresh-320.png: 기본 자세 공개 당시 근거.

현재 결과: http://100.73.251.77:18346/?candidate=wandering-swordsman%2Ffresh-gat-complete-v1
