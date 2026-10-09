/** Room geometry is shared by actual collision tiles and the exploration map silhouette. */
export function atlasRoomDimensions(index:number):{width:number;height:number} {
  return [{width:30,height:28},{width:54,height:22},{width:36,height:26},{width:56,height:18},{width:24,height:40},
    {width:38,height:24},{width:60,height:16},{width:44,height:30},{width:32,height:24},{width:48,height:28}][index%10]!;
}
export function atlasRoomAir(x:number,y:number,w:number,h:number,index:number):boolean {
  if(x<1||y<1||x>=w-1||y>=h-2)return false;
  // A continuous floor approach remains reachable. The upper chambers, shafts and alcoves differ.
  if(y>=h-5)return true;
  const k=index%5;
  if(k===0)return x>w*.3&&x<w*.7||y>h*.55&&x>4&&x<w-5;
  if(k===1)return y>h*.38&&x>3&&x<w-4||x>w*.2&&x<w*.36&&y>3;
  if(k===2)return x>4&&x<w*.55&&y>3||x>w*.4&&x<w-4&&y>h*.4;
  if(k===3)return y>h*.45&&x>3&&x<w-4||x>w*.65&&x<w*.83&&y>2;
  return x>w*.24&&x<w*.76&&y>2||y>h*.7&&x>3&&x<w-4;
}
