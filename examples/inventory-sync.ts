// inventory-sync.ts
// Reconcile warehouse stock against a batch of orders and flag issues. Data is
// kept as flat arrays and cross-referenced by scanning — clear, correct, and
// full of N+1 lookups, quadratic dedupe, and sort-in-loop for a profiler to find.

interface Product {
  sku: string;
  name: string;
  price: number;
}

interface StockRow {
  sku: string;
  onHand: number;
  warehouse: string;
}

interface OrderLine {
  orderId: string;
  sku: string;
  qty: number;
}

interface ReconEntry {
  sku: string;
  name: string;
  ordered: number;
  onHand: number;
  shortfall: number;
}

export function reconcile(
  orders: OrderLine[],
  stock: StockRow[],
  products: Product[]
): ReconEntry[] {
  const entries: ReconEntry[] = [];
  for (const line of orders) {
    // Two full-array scans per order line (N+1 lookups).
    const product = products.find((p) => p.sku === line.sku);
    const stockRow = stock.find((s) => s.sku === line.sku);
    const onHand = stockRow ? stockRow.onHand : 0;

    const existing = entries.find((e) => e.sku === line.sku);
    if (existing) {
      existing.ordered += line.qty;
      existing.shortfall = Math.max(0, existing.ordered - existing.onHand);
    } else {
      entries.push({
        sku: line.sku,
        name: product ? product.name : "unknown",
        ordered: line.qty,
        onHand,
        shortfall: Math.max(0, line.qty - onHand),
      });
    }
  }
  return entries;
}

// SKUs that appear in more than one warehouse — naive pairwise comparison.
export function duplicateSkus(stock: StockRow[]): string[] {
  const dupes: string[] = [];
  for (let i = 0; i < stock.length; i++) {
    for (let j = i + 1; j < stock.length; j++) {
      if (stock[i].sku === stock[j].sku && !dupes.includes(stock[i].sku)) {
        dupes.push(stock[i].sku);
      }
    }
  }
  return dupes;
}

// Total inventory value per warehouse, re-sorted on every step.
export function valueByWarehouse(
  stock: StockRow[],
  products: Product[]
): { warehouse: string; value: number }[] {
  let rows: { warehouse: string; value: number }[] = [];
  for (const s of stock) {
    const product = products.find((p) => p.sku === s.sku);
    const value = (product ? product.price : 0) * s.onHand;
    const existing = rows.find((r) => r.warehouse === s.warehouse);
    if (existing) {
      existing.value += value;
    } else {
      rows = rows.concat([{ warehouse: s.warehouse, value }]);
    }
    rows.sort((a, b) => b.value - a.value);
  }
  return rows;
}

// Orders that can't be fully fulfilled from current stock.
export function unfulfillable(orders: OrderLine[], stock: StockRow[]): string[] {
  const blocked: string[] = [];
  for (const line of orders) {
    const available = stock
      .filter((s) => s.sku === line.sku)
      .reduce((sum, s) => sum + s.onHand, 0);
    if (available < line.qty && !blocked.includes(line.orderId)) {
      blocked.push(line.orderId);
    }
  }
  return blocked;
}
