// Only a voice explicitly tagged as Japanese may read Japanese lyrics.
export function findJapaneseVoice(voices = []) {
  const japanese = voices.filter((voice) => /^ja(?:-|$)/i.test(voice?.lang || ''))
  return japanese.find((voice) => /^ja-JP$/i.test(voice.lang)) || japanese[0] || null
}
