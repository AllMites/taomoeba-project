# Lane C report: page shell

Files: `src/app/App.tsx`, `src/app/app.css` (new), `src/styles/tokens.css`, `src/styles/base.css`, `index.html`.
Gate: `npm run gate` green (53 TS tests, 67 py tests). Nothing merged, pushed or deployed.

## What was built
- Hero: title, one sentence, three radio cards (fieldset + legend, real radios in labels, arrow keys work natively). Each card: name, oxygen % bar, pressure kPa bar, `note`. Picked card = thicker border + tinted fill + "✓ Picked" text. Card sizes are fixed, so changing the pick moves nothing. Focal visual: CSS round glow (radial gradient, slow pulse, off under reduced motion).
- Sticky bar: fixed (no layout shift), shows a `select` on the same store value once the hero leaves view (IntersectionObserver). Not rendered while the drawer is open. Headings have `scroll-margin-top: 5rem` (bar is 53px).
- Layout: `main` is one column, max 60rem, 3rem gaps; `.hero`, `.foot` match. Skip link and `<main id="main">` kept.
- Limits strip, computed at runtime from `investigations.json`, fire experiments only (`pds !== "Other"`, 24): 0 of 24 ran in Moon or Mars gravity (19 flight, 5 ground, by `evidence`); 14 of 24 no oxygen level; 18 of 24 no pressure. Dot rows show it. Hand count (node over the JSON) gives the same 24 / 19 / 5 / 14 / 18. Plus the bracket sentence. `limitsFrom()` is exported from App.tsx.
- Footer: data source, SI note, "sample data" badge (same fixture logic as before).
- `index.html`: lang, title, description, viewport, theme-color for dark and light.
- `base.css`: removed `.topbar`, `.nav`, old `main` rule, `overflow-x: hidden` (it hid overflow bugs). Kept `.field`, `.card(s)`, `.muted`, `.block`, `.evidence`, `.badge`, `.skip`. Added `.unknown` (italic, `--color-unknown`) for "Not on record", reduced-motion reset.

## Tokens (all in tokens.css; the file header documents each)
Colour: `--color-bg`, `-surface`, `-surface-2`, `-border`, `-edge`, `-text`, `-text-muted`, `-unknown`, `-accent`, `-accent-contrast`, `-focus`, `-highlight`, `-highlight-bg`, `-glow`, `-badge-bg`, `-badge-text`, `-meter-track`, `-meter-fill`, `-marker`, `-tag-prevention`(+`-text`), `-tag-detection`(+`-text`), `-tag-suppression`(+`-text`).
Shadow: `--shadow-1`, `--shadow-2`. Space: `--space-1` to `--space-8`. Radius: `--radius-1`, `-2`, `-3`.
Type: `--font-sans`, `--font-display`, `--font-mono`, `--text-xs`, `-sm`, `-base`, `-lg`, `-xl`, `-2xl`, `-3xl`.
Motion: `--motion-fast`, `--motion-slow` (both 0s under reduced motion).
Added beyond the ask: `--color-edge` (control outlines at 3:1+, since `--color-border` is decorative), `--color-glow`, `--text-base`.
Dark is the default; light applies under `prefers-color-scheme: light`.

## Contrast (computed with the WCAG relative-luminance formula over the hex values in tokens.css)
| pair | dark | light |
|---|---|---|
| text on bg / surface / surface-2 | 16.6 / 15.3 / 13.8 | 16.1 / 17.2 / 14.6 |
| text-muted on bg / surface / surface-2 | 9.1 / 8.4 / 7.6 | 7.4 / 7.9 / 6.7 |
| unknown on bg / surface | 8.1 / 7.5 | 6.6 / 7.1 |
| accent on bg / surface / highlight-bg | 11.1 / 10.3 / 9.0 | 5.9 / 6.3 / 5.6 |
| accent-contrast on accent | 10.7 | 6.3 |
| edge on bg / surface (UI mark, need 3) | 5.2 / 4.8 | 4.3 / 4.6 |
| highlight on bg (UI mark) | 11.1 | 4.3 |
| focus on bg | 13.6 | 5.9 |
| meter-fill on meter-track (UI mark) | 7.5 | 3.4 |
| tag text on tag fill (x3) | 7.9 to 8.4 | 8.4 to 8.6 |
All text pairs >= 4.5, all marks >= 3.

## Checked in a real browser (built-in pane, dev server on :5199, now killed)
- 1440x900 dark: hero, picker, limits render; scrollWidth 1425 <= 1440. Arrow keys move the radio (ISS then two Right presses landed on rover). Sticky bar appears once the hero is gone (53px tall), its select shows and changes the same store value; screenshot confirmed it does not hide the section content.
- 375x812 light and dark: no sideways scroll (scrollWidth 375); cards stack; limits cards stack; sticky bar fits.
- Limits numbers on screen: 0 of 24 | 14 of 24 | 18 of 24.

## Not checked
- Full 1440 light screenshot (light was checked at 375 only, plus the contrast table).
- Sticky bar over real section content: the other lanes are stubs, so I padded `main` to force scrolling. Focus-under-bar relies on `scroll-margin-top`, tested only on a probe element via computed style, not on real Tab order through other lanes' controls.
- Open-dialog case: the bar is hidden by `selectedInvestigationId !== null`; no real drawer existed to open.
- Screen reader pass, forced-colors mode, and reduced-motion emulation (CSS rule only, not run).
- Mobile picker is tall (three stacked cards, about two screens). Could drop the bars at 375 if the owner wants it tighter.

## For the integrator
Other lanes should use `--color-surface-2`, `--color-highlight(-bg)`, `--color-meter-*`, `--color-marker`, `--color-unknown`, tag tokens, `.unknown` class. `.glow` pulse stops under reduced motion.
