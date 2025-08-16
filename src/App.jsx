import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Info, Dumbbell, Gauge, Download, Smartphone, X, Plus, Minus } from "lucide-react";

// --- Utilities --------------------------------------------------------------
const KG_IN_LB = 2.20462262185;
const fmt = (n, unit) =>
  isFinite(n) ? `${n.toFixed(1)} ${unit}` : "—";
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const roundTo = (value, step) => (step ? Math.round(value / step) * step : value);
const kgTo = (kg, unit) => (unit === "kg" ? kg : kg * KG_IN_LB);
const toKg = (val, unit) => (unit === "kg" ? val : val / KG_IN_LB);

function epley1RM(weight, reps) {
  // 1RM = w * (1 + reps/30)
  return weight * (1 + reps / 30);
}

function weightForReps(oneRM, reps) {
  // w = 1RM / (1 + reps/30)
  return oneRM / (1 + reps / 30);
}

function useLocalStorage(key, initial) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch (e) {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch { }
  }, [key, state]);
  return [state, setState];
}

// --- PWA bootstrap (single-file friendly) ----------------------------------
function usePWA(name = "Load Calculator") {
  const deferredPrompt = useRef(null);

  useEffect(() => {
    // Inject manifest dynamically so this single-file demo can be installed.
    const icons = [
      {
        src: "data:image/svg+xml;base64,PHN2ZyBmaWxsPSIjMDBlNmZmIiB2aWV3Qm94PSIwIDAgMjU2IDI1NiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmFkaWFsR3JhZGllbnQgaWQ9ImciIGN4PSIxMjgiIGN5PSIxMjgiIHI9IjEyOCI+PHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjMDBlNmZmIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMDQzY2ZmIi8+PC9yYWRpYWxHcmFkaWVudD48Y2lyY2xlIGZpbGw9InVybCgjZykiIGN4PSIxMjgiIGN5PSIxMjgiIHI9IjEyOCIvPjxwYXRoIGZpbGw9IndoaXRlIiBkPSJNMTg4IDEyNGE2NCA2NCAwIDEgMS0xMjggMCA2NCA2NCAwIDEgMSAxMjggMHptLTk0LTMyaDk2djI0aC05NnoiLz48L3N2Zz4=",
        sizes: "256x256",
        type: "image/svg+xml",
        purpose: "any maskable",
      },
    ];

    const manifest = {
      name,
      short_name: "LoadCalc",
      start_url: ".",
      display: "standalone",
      background_color: "#0b1220",
      theme_color: "#0ea5e9",
      icons,
    };

    const blob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = url;
    document.head.appendChild(link);

    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = "#0ea5e9";
    document.head.appendChild(meta);

    // Minimal service worker for offline cache.
    if ("serviceWorker" in navigator) {
      const swCode = `
        const CACHE = 'loadcalc-v1';
        self.addEventListener('install', e => {
          e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./'])));
          self.skipWaiting();
        });
        self.addEventListener('activate', e => self.clients.claim());
        self.addEventListener('fetch', e => {
          e.respondWith(
            caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
              const copy = resp.clone();
              caches.open(CACHE).then(c => c.put(e.request, copy)).catch(()=>{});
              return resp;
            }).catch(()=>caches.match('./')))
          );
        });`;
      const swBlob = new Blob([swCode], { type: "text/javascript" });
      const swUrl = URL.createObjectURL(swBlob);
      navigator.serviceWorker.register(swUrl).catch(() => { });
    }

    const handler = (e) => {
      e.preventDefault();
      deferredPrompt.current = e;
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [name]);

  return {
    canInstall: !!deferredPrompt.current,
    install: async () => {
      if (deferredPrompt.current) {
        deferredPrompt.current.prompt();
        await deferredPrompt.current.userChoice;
        deferredPrompt.current = null;
      }
    },
  };
}

// --- UI ---------------------------------------------------------------------
const Label = ({ children }) => (
  <label className="text-sm text-slate-300 block mb-2">{children}</label>
);

function NumberField({ label, value, onChange, step = 1, min = 0, placeholder }) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        inputMode="decimal"
        type="number"
        step={step}
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        placeholder={placeholder}
        className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
      />
    </div>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div className="inline-flex rounded-2xl p-1 bg-white/10 backdrop-blur border border-white/10">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-4 py-2 rounded-xl text-sm transition-all ${value === opt.value
              ? "bg-gradient-to-tr from-cyan-500 to-indigo-500 text-white shadow"
              : "text-slate-300 hover:text-white"
            }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function GlassCard({ children, className = "" }) {
  return (
    <div className={`rounded-3xl bg-white/5 border border-white/10 p-4 md:p-6 shadow-xl ${className}`}>
      {children}
    </div>
  );
}

function ResultTile({ title, value, sub }) {
  return (
    <motion.div layout className="rounded-3xl p-4 md:p-6 bg-gradient-to-br from-cyan-500/20 via-sky-500/10 to-indigo-500/20 border border-cyan-400/20">
      <div className="text-slate-300 text-sm mb-2">{title}</div>
      <div className="text-3xl md:text-4xl font-semibold text-white">{value}</div>
      {sub && <div className="text-slate-400 text-sm mt-1">{sub}</div>}
    </motion.div>
  );
}

function InfoModal({ open, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-6"
        >
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            className="max-w-lg w-full rounded-3xl bg-slate-900 border border-white/10 p-6"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-semibold text-white">How this works</h3>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl">
                <X className="w-5 h-5 text-slate-300" />
              </button>
            </div>
            <p className="text-slate-300 leading-relaxed">
              This calculator estimates your <span className="font-semibold">1-rep max</span> using the
              Epley formula and lets you plan loads for a target rep range. If you enter
              <span className="font-semibold"> RIR (reps in reserve)</span>, we treat it as additional potential reps.
              <br />
              <br />
              <code className="bg-white/10 px-2 py-1 rounded-xl">1RM = weight × (1 + reps/30)</code>
              <br />
              <code className="bg-white/10 px-2 py-1 rounded-xl">Load@reps = 1RM / (1 + reps/30)</code>
              <br />
              where <em>reps</em> includes your chosen RIR.
            </p>
            <p className="text-slate-400 text-sm mt-4">
              These are estimates—auto-regulate based on how you feel and warm-up sets.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Plate math ---------------------------------------------------------------
function plateMath(total, unit = "kg", bar = 20) {
  if (!isFinite(total) || total <= 0) return [];
  const plates = unit === "kg" ? [25, 20, 15, 10, 5, 2.5, 1.25, 1, 0.5] : [45, 35, 25, 10, 5, 2.5, 1.25];
  const perSide = (total - bar) / 2;
  if (perSide <= 0) return [];
  let remaining = perSide;
  const out = [];
  for (const p of plates) {
    let count = 0;
    while (remaining + 1e-9 >= p) {
      remaining -= p;
      count++;
    }
    if (count) out.push({ size: p, count });
  }
  return out;
}

// Main App ------------------------------------------------------------------
export default function LoadCalculatorApp() {
  const [unit, setUnit] = useLocalStorage("lc_unit", "kg");
  const [weight, setWeight] = useLocalStorage("lc_weight", 85);
  const [reps, setReps] = useLocalStorage("lc_reps", 5);
  const [repGoal, setRepGoal] = useLocalStorage("lc_repGoal", 8);
  const [rir, setRir] = useLocalStorage("lc_rir", 0);
  const [roundStep, setRoundStep] = useLocalStorage("lc_round", 2.5); // kg default
  const [barWeight, setBarWeight] = useLocalStorage("lc_bar", 20);
  const [showInfo, setShowInfo] = useState(false);

  // Keep step in sync with unit
  useEffect(() => {
    setRoundStep(unit === "kg" ? 2.5 : 5);
    setBarWeight(unit === "kg" ? 20 : 45);
  }, [unit]);

  const oneRM = useMemo(() => {
    const wkg = toKg(Number(weight) || 0, unit);
    const eff = (Number(reps) || 0) + (Number(rir) || 0);
    return kgTo(epley1RM(wkg, eff), unit);
  }, [weight, reps, rir, unit]);

  const targetLoad = useMemo(() => {
    const one = toKg(oneRM, unit);
    const repsTarget = (Number(repGoal) || 0) + (Number(rir) || 0);
    const raw = weightForReps(one, repsTarget);
    return kgTo(roundTo(raw, toKg(roundStep, unit)), unit);
  }, [oneRM, repGoal, rir, unit, roundStep]);

  const intensity = useMemo(() => (oneRM ? (targetLoad / oneRM) * 100 : 0), [oneRM, targetLoad]);

  const plates = useMemo(() => plateMath(targetLoad, unit, barWeight), [targetLoad, unit, barWeight]);

  const { canInstall, install } = usePWA("Reactive Load Calculator");

  // --- Layout --------------------------------------------------------------
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />

      <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-slate-900/50 bg-slate-900/80 border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
          <Dumbbell className="w-6 h-6 text-cyan-400" />
          <h1 className="text-lg font-semibold tracking-tight">Load Calculator</h1>
          <div className="flex-1" />
          <Segmented
            options={[
              { label: "Lbs", value: "lb" },
              { label: "Kg", value: "kg" },
            ]}
            value={unit}
            onChange={setUnit}
          />
          <button
            title="Info"
            onClick={() => setShowInfo(true)}
            className="ml-3 p-2 rounded-xl hover:bg-white/10"
          >
            <Info className="w-5 h-5 text-slate-300" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Inputs */}
        <GlassCard>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NumberField label={`Weight (${unit})`} value={weight} onChange={setWeight} step={unit === "kg" ? 0.5 : 1} />
            <NumberField label="Reps" value={reps} onChange={setReps} step={1} />
            <NumberField label="Rep Goal" value={repGoal} onChange={setRepGoal} step={1} />
            <NumberField label="Reps In Reserve (RIR)" value={rir} onChange={(v) => setRir(clamp(v, 0, 10))} step={1} />
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Rounding</Label>
              <div className="flex items-center gap-2">
                <button
                  className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10"
                  onClick={() => setRoundStep((s) => Math.max((unit === 'kg' ? 0.25 : 0.5), (Number(s) || 0) / 2))}
                  title="Half step"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="flex-1 text-center font-medium">
                  {roundStep} {unit}
                </div>
                <button
                  className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10"
                  onClick={() => setRoundStep((s) => (Number(s) || 0) * 2 || (unit === 'kg' ? 2.5 : 5))}
                  title="Double step"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="text-xs text-slate-400 mt-1">Rounds the recommended load to the nearest step.</div>
            </div>

            <div>
              <Label>Bar weight</Label>
              <select
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-3 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                value={barWeight}
                onChange={(e) => setBarWeight(Number(e.target.value))}
              >
                {unit === "kg" ? (
                  <>
                    <option value={20}>20 kg (standard)</option>
                    <option value={15}>15 kg</option>
                    <option value={10}>10 kg</option>
                  </>
                ) : (
                  <>
                    <option value={45}>45 lb (standard)</option>
                    <option value={35}>35 lb</option>
                    <option value={15}>15 lb</option>
                  </>
                )}
              </select>
              <div className="text-xs text-slate-400 mt-1">Used for plate breakdown only.</div>
            </div>

            <div className="flex flex-col justify-end">
              <button
                onClick={() => {
                  setWeight(85);
                  setReps(5);
                  setRepGoal(8);
                  setRir(0);
                }}
                className="rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-4 py-3 font-medium shadow hover:opacity-95"
              >
                Reset Example
              </button>
            </div>
          </div>
        </GlassCard>

        {/* Results */}
        <div className="grid grid-cols-1 gap-4 md:gap-6">
          <ResultTile title="Estimated 1 Rep Max" value={fmt(oneRM, unit)} sub="Epley method" />
          <ResultTile title="Weight to Use" value={fmt(targetLoad, unit)} sub={`${Math.round(intensity)}% of est. 1RM`} />

          <GlassCard>
            <div className="flex items-center gap-2 mb-3">
              <Gauge className="w-5 h-5 text-cyan-400" />
              <div className="text-slate-200 font-medium">Plate breakdown</div>
            </div>
            {plates.length === 0 ? (
              <div className="text-slate-400 text-sm">Enter values above to see plates per side.</div>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {plates.map((p) => (
                  <li key={p.size} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-200">
                    {p.count} × {p.size} {unit}
                  </li>
                ))}
              </ul>
            )}
            <div className="text-xs text-slate-500 mt-3">Total includes the bar: {barWeight} {unit}.</div>
          </GlassCard>
        </div>

        {/* Callouts */}
        <GlassCard className="md:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex-1">
              <div className="text-slate-100 font-medium">Tips</div>
              <ul className="list-disc pl-5 text-slate-300 text-sm mt-2 space-y-1">
                <li>Use RIR to reflect how close to failure you trained last time or plan to train this set.</li>
                <li>Rounding helps match real plates in your gym; tweak the step to your smallest plates.</li>
                <li>Long-press the app icon after installing to get quick access to your last session.</li>
              </ul>
            </div>
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-cyan-400" />
              <button
                onClick={install}
                className={`rounded-2xl border px-4 py-2 text-sm transition ${canInstall ? "border-cyan-400/40 hover:bg-cyan-400/10" : "border-white/10 text-slate-400 cursor-default"
                  }`}
                disabled={!canInstall}
              >
                Add to Home Screen
              </button>
            </div>
          </div>
        </GlassCard>
      </main>

      {/* Bottom sticky results (mobile friendly) */}
      <div className="md:hidden fixed bottom-4 inset-x-4 z-40">
        <motion.div
          layout
          className="rounded-3xl p-4 bg-slate-900/90 backdrop-blur border border-white/10 shadow-2xl"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">Use</div>
              <div className="text-xl font-semibold">{fmt(targetLoad, unit)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400">1RM</div>
              <div className="text-xl font-semibold">{fmt(oneRM, unit)}</div>
            </div>
          </div>
        </motion.div>
      </div>

      <InfoModal open={showInfo} onClose={() => setShowInfo(false)} />

      <footer className="mx-auto max-w-6xl px-4 pb-20 md:pb-6 text-center text-xs text-slate-500">
        Built with ❤️ for phones first. Responsive and PWA-ready.
      </footer>
    </div>
  );
}
