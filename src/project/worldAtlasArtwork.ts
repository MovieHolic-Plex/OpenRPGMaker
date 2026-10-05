import {atlasRoomAir,atlasRoomDimensions} from './worldAtlasGeometry';

/** Original terrain cartography; settlements continue to use the approved shared icons. */
function trees(x:number,y:number,w:number,h:number):string{
  let s='';for(let yy=y;yy<y+h;yy+=16)for(let xx=x;xx<x+w;xx+=18){
    const dx=Math.sin(xx*yy)*3,dy=Math.cos(xx+yy)*4;
    s+=`<ellipse cx="${xx+dx}" cy="${yy+dy+5}" rx="8" ry="7" fill="#537762" opacity=".22"/><path d="M${xx+dx-6} ${yy+dy+4}q-3-9 4-12q7-4 9 4q5 8-5 10z" fill="#588064"/><path d="M${xx+dx-3} ${yy+dy-3}q3-5 6-3" fill="none" stroke="#91b079" stroke-width="2"/>`;
  }return s;
}
function mountains(x:number,y:number,count:number):string{
  let s='';for(let i=0;i<count;i++){const xx=x+i*28,yy=y+Math.sin(i*1.8)*9;
    s+=`<path d="M${xx-22} ${yy+20}l22-42 23 42z" fill="#889888"/><path d="M${xx-22} ${yy+20}l22-42 1 42z" fill="#bcc3a6"/><path d="M${xx-10} ${yy-4}l10-18 10 18-10-5z" fill="#eee8cb"/>`;
  }return s;
}
export function atlasCartographicTerrain(stage:boolean):string{
  const coast=stage?'M76 422Q58 280 137 228Q179 196 263 231Q360 192 422 274Q466 343 414 446Q323 503 186 495Q105 488 76 422Z M414 264Q421 178 501 137Q595 110 685 177L795 139Q893 173 887 255Q898 331 809 357Q742 328 685 346Q588 388 504 339Z M659 83Q698 52 752 78Q781 126 735 137Q687 148 659 83Z M224 211Q225 180 263 176Q301 173 314 201Q318 238 280 246Q239 249 224 211Z':
    'M67 447Q49 392 91 322L73 258Q85 213 148 208L174 147Q217 136 255 166L294 113Q350 87 401 119L451 94Q518 72 559 110L605 122Q628 95 679 105L718 85Q777 90 797 128Q866 120 892 172L877 220Q910 266 870 315L830 342Q845 413 785 447L710 449Q673 489 606 460L538 492Q471 528 424 501L358 541Q300 553 272 508L184 513Q118 488 67 447Z';
  let s=`<rect x="24" y="68" width="912" height="516" fill="${stage?'#86becb':'#a3c4c6'}"/><path d="${coast}" transform="translate(0 11)" fill="#779b88"/><path d="${coast}" fill="${stage?'#b0c982':'#b8c99a'}" stroke="#e0d8ad" stroke-width="7"/><defs><clipPath id="atlas-land"><path d="${coast}"/></clipPath></defs><g clip-path="url(#atlas-land)">`;
  if(stage){
    s+='<path d="M405 124H903V263H717L638 294H486Z" fill="#ccd09b"/><path d="M748 98H908V295L819 261Z" fill="#b8b59e"/>';
    s+=trees(375,304,198,65)+trees(130,277,74,95)+mountains(709,227,5);
    s+='<path d="M248 332q34-68 74-29q40 52 82 27q-4 49-52 64q-64 21-104-62" fill="#94b975"/><path d="M271 324q15-30 30-25" stroke="#c5d797" stroke-width="4" fill="none"/>';
  }else{
    s+='<path d="M78 455Q155 331 225 296Q258 216 340 222Q413 296 365 466L307 526H122Z" fill="#a1bd8a"/><path d="M321 106Q449 79 590 128L621 205Q548 210 497 179L374 191Z" fill="#cbd1ad"/>';
    s+=trees(118,263,133,97)+trees(365,367,137,73)+trees(739,187,107,88)+mountains(321,173,10);
    s+='<path d="M642 168Q609 226 653 259Q721 280 745 334Q755 397 697 463" fill="none" stroke="#71a4b6" stroke-width="19"/><path d="M641 165Q609 226 653 259Q721 280 745 334Q755 397 697 463" fill="none" stroke="#aed0cc" stroke-width="3"/><path d="M660 257q-39-44-78-13q-32 38 9 67q67 40 89-15z" fill="#80b0bc" stroke="#d2d4ad" stroke-width="4"/>';
  }
  s+='</g>';for(let i=0;i<27;i++){const x=44+(i*137)%872,y=92+(i*89)%469;s+=`<path d="M${x} ${y}q8-3 18 0m-12 5h7" stroke="#dae9d9" stroke-width="1" fill="none" opacity=".5"/>`;}
  return s;
}

/** The minimap silhouette uses the SAME air cells as the saved side view room. */
export function atlasRoomArtwork(index:number,x:number,y:number,w:number,h:number,image:string|undefined,active:boolean):string{
  const dims=atlasRoomDimensions(index),cw=w/dims.width,ch=h/dims.height,n=(v:number)=>Math.round(v*100)/100;
  let area='',border='';for(let ry=0;ry<dims.height;ry++)for(let rx=0;rx<dims.width;rx++)if(atlasRoomAir(rx,ry,dims.width,dims.height,index)){
    const xx=n(x+rx*cw),yy=n(y+ry*ch);area+=`M${xx} ${yy}h${n(cw+.03)}v${n(ch+.03)}h-${n(cw+.03)}z`;
    for(const [dx,dy,seg]of[[0,-1,`M${xx} ${yy}h${n(cw)}`],[1,0,`M${n(xx+cw)} ${yy}v${n(ch)}`],[0,1,`M${xx} ${n(yy+ch)}h${n(cw)}`],[-1,0,`M${xx} ${yy}v${n(ch)}`]] as const)if(!atlasRoomAir(rx+dx,ry+dy,dims.width,dims.height,index))border+=seg;
  }
  const color=index<5?'#527e82':index<8?'#527969':'#77698b';
  return `<defs><clipPath id="atlas-room-${index}"><path d="${area}"/></clipPath></defs><path d="${area}" fill="${color}"/>`+
    (image?`<image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none" opacity=".23" clip-path="url(#atlas-room-${index})" href="${image}"/>`:'')+
    `<path d="${border}" fill="none" stroke="${active?'#e1bf79':'#a8b8a3'}" stroke-width="${active?3:1.4}"/>`;
}

// Existing editor UI symbols, used as encounter data markers. No character glyph placeholders.
export function atlasEncounterSymbol(kind:string,x:number,y:number,size=27):string{
  const symbols:Record<string,string>={
    battle:'<path d="M4 18l9.5-9.5M15 4l3 3-2 2-3-3zM6.5 15.5 4 18M8 12l2 2"/>',
    elite:'<path d="M4 18l9.5-9.5M15 4l3 3-2 2-3-3zM4 4l14 14M8 12l2 2M12 12l2-2"/>',
    boss:'<path d="M11 3.5l2.4 5 5.4.7-4 3.8 1 5.4L11 15.8l-4.8 2.6 1-5.4-4-3.8 5.4-.7z"/>',
    camp:'<circle cx="11" cy="11" r="3.5"/><path d="M11 2.5v2M11 17.5v2M2.5 11h2M17.5 11h2M5 5l1.4 1.4M15.6 15.6 17 17M5 17l1.4-1.4M15.6 6.4 17 5"/>',
    treasure:'<circle cx="11" cy="11" r="8"/><path d="M8 11h6M9.5 8.5v5"/>',
    shop:'<path d="M2.5 4.5h2.5l2.2 9.5h9.8l2-7H6"/><circle cx="8" cy="17.5" r="1.3"/><circle cx="15.5" cy="17.5" r="1.3"/>',
    event:'<path d="M3.5 4.5h15v9.5h-7l-4 3.5v-3.5h-4z"/>',
  };
  return `<g transform="translate(${x-size/2} ${y-size/2}) scale(${size/22})" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${symbols[kind]??symbols.event}</g>`;
}
