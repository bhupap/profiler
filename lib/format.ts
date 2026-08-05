// Pretty-print Big-O / complexity strings for display. The model returns ASCII
// notation like "O(n^2)", "O(2^n)", "O(phi^n)", "O(n^(k+1))" — this renders the
// exponents as real Unicode superscripts and common symbols (phi -> φ, sqrt -> √)
// so nothing shows as a literal "phi^n". Returns a plain string, so it works in
// JSX text, title tooltips, prose, and the Markdown export alike.

const SUP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷",
  "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "(": "⁽", ")": "⁾", " ": " ",
  a: "ᵃ", b: "ᵇ", c: "ᶜ", d: "ᵈ", e: "ᵉ", f: "ᶠ", g: "ᵍ", h: "ʰ", i: "ⁱ",
  j: "ʲ", k: "ᵏ", l: "ˡ", m: "ᵐ", n: "ⁿ", o: "ᵒ", p: "ᵖ", r: "ʳ", s: "ˢ",
  t: "ᵗ", u: "ᵘ", v: "ᵛ", w: "ʷ", x: "ˣ", y: "ʸ", z: "ᶻ",
};

function toSuper(exp: string): string {
  const chars = [...exp].map((ch) => SUP[ch.toLowerCase()]);
  // If any character has no superscript glyph (e.g. 'q'), keep the caret form.
  return chars.every(Boolean) ? chars.join("") : "^" + exp;
}

export function prettyComplexity(s: string | undefined | null): string {
  if (!s) return s ?? "";
  return s
    .replace(/\bphi\b/gi, "φ")
    .replace(/\bsqrt\b/gi, "√")
    // ^(k+1) style groups first, then bare ^n / ^2 exponents.
    .replace(/\^\(([^)]+)\)/g, (_, exp: string) => toSuper(exp.trim()))
    .replace(/\^([A-Za-z0-9]+)/g, (_, exp: string) => toSuper(exp));
}
