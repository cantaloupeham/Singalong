// LRC can repeat timestamps on one line; each timestamp creates a lyric cue.
export function parseLrc(source) {
  const cues = []
  for (const row of source.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const stamps = [...row.matchAll(/\[(\d{1,3}):([0-5]\d)(?:[.:](\d{1,3}))?\]/g)]
    if (!stamps.length) continue
    const text = row.replace(/\[\d{1,3}:[0-5]\d(?:[.:]\d{1,3})?\]/g, '').trim()
    if (!text || /^\[/.test(text)) continue
    for (const stamp of stamps) {
      const fraction = stamp[3] ? Number(stamp[3]) / 10 ** stamp[3].length : 0
      cues.push({ startTime: Number(stamp[1]) * 60 + Number(stamp[2]) + fraction, text })
    }
  }
  cues.sort((a, b) => a.startTime - b.startTime)
  return cues.map((cue, index) => ({
    id: index + 1, ...cue,
    endTime: cues[index + 1]?.startTime ?? Infinity,
    translation: '释义待填写', words: [],
  }))
}
