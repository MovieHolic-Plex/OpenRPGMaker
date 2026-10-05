# Review timing — 방랑 검객

All times are proposed preview holds in milliseconds. The GIFs are 4× nearest previews on a checker background. They are local review artifacts, not battle captures. Coordinates refer to the unscaled 64×64 grid, with (0,0) at the top left.

## GIF sequences

| GIF | Frame order and holds | Purpose |
| --- | --- | --- |
| `inspection/idle.gif` | idle_a 220 → idle_b 220 → idle_c 220 → idle_b 220; loop | Shoulder, cuff and robe breathing. The requested 220ms idle cadence is retained. |
| `inspection/sword.gif` | idle_a 300 → windup 180 → move 100 → attack 120 → recover 200 → idle_a 300; loop | Draw near the sheath, forward step, horizontal contact, lowered steel, settling stance. |
| `inspection/skill.gif` | idle_a 300 → skill_a 280 → skill_b 150 → skill_c 240 → recover 180 → idle_a 300; loop | Rearward charge, crescent contact, torn residual and partial sheathing, then normal recovery. |
| `inspection/poison.gif` | poison_a 420 → poison_b 420; loop | Two strained/slumped postures and changing round alchemical motes. |
| `inspection/stun.gif` | stun_a 360 → stun_b 360; loop | Hanging arms, deeper knee compression and independently redrawn stars. |
| `inspection/sleep.gif` | sleep_a 650 → sleep_b 650; loop | Closed warm lids and slow sleeve/robe breathing with lowered sword. |
| `inspection/damage.gif` | idle_a 300 → hit 200 → dead 1100; loop for review only | Recoil followed by a clearly fallen body. The review loop restarts; no revival action is implied. |

`dead` is intended as a static terminal pose when used in a game. The GIF's 1100ms hold merely allows review of the body, dropped gat and blade.

## Weapon and hand anchors

| Frame | Native anchor | Contact description |
| --- | --- | --- |
| idle_a/b/c | Grip around (37,37–39), diagonal blade rising toward (62,18) | Stable two-eye face and grip; breathing is concentrated in shoulders, cuffs and robe. |
| windup | Draw hand around (36,41); guard near (40,40); exposed steel near (44,37) | The hand stays close to the sheath. Short exposed steel makes the start of the draw visible. |
| move | Fist around (38,39); guard near (42,39); tip (52,33) | The blade rises out of the forward stepping grip above the distinct dark sheath. |
| attack | Fist around (35,36); guard (38,36); horizontal tip near (62,34–35) | Pale shoulder and elbow connect through the cuff to the fingers and guard. This is the proposed ordinary attack contact pose. |
| skill_a | Draw grip (24,45); guard (20,46); rear/low blade tip (5,54) | Shoulder and folded sleeve terminate in the warm grip. The pale gathering clusters follow the low steel; the small branch curls up from that blade edge. |
| skill_b | Fist (43,36); guard (45,35); tip (54,27) | The diagonal blade leads from the fingers to this actual tip. At y27, m pixels x55–60 connect the tip's w pixel to the crescent's outer w pixels x61–62. This is the proposed skill contact pose. |
| skill_c | Draw hand (37,42); guard (40,43); support hand (39,44); steel x42–44, y44–47 | Both hands gather toward the sheath. Short exposed steel enters beside the dark sheath. Residual tears at roughly (57,26), (54,34), and (49,43) are detached fading fragments, intentionally no longer a live blade-connected crescent. |
| dead | Slack hand around (39,58); dropped steel along y60 | Body stays fallen while the gat lies separately to the left. |

The skill is weapon-based; there is no mouth emission anchor. The crescent is not a separate projectile cel, and no damage, sound, collision, camera or engine timing is implemented here.

## Ordering and limitations

Do not substitute ordinary attack for skill B, or idle A for status frames. All nine action frames contain their own full character and literal effect pixels. Poison, stun and sleep loops have their own posture changes. Skill C's torn motes are recovery fragments rather than a repeated crescent.

These timings retain readable preparation and recovery while giving the two contact poses shorter holds. The sudden angle changes are deliberate key-pose choices; smooth motion and synchronization with damage still require actual engine review. No battle validation, tests/gates, user selection or acceptance is claimed.
