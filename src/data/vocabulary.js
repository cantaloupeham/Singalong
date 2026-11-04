const STOP_WORDS = new Set('a an the and or but if to in on at for of with from by is are was were be been being i you he she it we they me my your our their this that these those do does did not just can will would should could as so up out into about have has had'.split(' '))
const cache = new Map()

export function chooseWords(text) {
  const words = text.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || []
  const seen = new Set()
  return words.filter((word) => {
    const plain = word.toLowerCase().replace(/[’']/g, '')
    if (plain.length < 4 || STOP_WORDS.has(plain) || seen.has(plain)) return false
    seen.add(plain); return true
  }).slice(0, 3).map((word) => ({ word, meaning: '词义待查', tip: '可听单词发音', generated: true }))
}

export function lookupForm(word) {
  const plain = word.toLowerCase().replace(/[’']/g, '').replace(/[^a-z]/g, '')
  if (plain.length < 3 || ['gonna', 'wanna', 'aint', 'gon', 'ya'].includes(plain)) return null
  if (plain.endsWith('ies') && plain.length > 5) return plain.slice(0, -3) + 'y'
  if (plain.endsWith('ing') && plain.length > 6) return plain.slice(0, -3)
  if (plain.endsWith('ed') && plain.length > 5) return plain.slice(0, -2)
  if (plain.endsWith('s') && plain.length > 4 && !plain.endsWith('ss')) return plain.slice(0, -1)
  return plain
}

export async function lookupWord(word) {
  const exact = word.toLowerCase().replace(/[’']/g, '').replace(/[^a-z]/g, '')
  const base = lookupForm(word)
  if (!base) return { status: 'unavailable' }
  if (cache.has(exact)) return cache.get(exact)
  const request = (async () => {
    try {
      let response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(exact)}`, { signal: AbortSignal.timeout(4500) })
      if (response.status === 404 && base !== exact) response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(base)}`, { signal: AbortSignal.timeout(4500) })
      if (response.status === 404) return { status: 'missing' }
      if (!response.ok) return { status: 'error' }
      const entries = await response.json()
      const entry = entries?.[0]
      const phonetics = entry?.phonetics || []
      return { status: 'ok', phonetic: entry?.phonetic || phonetics.find((item) => item.text)?.text || '', audio: phonetics.find((item) => item.audio?.startsWith('https://'))?.audio || '', definition: entry?.meanings?.[0]?.definitions?.[0]?.definition || '' }
    } catch { return { status: 'error' } }
  })()
  cache.set(exact, request)
  const result = await request
  if (result.status === 'error') cache.delete(exact)
  return result
}
