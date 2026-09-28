# Actor1 0–4 전투 도트 저작

담당 브랜치: `agent/cb-art1`. 담당 캐릭터만 생성한다.

## 원본과 변경

- 원본: `public/assets/easyrpg/charset/Actor1.png`의 왼쪽 방향.
- 원작: Marina Navarro Travesset(base), VictorSena(Edit), CC BY 4.0.
- 출처·작가 링크: `public/assets/easyrpg/AUTHORS.md`의 Actor1 항목.
- 무기 형태 참고: `public/assets/easyrpg/battle-weapon/Weapon.png`, russidan (Alephman), CC BY 4.0.
- 이 작업의 수정: 머리·옷·망토·장화 원본 픽셀을 부위별로 나누고 팔·다리·무기를 1px 단위로 재저작했다.
- AI 생성 그림은 입력으로 사용하지 않는다. 외부 그림 다운로드도 없다.
- 용사(0)는 검, 마법사(1,4)는 지팡이, 기사(2,3)는 검과 서로 다른 방패다.
- 1명당 20개 전투 포즈를 다시 그렸다. 걷기 3개와 정면 1개는 원본 픽셀과 정확히 같다.
- 원본 팔레트 밖 색은 검·지팡이·마법·병에 사용하는 공용 6색 이하다.
- 48×48 셀, 왼쪽 방향, 바닥 마지막 불투명 행 44, 알파 0/255, 기존 24칸 좌표를 유지한다.

## 재현

저장소 루트에서 실행한다. Pillow가 필요하다.

```bash
python3 -B scripts/asset-gen/charset-battler/art/rpg-zzu-cb-art1/paint.py
python3 -B scripts/asset-gen/charset-battler/build.py actor1-0 actor1-1 actor1-2 actor1-3 actor1-4
python3 -B scripts/asset-gen/charset-battler/art/rpg-zzu-cb-art1/verify.py
```

`paint.py actor1-0`처럼 캐릭터 하나만 갱신할 수 있다. `--manifest`는 사용하지 않는다.

## 검토 근거

각 캐릭터 폴더:

- `_board.png`: 24포즈 4배 확인판, 직접 열어 시각 검토.
- `_motion.png`: 걷기4 → 공격4 → 마법3 → 피격3 → 승리2 순서, 3072×212 한 줄 확인판, 직접 열어 시각 검토.
- `_motion-review.png`: 같은 순서를 동작별 다섯 줄로 접은 확대 확인판.
- `_motion.gif`: 같은 16프레임 순서, 4배 nearest, 120ms/프레임, 무한 반복.

원본 머리/모자/투구/긴 머리와 망토의 식별성, 공격의 뒤→위→앞→앞아래 이동, 영창 팔의 상승과 방출,
닫힌 눈, 웅크림, 오른쪽 머리의 누운 자세를 검토했다. 검 끝의 잘림, 지팡이 보석의 바닥 잘림,
마법 상승 자세에서 지팡이를 드는 손의 전환을 수정했다. actor1-4의 팔은 검은 옷 팔레트로 별도 조정했다.

최종 빌드: 5명 모두 `통과`, exit 0.
추가 검사: 120개 원본 포즈의 포맷·알파·바닥·좌우 여백, 원본 걷기/정면 20칸의 바이트 일치,
추가색 상한, 시트 패킹의 바이트 일치, GIF 16프레임과 각 120ms를 통과했다.

공용 도구 버그는 발견하지 않았다. 런타임 재생·데모 프로젝트 저장·매니페스트 통합은 감독자 범위다.
npm/vitest/gates/typecheck와 브라우저 런타임 QA는 실행하지 않았다.
