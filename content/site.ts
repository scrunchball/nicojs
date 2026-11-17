/**
 * Nico's content, verbatim from his Pages document (www.njs-film.com.pages).
 * Shaped like the Payload collections in docs/BRIEF.md so the CMS can replace
 * this file later without touching the page components.
 * German and Spanish fall back to English until proofread translations exist.
 */
import media from "./media.json";

export type Composition = "full-bleed" | "large-window" | "small-window";

export type Shot = {
  id: string;
  kind: "image" | "clip";
  /** Image (or clip poster) under /public. */
  src: string;
  /** Clips only: loop encode and all-intra scrub encode. */
  loop?: string;
  scrub?: string;
  width: number;
  height: number;
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
  /** Cut through after the key image (one of them a clip). */
  shots: Shot[];
  /** The last shot, after the second sentence. */
  lastShot: Shot;
  recognition: Recognition[];
};

/* ---------- media: content/media.json is the single list of files (see docs/MEDIA.md) ---------- */
type MediaShot = { id: string; kind: "image" | "clip"; size?: [number, number] };
const folders = (media as unknown as { folders: Record<string, { size: [number, number]; shots: MediaShot[] }> }).folders;

function shot(folder: string, id: string, alt: string, composition: Composition, side?: "left" | "right"): Shot {
  const f = folders[folder];
  const m = f.shots.find((x) => x.id === id);
  if (!m) throw new Error(`content/media.json has no ${folder}/${id}`);
  const [width, height] = m.size ?? f.size;
  const base = `/media/${folder}/${id}`;
  return {
    id, kind: m.kind, src: `${base}.jpg`, width, height, alt, composition, side,
    ...(m.kind === "clip" ? { loop: `${base}.mp4`, scrub: `${base}-scrub.mp4` } : {}),
  };
}

export const site = {
  name: "Nicolás J. Scatamacchia",
  nameMark: "N. J. SCATAMACCHIA",
  email: "njs@dizsiplin.org",
  tagline: "Berlin-based director making films about hope and beauty.",
  /** One phrase per beat; the last phrase's final word is set in italic. */
  statement: [
    "Selected two years in a row by Berlin Commercial Awards.",
    "Zero budget, both times.",
    "Imagine what’s next.",
  ],
  endTitle: ["Let’s", "make the", "next one."],
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
    shots: [
      shot("what-else-is-there", "wei-02", "Frame from What Else is There?", "large-window", "right"),
      shot("what-else-is-there", "wei-03", "Frame from What Else is There?", "small-window", "left"),
      shot("what-else-is-there", "wei-04", "Clip from What Else is There?", "large-window", "right"),
    ],
    lastShot: shot("what-else-is-there", "wei-05", "Frame from What Else is There?", "large-window", "left"),
    recognition: [
      { kind: "Opening film", festival: "Berlin Short Film Festival", year: 2026 },
      { kind: "Shortlisted", festival: "Berlin Commercial Awards", year: 2025, note: "Personal Work – Experimental" },
      { kind: "Semi-Finalist", festival: "Flickers’ Rhode Island International Film Festival", year: 2026 },
      { kind: "Honorable Mention", festival: "Los Angeles Experimental Forum", year: 2026 },
      { kind: "Honorable Mention", festival: "Hollywood New Directors", year: 2026 },
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
    shots: [
      shot("by-the-fire", "btf-02", "Frame from By the Fire", "large-window", "left"),
      shot("by-the-fire", "btf-03", "Frame from By the Fire", "small-window", "right"),
      shot("by-the-fire", "btf-04", "Clip from By the Fire", "large-window", "left"),
    ],
    lastShot: shot("by-the-fire", "btf-05", "Frame from By the Fire", "large-window", "right"),
    recognition: [
      { kind: "Winner, Best Cinematography", festival: "FHIFF (Italy)" },
      { kind: "Official Selection", festival: "Berlin Commercial Awards", year: 2026, note: "Cultural Work" },
      { kind: "Opening film", festival: "Awareness Festival (California, USA)" },
      { kind: "Official Selection", festival: "FHIFF (Italy)" },
    ],
  },
];

export const portraits = {
  opening: shot("portraits", "portrait-01", "Portrait of Nicolás J. Scatamacchia", "full-bleed"),
  behind: shot("portraits", "portrait-02", "Nicolás J. Scatamacchia on set", "small-window", "left"),
  second: shot("portraits", "portrait-03", "Nicolás J. Scatamacchia", "small-window", "right"),
};

/** The opening's two film shots: film 1 large right, film 2 small left. */
export const openingShots = [
  { ...shot("what-else-is-there", "wei-02", "Frame from What Else is There?", "large-window", "right"), id: "open-wei-02" },
  { ...shot("by-the-fire", "btf-02", "Frame from By the Fire", "small-window", "left"), id: "open-btf-02" },
];
