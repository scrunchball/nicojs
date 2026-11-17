/**
 * Nico's content, verbatim from his Pages document (www.njs-film.com.pages).
 * Shaped like the Payload collections in docs/BRIEF.md so the CMS can replace
 * this file later without touching the page components.
 * German and Spanish fall back to English until proofread translations exist.
 */

export type Composition = "full-bleed" | "large-window" | "small-window";

export type Shot = {
  id: string;
  /** Image path under /public, or undefined while we wait for Nico's frames. */
  src?: string;
  alt: string;
  composition: Composition;
  side?: "left" | "right";
  /** Aspect ratio used by the placeholder until a real frame is supplied. */
  aspect?: number;
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
  keyShot: Shot;
  shots: Shot[];
  recognition: Recognition[];
};

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
    keyShot: {
      id: "wei-key",
      alt: "Frame from What Else is There?",
      composition: "full-bleed",
      aspect: 1.66,
    },
    shots: [
      { id: "wei-1", alt: "Frame from What Else is There?", composition: "large-window", side: "right", aspect: 1.66 },
    ],
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
    keyShot: {
      id: "btf-key",
      alt: "Frame from By the Fire",
      composition: "full-bleed",
      aspect: 1.37,
    },
    shots: [
      { id: "btf-1", alt: "Frame from By the Fire", composition: "small-window", side: "left", aspect: 1.37 },
    ],
    recognition: [
      { kind: "Winner, Best Cinematography", festival: "FHIFF (Italy)" },
      { kind: "Official Selection", festival: "Berlin Commercial Awards", year: 2026, note: "Cultural Work" },
      { kind: "Opening film", festival: "Awareness Festival (California, USA)" },
      { kind: "Official Selection", festival: "FHIFF (Italy)" },
    ],
  },
];

export const portraits: Shot[] = [
  { id: "portrait-1", alt: "Portrait of Nicolás J. Scatamacchia", composition: "full-bleed", aspect: 1.66 },
  { id: "portrait-2", alt: "Nicolás J. Scatamacchia on set", composition: "small-window", side: "left", aspect: 0.8 },
];
