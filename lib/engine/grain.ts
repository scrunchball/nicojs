/**
 * Grain canvas: one fine, living grain over everything (pictures, black and text).
 * Plates are physically based (Boolean model), generated in a worker in the browser (lib/engine/grainPlates.ts):
 * no download. Every film frame picks a new plate and a random offset, so the grain never visibly repeats.
 * The canvas is composited with mix-blend-mode: soft-light (CSS). Mid-grey = no change; grain shows most in
 * midtones and a little on black (D-44).
 */
import { GpuTimer } from "./gpuTimer";
import { hash01 } from "./film";
import { Pass, createContext, fitCanvas } from "./gl";
import { PLATE, VARIANTS, generatePlates } from "./grainPlates";

export type GrainState = {
  /** Default 0.06. */
  strength: number;
  /** CSS px per plate texel; 1 = clumps of ~1-2 CSS px. */
  scale: number;
  /** Freeze on one plate (reduced motion). */
  still: boolean;
};

const FRAG = `#version 300 es
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
  // grey around 0.5 (neutral in soft-light). Strength 0.06 => ~1.8% std on a midtone, ~1.7 levels on Gate black.
  float v = 0.5 + (g - 0.5) * uStrength * 4.0;
  fragColor = vec4(vec3(v), 1.0);
}
`;

/**
 * Generate plates off the main thread: the self-contained generator is shipped to a worker as source text
 * (no bundler support needed). Falls back to the main thread (~0.5 s) if workers are unavailable.
 */
function generate(density: number): Promise<Uint8Array> {
  let url = "";
  try {
    const src = `const gen = ${generatePlates.toString()};
self.onmessage = (e) => { const d = gen(e.data.density); self.postMessage({ data: d }, [d.buffer]); };`;
    url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
    const w = new Worker(url);
    return new Promise<Uint8Array>((resolve, reject) => {
      w.onmessage = (e: MessageEvent<{ data: Uint8Array }>) => { resolve(e.data.data); w.terminate(); URL.revokeObjectURL(url); };
      w.onerror = (e) => { w.terminate(); URL.revokeObjectURL(url); reject(e); };
      w.postMessage({ density });
    }).catch(() => generatePlates(density));
  } catch {
    if (url) URL.revokeObjectURL(url);
    return Promise.resolve(generatePlates(density));
  }
}

export class GrainEngine {
  readonly gl: WebGL2RenderingContext;
  private pass: Pass;
  private tex: WebGLTexture | null = null;
  private density = -1;
  private dpr = 1;
  readonly timer: GpuTimer;
  cpuMs = 0;

  constructor(private canvas: HTMLCanvasElement, maxDpr = 2) {
    this.gl = createContext(canvas, false);
    this.pass = new Pass(this.gl, FRAG);
    this.timer = new GpuTimer(this.gl);
    this.setMaxDpr(maxDpr);
  }

  setMaxDpr(maxDpr: number) {
    this.dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    this.resize();
  }

  resize() { fitCanvas(this.gl, this.dpr); }

  /** Make one of the 4 densities (0..3). */
  async load(density: number) {
    if (density === this.density) return;
    const data = await generate(density);
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.R8, PLATE, PLATE, VARIANTS, 0, gl.RED, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (this.tex) gl.deleteTexture(this.tex);
    this.tex = tex;
    this.density = density;
  }

  render(frame: number, s: GrainState) {
    if (!this.tex) return;
    const t0 = performance.now();
    const gl = this.gl;
    const f = s.still ? 0 : frame;
    this.timer.measure(() => {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.disable(gl.BLEND);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
      this.pass.use()
        .i("uPlates", 0)
        .f("uLayer", Math.floor(hash01(f, 501) * VARIANTS))
        .f("uOffset", hash01(f, 502), hash01(f, 503))
        .f("uPx", this.dpr)
        .f("uScale", s.scale)
        .f("uStrength", s.strength)
        .draw();
    });
    this.cpuMs = this.cpuMs * 0.9 + (performance.now() - t0) * 0.1;
  }

  dispose() {
    if (this.tex) this.gl.deleteTexture(this.tex);
    this.pass.dispose();
  }
}
