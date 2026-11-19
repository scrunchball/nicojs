/**
 * Nico's content, verbatim from his Pages document (www.njs-film.com.pages).
 * Shaped like the Payload collections in docs/BRIEF.md so the CMS can replace
 * this file later without touching the page components.
 * German and Spanish fall back to English until proofread translations exist.
 */
import media from "./media.json";
import variants from "./media-variants.json";

export type Composition = "full-bleed" | "large-window" | "small-window";

export type Shot = {
  id: string;
  /** image; clip (scrubbed by scroll); loop (plays in the background); film (the player's source). */
  kind: "image" | "clip" | "loop" | "film";
  /** Image (or clip poster) under /public. */
  src: string;
  /** Clips only: loop encode and all-intra scrub encode. Films: the full-quality stream (R2). */
  loop?: string;
  scrub?: string;
  /** Films: a lighter stream for phones and data saver (R2). */
  sd?: string;
  width: number;
  height: number;
  /** Where the picture's subject is (0..1 from the top-left); crops keep it in frame. */
  focal?: [number, number];
  /** Responsive WebP variants and a tiny inline preview (scripts/encode-media.py). */
  srcSet?: string;
  lqip?: string;
  alt: string;
  composition: Composition;
  side?: "left" | "right";
  subtitle?: string;
};

export type Recognition = {
  kind: string;
  festival: string;
  year?: number;
  note?: string;
  /** Festival laurel beside the award (SVG or transparent PNG) under /public. */
  laurel?: string;
};

export type Film = {
  slug: string;
  title: string;
  year: number;
  formats: string[];
  /** One sentence per beat. */
  synopsis: string[];
  link: { href: string };
  /** Key image, full-bleed, carries the first synopsis sentence as its subtitle. */
  keyShot: Shot;
  /** The closing pair: image 1 with the second sentence off its corner, then image 2. */
  lastShot: Shot;
  secondShot: Shot;
  /** Watch beat: a short background loop, and the film the custom player plays. */
  loop: Shot;
  film: Shot;
  recognition: Recognition[];
};

/* ---------- media: content/media.json is the single list of files (see docs/MEDIA.md) ---------- */
type MediaShot = { id: string; kind: Shot["kind"]; size?: [number, number]; focal?: [number, number]; url?: string; sd?: string };
const folders = (media as unknown as { folders: Record<string, { size: [number, number]; shots: MediaShot[] }> }).folders;

function shot(folder: string, id: string, alt: string, composition: Composition, side?: "left" | "right"): Shot {
  const f = folders[folder];
  const m = f.shots.find((x) => x.id === id);
  if (!m) throw new Error(`content/media.json has no ${folder}/${id}`);
  const [width, height] = m.size ?? f.size;
  const base = `/media/${folder}/${id}`;
  const v = (variants as Record<string, { w: number[]; lqip: string }>)[`${folder}/${id}`];
  return {
    id, kind: m.kind, src: `${base}.jpg`, width, height, alt, composition, side, ...(m.focal ? { focal: m.focal } : {}),
    ...(v ? { srcSet: v.w.map((w) => `${base}-${w}.webp ${w}w`).join(", "), lqip: v.lqip } : {}),
    ...(m.kind === "clip" ? { loop: `${base}.mp4`, scrub: `${base}-scrub.mp4` } : {}),
    ...(m.kind === "loop" || m.kind === "film" ? { loop: m.url ?? `${base}.mp4` } : {}),
    ...(m.sd ? { sd: m.sd } : {}),
  };
}

export const site = {
  name: "Nicolás J. Scatamacchia",
  nameMark: "Nicolás J. Scatamacchia",
  email: "njs@disziplin.org",
  tagline: "Berlin-based director making films about hope and beauty.",
  /** One phrase per beat; the last phrase's final word is set in italic. */
  statement: [
    "Selected two years in a row by Berlin Commercial Awards.",
    "Zero budget, both times.",
    "Imagine what’s next.",
  ],
  /** Set one word per beat; "next one." on the second line. */
  endTitle: ["Let’s", "make", "the", "next", "one."],
  bio: [
    "I’m a Latino director, born in Argentina and based in Berlin.",
    "After years in production, I now direct full-time.",
    "I shoot on film and other formats, and my films explore the human condition through storytelling.",
    "I’m now looking for a production company that wants to see what I can do with a real budget.",
  ],
  getInTouch: "Get in touch",
};

export const films: Film[] = [
  {
    slug: "what-else-is-there",
    title: "What Else is There?",
    year: 2025,
    formats: ["Super 16mm", "Super 8mm"],
    synopsis: [
      "Sun, bikes, dancing, film.",
      "A filmmaker and an actress spend a summer day filming each other: a love letter to cinema and to being alive.",
    ],
    link: { href: "https://berlincommercial.awardsengine.com/winners/2025/personal-work#193614" },
    keyShot: shot("what-else-is-there", "wei-01", "Frame from What Else is There?", "full-bleed"),
    lastShot: shot("what-else-is-there", "wei-05", "Frame from What Else is There?", "large-window", "left"),
    secondShot: shot("what-else-is-there", "wei-06", "Frame from What Else is There?", "large-window", "left"),
    loop: shot("what-else-is-there", "wei-loop", "What Else is There?, a moment from the film", "full-bleed"),
    film: shot("what-else-is-there", "wei-film", "What Else is There?", "full-bleed"),
    recognition: [
      { kind: "Opening film", festival: "Berlin Short Film Festival", year: 2026, laurel: "/media/laurels/wei-1.svg" },
      { kind: "Shortlisted", festival: "Berlin Commercial Awards", year: 2025, note: "Personal Work – Experimental", laurel: "/media/laurels/wei-2.svg" },
      { kind: "Semi-Finalist", festival: "Flickers’ Rhode Island International Film Festival", year: 2026, laurel: "/media/laurels/wei-3.svg" },
      { kind: "Honorable Mention", festival: "Los Angeles Experimental Forum", year: 2026, laurel: "/media/laurels/wei-4.svg" },
      { kind: "Honorable Mention", festival: "Hollywood New Directors", year: 2026, laurel: "/media/laurels/wei-5.svg" },
    ],
  },
  {
    slug: "by-the-fire",
    title: "By the Fire",
    year: 2026,
    formats: ["16mm"],
    synopsis: [
      "A man quits his day job to live a life with meaning.",
      "A meditative journey through earth, water, air and fire, where layers of identity fall away and what remains is presence, and love.",
    ],
    link: { href: "https://berlincommercial.awardsengine.com/winners/2026#208868" },
    keyShot: shot("by-the-fire", "btf-01", "Frame from By the Fire", "full-bleed"),
    lastShot: shot("by-the-fire", "btf-05", "Frame from By the Fire", "large-window", "right"),
    secondShot: shot("by-the-fire", "btf-06", "Frame from By the Fire", "large-window", "right"),
    loop: shot("by-the-fire", "btf-loop", "By the Fire, a moment from the film", "full-bleed"),
    film: shot("by-the-fire", "btf-film", "By the Fire", "full-bleed"),
    recognition: [
      { kind: "Winner, Best Cinematography", festival: "FHIFF (Italy)", laurel: "/media/laurels/btf-1.svg" },
      { kind: "Official Selection", festival: "Berlin Commercial Awards", year: 2026, note: "Cultural Work", laurel: "/media/laurels/btf-2.svg" },
      { kind: "Opening film", festival: "Awareness Festival (California, USA)", laurel: "/media/laurels/btf-3.svg" },
      { kind: "Official Selection", festival: "FHIFF (Italy)", laurel: "/media/laurels/btf-4.svg" },
    ],
  },
];

export const portraits = {
  opening: shot("portraits", "portrait-01", "Portrait of Nicolás J. Scatamacchia", "full-bleed"),
  /** Behind the camera: the bio lines share these pictures in order; each new one rolls in on a shutter and develops. */
  sequence: [
    shot("portraits", "portrait-02", "Nicolás J. Scatamacchia reading a script in a director's chair", "small-window", "left"),
    shot("portraits", "portrait-03", "Nicolás J. Scatamacchia on set beside the director's chair", "small-window", "left"),
  ],
};

/** The opening's two film shots: film 1 large right, film 2 small left. */
export const openingShots = [
  { ...shot("what-else-is-there", "wei-02", "On set, behind the scenes", "large-window", "right"), id: "open-wei-02" },
  { ...shot("by-the-fire", "btf-02", "On set, behind the scenes", "small-window", "left"), id: "open-btf-02" },
];
