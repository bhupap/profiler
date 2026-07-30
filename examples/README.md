# Demo files

Upload these in the Profiler (**Upload** button) to show the analyzer working on
realistic, non-trivial code. Each is correct, coherent code with algorithmic
problems planted in plain sight — the kind a senior reviewer would flag. All are
well under the 20 KB upload limit.

Suggested live order: **JS → Python → TypeScript** (simple/dramatic first,
then the graph one as the "wow").

| File | Language | Domain | Headline hotspots to expect |
|---|---|---|---|
| `order-analytics.js` | JavaScript | e-commerce order analytics | N+1 `find` in `enrichOrders`; `filter`-per-customer in `topCustomersBySpend`; **O(n²)** pairwise `findSimilarCustomers`; `concat`+`sort`-in-loop in `categoryLeaderboard`; rescan window in `rollingWeeklyRevenue` |
| `recommender.py` | Python | item-to-item recommendations | **O(n²)** pairwise `item_similarity` with vectors rebuilt in the inner loop; norms recomputed every `cosine` call; `in list` membership scans; **exponential** unmemoized recursion in `popularity_decay`; string `+=` in `render_report` |
| `graph-routes.ts` | TypeScript | weighted-graph routing | Dijkstra with a **linear-scan** min-select (O(V²)) and array `visited`; adjacency rebuilt by scanning all edges each call; `allPairsCost` / `reachableWithin` rerun full searches per node |

## Talking points

- **Static pre-pass vs. model** — the sidebar shows what the regex pass caught
  before the model ran; contrast that with what the model actually reasoned about.
- **Severity + big-O hero** — the right panel leads with the overall complexity
  and a severity meter, then an accordion of hotspots (open one at a time).
- **Suggested fix → diff → accept** — open a hotspot, *View suggested code*, and
  accept the rewrite to splice it into the editor.
- **Flame graph is an estimate** — widths are the model's estimated relative
  cost, not measured runtime (labelled as such).

## Note on limits

The uploader accepts `.js .jsx .ts .tsx .py` up to 20 KB / 20,000 characters
(see `lib/config.ts`). If you want a bigger stress case, paste directly into the
editor instead of uploading.
