/**
 * Picture canvas: develops a picture into view like a print in the darkroom tray, and weaves it.
 * Pictures are shown exactly as graded: sRGB values pass straight through (no colour management,
 * tone curve or saturation change), so at progress = 1 the output equals the source pixel.
 */
import type * as T from "three";
import { GpuTimer } from "./gpuTimer";
import type { WeaveOffset } from "./film";

type Three = typeof import("three");

export type Composition = "full-bleed" | "large-window" | "small-window";

export type PictureState = {
  /** Development progress 0..1 (1 = fully developed, lights on). */
  progress: number;
  develop: boolean;
  composition: Composition;
  side: "left" | "right";
  weave: WeaveOffset; // x, y as fraction of picture height; rot in degrees
  /** Dye layers arriving slightly out of step (0 = in step). */
  dye: number;
};

const COMMON_GLSL = /* glsl */ `
// ---- shared: value noise, the reel container's shape, the rolling shutter ----
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
uniform float uBoxOn;   // reel container on
uniform vec4 uBox;      // x, y, w, h in CSS px, top-left origin
uniform float uBoxR;    // corner radius px
uniform float uBoxJag;  // edge irregularity px
uniform float uBoxT;    // container time (wiggle), freezes with PROYECTOR
uniform vec2 uView;     // canvas size in CSS px
uniform float uReveal;  // rolling shutter: 0..1 edge position from the top, >= 1 fully revealed
// signed distance to the container: rounded rectangle, its edge nudged by slow noise so it is soft,
// slightly jagged and breathes a little, like a hand-cut gate
float boxSdf(vec2 px) {
  vec2 c = uBox.xy + uBox.zw * 0.5;
  vec2 hs = uBox.zw * 0.5 - uBoxR;
  vec2 q = abs(px - c) - hs;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uBoxR;
  float a = atan(px.y - c.y, px.x - c.x);
  float n = (noise(vec2(a * 7.0, uBoxT * 0.35)) - 0.5) + (noise(vec2(a * 29.0, uBoxT * 0.9)) - 0.5) * 0.45;
  return d + n * uBoxJag;
}
float boxMask(vec2 px) { return uBoxOn > 0.5 ? 1.0 - smoothstep(-2.5, 2.5, boxSdf(px)) : 1.0; }
// the shutter edge sweeps down, skewed like a rolling shutter; returns 1 above the edge
float shutterEdge(vec2 px) { return uReveal * (uView.y + 80.0) - 40.0 + (px.x / uView.x - 0.5) * uView.y * 0.07; }
float revealMask(vec2 px) { return uReveal >= 1.0 ? 1.0 : 1.0 - smoothstep(-1.0, 1.0, px.y - shutterEdge(px)); }
float shutterLine(vec2 px) { return uReveal >= 1.0 || uReveal <= 0.0 ? 0.0 : exp(-abs(px.y - shutterEdge(px)) / 1.6) * 0.16; }
`;

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// Development (brief: Film engine > 1. Development). Phases over progress p:
//  0-10% paper under safelight, 10-45% shadows emerge, 15-60% agitation, 45-75% full density, 75-100% lights on.
const FRAG = /* glsl */ `
precision highp float;
${COMMON_GLSL}
uniform sampler2D uTex;
uniform float uWipe;      // shutter wipe inside the picture: -1 off, else the edge 0..1 from the top
uniform vec4 uRect;       // picture rect in screen uv (x, y, w, h), origin bottom-left
uniform vec2 uUvScale;    // cover crop for full-bleed
uniform vec2 uShift;      // weave shift inside the picture (full-bleed only), local uv
uniform float uOverscan;  // 1% for full-bleed so weave never shows an edge
uniform float uRot;       // radians
uniform vec2 uRectPx;     // rect size in px, for aspect-correct rotation
uniform float uProgress;
uniform float uDevelop;
uniform float uDye;
uniform float uZoom;      // push-in: stills scale 1.00 -> 1.04 over the hold
uniform float uFade;      // fade to black at the end of a scene
uniform vec3 uPaper;      // blank paper seen by safelight
uniform vec3 uCast;       // warm cast left on the picture while the lights come up
varying vec2 vUv;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
  vec2 l = (vUv - uRect.xy) / uRect.zw;
  if (l.x < 0.0 || l.x > 1.0 || l.y < 0.0 || l.y > 1.0) { gl_FragColor = vec4(0.0); return; }
  vec2 px = vec2(vUv.x * uView.x, (1.0 - vUv.y) * uView.y);
  float alpha = boxMask(px) * revealMask(px);
  // the next picture rolls in on a shutter: rows near the edge slip sideways a touch, a thin line of light
  float wipeLine = 0.0;
  if (uWipe >= 0.0) {
    float ly = 1.0 - l.y;
    float edge = uWipe * 1.1 - 0.05 + (l.x - 0.5) * 0.08;
    if (ly > edge) { gl_FragColor = vec4(0.0); return; }
    float band = exp(-(edge - ly) / 0.012);
    l.x += sin(ly * 90.0) * 0.004 * band;
    wipeLine = band * 0.18;
  }
  if (alpha <= 0.001) { gl_FragColor = vec4(0.0); return; }

  vec2 c = l - 0.5 - uShift;
  vec2 ap = c * uRectPx;
  float s = sin(uRot), co = cos(uRot);
  ap = vec2(co * ap.x - s * ap.y, s * ap.x + co * ap.y);
  c = ap / uRectPx;
  c *= (1.0 - uOverscan) * uUvScale / uZoom;
  vec3 pic = texture2D(uTex, c + 0.5).rgb;

  if (uDevelop < 0.5 || uProgress >= 0.9999) { gl_FragColor = vec4(pic * uFade + wipeLine + shutterLine(px), alpha); return; }

  float p = clamp(uProgress, 0.0, 1.0);
  float L = luma(pic);

  // 3. agitation: a soft front sweeping in the direction the tray is rocked, gone completely by 60%
  float agit = smoothstep(0.15, 0.30, p) * (1.0 - smoothstep(0.45, 0.60, p));
  float wave = sin(dot(l, vec2(0.82, 0.57)) * 5.0 - p * 14.0) * agit;

  // density: darker pixels reach full density first; the brightest complete at p = 1 (brief formula, offset by phase 1)
  float t = clamp((p - 0.10 - L * 0.55 - wave * 0.08) / 0.35, 0.0, 1.0);

  // Under the safelight you see density only: a dim, red monochrome. Blank paper is the dim red "white";
  // as density builds, shadows darken out of it. Never bright.
  vec3 underSafelight = mix(uPaper, uPaper * L, t);

  // 5. lights on (75-100%): the true picture rises out of the safelight over the last quarter, never a flash.
  // Dye layers arrive a few percent apart (R ~ cyan density, B ~ yellow) so colour forms rather than fades.
  float lights = smoothstep(0.75, 1.0, p);
  vec3 lc = clamp(vec3(lights) + vec3(uDye, 0.0, -uDye) * 4.0 * lights * (1.0 - lights), 0.0, 1.0);
  vec3 img = mix(underSafelight, pic * mix(uCast, vec3(1.0), lc), lc);
  // +-0.5/255 dither while developing, so dim safelit gradients don't band (gone at p = 1)
  img += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  gl_FragColor = vec4(img * uFade + wipeLine + shutterLine(px), alpha);
}
`;

export type Rect = { x: number; y: number; w: number; h: number };

const BG_FRAG = /* glsl */ `
precision highp float;
${COMMON_GLSL}
uniform vec3 uColor;
uniform float uIntensity;
uniform float uTime;
uniform float uMode;
uniform vec3 uInside;   // the container's off-black
uniform float uBoxFade; // the container goes down with its scene
varying vec2 vUv;
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; } return v; }
void main() {
  vec2 uv = vUv; float asp = uView.x / uView.y; vec2 p = vec2(uv.x * asp, uv.y);
  vec2 px = vec2(uv.x * uView.x, (1.0 - uv.y) * uView.y);
  float m = 0.0;
  if (uMode < 0.5) {
    m = 0.0;
  } else if (uMode < 1.5) {        // safelight breathing up from below the frame, 9 s cycle
    float d = length((uv - vec2(0.5, -0.2)) * vec2(0.55, 1.0));
    m = smoothstep(1.15, 0.0, d) * (0.7 + 0.3 * sin(uTime * 6.2831 / 9.0));
  } else if (uMode < 2.5) { // haze drifting slowly sideways
    m = smoothstep(0.35, 0.85, fbm(p * 1.4 + vec2(uTime * 0.018, uTime * 0.005)));
  } else if (uMode < 3.5) { // embers: haze rising from the bottom
    m = smoothstep(0.42, 0.9, fbm(p * 2.0 + vec2(0.0, -uTime * 0.035))) * smoothstep(1.05, 0.0, uv.y);
  } else if (uMode < 4.5) { // soft bands passing upward, like a reel
    m = smoothstep(0.45, 0.95, fbm(vec2(p.x * 1.1, p.y * 2.6 - uTime * 0.05))) * 0.85;
  } else {                  // a pool of tungsten light, barely moving
    float d = length((uv - vec2(0.32 + 0.04 * sin(uTime * 0.1), 0.55)) * vec2(asp, 1.0));
    m = smoothstep(0.95, 0.0, d) * (0.85 + 0.15 * fbm(p * 2.0 + uTime * 0.02));
  }
  float k = clamp(m * uIntensity, 0.0, 1.0);
  if (uBoxOn > 0.5) {
    // inside the reel container: an off-black a touch lighter than the room, the scene's motif living in it
    float a = boxMask(px) * revealMask(px) * uBoxFade;
    vec3 col = mix(uInside, uColor, k) + shutterLine(px);
    gl_FragColor = vec4(col * a, a);
  } else {
    gl_FragColor = vec4(uColor * k, k); // premultiplied: a faint veil of the motif colour over Gate black
  }
}
`;

/** The reel container: CSS px, top-left origin; t = its wiggle clock. */
export type Box = { x: number; y: number; w: number; h: number; r: number; jag: number; t: number };

export type Background = {
  mode: number; color: [number, number, number]; intensity: number; time: number;
  box?: Box | null; inside?: [number, number, number]; reveal?: number; fade?: number;
};

type Uniforms = Record<string, { value: unknown }>;
function boxUniforms(THREE: Three): Uniforms {
  return {
    uBoxOn: { value: 0 },
    uBox: { value: new THREE.Vector4(0, 0, 1, 1) },
    uBoxR: { value: 28 },
    uBoxJag: { value: 2.5 },
    uBoxT: { value: 0 },
    uView: { value: new THREE.Vector2(1, 1) },
    uReveal: { value: 1 },
  };
}
function setBox(u: Uniforms, box: Box | null | undefined, reveal: number | undefined, vw: number, vh: number) {
  (u.uView.value as T.Vector2).set(vw, vh);
  u.uBoxOn.value = box ? 1 : 0;
  if (box) {
    (u.uBox.value as T.Vector4).set(box.x, box.y, box.w, box.h);
    u.uBoxR.value = box.r; u.uBoxJag.value = box.jag; u.uBoxT.value = box.t;
  }
  u.uReveal.value = reveal ?? 1;
}

/** One picture to draw this frame, at a rect in CSS px relative to the canvas (the viewport). */
export type Slot = {
  tex: T.Texture;
  aspect: number;
  rect: Rect;
  full: boolean;
  weave: WeaveOffset;
  progress: number;
  develop: boolean;
  dye: number;
  /** Push-in zoom (default 1) and fade to black (default 1 = no fade). */
  zoom?: number;
  fade?: number;
  /** Clip to the reel container; rolling-shutter reveal (1 = revealed); shutter wipe inside the picture (-1 = off). */
  box?: Box | null;
  reveal?: number;
  wipe?: number;
};

export class PictureEngine {
  readonly renderer: T.WebGLRenderer;
  private scene: T.Scene;
  private camera: T.Camera;
  private mat: T.ShaderMaterial;
  private bgScene: T.Scene;
  private bgMat: T.ShaderMaterial;
  private tex: T.Texture | null = null; // lab: the single loaded source
  private aspect = 16 / 9;
  readonly timer: GpuTimer;
  cpuMs = 0;

  constructor(private THREE: Three, private canvas: HTMLCanvasElement, maxDpr = 2) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.autoClear = false;
    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTex: { value: null },
        uRect: { value: new THREE.Vector4(0, 0, 1, 1) },
        uUvScale: { value: new THREE.Vector2(1, 1) },
        uShift: { value: new THREE.Vector2(0, 0) },
        uOverscan: { value: 0.01 },
        uRot: { value: 0 },
        uRectPx: { value: new THREE.Vector2(1, 1) },
        uProgress: { value: 1 },
        uDevelop: { value: 1 },
        uDye: { value: 0.03 },
        uZoom: { value: 1 },
        uFade: { value: 1 },
        uWipe: { value: -1 },
        ...boxUniforms(THREE),
        uPaper: { value: new THREE.Vector3(0.3, 0.075, 0.05) }, // safelit paper: dim red, luminance ~0.12
        uCast: { value: new THREE.Vector3(1.0, 0.55, 0.45) }, // residual warm cast as the lights come up
      },
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
    this.bgMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: BG_FRAG,
      blending: THREE.NoBlending,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uColor: { value: new THREE.Vector3(1, 1, 1) },
        uIntensity: { value: 0 },
        uTime: { value: 0 },
        uMode: { value: 2 },
        uInside: { value: new THREE.Vector3(0.105, 0.098, 0.09) },
        uBoxFade: { value: 1 },
        ...boxUniforms(THREE),
      },
    });
    this.bgScene = new THREE.Scene();
    this.bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.bgMat));
    this.timer = new GpuTimer(this.renderer.getContext() as WebGL2RenderingContext);
    this.resize();
  }

  resize() {
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);
  }

  /** Make a texture from a decoded image, a canvas or a playing video. Graded sRGB passes straight through. */
  createTexture(src: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement): T.Texture {
    const { THREE } = this;
    const tex =
      src instanceof HTMLVideoElement ? new THREE.VideoTexture(src)
      : src instanceof HTMLCanvasElement ? new THREE.CanvasTexture(src)
      : new THREE.Texture(src);
    tex.colorSpace = THREE.NoColorSpace;
    tex.magFilter = THREE.LinearFilter;
    if (src instanceof HTMLVideoElement) {
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
    } else {
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      tex.anisotropy = 4;
    }
    tex.needsUpdate = true;
    return tex;
  }

  /** Upload a texture now (so the first draw never stalls mid-scroll). */
  upload(tex: T.Texture) { this.renderer.initTexture(tex); }

  /** Draw the scene's background motif (optional), then every visible slot. Nothing to draw clears the canvas. */
  frame(slots: Slot[], bg?: Background | null) {
    const t0 = performance.now();
    const vw = this.canvas.clientWidth, vh = this.canvas.clientHeight;
    const u = this.mat.uniforms;
    this.timer.measure(() => {
      this.renderer.clear();
      if (bg && (bg.intensity > 0.0005 || bg.box)) {
        const b = this.bgMat.uniforms;
        b.uColor.value.set(...bg.color);
        b.uIntensity.value = bg.intensity;
        b.uTime.value = bg.time;
        b.uMode.value = bg.mode;
        if (bg.inside) b.uInside.value.set(...bg.inside);
        b.uBoxFade.value = bg.fade ?? 1;
        setBox(b, bg.box, bg.reveal, vw, vh);
        this.renderer.render(this.bgScene, this.camera);
      }
      for (const s of slots) {
        const r = s.rect;
        const dxPx = s.weave.x * r.h, dyPx = s.weave.y * r.h; // weave is a fraction of picture height
        if (s.full) {
          const ra = r.w / r.h; // cover crop
          u.uUvScale.value.set(ra > s.aspect ? 1 : ra / s.aspect, ra > s.aspect ? s.aspect / ra : 1);
          u.uRect.value.set(r.x / vw, 1 - (r.y + r.h) / vh, r.w / vw, r.h / vh);
          u.uShift.value.set(dxPx / r.w, dyPx / r.h);
          u.uOverscan.value = 0.01;
          u.uRot.value = (s.weave.rot * Math.PI) / 180;
        } else {
          // windows: the whole window moves, edges included
          u.uUvScale.value.set(1, 1);
          u.uRect.value.set((r.x + dxPx) / vw, 1 - (r.y + r.h - dyPx) / vh, r.w / vw, r.h / vh);
          u.uShift.value.set(0, 0);
          u.uOverscan.value = 0;
          u.uRot.value = 0;
        }
        u.uRectPx.value.set(r.w, r.h);
        u.uTex.value = s.tex;
        u.uProgress.value = s.progress;
        u.uDevelop.value = s.develop ? 1 : 0;
        u.uDye.value = s.dye;
        u.uZoom.value = s.zoom ?? 1;
        u.uFade.value = s.fade ?? 1;
        u.uWipe.value = s.wipe ?? -1;
        setBox(u, s.box, s.reveal, vw, vh);
        this.renderer.render(this.scene, this.camera);
      }
    });
    this.cpuMs = this.cpuMs * 0.9 + (performance.now() - t0) * 0.1;
  }

  /* ---------- lab: one source, composition computed here ---------- */

  setSource(src: HTMLCanvasElement | HTMLImageElement) {
    this.tex?.dispose();
    this.tex = this.createTexture(src);
    this.aspect = (src as HTMLCanvasElement).width / (src as HTMLCanvasElement).height;
  }

  /** Picture rect in CSS px for a composition (the real page takes rects from the DOM instead). */
  rectPx(comp: Composition, side: "left" | "right"): Rect {
    const vw = this.canvas.clientWidth, vh = this.canvas.clientHeight;
    if (comp === "full-bleed") return { x: 0, y: 0, w: vw, h: vh };
    let w = (comp === "large-window" ? 0.62 : 0.34) * vw;
    let h = w / this.aspect;
    const maxH = vh * 0.76; // keeps at least 12vh of black above and below
    if (h > maxH) { h = maxH; w = h * this.aspect; }
    const x = side === "right" ? vw * 0.92 - w : vw * 0.08; // 8vw at the sides
    return { x, y: (vh - h) / 2, w, h };
  }

  render(s: PictureState) {
    if (!this.tex) return;
    this.frame([{
      tex: this.tex, aspect: this.aspect, rect: this.rectPx(s.composition, s.side),
      full: s.composition === "full-bleed", weave: s.weave, progress: s.progress, develop: s.develop, dye: s.dye,
    }]);
  }

  dispose() { this.tex?.dispose(); this.mat.dispose(); this.bgMat.dispose(); this.renderer.dispose(); }
}
