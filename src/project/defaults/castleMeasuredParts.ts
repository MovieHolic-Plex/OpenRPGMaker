/** Measured Castle2_5.png rectangles, in 16px cells (32 columns).
 * Screenshot-composite pixels are never a source. See openwiki/castle-map.md.
 */
export const CASTLE_MEASURED_PARTS = [
  {id:'grass',name:'잔디 중심',rect:[0,22,2,2],layer:'lower',passage:'passable'},
  {id:'water',name:'깊은 물 중심',rect:[0,24,2,2],layer:'lower',passage:'solid'},
  {id:'paving',name:'포장 마당 · 테두리 포함',rect:[12,20,6,6],layer:'lower',passage:'passable'},
  {id:'roof',name:'성채 옥상 · 난간 포함',rect:[12,0,8,6],layer:'upper',passage:'solid'},
  {id:'gate',name:'큰 아치 성문',rect:[6,6,6,6],layer:'upper',passage:'solid'},
  {id:'door',name:'작은 아치 문',rect:[4,7,2,4],layer:'upper',passage:'solid'},
  {id:'banner',name:'청색 깃발',rect:[14,14,2,5],layer:'upper',passage:'solid'},
  {id:'market',name:'장터 가판대',rect:[0,18,4,4],layer:'upper',passage:'solid'},
  {id:'fountain',name:'분수 전체',rect:[18,24,4,4],layer:'upper',passage:'solid'},
  {id:'clock-tree',name:'시계나무 전체',rect:[24,20,6,8],layer:'upper',passage:'solid'},
  {id:'statue',name:'석상과 받침',rect:[22,27,2,5],layer:'upper',passage:'solid'},
  {id:'bench',name:'벤치 전체',rect:[28,19,4,3],layer:'upper',passage:'solid'},
  {id:'lamp',name:'가로등 전체',rect:[31,22,1,6],layer:'upper',passage:'solid'},
  {id:'well',name:'우물 전체',rect:[28,28,4,4],layer:'upper',passage:'solid'},
] as const;
