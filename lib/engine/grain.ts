/**
 * Grain canvas: one fine, living grain over everything (pictures, black and text).
 * Plates are physically based (Boolean model) and generated at build time by scripts/make-grain.mjs.
 * Every film frame picks a new plate and a random offset, so the grain never visibly repeats.
 * The canvas is composited with mix-blend-mode: overlay (set in CSS; soft-light in the brief, see DECISIONS D-15).
 * Mid-grey = no change; grain shows most in midtones and falls to nothing at pure black and white,
 * as it does in a print.
 */
import type * as T from "three";
import { GpuTimer } from "./gpuTimer";
import { hash01 } from "./film";

type Three = typeof import("three");

export type GrainState = {
  /** Default 0.06 (brief). */
  strength: number;
  /** CSS px per plate texel; 1 = clumps of ~1-2 CSS px. */
  scale: number;
  /** Freeze on one plate (reduced motion). */
  still: boolean;
};

const PLATE = 512;
const VARIANTS = 12;

const VERT = /* glsl */ `
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = /* glsl */ `
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray uPlates;
uniform float uLayer;
uniform vec2 uOffset;
uniform float uPx;       // device px per CSS px (canvas pixel ratio)
uniform float uScale;    // CSS px per texel
uniform float uStrength;
out vec4 fragColor;
void main() {
  vec2 css = gl_FragCoord.xy / uPx;
  vec2 uv = css / (${PLATE}.0 * uScale) + uOffset;
  float g = texture(uPlates, vec3(uv, uLayer)).r;   // plates: mean 0.5, std 0.2
  // grey around 0.5 (neutral in overlay). Strength 0.06 => ~2% std on a midtone: felt, not seen.
  float v = 0.5 + (g - 0.5) * uStrength * 1.6667;
  fragColor = vec4(vec3(v), 1.0);
}
`;

export class GrainEngine {
  readonly renderer: T.WebGLRenderer;
  private scene: T.Scene;
  private camera: T.Camera;
  private mat: T.ShaderMaterial;
  private tex: T.DataArrayTexture | null = null;
  private density = -1;
  readonly timer: GpuTimer;
  cpuMs = 0;

  constructor(private THREE: Three, private canvas: HTMLCanvasElement, maxDpr = 2) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();
    this.mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uPlates: { value: null },
        uLayer: { value: 0 },
        uOffset: { value: new THREE.Vector2() },
        uPx: { value: 1 },
        uScale: { value: 1 },
        uStrength: { value: 0.06 },
      },
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
    this.timer = new GpuTimer(this.renderer.getContext() as WebGL2RenderingContext);
    this.resize();
  }

  resize() {
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);
  }

  /** Load one of the 4 densities (0..3). Only the active density is downloaded (~3 MB). */
  async load(density: number) {
    if (density === this.density) return;
    const res = await fetch(`/grain/density-${density}.bin`);
    if (!res.ok) throw new Error(`grain plates missing (${res.status}); run npm run grain`);
    const data = new Uint8Array(await res.arrayBuffer());
    const { THREE } = this;
    const tex = new THREE.DataArrayTexture(data, PLATE, PLATE, VARIANTS);
    tex.format = THREE.RedFormat;
    tex.type = THREE.UnsignedByteType;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.unpackAlignment = 1;
    tex.colorSpace = THREE.NoColorSpace;
    tex.needsUpdate = true;
    this.tex?.dispose();
    this.tex = tex;
    this.density = density;
    this.mat.uniforms.uPlates.value = tex;
  }

  render(frame: number, s: GrainState) {
    if (!this.tex) return;
    const t0 = performance.now();
    const u = this.mat.uniforms;
    const f = s.still ? 0 : frame;
    u.uLayer.value = Math.floor(hash01(f, 501) * VARIANTS);
    u.uOffset.value.set(hash01(f, 502), hash01(f, 503));
    u.uPx.value = this.renderer.getPixelRatio();
    u.uScale.value = s.scale;
    u.uStrength.value = s.strength;
    this.timer.measure(() => this.renderer.render(this.scene, this.camera));
    this.cpuMs = this.cpuMs * 0.9 + (performance.now() - t0) * 0.1;
  }

  dispose() { this.tex?.dispose(); this.mat.dispose(); this.renderer.dispose(); }
}
