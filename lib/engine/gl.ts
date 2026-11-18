/**
 * A very small WebGL2 core for the film engine (Stage 7, replaces three.js).
 * The engine only ever draws full-screen passes with three shaders and a handful of textures, so it needs:
 * a context, a full-screen triangle, programs with cached uniform locations, and textures from images,
 * canvases, videos and the grain plates. ~5 KB instead of three.js's 185 KB.
 */

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }
`;

/** Lets the picture shaders keep their GLSL 1 style bodies (varying, texture2D, gl_FragColor). */
export const FRAG_PREFIX = `#version 300 es
precision highp float;
#define varying in
#define texture2D texture
out vec4 fragColor_;
#define gl_FragColor fragColor_
`;

export function createContext(canvas: HTMLCanvasElement, alpha: boolean): WebGL2RenderingContext {
  const gl = canvas.getContext("webgl2", {
    alpha, premultipliedAlpha: true, antialias: false, depth: false, stencil: false,
    preserveDrawingBuffer: false, powerPreference: "high-performance",
  });
  if (!gl) throw new Error("WebGL2 unavailable");
  return gl;
}

/** Size the drawing buffer to the canvas's CSS size times the pixel ratio. Returns true if it changed. */
export function fitCanvas(gl: WebGL2RenderingContext, dpr: number) {
  const c = gl.canvas as HTMLCanvasElement;
  const w = Math.max(1, Math.round(c.clientWidth * dpr)), h = Math.max(1, Math.round(c.clientHeight * dpr));
  if (c.width === w && c.height === h) return false;
  c.width = w; c.height = h;
  return true;
}

export class Pass {
  private prog: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private buf: WebGLBuffer;
  private locs = new Map<string, WebGLUniformLocation | null>();

  constructor(private gl: WebGL2RenderingContext, frag: string) {
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) {
        throw new Error(`shader: ${gl.getShaderInfoLog(s)}`);
      }
      return s;
    };
    const p = gl.createProgram()!;
    const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, frag);
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.bindAttribLocation(p, 0, "aPos");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(`program: ${gl.getProgramInfoLog(p)}`);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    this.prog = p;
    // one triangle that covers the screen
    this.vao = gl.createVertexArray()!;
    this.buf = gl.createBuffer()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  use() { this.gl.useProgram(this.prog); return this; }
  private loc(name: string) {
    if (!this.locs.has(name)) this.locs.set(name, this.gl.getUniformLocation(this.prog, name));
    return this.locs.get(name)!;
  }
  f(name: string, ...v: number[]) {
    const l = this.loc(name), gl = this.gl;
    if (!l) return this;
    if (v.length === 1) gl.uniform1f(l, v[0]);
    else if (v.length === 2) gl.uniform2f(l, v[0], v[1]);
    else if (v.length === 3) gl.uniform3f(l, v[0], v[1], v[2]);
    else gl.uniform4f(l, v[0], v[1], v[2], v[3]);
    return this;
  }
  i(name: string, v: number) { const l = this.loc(name); if (l) this.gl.uniform1i(l, v); return this; }
  draw() {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }
  dispose() {
    this.gl.deleteProgram(this.prog);
    this.gl.deleteBuffer(this.buf);
    this.gl.deleteVertexArray(this.vao);
  }
}

/** A picture texture: an image, canvas or video, uploaded as graded sRGB (no colour conversion of our own). */
export class Tex {
  readonly tex: WebGLTexture;
  readonly video: HTMLVideoElement | null;
  /** Set when a video has a new frame (seeked, or playing); the next bind re-uploads. */
  needsUpdate = true;
  private uploaded = false;
  private vfc = 0;

  constructor(private gl: WebGL2RenderingContext, private src: TexImageSource, private mipmaps: boolean, aniso: EXT_texture_filter_anisotropic | null) {
    this.tex = gl.createTexture()!;
    this.video = src instanceof HTMLVideoElement ? src : null;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    if (aniso && mipmaps) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 4);
    const v = this.video as (HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }) | null;
    if (v?.requestVideoFrameCallback) {
      const onFrame = () => { this.needsUpdate = true; this.vfc = v.requestVideoFrameCallback!(onFrame); };
      this.vfc = v.requestVideoFrameCallback(onFrame);
    }
  }

  /** Bind to a texture unit, uploading first if needed. */
  bind(unit: number) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    const v = this.video;
    const videoDue = v && v.readyState >= 2 && (this.needsUpdate || (!v.paused && !("requestVideoFrameCallback" in v)));
    if (!this.uploaded || videoDue) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.src);
      if (this.mipmaps) gl.generateMipmap(gl.TEXTURE_2D);
      this.uploaded = true;
      this.needsUpdate = false;
    }
  }

  dispose() {
    const v = this.video as (HTMLVideoElement & { cancelVideoFrameCallback?: (h: number) => void }) | null;
    if (v?.cancelVideoFrameCallback && this.vfc) v.cancelVideoFrameCallback(this.vfc);
    this.gl.deleteTexture(this.tex);
  }
}
