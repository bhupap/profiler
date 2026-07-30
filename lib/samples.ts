import type { SupportedLanguage } from "./types";

/**
 * Starter snippets shown in the editor, one per language.
 * Each has an obvious O(n^2) hotspot so the analyzer has something to find.
 */
export const SAMPLES: Record<SupportedLanguage, string> = {
  javascript: `// Find duplicate values in an array
function findDuplicates(arr) {
  const dupes = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i] === arr[j] && !dupes.includes(arr[i])) {
        dupes.push(arr[i]);
      }
    }
  }
  return dupes;
}
`,
  typescript: `// Match users to their orders
function attachOrders(users: {id: number}[], orders: {userId: number}[]) {
  return users.map(u => ({
    ...u,
    orders: orders.filter(o => o.userId === u.id),
  }));
}
`,
  python: `# Find pairs that sum to target
def find_pairs(nums, target):
    result = []
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                result.append((nums[i], nums[j]))
    return result
`,
};

// True if the given code is one of the built-in samples (used to decide
// whether it's safe to swap in a different sample on language change).
export function isSample(code: string): boolean {
  return Object.values(SAMPLES).includes(code);
}
