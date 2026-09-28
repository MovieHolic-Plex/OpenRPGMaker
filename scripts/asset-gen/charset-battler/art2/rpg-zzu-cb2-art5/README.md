# 2차 시전 원화 — 담당 5명

대상: `actor3-4`, `actor3-5`, `actor3-6`, `actor3-7`, `actor4-1`.

- 7종 × 3단계 × 5명 = 105개의 새 시전 원화. 머리만 원본에서 가져오고 몸통·팔·손·다리는 관절 좌표로 다시 찍었다.
- 드루이드 = 지팡이, 무도가 = 맨손, 음유시인 둘 = 단검, 금발 청년 = 검. 원래 무기 종류는 적합하여 유지했다.
- 무기를 가진 네 명의 걷기 3칸에서 무기가 사라지던 문제를 고쳤다. 원본 걷기 칩의 발 움직임을 보존한다.
- 기존 일반 시전 3칸도 새 비전 시전으로 교체했다. 음유시인 특기는 단검을 유지하는 보조 시전으로 맞췄다. 아이템 사용 시에도 반대 손에 무기를 들게 했다.
- 전투 24칸의 무기색을 캐릭터 원본 팔레트로 통일하여, 시전 21칸까지 합친 추가색을 정확히 여섯 개로 제한했다. 원본 흰색·불꽃색·금색을 함께 사용한다.
- 손의 빛은 3/5/9픽셀이다. 손 주위 5×5 영역에만 찍고 투사체는 만들지 않는다.
- 48×48, 왼쪽 방향, 마지막 불투명 행 44, 알파 0/255. 최종 시전 시트는 144×336이다.

## 재현

```bash
python3 scripts/asset-gen/charset-battler/art2/rpg-zzu-cb2-art5/draw.py
python3 scripts/asset-gen/charset-battler/build_cast.py actor3-4 actor3-5 actor3-6 actor3-7 actor4-1
python3 scripts/asset-gen/charset-battler/build.py actor3-4 actor3-5 actor3-6 actor3-7 actor4-1
```

`draw.py`는 1차 담당자의 `art/rpg-zzu-cb-art5/draw.py`에서 부위 분해와 무기 그리기 함수를 읽어 재사용한다. 원본 칩은 `public/assets/easyrpg/charset/Actor3.png`, `Actor4.png`(기존 CC-BY 출처·라이선스 유지)뿐이다. AI 생성 일러스트는 사용하지 않았다.

## 검토 자료

각 캐릭터 폴더의 `_cast_board.png`(7행×3열), `_board.png`(24포즈)를 직접 열어 검토했다. `_cast.gif`는 마법 7종을 가로로 나란히 놓고 준비→영창→방출 3단계를 칸당 160ms로 반복한다. 모든 도트는 4배 nearest로 표시한다. 기존 `_motion.gif`/`_motion-review.png`도 변경된 걷기·일반 시전으로 갱신했다.

`audit.json`은 작성 시 알파·발 기준선·크기·추가색·21칸 중복 여부 검사를 기록한다. 전투의 예비→중간→타격→후속 동작은 기존 관절 구성을 유지하고 색만 맞췄다.

런타임 배치 반전, 캐릭터 전진, 마법 프레임 연결과 브라우저 전투 녹화는 이 원화 담당의 쓰기 범위 밖이며 통합 담당자가 검증해야 한다. 프로젝트 DB 콘텐츠는 변경하지 않았다.
