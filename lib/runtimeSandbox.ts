"use client";

import type { AnalysisResult } from "./types";

/**
 * Measured-runtime lens (client-side, JavaScript only).
 *
 * SAFE: the user's code runs in a Web Worker on the user's OWN machine — not on
 * the server — with a hard timeout that terminates a hung/slow run. We call the
 * top-level function with auto-scaled inputs and time each size, then infer the
 * empirical growth. This is measured wall-clock time, not an estimate.
 */
type Kind = "array" | "nested" | "number";

function parseFunction(code: string): { name: string; kinds: Kind[] } | null {
  const m =
    code.match(/function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/) ||
    code.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?function\s*\(([^)]*)\)/) ||
    code.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/);
  if (!m) return null;
  const params = m[2]
    .split(",")
    .map((p) => p.trim().split(/[:=]/)[0].trim())
    .filter(Boolean);
  const kinds = params.map((p): Kind => {
    if (/nested|matrix|grid|rows/i.test(p)) return "nested";
    if (/^(n|count|size|len|length|k|target|goal|iterations|times|num)$/i.test(p)) return "number";
    return "array";
  });
  if (kinds.length === 0) kinds.push("array");
  return { name: m[1], kinds };
}

const WORKER_SRC = `
self.onmessage = function(e){
  var d = e.data, code = d.code, fnName = d.fnName, kinds = d.kinds, sizes = d.sizes, budget = d.budget;
  function makeArg(k, n){
    if (k === 'number') return n;
    if (k === 'nested'){ var m = Math.max(1, Math.floor(Math.sqrt(n))); var a=[]; for(var i=0;i<m;i++){var r=[];for(var j=0;j<m;j++)r.push((i*j)%100);a.push(r);} return a; }
    var arr = new Array(n); for(var i=0;i<n;i++) arr[i]=Math.floor(Math.random()*Math.max(2,n/2)); return arr;
  }
  try{
    var fn = (new Function(code + "\\n;return (typeof " + fnName + " === 'function') ? " + fnName + " : null;"))();
    if(!fn){ postMessage({error:"Couldn't find function '"+fnName+"' to run."}); return; }
    var points = [];
    for(var s=0;s<sizes.length;s++){
      var n = sizes[s];
      var args = kinds.map(function(k){ return makeArg(k, n); });
      var t0 = performance.now();
      fn.apply(null, args);
      var ms = performance.now() - t0;
      points.push({ n: n, ms: ms });
      if (ms > budget) break;
    }
    postMessage({ points: points });
  }catch(err){ postMessage({ error: (err && err.message) ? err.message : String(err) }); }
};
`;

export async function measureRuntime(code: string): Promise<AnalysisResult> {
  const measuredFallback = (msg: string): AnalysisResult => ({
    overallComplexity: "—",
    complexityReasoning: msg,
    hotspots: [],
    flameGraph: [],
    measured: true,
  });

  const parsed = parseFunction(code);
  if (!parsed) return measuredFallback("Couldn't find a top-level function to benchmark.");
  if (typeof window === "undefined" || typeof Worker === "undefined")
    return measuredFallback("Runtime measurement runs in the browser only.");

  const sizes = [1000, 2000, 4000, 8000, 16000, 32000, 64000];
  const budget = 400; // ms per size before we stop scaling up

  const res = await new Promise<{ points?: { n: number; ms: number }[]; error?: string }>((resolve) => {
    let done = false;
    const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: "application/javascript" }));
    const worker = new Worker(url);
    const finish = (payload: { points?: { n: number; ms: number }[]; error?: string }) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(payload);
    };
    const timer = setTimeout(
      () => finish({ error: "Timed out — too slow to measure (possible infinite loop or very high complexity)." }),
      5000
    );
    worker.onmessage = (e) => finish(e.data);
    worker.onerror = (e) => finish({ error: e.message || "Worker error." });
    worker.postMessage({ code, fnName: parsed.name, kinds: parsed.kinds, sizes, budget });
  });

  if (res.error) return measuredFallback(res.error);
  const points = (res.points ?? []).filter((p) => isFinite(p.ms));
  if (points.length < 2) return measuredFallback("Ran too fast to measure a trend — try heavier inputs.");

  // Empirical growth: ratio of time when n doubles, over non-noisy samples.
  const ratios: number[] = [];
  for (let i = 1; i < points.length; i++) {
    if (points[i - 1].ms >= 2 && points[i].n === points[i - 1].n * 2) {
      ratios.push(points[i].ms / points[i - 1].ms);
    }
  }
  const avg = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null;
  let label = "unclear";
  if (avg != null) {
    if (avg < 1.5) label = "O(1) / O(log n)";
    else if (avg < 3) label = "O(n)";
    else if (avg < 6) label = "O(n²)";
    else if (avg < 12) label = "O(n³)";
    else label = "super-polynomial";
  }

  return {
    overallComplexity: avg != null ? `≈ ${label}` : "measured",
    complexityReasoning:
      avg != null
        ? `Measured in-browser: input ×2 → time ×~${avg.toFixed(1)} across ${points.length} sizes (this machine).`
        : `Measured ${points.length} sizes; times too small for a stable trend.`,
    hotspots: [],
    flameGraph: points.map((p) => ({
      label: `n=${p.n.toLocaleString()}`,
      startLine: 1,
      endLine: 1,
      weight: Math.max(1, Math.round(p.ms)),
      complexity: `${p.ms.toFixed(1)} ms`,
    })),
    measured: true,
  };
}
