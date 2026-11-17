"use client";

/**
 * /lab — the film lab (Stage 3). Unlisted and noindex until the admin login exists (backend phase).
 * Load a test frame (or your own), scrub the development, tune each layer's weave and the grain,
 * A/B wipe against a raw scan, and read frame times. State can be set from the URL for recordings:
 *   /lab/?test=3&p=0.4&comp=full&play=1&grain=0.06&density=2&scale=1&weave=1&ab=50&ui=0&still=0
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { FPS, WEAVE, frameAt, weave } from "@/lib/engine/film";
import type { Composition, PictureEngine } from "@/lib/engine/picture";
import type { GrainEngine } from "@/lib/engine/grain";
import { TESTS, standIn, type TestId } from "@/lib/engine/testFrames";

type Params = {
  test: TestId | 0; // 0 = user-loaded frame
  progress: number;
  develop: boolean;
  play: boolean;
  composition: Composition;
  side: "left" | "right";
  dye: number;
  // weave (multipliers on the brief's defaults are easier to reason about, but we expose real units)
  picDrift: number; // % of picture height
  picJitter: number; // %
  picRot: number; // degrees
  titleDrift: number; // px
  titleJitter: number; // px
  weaveOn: boolean;
  textOn: boolean;
  // grain
  grainOn: boolean;
  strength: number;
  density: number;
  scale: number;
  still: boolean;
  blend: "overlay" | "soft-light";
  // A/B
  ab: boolean;
  wipe: number; // % from left
};

const DEFAULTS: Params = {
  test: 1,
  progress: 1,
  develop: true,
  play: false,
  composition: "full-bleed",
  side: "right",
  dye: 0.03,
  picDrift: WEAVE.picture.drift * 100,
  picJitter: WEAVE.picture.jitter * 100,
  picRot: WEAVE.picture.rot ?? 0.03,
  titleDrift: WEAVE.title.drift,
  titleJitter: WEAVE.title.jitter,
  weaveOn: true,
  textOn: false,
  grainOn: true,
  strength: 0.06,
  density: 2,
  scale: 1,
  still: false,
  blend: "overlay",
  ab: false,
  wipe: 50,
};

const COMP: Record<string, Composition> = { full: "full-bleed", large: "large-window", small: "small-window" };

function fromQuery(): Partial<Params> {
  if (typeof window === "undefined") return {};
  const q = new URLSearchParams(window.location.search);
  const o: Partial<Params> = {};
  const num = (k: string) => (q.has(k) ? Number(q.get(k)) : undefined);
  const t = num("test"); if (t && t >= 1 && t <= 4) o.test = t as TestId;
  const p = num("p"); if (p !== undefined) o.progress = Math.min(1, Math.max(0, p));
  if (q.get("comp") && COMP[q.get("comp")!]) o.composition = COMP[q.get("comp")!];
  if (q.get("side") === "left" || q.get("side") === "right") o.side = q.get("side") as "left" | "right";
  if (q.get("play") === "1") o.play = true;
  const g = num("grain"); if (g !== undefined) { o.strength = g; o.grainOn = g > 0; }
  const d = num("density"); if (d !== undefined && d >= 0 && d <= 3) o.density = Math.round(d);
  const s = num("scale"); if (s !== undefined) o.scale = s;
  if (q.get("weave") === "0") o.weaveOn = false;
  if (q.get("still") === "1") o.still = true;
  if (q.get("blend") === "soft-light") o.blend = "soft-light";
  const ab = num("ab"); if (ab !== undefined) { o.ab = true; o.wipe = ab; }
  if (q.get("text") === "1" || o.test === 4) o.textOn = true;
  return o;
}

/** Development play cycle in film frames: 4 s forward, 1 s hold, 4 s back, 1 s hold. */
function playProgress(frame: number) {
  const f = frame % (FPS * 10);
  if (f < FPS * 4) return f / (FPS * 4);
  if (f < FPS * 5) return 1;
  if (f < FPS * 9) return 1 - (f - FPS * 5) / (FPS * 4);
  return 0;
}

type Readout = { fps: number; picCpu: number; picGpu: number | null; grainCpu: number; grainGpu: number | null; gpuQuery: boolean };

export function LabClient() {
  const picRef = useRef<HTMLCanvasElement>(null);
  const grainRef = useRef<HTMLCanvasElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const engines = useRef<{ pic: PictureEngine; grain: GrainEngine } | null>(null);
  const params = useRef<Params>({ ...DEFAULTS });
  const dirty = useRef(true);
  const [ui, setUi] = useState<Params>(DEFAULTS);
  const [panelOpen, setPanelOpen] = useState(true);
  const [showUi, setShowUi] = useState(false); // shown after mount unless ?ui=0, so recordings start clean
  const playStart = useRef(-1);
  const [scanUrl, setScanUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [readout, setReadout] = useState<Readout | null>(null);

  const set = useCallback(<K extends keyof Params>(k: K, v: Params[K]) => {
    params.current = { ...params.current, [k]: v };
    dirty.current = true;
    setUi(params.current);
  }, []);

  const loadTest = useCallback((id: TestId) => {
    engines.current?.pic.setSource(standIn(id));
    params.current = { ...params.current, test: id, textOn: id === 4 ? true : params.current.textOn };
    if (id === 3) params.current.play = true;
    dirty.current = true;
    setUi(params.current);
  }, []);

  // boot
  useEffect(() => {
    const q = fromQuery();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    params.current = { ...DEFAULTS, ...(reduced ? { weaveOn: false, still: true, progress: 1 } : {}), ...q };
    setShowUi(new URLSearchParams(window.location.search).get("ui") !== "0");
    setUi(params.current);

    let raf = 0;
    let disposed = false;
    let lastFrame = -1;
    let frames = 0;
    let fpsT0 = performance.now();

    (async () => {
      try {
        const { PictureEngine } = await import("@/lib/engine/picture");
        const { GrainEngine } = await import("@/lib/engine/grain");
        if (disposed || !picRef.current || !grainRef.current) return;
        const pic = new PictureEngine(picRef.current);
        const grain = new GrainEngine(grainRef.current);
        engines.current = { pic, grain };
        pic.setSource(standIn((params.current.test || 1) as TestId));
        await grain.load(params.current.density);
        // automation hook for recordings and checks (lab only)
        const w = window as unknown as { __labReady?: boolean; __labSet?: (patch: Partial<Params>) => void };
        w.__labSet = (patch) => { params.current = { ...params.current, ...patch }; dirty.current = true; setUi(params.current); };
        w.__labReady = true;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return;
      }

      const onResize = () => { engines.current?.pic.resize(); engines.current?.grain.resize(); dirty.current = true; };
      window.addEventListener("resize", onResize);

      const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        const e = engines.current;
        if (!e) return;
        const frame = frameAt(now);
        if (frame === lastFrame && !dirty.current) return; // film moves only on film-frame boundaries
        lastFrame = frame;
        dirty.current = false;
        const p = params.current;

        if (!p.play) playStart.current = -1;
        else {
          if (playStart.current < 0) playStart.current = frame; // each play starts from blank paper
          p.progress = playProgress(frame - playStart.current);
          if (frame % 3 === 0) setUi({ ...p });
        }

        const pw = p.weaveOn && !p.still
          ? weave({ ...WEAVE.picture, drift: p.picDrift / 100, jitter: p.picJitter / 100, rot: p.picRot }, frame)
          : { x: 0, y: 0, rot: 0 };
        e.pic.render({ progress: p.progress, develop: p.develop, composition: p.composition, side: p.side, weave: pw, dye: p.dye });

        if (p.grainOn) e.grain.render(frame, { strength: p.strength, scale: p.scale, still: p.still });

        // text layers weave on their own seeds, smaller than the picture; CSS transform only (no layout)
        const moving = p.weaveOn && !p.still;
        const tw = moving ? weave({ ...WEAVE.title, drift: p.titleDrift, jitter: p.titleJitter }, frame) : { x: 0, y: 0 };
        const k = p.titleDrift ? 0.625 : 0; // subtitles: 0.5 px vs 0.8 px in the brief
        const sw = moving ? weave({ ...WEAVE.subtitle, drift: p.titleDrift * k, jitter: p.titleJitter * 0.67 }, frame) : { x: 0, y: 0 };
        if (titleRef.current) titleRef.current.style.transform = `translate3d(${tw.x.toFixed(2)}px, ${tw.y.toFixed(2)}px, 0)`;
        if (subRef.current) subRef.current.style.transform = `translate3d(${sw.x.toFixed(2)}px, ${sw.y.toFixed(2)}px, 0)`;

        frames++;
        if (now - fpsT0 > 500) {
          setReadout({
            fps: (frames * 1000) / (now - fpsT0),
            picCpu: e.pic.cpuMs, picGpu: e.pic.timer.ms,
            grainCpu: e.grain.cpuMs, grainGpu: e.grain.timer.ms,
            gpuQuery: e.pic.timer.supported,
          });
          frames = 0; fpsT0 = now;
        }
      };
      raf = requestAnimationFrame(loop);
      return () => window.removeEventListener("resize", onResize);
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      engines.current?.pic.dispose();
      engines.current?.grain.dispose();
      engines.current = null;
    };
  }, []);

  // density changes need a new plate set
  useEffect(() => {
    engines.current?.grain.load(ui.density).then(() => { dirty.current = true; }).catch((e) => setError(String(e)));
  }, [ui.density]);

  const onFrameFile = async (f: File | undefined) => {
    if (!f || !engines.current) return;
    const bmp = await createImageBitmap(f);
    const c = document.createElement("canvas");
    c.width = bmp.width; c.height = bmp.height;
    c.getContext("2d")!.drawImage(bmp, 0, 0);
    engines.current.pic.setSource(c);
    set("test", 0);
  };
  const onScanFile = (f: File | undefined) => {
    if (!f) return;
    if (scanUrl) URL.revokeObjectURL(scanUrl);
    setScanUrl(URL.createObjectURL(f));
    set("ab", true);
  };

  const p = ui;
  const wipeClipScan = p.ab ? `inset(0 0 0 ${p.wipe}%)` : undefined;
  const wipeClipGrain = p.ab ? `inset(0 ${100 - p.wipe}% 0 0)` : undefined;
  const fmt = (v: number | null) => (v == null ? "n/a" : `${v.toFixed(2)} ms`);

  return (
    <div className="lab">
      <canvas ref={picRef} className="c-picture" aria-hidden="true" />
      {p.ab && scanUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="scan" src={scanUrl} alt="Raw scan for comparison" style={{ clipPath: wipeClipScan }} />
      )}
      <div className="text-layer" style={{ display: p.textOn ? "block" : "none" }}>
        <div ref={titleRef} className="t-title">
          <p className="label" style={{ marginBottom: 16 }}>REEL 1</p>
          <h2 className="title">What Else is There?</h2>
        </div>
        <div ref={subRef} className="t-sub">
          <p className="subtitle">Sun, bikes, dancing, film.</p>
        </div>
      </div>
      <canvas ref={grainRef} className="c-grain" aria-hidden="true" style={{ clipPath: wipeClipGrain, display: p.grainOn ? "block" : "none", mixBlendMode: p.blend }} />
      {p.ab && <div className="wipe-line" style={{ left: `${p.wipe}%` }} />}

      {error && (
        <div className="panel" style={{ left: 16, right: "auto" }}>
          <h2>Engine error</h2>
          <p className="note">{error}</p>
        </div>
      )}

      {showUi && (
        <aside className={`panel ${panelOpen ? "" : "hidden"}`} aria-label="Lab controls">
          <div className="panel-head">
            <h2>Film lab · Stage 3</h2>
            <button onClick={() => setPanelOpen((o) => !o)} aria-expanded={panelOpen}>{panelOpen ? "Hide" : "Show"}</button>
          </div>

          <fieldset>
            <legend>Test frame</legend>
            <div className="row">
              {([1, 2, 3, 4] as TestId[]).map((id) => (
                <button key={id} aria-pressed={p.test === id} onClick={() => loadTest(id)} title={TESTS[id].name}>{id}</button>
              ))}
              <label className="file">Load frame…<input type="file" accept="image/*" onChange={(e) => onFrameFile(e.target.files?.[0])} /></label>
            </div>
            {p.test ? (
              <p className="note"><span className="standin">Stand-in.</span> {TESTS[p.test].name}: {TESTS[p.test].check}</p>
            ) : <p className="note">Your frame.</p>}
          </fieldset>

          <fieldset>
            <legend>Composition</legend>
            <div className="row">
              {(["full-bleed", "large-window", "small-window"] as Composition[]).map((c) => (
                <button key={c} aria-pressed={p.composition === c} onClick={() => set("composition", c)}>{c.replace("-window", "").replace("full-bleed", "full")}</button>
              ))}
              <button onClick={() => set("side", p.side === "left" ? "right" : "left")} disabled={p.composition === "full-bleed"}>side: {p.side}</button>
            </div>
          </fieldset>

          <fieldset>
            <legend>Development</legend>
            <label>progress <span className="read">{(p.progress * 100).toFixed(0)}%</span>
              <input type="range" min={0} max={1} step={0.001} value={p.progress} onChange={(e) => { set("play", false); set("progress", Number(e.target.value)); }} />
            </label>
            <div className="row">
              <button aria-pressed={p.play} onClick={() => set("play", !p.play)}>{p.play ? "Pause" : "Play"} cycle</button>
              <button aria-pressed={p.develop} onClick={() => set("develop", !p.develop)}>develop {p.develop ? "on" : "off"}</button>
            </div>
            <label>dye offset <span className="read">{(p.dye * 100).toFixed(1)}%</span>
              <input type="range" min={0} max={0.08} step={0.005} value={p.dye} onChange={(e) => set("dye", Number(e.target.value))} />
            </label>
          </fieldset>

          <fieldset>
            <legend>Weave</legend>
            <label className="check"><input type="checkbox" checked={p.weaveOn} onChange={(e) => set("weaveOn", e.target.checked)} /> weave on</label>
            <label>picture drift <span className="read">±{p.picDrift.toFixed(2)}%</span>
              <input type="range" min={0} max={1} step={0.01} value={p.picDrift} onChange={(e) => set("picDrift", Number(e.target.value))} />
            </label>
            <label>picture jitter <span className="read">±{p.picJitter.toFixed(3)}%</span>
              <input type="range" min={0} max={0.3} step={0.005} value={p.picJitter} onChange={(e) => set("picJitter", Number(e.target.value))} />
            </label>
            <label>picture rotation <span className="read">≤{p.picRot.toFixed(3)}°</span>
              <input type="range" min={0} max={0.1} step={0.005} value={p.picRot} onChange={(e) => set("picRot", Number(e.target.value))} />
            </label>
            <label className="check"><input type="checkbox" checked={p.textOn} onChange={(e) => set("textOn", e.target.checked)} /> title + subtitle layer</label>
            <label>title drift <span className="read">±{p.titleDrift.toFixed(2)} px</span>
              <input type="range" min={0} max={3} step={0.05} value={p.titleDrift} onChange={(e) => set("titleDrift", Number(e.target.value))} />
            </label>
            <label>title jitter <span className="read">±{p.titleJitter.toFixed(2)} px</span>
              <input type="range" min={0} max={1} step={0.05} value={p.titleJitter} onChange={(e) => set("titleJitter", Number(e.target.value))} />
            </label>
          </fieldset>

          <fieldset>
            <legend>Grain</legend>
            <label className="check"><input type="checkbox" checked={p.grainOn} onChange={(e) => set("grainOn", e.target.checked)} /> grain on</label>
            <label>strength <span className="read">{p.strength.toFixed(3)}</span>
              <input type="range" min={0} max={0.2} step={0.005} value={p.strength} onChange={(e) => set("strength", Number(e.target.value))} />
            </label>
            <label>density <span className="read">{p.density}</span>
              <input type="range" min={0} max={3} step={1} value={p.density} onChange={(e) => set("density", Number(e.target.value))} />
            </label>
            <label>size (CSS px / texel) <span className="read">{p.scale.toFixed(2)}</span>
              <input type="range" min={0.5} max={2.5} step={0.05} value={p.scale} onChange={(e) => set("scale", Number(e.target.value))} />
            </label>
            <div className="row">
              {(["overlay", "soft-light"] as const).map((b) => (
                <button key={b} aria-pressed={p.blend === b} onClick={() => set("blend", b)}>{b}</button>
              ))}
            </div>
            <label className="check"><input type="checkbox" checked={p.still} onChange={(e) => set("still", e.target.checked)} /> freeze (reduced motion)</label>
          </fieldset>

          <fieldset>
            <legend>A/B against a raw scan</legend>
            <div className="row">
              <label className="file">Load scan…<input type="file" accept="image/*" onChange={(e) => onScanFile(e.target.files?.[0])} /></label>
              <button aria-pressed={p.ab} onClick={() => set("ab", !p.ab)} disabled={!scanUrl}>wipe {p.ab ? "on" : "off"}</button>
            </div>
            {p.ab && (
              <label>wipe <span className="read">{p.wipe.toFixed(0)}%</span>
                <input type="range" min={0} max={100} step={1} value={p.wipe} onChange={(e) => set("wipe", Number(e.target.value))} />
              </label>
            )}
            <p className="note">Left: engine (picture + grain). Right: the scan, untouched.</p>
          </fieldset>

          <fieldset>
            <legend>Frame time</legend>
            <p className="read">
              display {readout ? readout.fps.toFixed(0) : "–"} fps · film 24 fps<br />
              picture GPU {fmt(readout?.picGpu ?? null)} · CPU {readout ? readout.picCpu.toFixed(2) : "–"} ms<br />
              grain GPU {fmt(readout?.grainGpu ?? null)} · CPU {readout ? readout.grainCpu.toFixed(2) : "–"} ms<br />
              {readout && !readout.gpuQuery && "GPU timer query unavailable in this browser."}
            </p>
            <p className="note">Budgets: picture ≤ 2 ms, grain ≤ 1 ms at 1440 × 900 on an M1 Air.</p>
          </fieldset>
        </aside>
      )}
    </div>
  );
}
