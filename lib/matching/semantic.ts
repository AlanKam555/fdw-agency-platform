const DIMS = 64;

export function deterministicVector(text: string): number[] {
  const vector = new Array<number>(DIMS).fill(0);
  const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 1);
  for (const token of tokens) {
    let hash = 2166136261;
    for (const char of token) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    vector[Math.abs(hash) % DIMS] += 1;
  }
  return vector;
}

export function cosine(left: number[], right: number[]): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  const score = dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
  return Math.max(0, Math.min(1, score));
}

/** 1 when both sides are empty, otherwise token cosine in [0, 1]. No network. */
export function deterministicSimilarity(left: string, right: string): number {
  const a = left.trim();
  const b = right.trim();
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  return cosine(deterministicVector(a), deterministicVector(b));
}
