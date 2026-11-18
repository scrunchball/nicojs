/** Measures GPU time of a draw with EXT_disjoint_timer_query_webgl2 where available. */
export class GpuTimer {
  private ext: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
  private pending: WebGLQuery[] = [];
  private samples: number[] = [];
  constructor(private gl: WebGL2RenderingContext) {
    this.ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
  }
  get supported() { return !!this.ext; }
  measure(draw: () => void) {
    const { gl, ext } = this;
    if (!ext || this.pending.length > 4) { draw(); this.poll(); return; }
    const q = gl.createQuery();
    if (!q) { draw(); return; }
    gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
    draw();
    gl.endQuery(ext.TIME_ELAPSED_EXT);
    this.pending.push(q);
    this.poll();
  }
  private poll() {
    const { gl, ext } = this;
    if (!ext) return;
    while (this.pending.length) {
      const q = this.pending[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
      if (!disjoint) this.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
      gl.deleteQuery(q);
      this.pending.shift();
    }
  }
  private push(ms: number) { this.samples.push(ms); if (this.samples.length > 48) this.samples.shift(); }
  /** Rolling average in ms, or null if unsupported / no samples yet. */
  get ms(): number | null {
    if (!this.samples.length) return null;
    return this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
  }
}
