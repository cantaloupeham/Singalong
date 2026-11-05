export const STORAGE_KEY = 'singloop-practice-v1'

export function textHash(value) {
  let hash = 2166136261
  for (const char of value) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 16777619) }
  return (hash >>> 0).toString(16)
}

export function songKey(mode, audioHash, lines, language = 'english') {
  if (mode === 'import' && !audioHash) return null
  const signature = lines.map(({ text, startTime, endTime }) => [text, startTime, endTime])
  const base = `${mode}:${audioHash || 'original'}:${textHash(JSON.stringify(signature))}`
  // Keep legacy English keys readable; a Japanese choice has its own records.
  return language === 'japanese' ? `${base}:ja-JP` : base
}

export function lineKey(line) { return `${line.id}:${line.startTime}:${line.text}` }

export function readRecords() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch { return {} }
}

const CONTRACTIONS = { "don't": 'do not', "doesn't": 'does not', "didn't": 'did not', "can't": 'can not', cannot: 'can not', "won't": 'will not', "i'm": 'i am', "you're": 'you are', "we're": 'we are', "they're": 'they are', "it's": 'it is', "that's": 'that is', "i've": 'i have', "we've": 'we have', "i'll": 'i will', "you'll": 'you will' }
const wordPattern = /[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)?|[^A-Za-z0-9]+/g

function wordsWithGroups(text) {
  const tokens = text.match(wordPattern) || [], words = [], groups = []
  tokens.forEach((token, tokenIndex) => {
    if (!/^[A-Za-z0-9]/.test(token)) return
    const normalized = token.toLowerCase().replace(/’/g, "'")
    const expanded = (CONTRACTIONS[normalized] || normalized).split(' ')
    for (const word of expanded) { words.push(word); groups.push(tokenIndex) }
  })
  return { tokens, words, groups }
}

export function normalizeWords(text) { return wordsWithGroups(String(text || '')).words }

// Wagner–Fischer alignment: O(n*m) time and O(n*m) space for n/m tokens.
export function alignSequences(expectedWords, actualWords) {
  const n = expectedWords.length, m = actualWords.length
  const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0))
  for (let i = 0; i <= n; i++) dp[i][0] = i
  for (let j = 0; j <= m; j++) dp[0][j] = j
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++)
    dp[i][j] = Math.min(dp[i-1][j-1] + (expectedWords[i-1] === actualWords[j-1] ? 0 : 1), dp[i-1][j] + 1, dp[i][j-1] + 1)
  const statuses = Array(n).fill('missing'), replacements = [], unexpected = [], replacementLocations = [], unexpectedLocations = []
  let i = n, j = m
  while (i || j) {
    if (i && j && expectedWords[i-1] === actualWords[j-1] && dp[i][j] === dp[i-1][j-1]) { statuses[--i] = 'matched'; j--; continue }
    if (i && j && dp[i][j] === dp[i-1][j-1] + 1) { statuses[--i] = 'replaced'; --j; replacements.unshift({ expected: expectedWords[i], actual: actualWords[j] }); replacementLocations.unshift({ expectedIndex: i, actualIndex: j }); continue }
    if (i && dp[i][j] === dp[i-1][j] + 1) { i--; continue }
    unexpected.unshift(actualWords[--j]); unexpectedLocations.unshift(j)
  }
  return { statuses, replacements, unexpected, replacementLocations, unexpectedLocations }
}

export function compareWords(expectedText, spokenText) {
  const expected = wordsWithGroups(expectedText), actual = wordsWithGroups(spokenText)
  const { statuses, replacements, unexpected } = alignSequences(expected.words, actual.words)
  const byToken = new Map()
  statuses.forEach((status, index) => {
    const group = expected.groups[index], old = byToken.get(group)
    byToken.set(group, status === 'matched' ? old || 'matched' : status === 'replaced' ? 'replaced' : old === 'replaced' ? old : 'missing')
  })
  const parts = expected.tokens.map((text, index) => ({ text, status: /^[A-Za-z0-9]/.test(text) ? byToken.get(index) : 'punctuation' }))
  return { parts, missing: expected.words.filter((_, index) => statuses[index] === 'missing'), replacements, unexpected }
}
