import type { ModernProgramVariation } from "./modernPresets";
import type { InteriorRoomTemplate, InteriorTemplateItem } from "./templates";

export const NEIGHBORHOOD_KONBINI = "neighborhood-konbini";
const SALES = "konbini-sales";
const STOCK = "konbini-stock";

export const neighborhoodKonbiniProgram = { map: NEIGHBORHOOD_KONBINI, kinds: [SALES, STOCK] };

export const neighborhoodKonbiniVariation: ModernProgramVariation = {
  rows: [[SALES, STOCK]], ragged: true, entrance: SALES, left: [[SALES, STOCK]],
  fixed: [SALES, STOCK],
  palettes: [
    { [SALES]: ["mci-tile-concourse", "mci-wall-store"], [STOCK]: ["mci-concrete", "mci-wall-metal"] },
    { [SALES]: ["mci-vinyl-store", "mci-wall-tile"], [STOCK]: ["mci-vinyl-store", "mci-wall-office"] },
  ],
};

const fixture = (id: string, x: number, y: number): InteriorTemplateItem => ({ t: "o", id, x, y });
const room = (kind: string, w: number, h: number, floor: string, wall: string, items: InteriorTemplateItem[]): InteriorRoomTemplate => ({
  id: `${NEIGHBORHOOD_KONBINI}:${kind}`, map: NEIGHBORHOOD_KONBINI, building: NEIGHBORHOOD_KONBINI, kind, w, h, floor, wall, items,
});

// Short parallel shelves leave a cross-aisle and a straight entrance-to-cooler aisle.
// The template fitter keeps door approaches clear and rejects placements that isolate floor.
export const neighborhoodKonbiniTemplates = [
  room(SALES, 12, 10, "mci-vinyl-store", "mci-wall-store", [
    fixture("mci-cooler", 0, 2), fixture("mci-cooler", 2, 2), fixture("mci-cooler", 4, 2),
    fixture("mci-magazine", 7, 2), fixture("mci-fridge", 10, 2),
    fixture("mart-gondola-snack", 1, 4), fixture("mci-gondola", 3, 4),
    fixture("mci-gondola", 7, 4), fixture("mart-gondola-tea", 9, 4),
    fixture("mci-gondola", 1, 6), fixture("mart-gondola-tea", 3, 6),
    fixture("mart-gondola-snack", 7, 6), fixture("mci-gondola", 9, 6),
    fixture("mci-freezer", 1, 8), fixture("mci-counter-register", 8, 8),
    fixture("mci-basket-stack", 4, 9),
  ]),
  room(STOCK, 4, 5, "mci-concrete", "mci-wall-metal", [
    fixture("mci-rack", 1, 2), fixture("mci-pallet", 3, 4),
  ]),
];
