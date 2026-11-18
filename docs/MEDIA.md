# Media: how to replace the placeholders

Every picture and clip on the site is listed in `content/media.json` and lives in `public/media/<folder>/`.
Each file is currently a **PLACEHOLDER** (soft abstract image with its filename in the corner).
Replacing a placeholder needs **no code change**: a file with the same name takes its place.

## Easiest: send them to Claude
Drop the frames and clips into the Claude session. Claude renames, checks size and colour space,
encodes the clips (loop + all-intra scrub + poster), puts them in place, and pushes a preview.

## Or by hand (images only)
Upload JPGs on GitHub into `public/media/<folder>/` on the stage branch, with exactly these names.
Clips need encoding (see below), so send those to Claude.

| Folder | File | What goes there |
|---|---|---|
| `what-else-is-there` | `wei-01.jpg` | Key image, full-bleed, with the first line of the synopsis |
| | `wei-02.jpg` | Opening: large window, right |
| | `wei-05.jpg` | Closing pair, image 1 (the second sentence sits off its corner) |
| | `wei-06.jpg` | Closing pair, image 2 |
| | `wei-loop.mp4` | Watch beat: a short loop behind the button (6–10 s, no text, no sound) |
| | `wei-film.mp4` | The film for the player (5–10 min: goes to R2, see below) |
| `by-the-fire` | `btf-01.jpg` | Key image, full-bleed, with the first line of the synopsis |
| | `btf-02.jpg` | Opening: small window, left |
| | `btf-05.jpg` | Closing pair, image 1 (the second sentence sits off its corner) |
| | `btf-06.jpg` | Closing pair, image 2 |
| | `btf-loop.mp4` | Watch beat: a short loop behind the button (6–10 s, no text, no sound) |
| | `btf-film.mp4` | The film for the player (5–10 min: goes to R2, see below) |
| `portraits` | `portrait-01.jpg` | Opening portrait (hero), full-bleed. **In: Nico's close-up** |
| | `portrait-02.jpg`, `portrait-03.jpg` | Behind the camera, in order (the four bio lines share them). More can be added (`portrait-04`, …): add them to `content/media.json` |
| `laurels` | `wei-1.svg` … `wei-5.svg` | Laurels for What Else is There?, in the order of its awards (Berlin Short Film Festival, Berlin Commercial Awards, Flickers' Rhode Island, LA Experimental Forum, Hollywood New Directors) |
| | `btf-1.svg` … `btf-4.svg` | Laurels for By the Fire (FHIFF winner, Berlin Commercial Awards, Awareness Festival, FHIFF selection) |

Laurels: SVG or transparent PNG. If one is a PNG, send it to Claude (the path changes from `.svg` to `.png`).

**The films (5–10 min)** are 150–400 MB, over Cloudflare Pages' 25 MiB per-file limit. They go on Cloudflare R2
(free up to 10 GB, serves MP4 with seeking); the player then points at the R2 URL. Send the masters to Claude
for a 1080p web encode (H.264, ~6 Mbps, AAC audio).

## Delivered so far
- Portraits: the close-up (hero), reading in the director's chair, standing by the director's chair.
- What Else is There?: key = two women in the field; pair = close-up by the water, reading under the tree; loop = the cycling clip.
- By the Fire: key = arms open in the sunflowers; pair = covered head at the desk in the field, three at the fire; loop = the flower/eye clip.
- Full films: on R2 (`nicojs-media/films/`), 1080p + 720p each.
- Still to come: the opening's two windows (wei-02, btf-02), laurels, more portraits (optional).

## Focal points
Each picture can have `"focal": [x, y]` in `content/media.json` (0..1 from the top-left): where the subject is. Crops keep it in frame, which matters most on portrait phones.

## After adding or replacing frames
```bash
python3 scripts/encode-media.py
```
Writes the WebP sizes (960/1600/2560) and the tiny blurred previews. Claude runs this when encoding.

## Specs (from the brief)
- **Frames:** clean frame grabs from the graded master. No titles, subtitles, credits or posters.
  2560px wide (1920 minimum), original aspect ratio, sRGB, JPG quality ~85.
  **Never pre-apply grain or filters**: the engine adds grain, and doubling it looks fake.
- **Clips:** one continuous shot or short sequence, 6–12 s, no text, the master file (ProRes or high-bitrate H.264).
- **Raw scan crops** (for grain calibration in /lab): 2–3 ungraded, un-denoised frames straight from the scans.
- If a real frame has a different aspect ratio from the placeholder, update its `size` in `content/media.json`
  (Claude does this when encoding).

## Clip encodes (until the Stage 8 media pipeline does this on upload)
```bash
# loop (autoplay loops), 1280 wide
ffmpeg -i master.mov -vf "scale=1280:-2,format=yuv420p" -c:v libx264 -preset slow -crf 20 -movflags +faststart -an wei-04.mp4
# scrub (frame-accurate scroll scrubbing): all-intra, 960 wide, 24 fps, no audio
ffmpeg -i master.mov -vf "scale=960:-2,format=yuv420p" -r 24 -c:v libx264 -preset medium -crf 22 -g 1 -keyint_min 1 -sc_threshold 0 -movflags +faststart -an wei-04-scrub.mp4
# poster (first frame)
ffmpeg -i wei-04.mp4 -frames:v 1 -q:v 3 wei-04.jpg
```
**Size limit:** Cloudflare Pages serves files up to 25 MiB. All-intra scrub files are 3–5x larger than normal
encodes, so keep scrub clips short (≤ 10 s at 960 wide). Larger media moves to R2 in the backend phase.

## Full films on Cloudflare R2
Bucket `nicojs-media`, public URL `https://pub-54ce44e4126944899cfbb4c683fd43f6.r2.dev`. Files live under `films/`:
`what-else-is-there-1080.mp4`, `what-else-is-there-720.mp4`, `by-the-fire-1080.mp4`, `by-the-fire-720.mp4`.
The URLs are set on `wei-film` / `btf-film` in `content/media.json` (`url` and `sd`).
Encodes (crop only if the master has burned-in bars):
```bash
ffmpeg -i master.mp4 -vf "format=yuv420p" -c:v libx264 -preset slow -profile:v high -crf 20 -maxrate 7M -bufsize 14M -c:a aac -b:a 160k -ac 2 -movflags +faststart film-1080.mp4
ffmpeg -i master.mp4 -vf "scale=1280:-2,format=yuv420p" -c:v libx264 -preset slow -profile:v high -crf 22 -maxrate 3M -bufsize 6M -c:a aac -b:a 160k -ac 2 -movflags +faststart film-720.mp4
```
Single uploads through the Cloudflare API are limited to ~300 MB per file.
