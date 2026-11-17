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

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// Development (brief: Film engine > 1. Development). Phases over progress p:
//  0-10% paper under safelight, 10-45% shadows emerge, 15-60% agitation, 45-75% full density, 75-100% lights on.
const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform vec4 uRect;       // picture rect in screen uv (x, y, w, h), origin bottom-left
uniform vec2 uUvScale;    // cover crop for full-bleed
uniform vec2 uShift;      // weave shift inside the picture (full-bleed only), local uv
uniform float uOverscan;  // 1% for full-bleed so weave never shows an edge
uniform float uRot;       // radians
uniform vec2 uRectPx;     // rect size in px, for aspect-correct rotation
uniform float uProgress;
uniform float uDevelop;
uniform float uDye;
uniform vec3 uPaper;      // blank paper seen by safelight
uniform vec3 uCast;       // warm cast left on the picture while the lights come up
varying vec2 vUv;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
  vec2 l = (vUv - uRect.xy) / uRect.zw;
  if (l.x < 0.0 || l.x > 1.0 || l.y < 0.0 || l.y > 1.0) { gl_FragColor = vec4(0.0); return; }

  vec2 c = l - 0.5 - uShift;
  vec2 ap = c * uRectPx;
  float s = sin(uRot), co = cos(uRot);
  ap = vec2(co * ap.x - s * ap.y, s * ap.x + co * ap.y);
  c = ap / uRectPx;
  c *= (1.0 - uOverscan) * uUvScale;
  vec3 pic = texture2D(uTex, c + 0.5).rgb;

  if (uDevelop < 0.5 || uProgress >= 0.9999) { gl_FragColor = vec4(pic, 1.0); return; }

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
  gl_FragColor = vec4(img, 1.0);
}
`;

export type Rect = { x: number; y: number; w: number; h: number };

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
};

export class PictureEngine {
  readonly renderer: T.WebGLRenderer;
  private scene: T.Scene;
  private camera: T.Camera;
  private mat: T.ShaderMaterial;
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
        uPaper: { value: new THREE.Vector3(0.3, 0.075, 0.05) }, // safelit paper: dim red, luminance ~0.12
        uCast: { value: new THREE.Vector3(1.0, 0.55, 0.45) }, // residual warm cast as the lights come up
      },
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
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

  /** Draw every visible slot. An empty list clears the canvas. */
  frame(slots: Slot[]) {
    const t0 = performance.now();
    const vw = this.canvas.clientWidth, vh = this.canvas.clientHeight;
    const u = this.mat.uniforms;
    this.timer.measure(() => {
      this.renderer.clear();
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

  dispose() { this.tex?.dispose(); this.mat.dispose(); this.renderer.dispose(); }
}
