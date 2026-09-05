import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { writeEscMenuFixture } from "./esc-menu-fixture.mjs";

// QA-only fixture: exercise a real sixth slot through the shipping player.
const source = await writeEscMenuFixture();
const project = JSON.parse(await readFile(source, "utf8"));
const actor = project.database.actors.find((entry) => entry.id === "actor_hero");
const template = project.database.equipment.find((entry) => entry.slot === "accessory");
if (!actor || !template) throw new Error("Equipment QA fixture requires hero and accessory");
project.database.equipmentSlots = [{ id: "slot_boots", label: "신발" }];
const boots = {
  ...template,
  id: "equip_qa_boots",
  name: "여행용 장화",
  slot: "slot_boots",
  twoHanded: false,
  cursed: false,
  effectFlags: { ...template.effectFlags, fixedEquipment: false },
  statBonuses: { attack: 0, defense: 3, mind: 0, agility: 7 },
  equippableActorIds: [actor.id],
};
project.database.equipment.push(boots);
actor.options.fixedEquipment = false;
const actorClass = project.database.classes.find((entry) => entry.id === actor.classId);
if (actorClass) actorClass.options.fixedEquipment = false;
actor.initialEquipment = { ...actor.initialEquipment, slot_boots: boots.id };
const projectFixture = join(dirname(source), "custom-equipment-slots.json");
await writeFile(projectFixture, JSON.stringify(project));

const key = (key, times = 1) => ({ kind: "key", key, times });
const present = (testid) => ({ kind: "waitFor", testid, state: "present" });

export default {
  id: "custom-equipment-slots",
  projectFixture,
  beats: [
    { id: "title", expect: { testidPresent: ["title-screen"] } },
    {
      id: "custom-slot",
      ops: [
        key("Enter"), { kind: "waitForRuntime" }, key("Escape"), present("main-menu"),
        key("ArrowDown", 2), key("ArrowRight"), key("Enter"),
        present("status-menu-equipment-slot-slot_boots"),
      ],
      expect: { visibleText: { "status-menu-equipment-slot-slot_boots": "여행용 장화" } },
      shot: true,
    },
    {
      id: "unequip-choice",
      ops: [key("ArrowDown", 5), key("Enter"), present("status-menu-equipment-item-none")],
      expect: { visibleText: { "status-menu-equipment-item-none": "여행용 장화" } },
      shot: true,
    },
    {
      id: "empty-custom-slot",
      ops: [key("Enter"), present("status-menu-equipment-slot-slot_boots")],
      expect: { visibleText: { "status-menu-equipment-slot-slot_boots": "없음" } },
      shot: true,
    },
    {
      id: "returned-to-inventory",
      ops: [key("Enter"), present("status-menu-equipment-item-equip_qa_boots")],
      expect: {
        testidAbsent: ["status-menu-equipment-item-none"],
        visibleText: { "status-menu-equipment-item-equip_qa_boots": "1개" },
      },
      shot: true,
    },
    {
      id: "equipped-again",
      ops: [key("Enter"), present("status-menu-equipment-slot-slot_boots")],
      expect: { visibleText: { "status-menu-equipment-slot-slot_boots": "여행용 장화" } },
      shot: true,
    },
  ],
};
