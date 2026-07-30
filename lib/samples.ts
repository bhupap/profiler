import type { SupportedLanguage } from "./types";

/**
 * Starter snippets shown in the editor. Not every language has one — those fall
 * back to a neutral placeholder via `sampleFor`. Each snippet has an obvious
 * O(n^2) hotspot so the analyzer has something to find.
 */
export const SAMPLES: Partial<Record<SupportedLanguage, string>> = {
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

const PLACEHOLDER = "// Paste your code here, then press Analyze";

// The starter content for a language: its sample, or a neutral placeholder.
export function sampleFor(language: SupportedLanguage): string {
  return SAMPLES[language] ?? `${PLACEHOLDER}\n`;
}

// True if the given code is still pristine starter content (a built-in sample
// or the placeholder) — used to decide whether it's safe to swap it out on a
// language change.
export function isSample(code: string): boolean {
  return Object.values(SAMPLES).includes(code) || code.trim() === PLACEHOLDER;
}
