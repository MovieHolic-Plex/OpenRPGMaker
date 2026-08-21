# RM2K3 Database Field Matrix

> **Status:** 설계 스펙 (시점 기록). 현행 구현의 정본은 코드 — 차이가 있으면 코드를 따른다.

This matrix defines the T10 editor surface. Every tab is a real editable panel with a searchable list, detail form, duplicate/delete controls where records are list-backed, and reference pickers that use current database names.

| Tab | MVP Fields | Reference Pickers | Safeguards and Preview |
| --- | --- | --- | --- |
| Actors | name, class, initial level, max level, learned Skills, CharSet resource, BattleCharSet resource | Classes, Skills | deleting referenced actors is blocked by System/party references |
| Classes | name, learned Skills | Skills | class delete is blocked while Actors reference it |
| Skills | name, scope, power, Battle Animations | Battle Animations | skill delete is blocked while Actors, Classes, Items, Equipment, or Enemies reference it |
| Items | name, price, scope, linked Skill | Skills | project export preserves created and edited item records |
| Equipment | name, price, slot, linked Skill | Skills | project export preserves created and edited equipment records |
| Enemies | name, Monster resource, action Skills | Skills | enemy delete is blocked while Troops reference it |
| Troops | name, enemy members, battle event page count | Enemies | troop membership updates when enemy names change |
| States | name and message placeholder field for restriction/status text | none in T10 | state record is editable and exported |
| Battle Animations | name, resource id, preview label | resource id text field | animation preview shows the selected resource id; Skills can reference animations |
| Tilesets | name, resource id, tile count, tile size, priority grid | map/resource ids by record | priority/passability data remains editable and exported |
| Common Events | name, trigger, condition switch, full command editor | Switches | not text-only; uses the same structured command editor as map events |
| System | start party, initial troop, title graphic, System graphic, System2 battle graphic | Actors, Troops | System2 resource is explicitly editable |
| Terms | Gold, Level, HP, MP, Attack, Skill, Item | none | vocabulary updates export JSON immediately |
| Switches | searchable list, stable ids, names, bulk range rename/create | event/common-event references | delete preserves stable ids of other switches |
| Variables | searchable list, stable ids, names, bulk range rename/create | event command references | delete preserves stable ids of other variables |

Required browser selectors include `right-tab-database`, `db-tab-actors`, `db-tab-classes`, `db-tab-skills`, `db-tab-items`, `db-tab-enemies`, `db-tab-troops`, `db-tab-states`, `db-tab-animations`, `db-tab-system`, and `db-tab-terms`.
