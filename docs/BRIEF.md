# nicojs.com custom build brief

> Plain-text export of the Claude Docs brief (formatting such as tables flattened). The live doc is the source of truth: https://claude.ai/artifact/TnKJNps6YjJNtF93dYVAd5

nicojs.com: custom build brief
 · 
How to use this brief
This brief rebuilds nicojs.com as a custom-coded site with its own CMS, replacing the Framer version. Claude Code builds it in a GitHub repo, stage by stage. Nico edits it himself at nicojs.com/admin.
Repo first. Create a private GitHub repo nicojs-web. Put this whole brief in docs/BRIEF.md. Claude Code keeps CLAUDE.md (project rules: the Working rules below), PROGRESS.md (where each stage stands) and DECISIONS.md (every choice made and why), and updates all three at the end of every session, so any session or account can pick up where the last one stopped.

One stage per session. Stages are in the Build stages section. Each ends with a Done when check: a screen recording of the running site, screenshots and a short changelog. The next stage starts only when Adam replies "go Stage N".

Branches. One git branch per stage (stage-03-film-engine), merged into main after Adam's approval. Every branch gets its own preview deployment URL.

Model and effort. The suggested model per stage is in the stages table. Use Opus for the film engine and motion stages, where taste and maths matter, and Sonnet for plumbing (CMS fields, deploy, SEO). Test lightly while building and run one heavy performance pass at the end (Stage 11).

Corrections go back as plain words with the stage and item number, e.g. "Stage 3, development: lights-on too fast".

The Framer site stays live on nicojs.com until Stage 12, when the domain moves over. Nothing is switched without Adam's written go-ahead.

The idea: a film composed in layers
Objective. Visiting nicojs.com should feel like watching a quiet, beautifully composed film of Nico's work. The browser window is the screen and scroll is the projector: every movement of the wheel advances the film. It should never feel cramped, not for a single screen. Producers, production companies and festival programmers leave wanting to email Nico. Everything builds toward the end title: "Let's make the next one."
The era. 16mm in the 1960s and 70s (the Nouvelle Vague, Cinema Novo, Argentina's Nuevo Cine), when cinema became portable and personal. Nico shoots Super 16 and 16mm. The site should feel analogue and precise, never retro kitsch.
How the picture is made. Think of every screen as an optical-printer composite. In that era, titles and pictures were filmed as separate elements and combined layer by layer onto one print, and each element carried its own slight weave. The site works the same way: each screen is a few layers (the black, a picture, a line of text, and a fine grain over all of it), and each layer moves on its own.
The seven rules
Space is the main material. Most of every screen is black. One picture or one line of text at a time, never a crowded screen.

One thing per beat. Information arrives scene by scene: a title, then a year, then one sentence, then a picture. Nothing is listed when it can be revealed.

Pictures are clean. No frames, gate edges, vignettes, glows, sprocket holes, dust or scratches, on or around them. Nico's grade is shown exactly as he graded it. Pictures appear full-bleed or floating borderless in the black.

Two film touches on pictures, and only two: development and weave. Each picture develops into view the way a print comes up in the darkroom tray, and every layer weaves very slightly at film speed, independently of the others.

Grain over everything. One fine, subtle, living grain covers the whole screen (pictures, black and text), so the entire site feels printed on the same stock. You notice it only when you look for it.

Scroll is the projector. Scrolling advances a single timeline: pictures develop, clips scrub frame by frame, stills cut, and text arrives and leaves. Scrolling back runs the film in reverse.

The site is an edit. The CMS stores the screening as an edit decision list: the beats, how long each holds, how each picture is composed. The site plays that list, and when Nico adds a film or a shot, the edit updates itself.

What should make people stop scrolling: the first picture developing out of the dark under a red safelight, the title and the picture drifting very slightly apart like two layers of film, and how calm and spacious it all feels.
Palette in one line. Gate black, bone-white type, one safelight red. The red is the darkroom safelight: pictures develop under its glow before the lights come on. In the interface it marks only active states and the end title.
Lessons carried over from the Framer round
The Framer redesign (draft page /reel, November 2026) read cheap for six reasons. Each one is now a hard rule in this build.
What went wrong
Rule for this build

Festival posters with credits baked in were used as film stills
Only clean frame grabs and clips are shown as pictures. Posters appear only small, on film pages

Up to 12 tiny labels on one screen
A chrome budget of 3 fixed UI elements, and one thing per beat

Scenes pinned for 150–300vh while one small thing moved
A beat (something arriving or leaving) at least every 60vh. Black rests are deliberate and at most 40vh

Too many film references: gate frames, crop marks, halftone, light leaks, sprockets
Only development, weave and grain. Pictures stay clean and borderless

Grain was 6 pre-drawn frames of flat white noise, so it read as TV static
Physically based grain, subtle, renewed every film frame and never visibly repeating

Weave moved the whole page as one block
Each layer weaves on its own by tiny amounts. The page never shakes as a whole, and the navigation stays still

What carries over unchanged: the Round 1 colours, Instrument Serif and Courier Prime, Nico's copy, and the Spanish markers (ROLLO, FIN, PROYECTOR).
Architecture
One Next.js app does everything on the server: it renders the pages, hosts Nico's admin and runs the video-encoding jobs. In the browser, real HTML carries all the words, while a picture canvas behind it develops and weaves the pictures and a grain canvas lies over everything, both driven by the scroll timeline.
Pictures and clips stream straight from R2 to the picture canvas. Content and the screening order come from Postgres through the pages, so whatever Nico publishes in the admin is what the timeline plays.
Stack and running costs
The stack is one Next.js app with Payload CMS inside it, Postgres for content, Cloudflare R2 for media, and a single three.js canvas for the film. Everything is open-source and free to use. The only running costs are hosting and storage.
Layer
Choice
Why

Framework
Next.js 16 (App Router), React, TypeScript
Server-rendered pages for SEO. Payload installs inside it and is compatible with Next.js 16

CMS
Payload 3 (MIT licence)
Admin panel at /admin in the same app, with built-in login, field-level localization, drafts, versions, live preview and a jobs queue for background work

Database
Postgres (managed)
Payload's best-supported database. Daily backups

Media storage
Cloudflare R2, via Payload's S3 storage adapter
No egress fees, which matters for video. The free tier covers 10 GB of storage

Film rendering
three.js (WebGL2), custom shaders, two full-screen canvases
Full control of development and weave, with only two WebGL contexts for the whole site (pictures and grain)

Motion
GSAP 3 with ScrollTrigger, plus Lenis
GSAP is now free for commercial use, including SplitText and CustomEase. Lenis gives inertia scrolling that stays in sync with ScrollTrigger

Video
H.264 MP4: all-intra encodes for scrubbing, normal encodes for loops
Frame-accurate seeking on scroll (Stage 8 makes the encodes automatically)

Languages
next-intl, with /en, /de and /es routes
Pairs with Payload's field-level localization

Fonts
Instrument Serif and Courier Prime, self-hosted through next/font
Both are open-licence; no layout shift, no third-party requests

Email
Resend or Postmark
Password resets for the admin login

Analytics (optional)
Plausible or Umami
Cookie-less, so no consent banner is needed

Hosting decision (Stage 0). The video encoding jobs (Stage 8) run ffmpeg and need a long-running server, so use one of these:
A. One container host (Railway, Render, or a small EU VPS with Docker): the app, the jobs worker and ffmpeg live together. This is the simplest option and the recommended one.

B. Vercel plus a separate worker. Vercel's Hobby plan is for personal, non-commercial use only. A site meant to win Nico paid work should be treated as commercial, which means Pro (currently $20 per user per month) plus a small worker for ffmpeg.

Running costs to expect: hosting (the main cost, confirmed when the host is chosen in Stage 0), R2 storage at $0.015 per GB-month beyond the free 10 GB (the full site should stay near or inside the free tier), and the existing domain. Claude Code reports the exact monthly total at the end of Stage 0.
Design system
The design system has two voices: huge serif titles and small, exact mono type, each on its own weaving layer. There's one accent and very little interface. Everything lives as CSS custom properties in styles/tokens.css, with the matching values exported to the shaders.
Colour (contrast measured against Gate black; all text pairs pass WCAG AA)
Token
Hex
Use
Contrast

--gate-black
#121110
The room: the page background and the space between pictures
n/a

--picture-black
#171513
Blank paper at the start of a development, mixed with Safelight red (pictures themselves keep Nico's grade)
shader

--picture-white
#F2ECE0
Lab reference swatch only; never applied to pictures
shader

--bone
#ECE6DA
All interface and subtitle text
15.2:1

--silver
#9A948A
Secondary text in credits, inactive nav
6.3:1

--safelight
#E8441E
Darkroom safelight cast during development, active states, end title
4.7:1

--ink-on-red
#121110
Text on Safelight red (Bone on red fails at 3.2:1)
4.7:1 on red

Type (fluid sizes with clamp(min, preferred, max))
Token
Font
Size
Line height
Tracking
Use

--t-name
Instrument Serif
clamp(76px, 16.5vw, 280px)
0.86
-0.02em
Nico's name in the opening titles

--t-title
Instrument Serif
clamp(60px, 12vw, 200px)
0.9
-0.015em
Film titles, the end title

--t-intertitle
Instrument Serif
clamp(40px, 6vw, 104px)
1.02
-0.005em
Intertitles, credits headings

--t-subtitle
Courier Prime
clamp(17px, 1.5vw, 24px)
1.45
0
Synopses and bio, as subtitles

--t-body
Courier Prime
clamp(14px, 1.1vw, 16px)
1.6
0
Film pages (credits, festival lists)

--t-label
Courier Prime Bold, uppercase
clamp(11px, 0.85vw, 12px)
1.4
0.14em
Fixed UI, markers, links

One Instrument Serif italic word per card at most, for emphasis. There is no medium size: the gap between the titles and the labels is the whole idea.
Chrome budget (the only fixed interface)
Element
Position
Content

Name mark
Top-left
N. J. SCATAMACCHIA, linking to the top

Nav
Top-right
FILMS · ABOUT · CONTACT and EN · DE · ES, the active item in Safelight red

Projector line
Bottom-left
00:00:00:00 · PROYECTOR ● · SOUND ○: timecode, motion toggle and sound toggle on one line, in Silver

Markers (at most one per screen): ROLLO 1 above a film title, 2025 · SUPER 16MM below it, and FIN on the tail leader.
Type on pictures
Subtitles sit in the bottom 12% of the frame, centred, at most 2 lines of 62 characters, in Bone with a soft shadow (0 0 14px rgb(0 0 0 / 0.55)). They never move.

Titles go centred, or bottom-left on the lower-third line, and run to 2 lines at most.

One text group per screen, and never over a face: each shot's safe area is set in the CMS.

No justified text anywhere.

Layout grid: pictures are always full-bleed. Interface type aligns to a 12-column grid with 48px margins and 24px gutters (8 columns, 32/20 on tablet; 4 columns, 20/16 on phone). Spacing scale: 8, 16, 24, 40, 64, 104, 168. No rounded corners and no drop shadows except the subtitle shadow.
Space, pacing and layers
Empty space does most of the work. Each screen holds one thing at a time, information is revealed in beats rather than laid out, and every screen is built from a few independent layers.
Composition modes (set per shot in the CMS)
Mode
What it looks like
Use

Full-bleed
The picture fills the screen edge to edge
At most once per reel, for its key image, and for the opening portrait

Large window
The picture at about 62% of the viewport width, borderless, sitting on the left or right third, with black around it
The default for film shots

Small window
About 34% of the width, on a third, surrounded by black
Quiet moments, details, portraits in Behind the camera

Text only
Black, with one line or phrase
Intertitles, facts, credits beats, links

Windows keep the picture's own aspect ratio and are never cropped into a card shape. Successive windows alternate sides, so the eye travels across the screen like a slow pan.
Density limits
One picture and at most one text group on screen at a time. Never two pictures, except for the single frame of a cut.

At most 24 words visible at once (a two-line subtitle). The Impressum is the only exception.

On text-only screens, the text block takes no more than 40% of the screen width. Everything else is black.

Windows keep at least 12vh of black above and below them and 8vw at the sides.

Pacing
A beat is something arriving or leaving. There is at least one beat every 60vh of scroll.

Rests: 20–40vh of pure black and grain between scenes, like a breath. Never longer than 40vh.

One fact per beat: the title, then the year and format, then one sentence of the synopsis, then the next.

Text and pictures alternate more often than they overlap: a sentence on black, then the picture develops. Text sits on a picture only when the line belongs to that image (a subtitle).

Layers (back to front)
#
Layer
Moves

1
The room (Gate black)
Never

2
Picture
Develops in; weaves on its own seed

3
Text (real DOM text)
Arrives in stepped frames; weaves on its own seed, smaller than the picture

4
Grain
Renewed every film frame, over everything

—
Interface (nav, projector line)
Sits under the grain; never weaves

The CMS: Nico's own login
Nico logs in at nicojs.com/admin with his own account. From there he can add a film, change a shot, fix a synopsis in any language or reorder the screening, all without touching code and without breaking the design. The CMS is Payload, configured with the content model below and an admin written in plain words.
Accounts and roles
Role
Who
Can

Admin
Adam
Everything, including the Projector settings, users and SEO defaults

Editor
Nico
All content, media, the screening order and publishing. Can't change users or the Projector settings

Login uses email and password, with password reset by email and two-factor authentication through the payload-totp plugin. Login attempts are rate-limited (Stage 12).
Collections (fields marked L are localized: EN, DE, ES)
Collection
Fields
Notes

Films
Title, Slug, Year, Format (Super 16mm / 16mm / Super 8mm / 35mm / Digital, multi-select), Runtime, Logline (L), Synopsis (L), Credits (array: role, name), Shots (array, below), Poster (small use only), Watch links (array: label, URL), Trailer (Vimeo or YouTube URL, for the film page), Status
One entry = one reel in the screening, plus its own film page

Shots (array inside Films)
Picture (image) or Clip, Hold (Short / Normal / Long), Composition (Full-bleed / Large window / Small window, and side), Develop (Auto / Always / Never), Subtitle (L, max 2 × 62 characters), Text safe area (Left / Right / Top / Bottom), Mono (yes / no)
Order in the array = order in the edit

Recognition
Film (relation), Festival or award name, Kind (Opening film / Official selection / Shortlisted / Semi-finalist / Honourable mention / Winner, Best …), Year, Laurel (SVG or PNG, optional), Order
Feeds the Festival circuit beats and the film pages

Press
Quote (L), Source, Link, Date
Hidden until it has entries

Media
Images, with alt text (L), a focal point and a credit line
Sizes are generated automatically (below)

Clips
Original video upload, plus generated files, duration, fps and a status (Queued / Encoding / Ready / Failed)
Encoded automatically (below)

Users
Name, email, role
Auth collection

Globals
Global
Fields

Site
Name, tagline (L), statement (L), email, social links, SEO title and description defaults (L), social image

About
Portrait shots (same shot array as Films), bio as subtitle lines (L)

Screening
The running order as reorderable blocks: Opening, Intertitle, Reel (choose a film), Festival circuit, Behind the camera, End title, with rests between them. Each block can be hidden. This global is the edit decision list the site plays

Projector (admin only)
Grain strength, picture weave, text weave and development speed, with defaults from Stage 3, so the look can be tuned without a deploy

Editing experience
Live preview opens the actual screening beside the form, so Nico sees a shot change on the real site before publishing.

Drafts and versions: nothing goes live until he presses Publish, and any version can be restored.

Plain-language help on every field (e.g. "Hold: how long this shot stays on screen while scrolling. Normal suits most shots"), character counters on subtitles, and a short "How to add a film" panel on the admin dashboard.

Languages: English is required and German and Spanish are optional, falling back to English when empty. Nico writes Spanish himself; German goes to a proofreader.

Media pipeline
Images: on upload, the server generates AVIF and WebP at 640, 1280, 1920 and 2560px wide, keeps the focal point and stores everything on R2. Uploads under 1920px wide get a warning.

Clips: on upload, a Payload job runs ffmpeg and produces scrub_1920.mp4 and scrub_960.mp4 (all-intra: every frame a keyframe, 24 fps, no audio, so scroll scrubbing is frame-accurate), loop_1280.mp4 (a normal encode for autoplay loops) and poster.jpg (the first frame). The status shows in the admin, and failures are emailed to Adam. Scrub clips are capped at 15 seconds.

The film engine: development, weave and grain
The engine does three things, and does each of them convincingly. It develops pictures into view like a print in the darkroom tray, it weaves each layer like film running through a gate, and it lays a fine, living grain over the whole screen. That's all: no frames, glows, halation, dust, scratches, flicker or vignettes. Restraint is the point.
Setup
Two canvases: the picture canvas (three.js, WebGL2) behind the text, and the grain canvas on top of everything, with pointer-events: none. Two WebGL contexts in total.

All text is real DOM text, sitting between the two canvases: crisp, selectable, accessible and translatable.

Film clock: weave and grain advance once per film frame at 24 fps, whatever the screen's refresh rate (frame = floor(time * 24)). The stepping is part of what makes it read as film.

Pictures are colour-managed (sRGB) and shown exactly as Nico graded them: no tone curve, no saturation change, no added contrast.

1. Development: the darkroom reveal
A print in the developer doesn't fade in. It comes up: the image starts to appear after a while, the darkest areas first, then keeps building density, all under the dim red of the safelight, and it is judged properly only once the lights come on. The site recreates that, tied to scroll (scrolling back sinks the picture back into the paper).
Phase
Share of the develop range
What you see

1. Paper under safelight
0–10%
A dim, warm red rectangle where the picture will be: blank paper seen by safelight. Low luminance, never bright

2. Shadows emerge
10–45%
The darkest areas form first, then the midtones, as density builds. Faint at first, gaining contrast

3. Agitation
15–60%
Development is slightly uneven: a soft front sweeps across the picture in the direction the tray is rocked, then evens out completely. No streaks remain

4. Full density
45–75%
Midtones and highlights complete, still under the red cast

5. Lights on
75–100%
The safelight cast lifts to the true picture over at least 12 film frames: a gentle rise, never a flash

Shader logic, per pixel: t = clamp((progress - L * 0.55 - wave(uv, progress) * 0.08) / 0.35, 0.0, 1.0), where L is the pixel's final luminance, so darker pixels reach full density first. Then image = mix(paperUnderSafelight, picture * safelightCast, t), and in phase 5 safelightCast eases to neutral white. Colour pictures develop with their dye layers very slightly out of step (cyan, magenta and yellow density arriving a few percent apart), so colour forms rather than fades.
When: the first picture of each scene, and any picture arriving out of a black rest. Cuts inside a sequence don't re-develop.

Length: the first 45% of the shot's hold (about 27vh for a Normal hold). The opening portrait develops on a 2.5 s timer on load, because the visitor hasn't scrolled yet.

Optional, off by default: a "from negative" variant for one moment on a film page, where a colour frame first appears as a negative on its orange base, then inverts to positive.

Reduced motion: pictures appear already developed.

2. Weave: every layer on its own
Each layer has its own noise seed and a slightly different period, so the layers drift a fraction apart and back together, like separately printed elements on an optical-printer composite. All motion is stepped at 24 fps.
Layer
Slow drift (period)
Per-frame jitter
Rotation

Picture
±0.25% of picture height (1.7 s)
±0.06%
≤0.03°

Titles and intertitles
±0.8 px (1.3 s)
±0.3 px
none

Subtitles and body text
±0.5 px (2.1 s)
±0.2 px
none

Nav, projector line, links
none
none
none

The picture weave is applied in the shader (a UV offset with 1% overscan for full-bleed; for windows the whole window moves, edges included). The text weave is a CSS transform on each text group's wrapper: GPU-composited, never causing layout. If any text weave makes reading uncomfortable, halve it.
3. Grain over everything
The top canvas covers the viewport and blends with mix-blend-mode: soft-light, so the grain shows most in midtones and least in pure black and white, the way grain sits in an emulsion. It covers pictures, black and text alike.

Physically based, not uniform noise. At build time, a Node script renders tileable 512 × 512 grain plates from the Boolean film-grain model (Newson, Delon, Galerne and colleagues, 2017): 12 random variants at each of 4 densities, monochrome. Every film frame picks a new variant and a random offset, so the grain lives and never visibly repeats.

Size and strength: grain clumps of about 1–2 CSS px (sized from resolution ÷ device pixel ratio, so retina screens don't erase it). The default strength is 0.06 in soft-light: almost invisible on black, felt on midtones. The test: you notice it only when you look for it.

24 fps on desktop and 12 fps on phones. Under reduced motion it freezes (one still plate) rather than disappearing.

Calibrate size and texture against a raw scan from Nico's own negative, side by side in the lab.

The lab (/lab, admin login only): load any test frame or clip, scrub the development with a slider, and adjust each layer's weave and the grain strength live, with an A/B wipe against Nico's scan and a frame-time readout.
The 4 lab tests
A flat midtone wall: the grain is visible but fine, with no colour speckle.

A deep shadow beside the black page: the grain is barely there, and never sits on black as flat noise.

A face developing: shadows come first, and lights-on is a gentle rise with no flash.

A title over a picture: the two layers drift independently, and the text stays comfortable to read.

Fail conditions: any frame, border, glow or vignette on a picture; grain that reads as noise on black, shows colour, or moves faster than 24 fps; a development that flashes; text weave that tires the eyes.
Budgets: picture canvas at most 2 ms GPU per frame and the grain canvas at most 1 ms at 1440 × 900 on an M1 MacBook Air; at most 5 ms together on a recent iPhone. Rendering pauses when the tab is hidden.
Motion and the edit
Scroll drives one master timeline compiled from the Screening global, so the whole site plays like one continuous, unhurried film that the visitor projects at their own speed. The motion vocabulary is deliberately small: things develop, arrive, hold, and leave through black.
Scroll engine
Lenis drives smooth inertia scrolling (lerp around 0.09, never altering direction), synced to GSAP: lenis.on('scroll', ScrollTrigger.update), with Lenis ticking inside gsap.ticker. Under reduced motion, Lenis is off and native scrolling stays.

The DOM keeps real, semantic sections (<section id="films"> and so on), each as tall as its scroll length, so anchor links, keyboard scrolling and screen readers all work. The canvases stay fixed and read the timeline.

Timeline compiler: turns the Screening global into beats with scroll ranges. Holds: Short 40vh, Normal 60vh, Long 90vh. Text-only beats run 30–60vh, and rests 20–40vh.

Film time: 1 film frame per 8px of scroll, shown in the projector line as HH:MM:SS:FF at 24 fps. Every change lands on a frame boundary.

Film cadence: picture and text motion is stepped at 24 fps, so it moves like projected film. The interface stays smooth.

The whole vocabulary
Move
Length
What happens
Use

Develop
First 45% of a hold
The darkroom reveal (Film engine section)
The first picture of each scene, and any picture after a rest

Cut
0
An instant change on a frame boundary
Between pictures inside a sequence

Push-in
The shot's hold
Still pictures scale from 1.00 to 1.04, linear and very slow
Every still

Scrub
The shot's hold
Clip time = shot progress × clip duration, from the all-intra encode; holds the last frame
Every clip

Arrive
6 film frames
Text fades up in visible 24 fps steps, already weaving on its own layer. It leaves in 4 frames
Every text beat

Fade to black
20–40vh
Picture and text go down through black in stepped frames, as in a film fade, into a rest
The end of every scene

Cut to red
0
After a black rest, one single cut to the Safelight red end title
Once

No crossfades, no slides, no parallax, no scaling text, no bounce.
Titles and text beats
Nico's name: prints in letter by letter over 18 film frames in an uneven order, as if each letter were exposed separately on the optical printer. It holds while the portrait finishes developing, then fades.

Intertitle (the statement): one phrase per beat, alone on black, each arriving over 6 frames. The italic word comes last and holds longest.

Reel openings: ROLLO 1 and the film title on one beat; the year and format on the next; then the first picture develops.

Synopsis and bio: one sentence per beat, either alone on black or as a subtitle on the picture it belongs to. Never more than two lines.

Festival circuit: told in beats, not a list. Festival circuit as an intertitle, then for each film its title, then one recognition per beat: the kind in Label above (OPENING FILM), the festival large in the intertitle size, the year small underneath, and the laurel small beside it if there is one. Each beat holds 30vh. The complete list lives on each film's page, generously spaced.

End title: "Let's make the next one." sets word by word over 3 beats on the red; then the email arrives on its own beat; then the tail: FIN alone on black.

Interface motion: fades of 150–250 ms with a custom "projector" ease (fast out, soft settle), built with CustomEase. The nav and toggles never slide, bounce or weave.
Loading discipline: decode the next 2 pictures ahead of each beat, load clips once their scene is within one viewport, and keep a low-resolution placeholder for every picture, so nothing ever appears half-loaded.
The running order and the pages
The home page is the screening: about 2,000vh on desktop, built from roughly 45 beats, none of them crowded. Each film also gets its own page, so a producer can be sent a direct link. All copy comes from the CMS, with Nico's words verbatim.
The screening (the default Screening order; Nico can reorder or hide blocks)
#
Scene
Beats, in order

1
Opening
Black and grain for 1 s on load → the portrait develops full-bleed (2.5 s timer) → Nico's name prints in over it → the name fades → the tagline alone on black → a shot from film 1 develops in a large window, right → a shot from film 2 in a small window, left → fade to black, rest

2
Intertitle
The statement, one phrase per beat on black → fade, rest

3
Reel 1
ROLLO 1 and "What Else is There?" → 2025 · SUPER 16MM + SUPER 8MM → the key picture develops full-bleed → the synopsis's first sentence as its subtitle → cuts through 3–5 shots in alternating windows (one of them a scrubbed clip) → the next sentence alone on black → the last shot → VIEW THE FILM ↗ and the Berlin Commercial link, alone on black → fade, rest

4
Reel 2
The same structure, as ROLLO 2, for By the Fire

5
Festival circuit
The intertitle → per film: its title → one recognition per beat (Motion section) → fade, rest

6
Behind the camera
A portrait develops in a small window → the bio, one sentence per beat on the opposite side → a second portrait → fade, rest of 40vh

7
End title
Cut to red → "Let's make the next one." in 3 beats → the email on its own beat (njs@disziplin.org, as it stands; see Open decisions) → fade → FIN alone on black

Film pages (/en/films/what-else-is-there and so on): a calm, shorter screening of their own, in the same beat language: title → year and format → the synopsis a sentence at a time → the shots in alternating windows → the trailer (a Vimeo or YouTube embed, loaded only on click, borderless on black) → the credits (role and name, one pair per line, generously spaced) → the full festival list for that film, generously spaced → the small poster → the watch links. Each page gets its own social image (a clean still with the title).
Other routes
/en, /de and /es: the screening in each language. / redirects to the visitor's browser language, falling back to /en.

/admin: the CMS (Nico and Adam). /lab: the film lab (admin login only).

A 404 page: black, grain, ROLLO PERDIDO ("lost reel") and a link home.

No cookie banner (no cookies beyond the admin session). An Impressum and privacy page, linked quietly from the projector line (a German legal requirement; Nico supplies the details).

Sound (optional, off by default)
Sound stays off until the visitor turns on SOUND ○ in the projector line. Browsers block audio before a click anyway, and most people browse with sound off. When it's on, the sound is as minimal as the picture: a projector quietly running, and the darkroom.
Sound
Behaviour

Projector
A soft motor and gate loop whose rate follows scroll velocity: idle at rest, running at film speed while scrolling, winding down as scrolling stops

Developer tray
A faint rocking of liquid during a development

Lights on
A soft switch click as the safelight lifts

Source: Adam records a real 16mm projector and a developing tray (close-miked, no room) or designs the sounds himself. Otherwise Claude Code synthesizes them with the Web Audio API.
Rules: keep the mix quiet with no sudden transients, mute when the tab is hidden, remember the choice for the visit, and never play sound under reduced motion unless it's explicitly switched on.
Responsive, performance and fallbacks
The screening works on every screen, with a phone getting a shorter, calmer cut of the same film. If WebGL or video isn't available, the site degrades to a still, graded, fully readable version.
Breakpoints
Desktop (1200px+)
Tablet (810–1199px)
Phone (under 810px)

Scroll lengths
As specified
85%
70%

Crops
Each shot's focal point
Same
Large and small windows become centred windows at about 86% and 60% width; full-bleed crops to portrait around the focal point

Clips
scrub_1920
scrub_1920
scrub_960. On low-power devices, the clip is replaced by 3 stills

Film engine
Full pipeline
Full pipeline
Pixel ratio capped at 1.5, grain at 12 fps

Transitions
All
All
All, with development 30% shorter

Nav
Inline
Inline
ÍNDICE opens a full-screen index, alone on black

Subtitles
24px max
20px
17px, at most 2 lines

Use svh and dvh units so mobile browser bars never cut the frame. Tap targets are at least 44 × 44px. Test at 1920, 1440, 1200, 1024, 810, 600, 390 and 360px wide, in portrait and landscape.
Performance budgets
Metric
Target

Largest Contentful Paint
Under 2.0 s on desktop, under 2.5 s on a mid-range phone (the first shot is a server-rendered <img> that the canvas takes over from)

JavaScript before interaction
Under 180 KB gzipped. three.js and GSAP load after first paint

GPU time per frame
Desktop under 3 ms, phone under 5 ms (Film engine section)

Scroll
No dropped frames during cuts or scrubbing on desktop

Media per screening
First screen under 400 KB; the rest streams in as you scroll

Lighthouse
90+ on Performance, Accessibility, Best Practices and SEO, on mobile

Fallback ladder
Full: WebGL2 with video. The whole screening.

No video autoplay or scrubbing (data saver, low power): clips become their stills, and everything else stays.

No WebGL2: a DOM-only screening. Pictures are <img> shown as graded, the text is unchanged, and beats still happen on scroll, with a simple fade in place of development and no grain.

Reduced motion: no Lenis, no weave, development animation or scrubbing, and the grain is frozen. Shots cut on scroll; titles appear without builds.

No JavaScript: a plain, beautiful, server-rendered page with every scene's first shot, all the text and working links.

Accessibility, SEO and languages
The spectacle sits on top of a fully accessible, indexable page. Every word a visitor sees is real HTML text.
Accessibility (WCAG 2.2 AA)
All text is real DOM text in reading order, with correct headings: one H1 (Nico's name), and an H2 for each scene title.

prefers-reduced-motion triggers fallback level 4. PROYECTOR ● stops all motion for anyone, including the text weave and grain movement (WCAG 2.2.2: pause moving content).

Nothing flashes more than 3 times per second, including the development's lights-on step and the cut to red (WCAG 2.3.1).

Keyboard: skip link to content, visible 2px Safelight red focus rings, and every scene reachable with Tab and the anchor links.

Every image has localized alt text from the CMS. The canvas has aria-hidden="true", because every picture also has alt text in the DOM.

Text contrast follows the Design system table. Subtitles over pictures keep their shadow at every size.

SEO and sharing
Item
Value

Home title
"Nicolás J. Scatamacchia · Film director, Berlin" (localized)

Home description
"Argentine-born director based in Berlin, shooting on celluloid. Films about hope and beauty. Selected two years in a row by Berlin Commercial Awards." (built only from Nico's facts; Nico approves it; localized)

Film page titles
"[Title] ([Year]) · a film by Nicolás J. Scatamacchia"

Structured data
JSON-LD Person on the home page and Movie on film pages (director, year, awards)

Social images
Generated with next/og: a graded still, the title in Instrument Serif and a hint of grain, 1200 × 630, per page and per language

Favicon
A single Safelight red cue dot on Gate black

Sitemap and hreflang
Generated, covering every page in EN, DE and ES

Languages
next-intl routes (/en, /de, /es) with a language switch in the nav that keeps the visitor's place in the screening.

Interface strings (nav, labels, buttons, 404) live in messages/en.json, de.json and es.json. Content strings come from Payload's localized fields.

The Spanish markers (ROLLO, FIN, PROYECTOR, ÍNDICE) stay the same in every language as Nico's signature.

Layout must survive German (about 35% longer) and Spanish (about 25% longer). Test with padded strings at every breakpoint.

Typographic quotes per language: “English”, „Deutsch“, «español», plus ¿ and ¡. Run a glyph test on both fonts in Stage 2.

Security, hosting and handover
The site is small, but it has a login, so it is treated like an application: locked-down admin, secrets kept out of the repo, backups that are actually tested, and a handover Nico can follow without Adam.
Security
/admin uses Payload auth with strong passwords, two-factor authentication (TOTP) for both accounts, rate-limited logins and lockout after repeated failures.

Secrets (database URL, R2 keys, Payload secret, email key) live only in the host's environment variables and a local .env that is never committed. A .env.example lists the names.

Security headers: a strict Content Security Policy (allowing only the site, R2, and Vimeo or YouTube for trailer embeds), HSTS, and frame-ancestors 'none' for the admin.

Uploads accept images and video only, checked by file signature, not just extension, with size limits (images 30 MB, clips 500 MB).

Dependencies are kept current with Renovate or Dependabot. Payload and Next.js are updated in a monthly maintenance pass.

Hosting and operations
Deploy from GitHub: main deploys to production, and every branch gets a preview URL.

Daily Postgres backups kept for 30 days, plus a weekly export of the R2 bucket. Restore is tested once in Stage 12 and documented.

Uptime monitoring with an email to Adam if the site or the encoding jobs fail.

Domain move (Stage 12): lower the DNS TTL a day ahead, point nicojs.com at the new host, check HTTPS, redirects and email, then cancel the Framer plan only after a week of the new site running cleanly.

Handover
A short guide for Nico in the admin dashboard and as a PDF: logging in, adding a film, adding shots and clips, writing subtitles, translating, reordering the screening, previewing and publishing.

A 30-minute walkthrough call, recorded.

README.md for any future developer: the stack, how to run it locally, the environment variables, how to deploy, how to restore a backup, and the film engine's parameters.

Build stages
There are thirteen stages, built in this order so that each one stands on a finished foundation. The CMS and a readable static site come first, the film look is proven in a lab before it touches the page, and motion goes on last. Each stage ends with a stop for Adam's review.
Stage
Model
Builds
Done when

0. Setup
Sonnet
Repo, Next.js 16 + Payload 3, Postgres, R2 storage, hosting (option A or B, Stack section), preview deploys per branch, CLAUDE.md, PROGRESS.md, DECISIONS.md, .env.example
A blank site and /admin are live on a preview URL; Adam can log in; the exact monthly cost is reported

1. CMS and content
Sonnet
Every collection and global from the CMS section, roles, TOTP, localization (EN, DE, ES), image sizes, live preview, plain-language field help. Seed it with Nico's current copy and assets, verbatim
Nico's test account can add a film and a shot in a recorded run-through; a diff shows his copy unchanged

2. Static screening
Sonnet, Opus for type polish
Design tokens, fonts, the 3 chrome elements, every scene in DOM only (first shot of each, real text, server-rendered), next-intl routes, glyph test. This is fallback level 5
Screenshots of every scene at 1440, 810 and 390px look like a set of film frames with no JavaScript

3. Film engine lab
Opus
The /lab route: development, per-layer weave, and the grain-over-everything canvas with physically based plates; the 4 lab tests; A/B against Nico's scan; the frame-time readout
Recordings of the 4 lab tests and of a full development scrubbed forward and back, GPU time per canvas, Adam's sign-off on the look

4. Projector
Opus
The two canvases on the real page, the composition modes (full-bleed and windows), DOM-to-canvas sync, texture streaming and placeholders, video textures, the text-layer weave, context-loss recovery
The screening shows every shot through the engine; the WebGL context count stays at 2; no blank frames on fast scrolling

5. Timeline and cuts
Opus
Lenis + ScrollTrigger, the timeline compiler, develop, cut, push-in, scrub, arrive, fade to black, rests, subtitles, timecode, film cadence
Full-length recordings forward and back at normal speed; timecode and cuts in step; no dropped frames on desktop

6. Transitions and titles
Opus
The name build, intertitle beats, reel openings, the Festival circuit beats, the cut to red and the end title, plus a full pacing pass against the Space, pacing and layers rules
A full-length recording that passes the density limits (never more than one picture and one text group on screen); no flashes (frame-by-frame luminance check)

7. Film pages and credits
Sonnet
Film pages, trailer embeds on click, the 404, Impressum and privacy
Both film pages are recorded in all three languages

8. Media pipeline
Sonnet
The Payload job with ffmpeg (all-intra scrub encodes, loop encode, poster frame), status in the admin, failure emails. (Until this stage, clips are encoded by hand with the commands in Assets)
Uploading a raw clip in the admin produces working scrub files without touching a terminal

9. Sound (optional)
Opus
The projector sound layer and its toggle
A recording with sound on; sound is off by default

10. Responsive and fallbacks
Sonnet, Opus for phone motion
The breakpoint table and fallback levels 2–4
Recordings on a real iPhone and Android phone, plus screenshots of each fallback level

11. Performance, accessibility, SEO
Opus
Budgets, Lighthouse, keyboard and screen-reader pass, flash check, metadata, JSON-LD, social images, sitemap and hreflang
Lighthouse reports on mobile and desktop, an accessibility checklist marked pass or fail, social image previews

12. Security, launch and handover
Sonnet
Security headers, rate limits, backup and restore test, uptime monitoring, the domain move, Nico's guide and walkthrough
The site is live on nicojs.com, a restore has been tested, and Nico has published one change himself

Rules for every stage
Never change Nico's words or facts. New interface labels only where this brief gives them.

Keep PROGRESS.md and DECISIONS.md current, and commit at the end of every session.

Recordings come from the running site in a real browser, never from code screenshots.

Ask instead of guessing when the brief and reality conflict.

Assets and open decisions
The site is only as good as the frames it shows. Real material from Nico's films is the single biggest quality lever in this brief, so it's needed before Stage 3.
Assets from Nico (through Adam)
Asset
Spec
How many
Needed by

Frame grabs
Clean frames from the graded master, with no titles, subtitles or credits. 2560px wide (1920 minimum), original aspect ratio, sRGB
6–10 per film
Stage 3

Clips
One continuous shot or short sequence per film, 6–12 s, no text, the master file (ProRes or high-bitrate H.264)
1–2 per film
Stage 4

Raw scan crops
2–3 ungraded, un-denoised frames straight from the 16mm and Super 16 scans, at full scan resolution: a flat midtone area, a shadow and a bright edge
2–3
Stage 3 (grain calibration)

Lab test frames
The 4 lab tests in the Film engine section, picked from the frame grabs
4
Stage 3

Portraits
2–3 portraits of Nico, 2400px or more on the long side, one of them B&W-friendly
2–3
Stage 2

Trailers
Vimeo or YouTube links
1 per film
Stage 7

Credits
Role and name for each film
Per film
Stage 1

Laurels
SVG or transparent PNG
Optional
Stage 7

Impressum details
Name, address, contact, as required in Germany
1
Stage 7

Translations
Spanish from Nico; German from a proofreader
All localized fields
Stage 11

Projector sound
Close-miked recordings of a 16mm projector, if sound is wanted
Optional
Stage 9

Never use posters as stills, and never pre-apply grain or filters to the frames: the engine adds the grain, and doubling them looks fake.
Encoding clips by hand until Stage 8
The all-intra scrub files (every frame a keyframe) come out roughly 3–5 times larger than normal encodes, which is why scrub clips are capped at 15 seconds.
Open decisions for Adam
Commercial terms with Nico. This is a substantial custom build. Agree the fee (or the portfolio trade) before Stage 0, and consider a small monthly retainer for hosting, the monthly maintenance pass and content help, which is recurring income.

Hosting: option A (one container host, recommended) or B (Vercel Pro plus a worker), and who owns the accounts (ideally Nico, with Adam as admin).

Access to the nicojs.com domain registrar and DNS for the move in Stage 12.

Sound: in or out?

Accent: Safelight red #E8441E, or the current #FF5A1F (more orange, slightly higher contrast)?

Spanish markers (ROLLO, FIN, PROYECTOR, ÍNDICE) in every language: yes or no?

Email: the site uses njs@disziplin.org, while the company is spelled "Disziplin" elsewhere. Confirm the address works before launch.

Nico's sign-off on the meta description and on the look after Stage 3.

Deadline.

Sources
Payload 3.0: the CMS that installs into Next.js (jobs queue, live preview)

Payload: Next.js 16 compatibility

Payload docs: Localization

Payload CMS auth plugins compared (payload-totp)

GSAP: the full toolset is free

Lenis smooth scroll

Cloudflare R2 pricing

Vercel Terms of Service: Hobby plan and Vercel pricing comparison

Newson et al., Realistic Film Grain Rendering (IPOL, 2017)

Dehancer: Halation and Dehancer: Gate Weave

Why film grain differs from digital noise

Cue mark (changeover cues)

Fixing stuttering scroll-scrubbed video with all-intra encodes

Chromium: limit on active WebGL contexts

Scroll animations: when pinned sections stay too long

Art of the Title: Jean-Luc Godard

Development research
Ilford: Making your first print

Photrio: when the image appears in the developer

CineStill: bromide drag and surge marks

35mmc: why colour negative film has an orange mask

