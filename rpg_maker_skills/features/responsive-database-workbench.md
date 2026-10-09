# Responsive Database Workbench

This is not a skill. It is UI infrastructure.

## Purpose

Make the database modal usable on desktop, tablet, and narrow captures.

## Problems Observed

- Category tabs become dense and clipped.
- Korean labels wrap roughly.
- Long forms feel like a desktop modal compressed into mobile width.
- Footer actions compete with content height.

## Feature Direction

- Use a category menu or horizontally scrollable tabs below tablet width.
- Keep footer actions sticky and compact.
- Group long record details into sections.
- Prefer two-column desktop layout and one-column mobile layout.
- Add screenshot-friendly stable widths for QA.

## Why It Is Not A Skill

This needs CSS, layout rules, interaction states, and viewport testing.
