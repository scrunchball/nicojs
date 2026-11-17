/**
 * STAND-INS for the 4 lab tests, drawn procedurally until Nico's frame grabs arrive.
 * They exist only to exercise the engine; the look is signed off on Nico's real frames.
 */
export type TestId = 1 | 2 | 3 | 4;

export const TESTS: Record<TestId, { name: string; check: string }> = {
  1: { name: "Flat midtone wall", check: "Grain visible but fine, no colour speckle." },
  2: { name: "Deep shadow beside the black page", check: "Grain barely there; never flat noise on black." },
  3: { name: "A face developing", check: "Shadows first; lights-on is a gentle rise, no flash." },
  4: { name: "A title over a picture", check: "Layers drift independently; text stays comfortable." },
};

const W = 1920, H = 1157; // Super 16 (1.66:1)

export function standIn(id: TestId): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  if (id === 1) {
    const lg = g.createLinearGradient(0, 0, W, H);
    lg.addColorStop(0, "#8a7f70"); lg.addColorStop(1, "#7e7466");
    g.fillStyle = lg; g.fillRect(0, 0, W, H);
  } else if (id === 2) {
    const lg = g.createLinearGradient(0, 0, W, 0);
    lg.addColorStop(0, "#0a0908"); lg.addColorStop(0.45, "#141210"); lg.addColorStop(1, "#2b2622");
    g.fillStyle = lg; g.fillRect(0, 0, W, H);
    // a dim window-light shape in the far shadow
    const rg = g.createRadialGradient(W * 0.78, H * 0.4, 10, W * 0.78, H * 0.4, H * 0.5);
    rg.addColorStop(0, "rgba(70,60,50,0.55)"); rg.addColorStop(1, "rgba(70,60,50,0)");
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
  } else if (id === 3) {
    // warm interior, a soft head-and-shoulders silhouette (abstract stand-in, not a likeness)
    const bg = g.createLinearGradient(0, 0, W, 0);
    bg.addColorStop(0, "#2a2019"); bg.addColorStop(1, "#5a4636");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.filter = "blur(18px)";
    g.fillStyle = "#1a1512"; // shoulders
    g.beginPath(); g.ellipse(W * 0.5, H * 1.05, W * 0.26, H * 0.3, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#8c6248"; // neck
    g.fillRect(W * 0.47, H * 0.55, W * 0.06, H * 0.25);
    const skin = g.createRadialGradient(W * 0.53, H * 0.4, 20, W * 0.5, H * 0.45, H * 0.3);
    skin.addColorStop(0, "#d9a585"); skin.addColorStop(0.6, "#a8765a"); skin.addColorStop(1, "#5b3f30");
    g.fillStyle = skin; g.beginPath(); g.ellipse(W * 0.5, H * 0.43, W * 0.085, H * 0.2, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#16110e"; // hair
    g.beginPath(); g.ellipse(W * 0.5, H * 0.28, W * 0.095, H * 0.1, 0, Math.PI, Math.PI * 2); g.fill();
    g.filter = "blur(6px)"; g.fillStyle = "rgba(40,25,20,0.7)";
    g.beginPath(); g.ellipse(W * 0.47, H * 0.42, 14, 7, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(W * 0.53, H * 0.42, 14, 7, 0, 0, Math.PI * 2); g.fill();
    g.filter = "none";
  } else {
    // late-afternoon field: sky, low sun, dark ground
    const sky = g.createLinearGradient(0, 0, 0, H * 0.62);
    sky.addColorStop(0, "#5d7686"); sky.addColorStop(1, "#d7b48a");
    g.fillStyle = sky; g.fillRect(0, 0, W, H * 0.62);
    g.filter = "blur(30px)";
    g.fillStyle = "rgba(255,226,170,0.9)";
    g.beginPath(); g.arc(W * 0.7, H * 0.55, 60, 0, Math.PI * 2); g.fill();
    g.filter = "none";
    const gr = g.createLinearGradient(0, H * 0.6, 0, H);
    gr.addColorStop(0, "#4a4130"); gr.addColorStop(1, "#16130e");
    g.fillStyle = gr; g.fillRect(0, H * 0.6, W, H * 0.4);
  }
  return c;
}
