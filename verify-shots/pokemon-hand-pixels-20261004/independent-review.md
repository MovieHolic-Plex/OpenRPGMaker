# Focused final pixel review

**No blocking defect found in the requested focus. No approval ledger written.**

## Resolved findings

- Hero, nurse, merchant, mother, resident, explorer, ranger and hiker now have skin on both legs, with shadow on the rear leg. The former combination of one bare leg and one trouser leg is resolved. Boots remain distinct. This was checked visually at native 1× and integer 3×.
- Hero's rear field poses 0, 1 and 2 all show a gold bag inset and red lower pocket. Local pixel (7, 23) is RGBA `[213, 80, 60, 255]` in all three poses. The colors now match the gold bag and red pocket in hero_back. Direction and foot phases remain visible in the three hero cards.

## Exact visual inputs

The JSON report records current selection SHA, source SHA and imported candidate PNG SHA for 11 focused inputs. Gallery SHA is `c14392be08b14dcdfb6b1eec0c2281d15a8d365ecafe47b590564a93b91aa075`.

Python source PNG and imported candidate PNG have different compressed file hashes. Their decoded dimensions and RGBA pixels match exactly for all 11 inputs. The gallery displays the native authored source pixels. Both file hashes are recorded so later gates can identify the correct final bytes.

Representative source hashes:

- Hero atlas: `3efd6ab5c98cab81aeb95921bfa7320129ef560a5483d02376443ff7db3d8339`
- Mother portrait: `0ac7a00ef8c193bf7bf43bdb9dd01c4144711546f76f6908e039aa369263e8e6`
- Nurse portrait: `59d9f3d5129440d0ec4f5da0ffcab2536833ebc95222ce453321f9bf2f4f6aea`

The initial review JSON sampled source hashes after root rebuilt the assets. Its earlier defect observation is historical and must not be assigned to those later hashes. This final focused review supersedes that outcome. Old notes remain preserved.

## Remaining art limitations

The shared head, face, body and stance templates remain apparent. Hair, hats, clothing and props distinguish roles, but facial features and pose variety are limited. Field torsos and limbs remain boxy. Side step A and B have similar outer foot silhouettes; actual limb and depth changes exist, but alternating lead legs are subtle at native 1×.

These are quality and style cautions. They are not new definite identity or motion failures. This report does not grant blanket Emerald-quality approval.

## Scope and limits

The earlier review observed all 16 roles and 192 walking poses. This focused rereview checked the eight affected portraits and hero's three phases; it did not repeat all 192 captures. The professor source clip remains unchanged (`e0a284a2…`), with previously observed blink, talk and three gestures, and identical foot pixels across its six poses.

No authored source, image, code, canonical project or approval ledger was changed. Only private notes and read-only byte/pixel measurements were made. Actual exported player input, audio, scene timing and cleanup remain root's runtime QA.
