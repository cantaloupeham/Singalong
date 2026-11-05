const ENGLISH_MARKERS = new Set('a an the and or but i you we they he she it is are am was were to of in on for with my your our this that can will do not me us at from if so as be have has had let every again'.split(' '))

// Conservative script/word evidence, not a general-purpose language detector.
export function classifyLyrics(lines) {
  const texts = lines.map((line) => typeof line === 'string' ? line : line.text).filter((text) => /\p{L}/u.test(text || ''))
  if (!texts.length) return 'unknown'
  let latin = 0, other = 0, nonLatinLines = 0, markers = 0
  const distinctMarkers = new Set()
  for (const text of texts) {
    const letters = [...text.matchAll(/\p{L}/gu)].map((item) => item[0])
    const nonLatin = letters.filter((letter) => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(letter)).length
    const latinHere = letters.filter((letter) => /\p{Script=Latin}/u.test(letter)).length
    latin += latinHere; other += nonLatin
    if (nonLatin >= 3 && nonLatin / letters.length >= 0.65) nonLatinLines++
    for (const word of text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || []) if (ENGLISH_MARKERS.has(word)) { markers++; distinctMarkers.add(word) }
  }
  if (other >= 4 && other / (latin + other) >= 0.72 && nonLatinLines / texts.length >= 0.6) return 'non-english'
  if (texts.length >= 2 && latin >= 12 && latin / (latin + other) >= 0.78 && markers >= 3 && distinctMarkers.size >= 2) return 'english'
  return 'unknown'
}
