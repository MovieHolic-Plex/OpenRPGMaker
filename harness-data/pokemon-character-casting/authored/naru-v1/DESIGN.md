# 해안 측량사 나루 — 직접 저작한 필드 캐릭터

## 저작 범위

Codex GPT-6가 `naru.px.json`의 12포즈를 각각 팔레트 문자 행으로 작성했다. Python은 그 문자와 색을 일대일로 PNG/GIF에 기록하고 시트로 묶는다. 원작 PNG를 읽어 변형하거나 자동 좌우 반전하지 않는다. 사람 작가가 손으로 그렸다는 뜻은 아니다.

원작 참고: 저장소 `src/harnesses/pokemon-character-casting/references/`의 Emerald Wally, May, Hiker, Sailor, Camper, Expert male 실제 원본을 확대해 관찰했다. 원작의 16×32 칸, 칸 위 여백, 큰 머리와 작은 몸, 짧은 발, `[걸음 A, 정지, 걸음 B, 정지]` 타이밍을 참고했다. 최종 머리·얼굴·옷·가방·다리의 픽셀은 새 행으로 작성했다. 원작 몸을 입력으로 쓰지 않았다.

## 디자인과 포즈

- 작은 체형, 적갈색 단발과 비대칭 앞머리, 청록색 짧은 재킷, 아이보리 셔츠, 남색 바지, 낮은 갈색 부츠.
- 지도 가방은 캐릭터의 왼쪽. 정면에서는 화면 오른쪽, 뒷면에서는 화면 왼쪽, 왼쪽 측면에서는 크게 보인다. 오른쪽 측면에서는 몸 뒤로 일부만 보인다.
- 앞면 가방끈은 화면 왼쪽 어깨에서 오른쪽 허리로 내려가고, 뒷면에서는 반대 대각선이다.
- 왼쪽 위 광원: 머리 윗면과 앞쪽에 밝은 구리색, 뒷머리와 아래쪽에 갈색 그림자. 재킷·가방은 머리와 다른 재질의 색 덩어리로 나눴다.
- 실제 그림 높이: 정지 20px / 걸음 21px, 프레임 16×32. 14개 불투명색. 그림 축소·색 양자화 없음.
- 각 방향 두 걸음을 직접 작성했다. 정지보다 걸음의 머리와 몸통이 1px 높고, 발이 번갈아 전진한다. 팔은 같은 쪽 다리와 반대로 나간다.

## 보고 고친 부분

1. 초기 정지 자세의 머리가 몸통보다 왼쪽으로 치우쳐 보여 정면·뒷면 행을 다시 작성했다.
2. 부츠의 3행 높이가 무거워 보여 정지 포즈를 2행 부츠와 바지 끝으로 정리했다.
3. 오른쪽 걸음 A/B의 가까운 팔과 다리가 같은 쪽으로 나갔다. y23~25의 6개 행을 좌표 패치해 반대로 움직이게 고쳤다. `naru.px.json.edits.jsonl`에 전후 해시와 좌표가 있다.
4. 최종 GIF를 디코딩한 네 프레임 × 네 방향을 확인했다. 얼굴과 머리의 색 덩어리는 1px 상하 움직임 동안 유지되고, 지도 가방은 같은 쪽에 남는다.

기술 검사는 파일 규격과 프레임 연결을 확인한다. 얼굴의 매력, 의상의 취향과 동작의 만족도는 사용자의 Allow/Deny로 판단한다. 현재 후보는 승인 대기이며 실제 게임 적용·전투 초상화는 포함하지 않는다.

## 재생성

저장소 루트에서:

```sh
python3 src/harnesses/pokemon-character-casting/node/render-authored.py \
  --source harness-data/pokemon-character-casting/authored/naru-v1/naru.px.json \
  --candidate harness-data/pokemon-character-casting/authored/naru-v1/candidate.json \
  --out /absolute/review/naru
npm run harness -- pokemon-character-casting queue --bundle /absolute/review/naru
```

`recipe.json`에는 픽셀 행 전체, 원본 격자 SHA, 렌더러 SHA, 참고 자료의 목록 SHA가 들어 있다. 서버의 불변 후보 묶음에도 같은 recipe가 보존된다. 그림이나 출처가 바뀌면 새 후보로 검토한다.
