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
