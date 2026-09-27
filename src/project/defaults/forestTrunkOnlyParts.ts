// 잎 없는 줄기 덩어리 숲 부품(forest-trees 띠의 숲 벽·숲 기둥). 첫 줄까지 줄기 그림이라 위에 숲 천장을 덮어야 숲으로 보인다 —
// 숲 띠 시공(treeKit)의 재료이지 조수가 낱개로 찍을 소품이 아니다(2026-09-27 「숲속 오두막」: place_props 로 뿌리고,
// 막히자 stamp_object 로 29번 찍어 풀밭 위에 줄기 벽만 남았다). place_props·stamp_object·공용 오브젝트 목록이 같은 목록을 쓴다.
export const TRUNK_ONLY_FOREST_GROUPS: ReadonlySet<string> = new Set(["forest-trees:forest-wall", "forest-trees:forest-column"]);

export const TRUNK_ONLY_FOREST_GUIDANCE =
  "잎이 없는 줄기 부품이라 혼자 놓으면 숲이 되지 않습니다. 숲은 place_props({material:\"활엽수\", density:\"dense\"}) 로 굽이숲 수관을 깔고, "
  + "낱그루는 「숲 나무 · 큰 참나무」「숲 나무 · 활엽수」를 쓰세요.";
