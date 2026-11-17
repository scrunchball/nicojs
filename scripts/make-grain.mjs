// Build-time film grain plates (Boolean model, after Newson, Delon, Galerne et al., 2017).
// 12 random variants x 4 densities, tileable 512x512, monochrome, 8-bit raw (R8).
// Each plate is normalised to zero mean per plate so variants never "pump" in brightness.
// Output: public/grain/density-{0..3}.bin (12 layers x 512x512 bytes) + meta.json
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "grain");
const N = 512; // plate size (texels)
const S = 4; // supersampling per texel
const W = N * S;
const VARIANTS = 12;
const GRAY_LEVELS = [0.2, 0.35, 0.5, 0.65]; // the 4 densities (mean coverage of the Boolean model)
const R_TEXELS = 0.7; // mean grain radius in texels => clumps of ~1-2 px
const SIGMA = 0.25; // log-normal spread of grain radii
const VERSION = 2;

const metaPath = join(OUT, "meta.json");
if (existsSync(metaPath)) {
  try {
    const m = JSON.parse(readFileSync(metaPath, "utf8"));
    if (m.version === VERSION && existsSync(join(OUT, "density-3.bin"))) {
      console.log("grain plates up to date");
      process.exit(0);
    }
  } catch {}
}

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rnd) {
  const u = Math.max(rnd(), 1e-9), v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function poisson(lambda, rnd) {
  // normal approximation: lambda is large (>1e4)
  return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * gauss(rnd)));
}

function makePlate(u, seed) {
  const rnd = mulberry32(seed);
  const r0 = R_TEXELS * S;
  const meanArea = Math.PI * r0 * r0 * Math.exp(2 * SIGMA * SIGMA);
  const lambda = -Math.log(1 - u) / meanArea; // grains per subpixel^2
  const count = poisson(lambda * W * W, rnd);
  const mask = new Uint8Array(W * W);
  for (let g = 0; g < count; g++) {
    const cx = rnd() * W, cy = rnd() * W;
    const r = r0 * Math.exp(SIGMA * gauss(rnd));
    const ri = Math.ceil(r), r2 = r * r;
    for (let dy = -ri; dy <= ri; dy++) {
      const y = (((Math.floor(cy) + dy) % W) + W) % W;
      const fy = Math.floor(cy) + dy + 0.5 - cy;
      for (let dx = -ri; dx <= ri; dx++) {
        const fx = Math.floor(cx) + dx + 0.5 - cx;
        if (fx * fx + fy * fy <= r2) mask[y * W + ((((Math.floor(cx) + dx) % W) + W) % W)] = 1;
      }
    }
  }
  // box-downsample to texels = coverage fraction
  const cov = new Float32Array(N * N);
  let sum = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let c = 0;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) c += mask[(y * S + sy) * W + x * S + sx];
    cov[y * N + x] = c / (S * S);
    sum += cov[y * N + x];
  }
  const mean = sum / (N * N);
  let v = 0;
  for (let i = 0; i < cov.length; i++) v += (cov[i] - mean) ** 2;
  const std = Math.sqrt(v / cov.length) || 1;
  const out = new Uint8Array(N * N);
  for (let i = 0; i < cov.length; i++) {
    const z = (cov[i] - mean) / std; // unit variance, zero mean
    out[i] = Math.max(0, Math.min(255, Math.round((0.5 + 0.2 * z) * 255)));
  }
  return out;
}

mkdirSync(OUT, { recursive: true });
const t0 = Date.now();
GRAY_LEVELS.forEach((u, d) => {
  const buf = new Uint8Array(VARIANTS * N * N);
  for (let k = 0; k < VARIANTS; k++) buf.set(makePlate(u, 1000 * (d + 1) + k + 1), k * N * N);
  writeFileSync(join(OUT, `density-${d}.bin`), buf);
});
writeFileSync(metaPath, JSON.stringify({ version: VERSION, size: N, variants: VARIANTS, densities: GRAY_LEVELS, radiusTexels: R_TEXELS, mean: 0.5, std: 0.2 }, null, 2));
console.log(`grain plates written to public/grain in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
