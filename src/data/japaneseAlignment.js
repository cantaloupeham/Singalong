import { alignSequences } from './practice.js'

const isContent = (text) => /[\p{L}\p{N}]/u.test(text)
const normalized = (text) => text.normalize('NFKC').toLocaleLowerCase('ja-JP')

// Segment offsets are UTF-16 indices, matching String.slice and Intl.Segmenter.index.
export function japaneseSegments(text, segmenterAvailable = typeof Intl.Segmenter === 'function') {
  const source = String(text || '')
  if (segmenterAvailable) {
    const segmenter = new Intl.Segmenter('ja-JP', { granularity: 'word' })
    return { rough: false, tokens: [...segmenter.segment(source)]
      .filter((item) => item.isWordLike && isContent(item.segment))
      .map((item) => ({ text: item.segment, start: item.index, end: item.index + item.segment.length, value: normalized(item.segment) })) }
  }
  // Older browsers: character-level comparison is deliberately labelled rough.
  const tokens = []
  for (let index = 0; index < source.length;) {
    const char = String.fromCodePoint(source.codePointAt(index))
    if (isContent(char)) tokens.push({ text: char, start: index, end: index + char.length, value: normalized(char) })
    index += char.length
  }
  return { rough: true, tokens }
}

export function compareJapanese(expectedText, spokenText, segmenterAvailable = typeof Intl.Segmenter === 'function') {
  const expected = japaneseSegments(expectedText, segmenterAvailable)
  const actual = japaneseSegments(spokenText, segmenterAvailable)
  const { statuses, replacementLocations, unexpectedLocations } = alignSequences(expected.tokens.map((token) => token.value), actual.tokens.map((token) => token.value))
  const parts = [], source = String(expectedText || '')
  let cursor = 0
  expected.tokens.forEach((token, index) => {
    if (cursor < token.start) parts.push({ text: source.slice(cursor, token.start), status: 'punctuation' })
    parts.push({ text: token.text, status: statuses[index] })
    cursor = token.end
  })
  if (cursor < source.length) parts.push({ text: source.slice(cursor), status: 'punctuation' })
  return { parts, missing: expected.tokens.filter((_, index) => statuses[index] === 'missing').map((token) => token.text),
    replacements: replacementLocations.map(({ expectedIndex, actualIndex }) => ({ expected: expected.tokens[expectedIndex].text, actual: actual.tokens[actualIndex].text })),
    unexpected: unexpectedLocations.map((index) => actual.tokens[index].text), rough: expected.rough }
}
