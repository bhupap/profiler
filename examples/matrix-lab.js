// matrix-lab.js
// Small dense-matrix toolkit: multiply, power, transpose, and a few reductions.
// Matrices are arrays of number[] rows. Correct but textbook-naive — good
// material for a profiler (a cubic multiply, repeated transposes, growth-in-loop).

// Classic triple-nested multiply. Also re-transposes `b` on every call.
function multiply(a, b) {
  const bt = transpose(b);
  const result = [];
  for (let i = 0; i < a.length; i++) {
    const row = [];
    for (let j = 0; j < bt.length; j++) {
      let sum = 0;
      for (let k = 0; k < a[i].length; k++) {
        sum += a[i][k] * bt[j][k];
      }
      row.push(sum);
    }
    result.push(row);
  }
  return result;
}

// Rebuilds the transpose from scratch (called again inside every multiply).
function transpose(m) {
  const out = [];
  for (let j = 0; j < m[0].length; j++) {
    const row = [];
    for (let i = 0; i < m.length; i++) {
      row.push(m[i][j]);
    }
    out.push(row);
  }
  return out;
}

// Raise a square matrix to the k-th power by repeated multiplication.
function power(m, k) {
  let acc = identity(m.length);
  for (let step = 0; step < k; step++) {
    acc = multiply(acc, m);
  }
  return acc;
}

function identity(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < n; j++) row.push(i === j ? 1 : 0);
    out.push(row);
  }
  return out;
}

// Flatten a matrix into one array by growing it one element at a time.
function flatten(m) {
  let out = [];
  for (const row of m) {
    for (const value of row) {
      out = out.concat([value]);
    }
  }
  return out;
}

// True if `value` appears anywhere in the matrix — linear scan with includes.
function contains(m, value) {
  const flat = flatten(m);
  for (let i = 0; i < flat.length; i++) {
    if (flat.slice(0, i + 1).includes(value)) return true;
  }
  return false;
}

// Row sums, recomputing the running total list via concat each row.
function rowSums(m) {
  let sums = [];
  for (const row of m) {
    let total = 0;
    for (const v of row) total += v;
    sums = sums.concat([total]);
  }
  return sums;
}

module.exports = { multiply, transpose, power, identity, flatten, contains, rowSums };
