import { charsetFrameIndex } from '../../src/assets/easyrpgRtp';
import type { EventPage, EventPageGraphic, GameEvent, GameMap } from '../../src/project/types';

type Person = {
  id: string; name: string; x: number; y: number; sprite: string; characterIndex: number;
  line: string; direction?: 'down'|'left'|'right'|'up'; movement?: 'fixed'|'random';
};

const PEOPLE: Person[] = [
  { id:'harbor-master', name:'항구 관리인', x:103, y:46, sprite:'tex_easyrpg_charset_people2', characterIndex:2, line:'배를 대려면 동쪽 부두 끝의 계류석을 확인해 주시오.' },
  { id:'north-sailor', name:'북쪽 선원', x:104, y:28, sprite:'tex_easyrpg_charset_people1', characterIndex:5, line:'오늘은 두 척 모두 물자를 싣고 들어왔소.' , direction:'right'},
  { id:'market-vendor', name:'장터 상인', x:27, y:63, sprite:'tex_easyrpg_charset_people2', characterIndex:1, line:'강 건너에서 온 토마토요. 신선할 때 골라 가시오.' },
  { id:'market-customer', name:'장터 손님', x:36, y:64, sprite:'tex_easyrpg_charset_people3', characterIndex:3, line:'성 안쪽 분수까지 길이 이어져 있군요.', direction:'left' },
  { id:'garden-keeper', name:'정원 관리인', x:85, y:66, sprite:'tex_easyrpg_charset_people3', characterIndex:6, line:'시계나무 아래는 조용히 지나가 주세요.' },
  { id:'south-guard', name:'남문 경비병', x:57, y:101, sprite:'tex_easyrpg_charset_people1', characterIndex:0, line:'남문은 해가 지면 닫힙니다. 돌아갈 생각이면 서두르시오.' },
  { id:'resting-traveler', name:'여행객', x:76, y:106, sprite:'tex_easyrpg_charset_people4', characterIndex:4, line:'배를 타고 강을 내려가면 다음 도시까지 하루면 닿는다오.', direction:'left' },
];

function graphic(sprite: string, characterIndex: number, direction: Person['direction'] = 'down'): EventPageGraphic {
  return { sprite:{type:'bundled',id:sprite}, direction, pattern:charsetFrameIndex({characterIndex,direction,pattern:1}) };
}

function page(person: Person): EventPage {
  return {
    id:`page-${person.id}`,name:person.name,conditions:[],graphic:graphic(person.sprite,person.characterIndex,person.direction),
    trigger:{kind:'action'},priority:'same',overlapForbidden:true,
    movement:{type:person.movement ?? 'fixed',speed:3,frequency:3},
    commands:[{kind:'text',speaker:person.name,body:person.line}],
  };
}

function personEvent(person: Person): GameEvent {
  return { id:`ev-castle-${person.id}`,name:person.name,placementRole:'npc',x:person.x,y:person.y,
    trigger:{kind:'action'},commands:[],pages:[page(person)] };
}

function animalEvent(id:string,name:string,x:number,y:number,characterIndex:number,line:string): GameEvent {
  const direction='down' as const;
  return {id:`ev-castle-${id}`,name,x,y,trigger:{kind:'action'},commands:[],pages:[{
    id:`page-${id}`,name,conditions:[],graphic:graphic('tex_easyrpg_charset_animal',characterIndex,direction),
    trigger:{kind:'action'},priority:'same',movement:{type:'fixed',speed:2,frequency:3},
    commands:[{kind:'text',speaker:name,body:line}],
  }]};
}

/** Adds authored life to the already painted harbor/castle map. */
export function addCastleLife(map:GameMap): void {
  map.events = [
    ...PEOPLE.map(personEvent),
    animalEvent('harbor-cat','부두 고양이',108,58,4,'생선 냄새가 나는군.'),
    animalEvent('garden-dog','정원개',92,70,5,'멍!'),
  ];
  map.locations?.push(
    {id:'second-castle-harbor-life',name:'항구 사람들',x:99,y:22,w:22,h:38,tags:['NPC','선원','부두']},
    {id:'second-castle-market-life',name:'장터 사람들',x:23,y:58,w:17,h:13,tags:['NPC','상인']},
    {id:'second-castle-south-life',name:'남문 사람들',x:50,y:98,w:31,h:13,tags:['NPC','경비','여행객']},
  );
  map.layoutPlan!.notes += ' 항구·장터·정원·남문에 상호작용 NPC와 동물을 배치함.';
}
