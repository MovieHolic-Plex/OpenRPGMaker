import type {Project} from '@/project/types';
/** This campaign seed carried a 0G starter-ball row from the blank database. */
export function repairExpeditionShopPrices(project:Project):void {
 const item=project.database.items.find(item=>item.id==='item_capture_orb');
 const row=project.system.sellPrices?.find(row=>row.itemId==='item_capture_orb');
 if(item?.price===80&&row?.price===0)row.price=40;
}
