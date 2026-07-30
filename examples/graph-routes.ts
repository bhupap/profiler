// graph-routes.ts
// Shortest-path routing over a weighted directed graph of stops (a transit /
// delivery network). Edges are kept as a flat list; the graph is queried a lot.
//
// Correct but textbook-naive: adjacency is derived by scanning the edge list,
// Dijkstra picks the next node by linear scan, and visited/known sets are plain
// arrays. Rich pickings for a complexity profiler.

interface Edge {
  from: string;
  to: string;
  weight: number;
}

interface RouteResult {
  path: string[];
  cost: number;
}

export class RouteGraph {
  private edges: Edge[] = [];
  private nodes: string[] = [];

  addEdge(from: string, to: string, weight: number): void {
    this.edges.push({ from, to, weight });
    // Linear membership check on every insert keeps the node list unique.
    if (!this.nodes.includes(from)) this.nodes.push(from);
    if (!this.nodes.includes(to)) this.nodes.push(to);
  }

  // Neighbours of a node, recomputed by scanning every edge each call.
  private neighbours(node: string): Edge[] {
    return this.edges.filter((e) => e.from === node);
  }

  // Dijkstra with an array-scan "priority queue" and array-based visited set.
  shortestPath(start: string, goal: string): RouteResult | null {
    const dist: Record<string, number> = {};
    const prev: Record<string, string | null> = {};
    for (const node of this.nodes) {
      dist[node] = Infinity;
      prev[node] = null;
    }
    dist[start] = 0;

    const visited: string[] = [];
    while (visited.length < this.nodes.length) {
      // Find the unvisited node with the smallest tentative distance by
      // scanning the whole node list every iteration.
      let current: string | null = null;
      let best = Infinity;
      for (const node of this.nodes) {
        if (visited.includes(node)) continue;
        if (dist[node] < best) {
          best = dist[node];
          current = node;
        }
      }
      if (current === null || best === Infinity) break;
      if (current === goal) break;

      visited.push(current);
      for (const edge of this.neighbours(current)) {
        const alt = dist[current] + edge.weight;
        if (alt < dist[edge.to]) {
          dist[edge.to] = alt;
          prev[edge.to] = current;
        }
      }
    }

    if (dist[goal] === Infinity) return null;

    // Rebuild the path by walking predecessors, prepending with concat.
    let path: string[] = [];
    let step: string | null = goal;
    while (step !== null) {
      path = [step].concat(path);
      step = prev[step];
    }
    return { path, cost: dist[goal] };
  }

  // All-pairs shortest costs — just calls the naive single-source repeatedly.
  allPairsCost(): Record<string, Record<string, number>> {
    const table: Record<string, Record<string, number>> = {};
    for (const a of this.nodes) {
      table[a] = {};
      for (const b of this.nodes) {
        if (a === b) {
          table[a][b] = 0;
          continue;
        }
        const result = this.shortestPath(a, b);
        table[a][b] = result ? result.cost : Infinity;
      }
    }
    return table;
  }

  // Stops reachable from `start` within `budget` — reruns a full path search
  // for every candidate node.
  reachableWithin(start: string, budget: number): string[] {
    const reachable: string[] = [];
    for (const node of this.nodes) {
      if (node === start) continue;
      const result = this.shortestPath(start, node);
      if (result && result.cost <= budget) reachable.push(node);
    }
    return reachable;
  }
}

export function buildFromMatrix(matrix: number[][], labels: string[]): RouteGraph {
  const graph = new RouteGraph();
  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < matrix[i].length; j++) {
      if (matrix[i][j] > 0) graph.addEdge(labels[i], labels[j], matrix[i][j]);
    }
  }
  return graph;
}
