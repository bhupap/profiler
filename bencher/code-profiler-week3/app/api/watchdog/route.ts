import { NextRequest, NextResponse } from "next/server";
import type { WatchdogResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 15;

/**
 * WEEK 3 — The halting watchdog.
 *
 * THE THEORY (this is the whole point):
 * We CANNOT decide whether arbitrary code halts — that's the halting problem,
 * proven undecidable. So we don't try to decide. We APPROXIMATE with a runtime
 * step-budget: run the code, count operations, and stop at a limit.
 *
 * This gives a SOUND-BUT-INCOMPLETE answer:
 *   - "completed"        -> it finished within budget (definitely halts on THIS input)
 *   - "budget_exceeded"  -> it ran too long. We CANNOT say if it's stuck forever or
 *                           just slow. We report exactly that — we don't guess.
 *
 * SAFETY / FUTURE WORK: this is a *demo-grade* sandbox using the Function
 * constructor with a step counter injected into loops. It is NOT a secure
 * sandbox — do not run untrusted code with it in production. A real version
 * would use an isolated worker (isolated-vm, a WASM runtime, or a separate
 * container) with a hard CPU/time limit. Here it exists to show the SHAPE of
 * the "stuck or just slow?" feature.
 *
 * Currently JS/TS only. Python would need a separate sandboxed runner.
 */

const DEFAULT_BUDGET = 5_000_000; // 5M "steps"

export async function POST(req: NextRequest) {
  let body: { code?: string; entry?: string; budget?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const code = (body.code ?? "").trim();
  const budget = body.budget ?? DEFAULT_BUDGET;
  if (!code) return NextResponse.json({ error: "No code provided" }, { status: 400 });

  // Inject a step counter into loop headers. Extremely rough source rewriting —
  // a real implementation instruments the AST, not string-replaces.
  const instrumented = injectStepCounter(code, budget);

  const result = runWithBudget(instrumented, body.entry, budget);
  return NextResponse.json(result satisfies WatchdogResult);
}

/**
 * Rough instrumentation: add a __tick() call at the start of every for/while
 * body by inserting after the loop's opening brace. This is naive and will not
 * handle every style (single-line loops, etc.) — good enough to demonstrate.
 */
function injectStepCounter(code: string, budget: number): string {
  // Add __tick after "{" that immediately follows a for/while(...) header.
  const withTicks = code.replace(
    /(\b(?:for|while)\s*\([^)]*\)\s*\{)/g,
    `$1 __tick();`
  );
  return `
    let __steps = 0;
    const __budget = ${budget};
    function __tick() {
      if (++__steps > __budget) {
        const e = new Error("BUDGET_EXCEEDED");
        e.name = "BudgetExceeded";
        throw e;
      }
    }
    ${withTicks}
  `;
}

function runWithBudget(
  instrumented: string,
  entry: string | undefined,
  budget: number
): WatchdogResult {
  try {
    // Build a function that runs the instrumented code and optionally calls an entry.
    const runner = new Function(`
      ${instrumented}
      ${entry ? `return (${entry});` : "return undefined;"}
    `);
    const start = Date.now();
    runner();
    const elapsed = Date.now() - start;
    return {
      verdict: "completed",
      stepsUsed: -1, // not surfaced in this demo; would read __steps in a real build
      stepBudget: budget,
      message: `Finished within the step budget (${elapsed}ms). On this input, it halts.`,
    };
  } catch (err) {
    const e = err as Error;
    if (e.name === "BudgetExceeded" || e.message === "BUDGET_EXCEEDED") {
      return {
        verdict: "budget_exceeded",
        stepsUsed: budget,
        stepBudget: budget,
        message:
          "Hit the step budget without finishing. We can't tell if it's stuck forever or just slow — that's the halting problem. Treat this as 'needs a closer look.'",
      };
    }
    return {
      verdict: "error",
      stepsUsed: -1,
      stepBudget: budget,
      message: `Could not run: ${e.message}`,
    };
  }
}
