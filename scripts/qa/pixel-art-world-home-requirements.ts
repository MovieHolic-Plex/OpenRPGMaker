import type { InteriorRequirements } from '../../src/project/interiorPlacementAudit';
// An acceptance brief, never a target layout. The assistant chooses all room geometry.
export const homeRequirements: InteriorRequirements = {
  roomIds: ['bedroom', 'toilet', 'bathroom'], maxArea: 224, maxEmptySquare: 4, maxEmptyStrip: { width: 3, length: 4 }, southExit: true,
  objects: [
    ...['personal-m-bed', 'personal-m-wardrobe', 'personal-m-desk', 'personal-m-chair-back'].map(id => ({ ids: [id], min: 1, max: 1, roomId: 'bedroom', side: 'east' as const })),
    ...['bath-toilet-closed', 'bath-washer-front'].map(id => ({ ids: [id], min: 1, max: 1, roomId: 'toilet', side: 'east' as const })),
    { ids: ['bath-tub-horizontal'], min: 1, max: 1, roomId: 'bathroom', side: 'east' },
    ...['personal-m-kitchen', 'personal-m-fridge', 'washitu-round-table'].map(id => ({ ids: [id], min: 1, max: 1, side: 'west' as const })),
    { ids: ['washitu-cushion-blue', 'washitu-cushion-pattern'], min: 2, max: 2, side: 'west' },
  ],
};
