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

## Stage 4: Projector: approved ("continue"), merged into the Stage 5 branch
Done:
- Placeholder media for all 13 slots (`public/media/`, labelled with their filename); swap guide in `docs/MEDIA.md`.
- Reels now follow the brief: key full-bleed + subtitle, 3 shots in alternating windows (one a clip), second sentence, last shot, links. Opening uses film 1 large right + film 2 small left; Behind the camera has two portraits.
- The two canvases on the real page (2 WebGL contexts, verified), DOM-to-canvas sync, texture streaming with the DOM picture as placeholder, video textures for clips, text-layer weave on every title/subtitle group, context-loss recovery, opening portrait develops on its 2.5 s timer after 1 s of black.
- Checks: fast-scroll runs (450 px and 900 px steps) compared against the no-JS page: 0 blank slots, every slot drawn by the canvas, no console errors.

Not yet / caveats:
- Scroll is still native, so canvas pictures can trail the DOM text by a frame during fast scrolling. Lenis (Stage 5) puts both on one clock.
- Development on scroll, cuts, scrub and the PROYECTOR motion toggle are Stage 5. Clips loop for now.
- All media are placeholders until Adam uploads Nico's frames and clips.

## Stage 5: Timeline and cuts: approved ("good enough, refine later"), carried into Stage 6
Done:
- Film mode: the page plays as one pinned film; scroll is the projector. 46 beats compiled from the DOM (holds per the brief, phone 70% / tablet 85% lengths), rests of black between scenes.
- Moves: develop (first picture of a scene and any picture after text/black, over the first 45% of the hold), cut (instant, on a film frame), push-in (stills 1.00 -> 1.04), scrub (all-intra encode, clip time = hold progress, holds the last frame), arrive (6 stepped frames) / leave (4), fade to black through the rest. Scrolling back runs it in reverse.
- Lenis inertia scroll (lerp 0.09), off under reduced motion. Timecode HH:MM:SS:FF at 24 fps, 8 px per frame.
- PROYECTOR is now a real motion toggle. Chrome switches to Bone/Ink over the red end title (Stage 2 issue fixed). Tabbing to a link in a beat that isn't playing moves the film there.
- Checks: cuts land exactly on beat boundaries and the timecode matches (0 errors over 11 boundaries); scrub maps 0.1/0.5/0.9 -> 0.8/4.0/7.2 s of 8 s, forward and back; reverse frames identical to forward (motion paused); 2 WebGL contexts; no errors. Full-length recording forward and back in `docs/stage-05/`.

Not yet / caveats:
- "No dropped frames on desktop" can't be judged from here (software WebGL). Check on a real Mac: scroll the whole film and watch the timecode.
- Scrub clips are fetched once into memory (blob) so seeking works even where the server ignores range requests (Cloudflare Pages answered 200 with the whole file in testing).
- Name build, intertitle/festival/end-title builds and the pacing pass are Stage 6.

### Stage 5 corrections (Adam's review), done
- Reels shortened to 5 beats each (D-34). Festival circuit as one credit roll per film with laurel placeholders (D-35). Background motif per scene (D-36).
- The screening is now 29 beats, ~2,200vh including the end runway.

## Stage 6: Transitions and titles (branch `stage-06-titles`): built, awaiting Adam's review
Done:
- Nico's name prints in over 18 film frames in an uneven order during the portrait's develop, holds, then fades as the visitor moves on.
- Film titles and "Festival circuit" print letter by letter on scroll (14 frames).
- Statement: "Imagine what's" arrives, *next* arrives last; the rest leaves and *next* holds alone.
- End title: single cut to red; "Let's / make the / next one." set over 3 beats; the email on its own beat; red goes down through black; END alone on black.
- Pacing pass checks over the whole film (740 samples, every 2 film frames): never more than 1 screen, 1 picture, 1 text group at once. Flash check: largest 2-frame change 0.16 relative luminance, 3 changes >= 0.1 in the whole film, 0 opposing pairs within 1 s of film (WCAG 2.3.1 general flash passes).
- Recording and build stills in `docs/stage-06/`.

Not yet / caveats:
- Interface fades already use 200 ms with the projector ease (cubic-bezier); no CustomEase needed (no GSAP, D-27).
- Laurels, frames and portraits are still placeholders.

### Stage 6 corrections (Adam's review), done
- Festival box roll with laurels and dot leaders; reel container with rolling-shutter entrance; corner text layout and smaller reel text; watch beat with background loop and custom player (grain fades away); bio shutter sequence (4 portraits); end title word by word with "next one." on line two; glow/falloff on large type; grain slightly stronger on dark; language dropdown; PROJECTOR + SOUND bottom-right; viewfinder marks. See D-41..D-51.
- Media list grew: portrait-04/05, wei/btf-loop, wei/btf-film (placeholders in place).

## Not started
Stage 7 film pages and credits, 5 timeline, 6 titles, 7 film pages, 10 responsive, 11 performance. Backend phase: 0, 1, 8, 12. Optional: 9 sound.

## Waiting on Adam / Nico
- Cloudflare account and Pages connection.
- Frame grabs, clips, portraits, raw scan crops (Stage 3 needs them).
- Fee/terms: a favour. Recommended: credit, case study, testimonial, scope cap.
