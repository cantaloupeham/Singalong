import { alignSequences } from './practice.js'

const isContent = (text) => /[\p{L}\p{N}]/u.test(text)
const isMark = (text) => /\p{M}|[ﾞﾟ]/u.test(text)

// Compare kana spellings only. Kanji readings cannot be inferred from spelling.
export function japaneseCompareKey(text) {
  return String(text || '').normalize('NFKC').replace(/[\u30A1-\u30F6]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0x60)).normalize('NFC').toLocaleLowerCase('ja-JP')
}

function sourceClusters(source) {
  if (typeof Intl.Segmenter === 'function')
    return [...new Intl.Segmenter('ja-JP', { granularity: 'grapheme' }).segment(source)]
      .map(({ segment, index }) => ({ text: segment, start: index, end: index + segment.length }))
  const clusters = []
  for (let index = 0; index < source.length;) {
    const char = String.fromCodePoint(source.codePointAt(index))
    if (isMark(char) && clusters.length) { const last = clusters.at(-1); last.text += char; last.end += char.length }
    else clusters.push({ text: char, start: index, end: index + char.length })
    index += char.length
  }
  return clusters
}

// Segment offsets are UTF-16 indices, matching String.slice and Intl.Segmenter.index.
export function japaneseSegments(text, segmenterAvailable = typeof Intl.Segmenter === 'function') {
  const source = String(text || '')
  const clusters = sourceClusters(source)
  if (segmenterAvailable && typeof Intl.Segmenter === 'function') {
    // Segment the comparison spelling, then map each UTF-16 unit back to its
    // original grapheme. NFKC may expand or contract a source fragment.
    const units = [], comparison = clusters.map((cluster) => {
      const key = japaneseCompareKey(cluster.text)
      for (let index = 0; index < key.length; index++) units.push(cluster)
      return key
    }).join('')
    const segmenter = new Intl.Segmenter('ja-JP', { granularity: 'word' })
    return { rough: false, tokens: [...segmenter.segment(comparison)]
      .filter((item) => item.isWordLike && isContent(item.segment))
      .map((item) => {
        const start = units[item.index].start, end = units[item.index + item.segment.length - 1].end
        return { text: source.slice(start, end), start, end, value: item.segment }
      }) }
  }
  // Older browsers: grapheme-level comparison is deliberately labelled rough.
  const tokens = clusters.filter((cluster) => isContent(cluster.text))
    .map((cluster) => ({ ...cluster, value: japaneseCompareKey(cluster.text) }))
  return { rough: true, tokens }
}

export function compareJapanese(expectedText, spokenText, segmenterAvailable = typeof Intl.Segmenter === 'function') {
  const expected = japaneseSegments(expectedText, segmenterAvailable)
  const actual = japaneseSegments(spokenText, segmenterAvailable)
  const { statuses, replacementLocations, unexpectedLocations } = alignSequences(expected.tokens.map((token) => token.value), actual.tokens.map((token) => token.value))
  const uncertainIndices = new Set(replacementLocations.filter(({ expectedIndex, actualIndex }) => {
    const original = expected.tokens[expectedIndex].text, recognized = actual.tokens[actualIndex].text
    return (/\p{Script=Han}/u.test(original) && /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(recognized)) ||
      (/\p{Script=Han}/u.test(recognized) && /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(original))
  }).map((item) => item.expectedIndex))
  const kanjiKanaUncertain = uncertainIndices.size > 0
  const parts = [], source = String(expectedText || '')
  let cursor = 0
  expected.tokens.forEach((token, index) => {
    if (cursor < token.start) parts.push({ text: source.slice(cursor, token.start), status: 'punctuation' })
    parts.push({ text: token.text, status: uncertainIndices.has(index) ? 'uncertain' : statuses[index] })
    cursor = token.end
  })
  if (cursor < source.length) parts.push({ text: source.slice(cursor), status: 'punctuation' })
  return { parts, missing: expected.tokens.filter((_, index) => statuses[index] === 'missing').map((token) => token.text),
    replacements: replacementLocations.map(({ expectedIndex, actualIndex }) => ({ expected: expected.tokens[expectedIndex].text, actual: actual.tokens[actualIndex].text })),
    unexpected: unexpectedLocations.map((index) => actual.tokens[index].text), rough: expected.rough,
    kanjiKanaUncertain }
}
