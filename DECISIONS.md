# Decisions

| # | Decision | Why |
|---|----------|-----|
| D-01 | Repo is `scrunchball/nicojs` (not `nicojs-web`) | Adam's choice |
| D-02 | Front-end first. Backend (Stages 0, 1, 8, 12: Railway, Payload, Postgres, R2, Resend, ffmpeg jobs) postponed until the look is signed off | The Framer attempt failed on look, not on features. Prove the look first; host a static preview immediately |
| D-03 | Next.js 16 `output: "export"`, hosted on Cloudflare Pages | Free, commercial use allowed, branch previews. Vercel Hobby is non-commercial. Account later doubles as the R2 account |
| D-04 | Content in `content/site.ts`, typed like the Payload collections | A CMS can replace the file without touching components |
| D-05 | Accent = deep red `#C42A1A` (`--safelight`), chosen by Adam. A lighter tint `#E8441E` (`--safelight-text`) is used only for small red text on black | Deep red is 3.3:1 on Gate black (fails AA for small text). Bone on `#C42A1A` is 4.58:1 (passes) |
| D-06 | Spanish markers are translated: ROLLO/ROLLE/REEL, FIN/ENDE/END, PROYECTOR/PROJEKTOR/PROJECTOR, ÍNDICE/INDEX | Adam's choice (differs from the brief's default) |
| D-07 | Contact email `njs@dizsiplin.org` | Adam confirmed. The Pages file had the placeholder `example@example.com` |
| D-08 | Opening tagline = "Berlin-based director making films about hope and beauty."; the statement = the other three sentences of Nico's description, one per beat, "next" italic | The brief doesn't say how to split Nico's description. All words are verbatim |
| D-09 | Fonts self-hosted via `@fontsource` (Instrument Serif, Courier Prime) instead of `next/font/google` | No third-party requests; builds offline |
| D-10 | Placeholders (flat Picture black) stand in for all pictures | Nico's frames, portraits and scans haven't arrived |
| D-11 | DE and ES UI strings are my draft, content falls back to English | Nico writes Spanish; German goes to a proofreader |
| D-12 | Root `/` redirects client-side (and via meta refresh) to the browser language, falling back to `/en/` | Static hosting has no server redirect |
| D-13 | Festival years left blank where Nico's document gives none (FHIFF winner, Awareness Festival, FHIFF selection) | Never invent facts |
| D-14 | Development under the safelight shows density only: a dim red monochrome. Paper starts as the dim red "white" (luminance ~0.12) and shadows darken out of it; colour arrives at lights-on (75–100%), dye layers a few % apart. The brief's density formula is kept, offset by 0.10 for phase 1 | First pass used a red-tinted colour picture and glowed bright orange-red at 60–80%, against "low luminance, never bright". This is also how a print really comes up |
| D-15 | Grain blends with `overlay`, not `soft-light`. Default strength 0.06 is about 1.3% std on a midtone and ~0.4% near black | Measured in the lab: soft-light lifted grain on near-black (3.4 levels at RGB ~13), failing lab test 2. Overlay falls to nothing at black and white, like a print. Both are in the lab for comparison |
| D-16 | `/lab` is a public but unlisted, noindex route until the admin login exists | No backend yet (D-02). It holds no private content |
| D-17 | Lab tests run on procedural stand-in frames, with "Load frame" and "Load scan" pickers for Nico's real material | His frames and scans haven't arrived. The look is signed off on real frames only |
| D-18 | Grain plates are generated at build time (`npm run grain`, ~2 s) into `public/grain/` and not committed. 12 variants x 4 densities x 512² = 3 MB per density; only the active density is fetched | Keeps the repo small. Revisit the 3 MB download for phones in Stage 10/11 |
| D-19 | Raw WebGL output passes graded sRGB straight through (NoColorSpace, no tone mapping). At progress 1 the shader returns the source pixel exactly | "Pictures are shown exactly as Nico graded them" |
| D-20 | ±0.5/255 dither on the picture only while it develops | Dim safelit gradients banded in 8 bits. Gone at progress 1, so the finished picture is untouched |
