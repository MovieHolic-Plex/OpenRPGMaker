# 자연스러운 절벽 윤곽 — 솔바람 협곡 실험

## 근거 (2026-09-21 확인)

- Huftier et al., **Terrain Synthesis and Authoring based on Iso-Contours**, Computer Graphics Forum, Eurographics 2026. [저자 자료](https://h-schott.github.io/p/isos/), [논문](https://doi.org/10.1111/cgf.70389). 지형의 등고선을 직접 저작·변형하는 접근이다. 논문 자체는 급격한 수직 절벽/깊은 협곡 표현에 제약이 있다고 명시한다. 여기서는 평면 윤곽 저작 원칙만 차용한다.
- Perche et al., **Vector-Based Terrain Modelling**, Computer Graphics Forum, 2025. [논문](https://doi.org/10.1111/cgf.70160). 고수준 벡터 구조를 조작해 지형을 편집하는 접근. 16px 타일에 직접 검증된 논문은 아니다.
- Schott et al., **Terrain Amplification using Multi-Scale Erosion**, SIGGRAPH 2024. [저자/Adobe 자료](https://research.adobe.com/publication/terrain-amplification-using-multi-scale-erosion/). 큰 지형과 작은 침식 패턴을 여러 스케일로 다루는 근거. 이번 작업에서는 물리 침식 시뮬레이션을 수행하지 않는다.

## 실제 타일 구현

`plan-canyon-natural.mjs`는 큰 제어점을 smoothstep `s(t)=3t²−2t³`로 보간한다. 여기에 진폭 0.55칸의 작은 변화 `sin(0.87x+phase) sin²(πu)`를 더한다. 끝점에서는 진폭이 0이므로 고정된 다리·출입구와 충돌하지 않는다. 이는 이번 맵의 미술적 선택이며 논문에서 도출된 최적 수치가 아니다.

반올림 후 앞/뒤 두 번의 제약 투영으로 `|y[x+1]−y[x]|≤1`을 보장한다. 타일 문법이 지원하는 수평·45도 대각선만 사용하되 각 구간의 길이를 다르게 하여 긴 직선과 동일한 톱니 반복을 줄인다. 절벽 밑변은 같은 윤곽을 14행 내려서 만든다. 앞면의 시작 행·끝 행은 사선 타일의 오프셋까지 함께 계산한다.

검증은 윤곽만 평가하지 않는다. 집 앞 연결, 다리 제거 시 양안 단절, 난간 옆 낙하 방지, 나뭇잎 오토타일 일치, 줄기 원형 보존과 실제 에디터 스크린샷을 함께 확인한다. 예쁘게 보이는지는 사용자 검수 대상이다.

## 산출물

- [수정 전후 절벽 비교](canyon-natural/comparison.png)
- [실제 편집기 전체 화면](canyon-natural/after.png)
- [수정된 맵](canyon-natural/map.json) — `villages/tileset.json` + `villages/atlas.png`와 함께 사용
- [정수 윤곽 제어 데이터](canyon-natural/contours.json)
- [편집기 검증](canyon-natural/editor-proof.json), [원격 저장 후 재로드](canyon-natural/remote-proof.json)

양쪽 절벽 모두 최대 행 변화는 1칸이다. 수정 후 동일 기울기의 최장 구간은 서쪽 6칸·동쪽 7칸. 26×3 다리의 유일 연결성, 집 2채의 통행, 14칸 높이를 유지했다. 나뭇잎 변형 불일치 0, 줄기 원본 불일치 0, 난간 옆 통행 누수 0. 사용자 미술 검수는 아직 받지 않은 개정이다. 기존 공용 장소 v1은 이전 형상을 보관하며 자동으로 덮어쓰지 않았다.
