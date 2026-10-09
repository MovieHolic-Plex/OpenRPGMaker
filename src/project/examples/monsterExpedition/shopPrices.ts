import type {Project} from '@/project/types';
/** This campaign seed carried a 0G starter-ball row from the blank database. */
export function repairExpeditionShopPrices(project:Project):void {
 const item=project.database.items.find(item=>item.id==='item_capture_orb');
 const row=project.system.sellPrices?.find(row=>row.itemId==='item_capture_orb');
 if(item?.price===80&&row?.price===0){const prices=project.system.sellPrices!;const i=prices.findIndex(entry=>entry.itemId==='item_capture_orb');if(i>=0)prices[i]={...prices[i]!,price:40};}
}
