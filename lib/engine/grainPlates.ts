/**
 * Physically based film grain plates (Boolean model, after Newson, Delon, Galerne et al., 2017), generated in the
 * browser so nothing is downloaded: 12 tileable 512x512 monochrome plates per density, each normalised to zero mean.
 *
 * generatePlates() is deliberately self-contained (no outside references), so it can be shipped to a worker as
 * source text (see grain.ts). Keep it that way.
 */
export const PLATE = 512;
export const VARIANTS = 12;

export function generatePlates(density: number): Uint8Array {
  const PLATE = 512, VARIANTS = 12, S = 4, W = PLATE * S;
  const DENSITIES = [0.2, 0.35, 0.5, 0.65]; // mean coverage of the Boolean model
  const R_TEXELS = 0.7; // mean grain radius in texels => clumps of ~1-2 px
  const SIGMA = 0.25; // log-normal spread of grain radii
  const mulberry32 = (a: number) => () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = (rnd: () => number) => {
    const u = Math.max(rnd(), 1e-9), v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const out = new Uint8Array(VARIANTS * PLATE * PLATE);
  const mask = new Uint8Array(W * W);
  const cov = new Float32Array(PLATE * PLATE);
  const u = DENSITIES[density];
  for (let k = 0; k < VARIANTS; k++) {
    const rnd = mulberry32(1000 * (density + 1) + k + 1);
    const r0 = R_TEXELS * S;
    const lambda = -Math.log(1 - u) / (Math.PI * r0 * r0 * Math.exp(2 * SIGMA * SIGMA));
    const mean0 = lambda * W * W;
    const count = Math.max(0, Math.round(mean0 + Math.sqrt(mean0) * gauss(rnd)));
    mask.fill(0);
    for (let g = 0; g < count; g++) {
      const cx = rnd() * W, cy = rnd() * W;
      const r = r0 * Math.exp(SIGMA * gauss(rnd));
      const ri = Math.ceil(r), r2 = r * r;
      const fx0 = Math.floor(cx), fy0 = Math.floor(cy);
      for (let dy = -ri; dy <= ri; dy++) {
        const y = (((fy0 + dy) % W) + W) % W;
        const fy = fy0 + dy + 0.5 - cy;
        for (let dx = -ri; dx <= ri; dx++) {
          const fx = fx0 + dx + 0.5 - cx;
          if (fx * fx + fy * fy <= r2) mask[y * W + ((((fx0 + dx) % W) + W) % W)] = 1;
        }
      }
    }
    let sum = 0;
    for (let y = 0; y < PLATE; y++) for (let x = 0; x < PLATE; x++) {
      let c = 0;
      for (let sy = 0; sy < S; sy++) { const row = (y * S + sy) * W + x * S; for (let sx = 0; sx < S; sx++) c += mask[row + sx]; }
      const v = c / (S * S);
      cov[y * PLATE + x] = v;
      sum += v;
    }
    const mean = sum / cov.length;
    let vv = 0;
    for (let i = 0; i < cov.length; i++) vv += (cov[i] - mean) ** 2;
    const std = Math.sqrt(vv / cov.length) || 1;
    const off = k * PLATE * PLATE;
    for (let i = 0; i < cov.length; i++) {
      const z = (cov[i] - mean) / std;
      out[off + i] = Math.max(0, Math.min(255, Math.round((0.5 + 0.2 * z) * 255)));
    }
  }
  return out;
}
