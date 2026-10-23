// Offline token estimate. Real tokenizers differ per model; this is a heuristic.

/**
 * Roughly four characters per token for English prose and code; non-ASCII text
 * (for example Turkish diacritics, CJK) tokenizes worse, so it is weighted up.
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  if (text === '') { return 0; }
  let ascii = 0;
  let other = 0;
  for (const char of text) {
    if (char.charCodeAt(0) < 128) { ascii += 1; } else { other += 1; }
  }
  return Math.ceil(ascii / 4 + other / 2);
}
