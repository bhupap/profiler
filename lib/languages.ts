import type { SupportedLanguage } from "./types";

/**
 * The one place that knows about supported languages. `id` is a Monaco language
 * id (drives editor highlighting); `exts` map uploads to a language; `dot` is
 * the accent shown in the picker + tabs. config.ts derives its lists from here,
 * so adding a language is a one-line change.
 */
export type LanguageMeta = {
  id: SupportedLanguage;
  label: string;
  short: string;
  dot: string;
  exts: string[]; // primary extension first (used for the sample filename)
};

export const LANGUAGES: LanguageMeta[] = [
  { id: "javascript", label: "JavaScript", short: "JS", dot: "#FBBF24", exts: ["js", "jsx", "mjs", "cjs"] },
  { id: "typescript", label: "TypeScript", short: "TS", dot: "#5CD6E8", exts: ["ts", "tsx"] },
  { id: "python", label: "Python", short: "PY", dot: "#5DCAA5", exts: ["py"] },
  { id: "go", label: "Go", short: "GO", dot: "#7DD3FC", exts: ["go"] },
  { id: "rust", label: "Rust", short: "RS", dot: "#FB923C", exts: ["rs"] },
  { id: "java", label: "Java", short: "JAVA", dot: "#F87171", exts: ["java"] },
  { id: "csharp", label: "C#", short: "C#", dot: "#A78BFA", exts: ["cs"] },
  { id: "cpp", label: "C++", short: "C++", dot: "#93C5FD", exts: ["cpp", "cc", "cxx", "hpp", "hh"] },
  { id: "c", label: "C", short: "C", dot: "#94A3B8", exts: ["c", "h"] },
  { id: "ruby", label: "Ruby", short: "RB", dot: "#FB7185", exts: ["rb"] },
  { id: "php", label: "PHP", short: "PHP", dot: "#C4B5FD", exts: ["php"] },
  { id: "kotlin", label: "Kotlin", short: "KT", dot: "#C084FC", exts: ["kt", "kts"] },
  { id: "swift", label: "Swift", short: "SW", dot: "#FDBA74", exts: ["swift"] },
  { id: "sql", label: "SQL", short: "SQL", dot: "#67E8F9", exts: ["sql"] },
];

const BY_ID = Object.fromEntries(LANGUAGES.map((l) => [l.id, l])) as Record<SupportedLanguage, LanguageMeta>;

export function langMeta(id: SupportedLanguage): LanguageMeta {
  return BY_ID[id];
}
