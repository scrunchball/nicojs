# Progress

## Stage 2: Static screening: approved and merged to `main`, live at https://nicojs.pages.dev/en/
Done:
- Next.js 16 + next-intl static export, routes `/en`, `/de`, `/es`, root redirect.
- Tokens (`styles/tokens.css`), self-hosted fonts, 3 chrome elements, all 7 scenes as DOM-only frames with Nico's copy verbatim.
- Screenshots at 1440 / 810 / 390, JavaScript off, per scene: `docs/stage-02/`.

Known issues / next:
- Chrome over the red end title: the active EN (red on red) and the silver projector line lose contrast. Needs per-scene chrome colour, handled with the scroll timeline in Stage 5.
- Phone nav wraps to two rows; Stage 10 replaces it with the ÍNDICE full-screen index.
- Pictures are placeholders until Nico's frames and portraits arrive.
- Glyph test for typographic quotes (EN/DE/ES) not run yet.

## Stage 3: Film engine lab (branch `stage-03-film-engine`): built, awaiting Adam's sign-off
Done:
- `/lab` (unlisted): picture canvas (three.js, development + per-layer weave) and grain canvas over everything (second WebGL context). 2 contexts total.
- Physically based grain: Boolean-model plates generated at build (`scripts/make-grain.mjs`), new plate + offset every film frame, frozen under reduced motion.
- Development: paper under safelight, shadows first, agitation front gone by 60%, lights-on over the last 25% (24 film frames on a 4 s develop), dye layers out of step.
- Weave: picture (0.25% drift / 1.7 s, 0.06% jitter, ≤0.03° rotation, 1% overscan; windows move whole), title (0.8 px / 1.3 s, 0.3 px), subtitle (0.5 px / 2.1 s, 0.2 px). All stepped at 24 fps. Nav never weaves.
- Lab controls: the 4 tests, composition (full / large / small, side), development scrub + play cycle, dye offset, every weave amount, grain strength / density / size / blend / freeze, A/B wipe against a loaded scan, frame-time readout (GPU timer query where the browser has it).
- Checks: flash test through a full develop (largest single-frame luminance change 0.004 vs WCAG 0.1). Grain: midtone wall std 3.4 levels with no mean shift and no colour; near-black 1.1 levels.
- Recordings and stills in `docs/stage-03/`.

Not yet done / caveats:
- All test frames are STAND-INS. Grain size and texture are not calibrated against Nico's scan (needs his raw scan crops). Sign-off must happen on real frames.
- GPU time not measured on target hardware: recordings come from software WebGL (SwiftShader). Needs a check on an M1 Air and a recent iPhone in the lab's Frame time readout.
- "From negative" variant (optional, off by default) not built.

## Stage 4: Projector (branch `stage-04-projector`): built, awaiting Adam's review
Done:
- Placeholder media for all 13 slots (`public/media/`, labelled with their filename); swap guide in `docs/MEDIA.md`.
- Reels now follow the brief: key full-bleed + subtitle, 3 shots in alternating windows (one a clip), second sentence, last shot, links. Opening uses film 1 large right + film 2 small left; Behind the camera has two portraits.
- The two canvases on the real page (2 WebGL contexts, verified), DOM-to-canvas sync, texture streaming with the DOM picture as placeholder, video textures for clips, text-layer weave on every title/subtitle group, context-loss recovery, opening portrait develops on its 2.5 s timer after 1 s of black.
- Checks: fast-scroll runs (450 px and 900 px steps) compared against the no-JS page: 0 blank slots, every slot drawn by the canvas, no console errors.

Not yet / caveats:
- Scroll is still native, so canvas pictures can trail the DOM text by a frame during fast scrolling. Lenis (Stage 5) puts both on one clock.
- Development on scroll, cuts, scrub and the PROYECTOR motion toggle are Stage 5. Clips loop for now.
- All media are placeholders until Adam uploads Nico's frames and clips.

## Not started
Stage 5 timeline, 5 timeline, 6 titles, 7 film pages, 10 responsive, 11 performance. Backend phase: 0, 1, 8, 12. Optional: 9 sound.

## Waiting on Adam / Nico
- Cloudflare account and Pages connection.
- Frame grabs, clips, portraits, raw scan crops (Stage 3 needs them).
- Fee/terms: a favour. Recommended: credit, case study, testimonial, scope cap.
