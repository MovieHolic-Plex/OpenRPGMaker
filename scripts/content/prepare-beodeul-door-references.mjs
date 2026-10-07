import fs from 'node:fs';
const markdown=fs.readFileSync('tiledata/beodeul-door/README.md','utf8');
const refs=[{id:'beodeul-door-authoring',name:'버들항 문 열림 · 8단계',description:'16×32 손 도트 문 시안. 위아래 칸 동기화·문 앞 이벤트 분리.',
 documents:[{id:'bd-door-guide',name:'문 단계 사전·배치·시안 한계',markdown}],
 images:[{id:'bd-door-stages-image',name:'실제 문 8단계',caption:'닫힘에서 열림까지 16×32 8프레임, 6배 nearest-neighbor 확대',dataUrl:'/assets/beodeul-door/door-states-preview.png'},
 {id:'bd-door-errors-image',name:'같은 단계 / 혼합 단계',caption:'왼쪽 정상, 오른쪽 위4/아래0 혼합 오류',dataUrl:'/assets/beodeul-door/same-stage-vs-mixed.png'}]}];
fs.writeFileSync('src/assets/beodeulDoorReferences.json',JSON.stringify(refs,null,2)+'\n');
