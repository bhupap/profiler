import type { SupportedLanguage } from "./types";

/**
 * DEMO pool for the "+" new-tab button. Each snippet is small and has an obvious
 * algorithmic hotspot so a fresh tab always has something interesting to analyze.
 *
 * For the live product this goes away — a new tab should start blank (see
 * `openRandomTab` in app/page.tsx). It's here only to make demos self-serving.
 */
export type DemoSnippet = { name: string; language: SupportedLanguage; code: string };

export const DEMO_SNIPPETS: DemoSnippet[] = [
  {
    name: "two-sum.js",
    language: "javascript",
    code: `// Two-sum, brute force
function twoSum(nums, target) {
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[i] + nums[j] === target) return [i, j];
    }
  }
  return null;
}
`,
  },
  {
    name: "flatten.js",
    language: "javascript",
    code: `// Flatten a nested array by growing a new array in a loop
function flatten(nested) {
  let out = [];
  for (const row of nested) {
    for (const value of row) {
      out = out.concat([value]);
    }
  }
  return out;
}
`,
  },
  {
    name: "fib.js",
    language: "javascript",
    code: `// Recursive Fibonacci — no memoization
function fib(n) {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}

function sequence(count) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(fib(i));
  return out;
}
`,
  },
  {
    name: "attach-orders.ts",
    language: "typescript",
    code: `// Attach each user's orders by scanning the order list per user
function attachOrders(users: { id: number }[], orders: { userId: number }[]) {
  return users.map((u) => ({
    ...u,
    orders: orders.filter((o) => o.userId === u.id),
  }));
}
`,
  },
  {
    name: "unique.ts",
    language: "typescript",
    code: `// Deduplicate a list using linear membership checks
function unique<T>(items: T[]): T[] {
  const seen: T[] = [];
  for (const item of items) {
    if (!seen.includes(item)) seen.push(item);
  }
  return seen;
}
`,
  },
  {
    name: "find-pairs.py",
    language: "python",
    code: `# Find pairs that sum to a target
def find_pairs(nums, target):
    result = []
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                result.append((nums[i], nums[j]))
    return result
`,
  },
  {
    name: "bubble-sort.py",
    language: "python",
    code: `# Bubble sort
def bubble_sort(values):
    items = list(values)
    for i in range(len(items)):
        for j in range(len(items) - 1):
            if items[j] > items[j + 1]:
                items[j], items[j + 1] = items[j + 1], items[j]
    return items
`,
  },
  {
    name: "count-primes.py",
    language: "python",
    code: `# Count primes below n by trial division
def count_primes(n):
    count = 0
    for candidate in range(2, n):
        is_prime = True
        for d in range(2, candidate):
            if candidate % d == 0:
                is_prime = False
                break
        if is_prime:
            count += 1
    return count
`,
  },
];

export function randomSnippet(): DemoSnippet {
  return DEMO_SNIPPETS[Math.floor(Math.random() * DEMO_SNIPPETS.length)];
}
