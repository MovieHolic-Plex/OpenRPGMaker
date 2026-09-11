# 나무 밑동 아래 검은 구멍 — 수정 전/후 증거

## 무엇을 고쳤나

밑동 타일(290~293)은 칩에 투명 픽셀이 있는데 하위 레이어에 앉는다. 받침을 깔지 않으면
그 투명 픽셀이 캔버스 배경(`0,0,0,0`)을 드러내 **검은 사각형**이 된다.

편집기 캔버스(`chipsetTileRender.ts`)와 런타임(`playSceneMapRuntime.ts`)은 `tileBackingTile`
정책으로 잔디 받침을 깔아 왔지만, 캔버스 계열 공유 렌더러(`mapTileDraw.ts`)와 원형 전경
굽기 스크립트만 빠져 있었다.

## 그림

| 파일 | 내용 |
|---|---|
| `01-before-after.png` | 왼쪽 수정 전(밑동 아래 검정) / 오른쪽 수정 후(잔디) — 같은 칸 확대 |
| `02-archetype-before.png` | 구운 원형 전경(farm-rural) 수정 전 — 나무마다 검은 사각형 |
| `03-archetype-after.png` | 같은 전경 수정 후 — 검정 없음 |

## 실측

**마을 40x40·8채 (밑동 57칸)**

```
수정 전: 밑동 자리 검은 픽셀 6,641 (최악 143/256칸)
수정 후: 0
```

**구운 원형 전경 6장**

```
수정 전: 1.51% (farm-rural 1,249/82,944)
수정 후: 0.00% (6장 전부 0/82,944)
```

## 재현

렌더 경로가 실제로 받침을 까는지 회귀 검사한다.

```
npx vitest run test/mapTileBacking.test.ts
```

전경을 다시 굽고 검정이 0인지 본다.

```
npx vite-node scripts/bake-village-archetype-previews.mts
```
