# nicojs: project rules

Custom-coded site for Nicolás J. Scatamacchia (film director, Berlin). Full spec: `docs/BRIEF.md`.
Owner/client contact: Adam Cayir. Nico is the end user of the CMS.

## Working rules
- One stage per session, one git branch per stage (`stage-02-static-screening`), merged to `main` only after Adam says so. Next stage starts only when Adam replies "go Stage N".
- Never change Nico's words or facts. New interface labels only where the brief gives them.
- Keep `PROGRESS.md` and `DECISIONS.md` current and commit at the end of every session.
- Recordings and screenshots come from the running site in a real browser, never from code.
- Ask instead of guessing when the brief and reality conflict.
- Pictures are clean: no frames, borders, glows, vignettes, dust or scratches. Only development, weave and grain as film touches.
- Chrome budget: 3 fixed UI elements. One picture and at most one text group per screen. No justified text, no rounded corners, no drop shadows (except the subtitle shadow).
- Never use posters as stills; never pre-apply grain or filters to frames.

## Current phase
Front-end first, backend later (see `DECISIONS.md` D-02). Content lives in `content/site.ts` shaped like the Payload collections. Hosting is a static export on Cloudflare Pages.

## Commands
- `npm run build` static export to `out/`
- `npm run typecheck`
