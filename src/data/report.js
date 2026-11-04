import { lineKey, normalizeWords } from './practice.js'

function detailedAttempts(record) {
  if (!record?.count) return []
  const saved = Array.isArray(record.attempts) ? record.attempts.filter((item) => item?.feedback && typeof item.feedback === 'object') : []
  if (saved.length) return saved.slice(-3)
  return record.feedback && typeof record.feedback === 'object' ? [{ at: record.at, feedback: record.feedback }] : []
}

function issueWords(feedback) {
  const expected = new Set()
  const unexpected = new Set()
  for (const word of Array.isArray(feedback?.missing) ? feedback.missing : [])
    for (const normalized of normalizeWords(word)) expected.add(normalized)
  for (const item of Array.isArray(feedback?.replacements) ? feedback.replacements : [])
    for (const normalized of normalizeWords(item?.expected)) expected.add(normalized)
  for (const word of Array.isArray(feedback?.unexpected) ? feedback.unexpected : [])
    for (const normalized of normalizeWords(word)) unexpected.add(normalized)
  return { expected, unexpected }
}

function countOccurrences(attempts, kind) {
  const counts = new Map()
  for (const attempt of attempts) for (const word of issueWords(attempt.feedback)[kind])
    counts.set(word, (counts.get(word) || 0) + 1)
  return [...counts].map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0))
}

function practiceAge(at, now) {
  const timestamp = Date.parse(at)
  return Number.isFinite(timestamp) ? Math.max(0, Math.floor((now - timestamp) / 86400000)) : 0
}

export function buildLearningReport(title, lines, songRecords, now = Date.now()) {
  const practiced = [], unpracticed = [], repeatedWords = [], unexpectedWords = [], observations = []
  let totalAttempts = 0, lastAt = null, lastTimestamp = -Infinity

  lines.forEach((line, index) => {
    const record = songRecords?.[lineKey(line)]
    const count = Number(record?.count)
    if (!Number.isFinite(count) || count <= 0) { unpracticed.push({ index, text: line.text }); return }
    totalAttempts += count
    const timestamp = Date.parse(record.at)
    if (Number.isFinite(timestamp) && timestamp > lastTimestamp) { lastTimestamp = timestamp; lastAt = record.at }
    const attempts = detailedAttempts(record)
    const expectedCounts = countOccurrences(attempts, 'expected')
    const extraCounts = countOccurrences(attempts, 'unexpected')
    for (const item of expectedCounts.filter((item) => item.count >= 2))
      repeatedWords.push({ ...item, index, text: line.text, sampleCount: attempts.length })
    for (const item of extraCounts)
      unexpectedWords.push({ ...item, index, text: line.text, sampleCount: attempts.length })

    const firstIssues = attempts.length ? issueWords(attempts[0].feedback) : null
    const latestIssues = attempts.length ? issueWords(attempts.at(-1).feedback) : { expected: new Set(), unexpected: new Set() }
    const firstDifferenceCount = firstIssues?.expected.size ?? null
    const latestDifferenceCount = latestIssues.expected.size
    observations.push({ index, text: line.text, sampleCount: attempts.length, firstDifferenceCount,
      latestDifferenceCount, trend: attempts.length < 2 ? 'insufficient' : latestDifferenceCount < firstDifferenceCount ? 'decreased' : latestDifferenceCount > firstDifferenceCount ? 'increased' : 'unchanged' })

    const repeatHits = expectedCounts.reduce((sum, item) => sum + Math.max(0, item.count - 1), 0)
    const latestHasDifference = latestIssues.expected.size + latestIssues.unexpected.size > 0
    const ageDays = practiceAge(record.at || attempts.at(-1)?.at, now)
    // Ranking only: repeat mismatches, unresolved latest text, then time since practice.
    const score = repeatHits * 5 + (latestHasDifference ? 4 : 0) + Math.min(ageDays, 30) / 5
    const repeated = expectedCounts.find((item) => item.count >= 2)
    const facts = [
      attempts.length ? repeated ? `“${repeated.word}”在最近 ${attempts.length} 次中有 ${repeated.count} 次疑似未识别` : `最近 ${attempts.length} 次无反复出现的标准词差异` : '只有跟读次数，没有可分析的详细反馈',
      attempts.length ? latestHasDifference ? `最近一次有 ${latestIssues.expected.size} 个标准词差异、${latestIssues.unexpected.size} 个疑似多出词` : '最近一次文字比对一致' : '最近一次文字差异未知',
      `距上次练习 ${ageDays} 天`,
    ]
    const focusWord = repeated?.word || [...latestIssues.expected][0] || null
    const practiceWord = focusWord || line.words?.[0]?.word || normalizeWords(line.text)[0] || null
    practiced.push({ index, text: line.text, score, facts, sampleCount: attempts.length, ageDays, focusWord, practiceWord })
  })

  repeatedWords.sort((a, b) => b.count - a.count || a.index - b.index || (a.word < b.word ? -1 : 1))
  unexpectedWords.sort((a, b) => b.count - a.count || a.index - b.index || (a.word < b.word ? -1 : 1))
  practiced.sort((a, b) => b.score - a.score || a.index - b.index)
  return {
    title, totalLines: lines.length, practicedLines: practiced.length, totalAttempts, lastAt,
    hasRecords: practiced.length > 0, repeatedWords, unexpectedWords,
    topReview: practiced.slice(0, 3), unpracticed, observations,
  }
}
