export const STORAGE_KEY = 'singloop-practice-v1'

export function textHash(value) {
  let hash = 2166136261
  for (const char of value) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 16777619) }
  return (hash >>> 0).toString(16)
}

export function songKey(mode, audioHash, lines) {
  if (mode === 'import' && !audioHash) return null
  const signature = lines.map(({ text, startTime, endTime }) => [text, startTime, endTime])
  return `${mode}:${audioHash || 'original'}:${textHash(JSON.stringify(signature))}`
}

export function lineKey(line) { return `${line.id}:${line.startTime}:${line.text}` }

export function readRecords() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch { return {} }
}

// LCS keeps word order and treats repeated words as separate occurrences.
export function compareWords(expectedText, spokenText) {
  const tokens = expectedText.match(/[A-Za-z]+|[^A-Za-z]+/g) || []
  const expected = tokens.filter((part) => /^[A-Za-z]+$/.test(part)).map((part) => part.toLowerCase())
  const actual = (spokenText.match(/[A-Za-z]+/g) || []).map((part) => part.toLowerCase())
  const dp = Array.from({ length: expected.length + 1 }, () => Array(actual.length + 1).fill(0))
  for (let i = expected.length - 1; i >= 0; i--) for (let j = actual.length - 1; j >= 0; j--)
    dp[i][j] = expected[i] === actual[j] ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1])
  const matched = new Set(), used = new Set()
  let i = 0, j = 0
  while (i < expected.length && j < actual.length) {
    if (expected[i] === actual[j]) { matched.add(i); used.add(j); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }
  let wordIndex = 0
  const parts = tokens.map((token) => /^[A-Za-z]+$/.test(token)
    ? { text: token, status: matched.has(wordIndex++) ? 'matched' : 'different' }
    : { text: token, status: 'punctuation' })
  return { parts, missing: expected.filter((_, index) => !matched.has(index)), unexpected: actual.filter((_, index) => !used.has(index)) }
}
