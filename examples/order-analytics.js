// order-analytics.js
// Batch analytics over an e-commerce order stream: enrich raw orders with
// customer + product data, then compute spend, cohorts, and co-purchase stats.
//
// Realistic shape, deliberately naive algorithms — good material for a profiler
// demo (several nested-loop / N+1 / quadratic-growth hotspots hide in here).

/**
 * @typedef {{ id:number, customerId:number, items:{productId:number, qty:number, price:number}[], ts:number }} Order
 * @typedef {{ id:number, name:string, tier:string, country:string }} Customer
 * @typedef {{ id:number, name:string, category:string }} Product
 */

// Attach the full customer record and product records to every order line.
// (For each order we re-scan the whole customers and products arrays.)
function enrichOrders(orders, customers, products) {
  const enriched = [];
  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    const customer = customers.find((c) => c.id === order.customerId);
    const lines = order.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      return {
        ...item,
        productName: product ? product.name : "unknown",
        category: product ? product.category : "uncategorized",
        lineTotal: item.qty * item.price,
      };
    });
    enriched.push({ ...order, customer, lines });
  }
  return enriched;
}

// Total spend per customer, returned sorted high → low.
function topCustomersBySpend(orders, customers) {
  const rows = [];
  for (const customer of customers) {
    // Re-filter the entire order list for every single customer.
    const theirOrders = orders.filter((o) => o.customerId === customer.id);
    let spend = 0;
    for (const o of theirOrders) {
      for (const item of o.items) {
        spend += item.qty * item.price;
      }
    }
    rows.push({ customer: customer.name, tier: customer.tier, spend });
  }
  return rows.sort((a, b) => b.spend - a.spend);
}

// Customers who bought at least `minShared` of the same products — a naive
// pairwise comparison across the whole customer base.
function findSimilarCustomers(orders, customers, minShared = 2) {
  const productsByCustomer = {};
  for (const customer of customers) {
    const ids = [];
    for (const o of orders) {
      if (o.customerId !== customer.id) continue;
      for (const item of o.items) {
        // Linear membership check inside the loop keeps `ids` unique.
        if (!ids.includes(item.productId)) ids.push(item.productId);
      }
    }
    productsByCustomer[customer.id] = ids;
  }

  const pairs = [];
  for (let a = 0; a < customers.length; a++) {
    for (let b = a + 1; b < customers.length; b++) {
      const idsA = productsByCustomer[customers[a].id];
      const idsB = productsByCustomer[customers[b].id];
      let shared = 0;
      for (const id of idsA) {
        if (idsB.includes(id)) shared++;
      }
      if (shared >= minShared) {
        pairs.push({ a: customers[a].name, b: customers[b].name, shared });
      }
    }
  }
  return pairs;
}

// Revenue per category. Rebuilds and re-sorts the running list on every order.
function categoryLeaderboard(enrichedOrders) {
  let leaderboard = [];
  for (const order of enrichedOrders) {
    for (const line of order.lines) {
      const existing = leaderboard.find((r) => r.category === line.category);
      if (existing) {
        existing.revenue += line.lineTotal;
      } else {
        // Copy the whole array to append (quadratic as the list grows).
        leaderboard = leaderboard.concat([{ category: line.category, revenue: line.lineTotal }]);
      }
      // Keep it sorted at every step so callers can peek the top any time.
      leaderboard.sort((x, y) => y.revenue - x.revenue);
    }
  }
  return leaderboard;
}

// Rolling 7-day revenue for each day present in the data. For every day we
// re-scan every order to see if it falls in the trailing window.
function rollingWeeklyRevenue(orders) {
  const DAY = 86_400_000;
  const days = orders.map((o) => Math.floor(o.ts / DAY) * DAY);
  const uniqueDays = days.filter((d, i) => days.indexOf(d) === i).sort((a, b) => a - b);

  const series = [];
  for (const day of uniqueDays) {
    let revenue = 0;
    for (const o of orders) {
      if (o.ts <= day + DAY && o.ts > day + DAY - 7 * DAY) {
        for (const item of o.items) revenue += item.qty * item.price;
      }
    }
    series.push({ day, revenue });
  }
  return series;
}

module.exports = {
  enrichOrders,
  topCustomersBySpend,
  findSimilarCustomers,
  categoryLeaderboard,
  rollingWeeklyRevenue,
};
