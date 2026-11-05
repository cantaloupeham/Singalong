import { lineKey } from './practice.js'

export function recommendLine(lines, songRecords, now = Date.now(), language = 'english') {
  if (!lines.length) return null
  if (!lines.some((line) => songRecords[lineKey(line)]?.count)) return { index: 0, reason: '还没有真实跟读记录，先从第一句开始。' }
  const candidates = lines.map((line, index) => {
    const record = songRecords[lineKey(line)]
    if (!record?.count) return { index, score: 2, reason: '这句还没有真实跟读记录。' }
    const attempts = (record.attempts?.length ? record.attempts : [{ at: record.at, feedback: record.feedback }]).slice(-3)
    const counts = new Map()
    const issues = (feedback) => [
      ...(feedback?.missing || []).map((word) => ({ key: `expected:${word}`, label: word, kind: 'expected' })),
      ...(feedback?.replacements || []).map((item) => ({ key: `expected:${item.expected}`, label: item.expected, kind: 'expected' })),
      ...(feedback?.unexpected || []).map((word) => ({ key: `extra:${word}`, label: word, kind: 'extra' })),
    ]
    for (const attempt of attempts) for (const issue of new Map(issues(attempt.feedback).map((item) => [item.key, item])).values()) {
      const old = counts.get(issue.key)
      counts.set(issue.key, { ...issue, count: (old?.count || 0) + 1 })
    }
    const issue = [...counts.values()].sort((a, b) => b.count - a.count || (a.key < b.key ? -1 : 1))[0]
    const latest = attempts.at(-1)?.feedback
    const latestMismatch = issues(latest).length > 0
    const age = Math.max(0, Math.floor((now - (Date.parse(record.at) || now)) / 86400000))
    const score = (issue?.count || 0) * 4 + (latestMismatch ? 4 : 0) + Math.min(age, 30) / 3
    const issueReason = issue?.kind === 'extra' ? `识别文本中的“${issue.label}”在最近 ${attempts.length} 次中有 ${issue.count} 次疑似多出` : language === 'japanese' ? `“${issue?.label}”在最近 ${attempts.length} 次中有 ${issue?.count} 次疑似转写差异` : `“${issue?.label}”在最近 ${attempts.length} 次中有 ${issue?.count} 次未被识别或识别为其他词`
    const reason = issue ? `${issueReason}；${latestMismatch ? '最近一次仍有文字差异。' : '最近一次已改善。'}` : age ? `这句已 ${age} 天未练习。` : '这句最近的文字比对一致，可再巩固一次。'
    return { index, score, reason }
  })
  return candidates.sort((a, b) => b.score - a.score || a.index - b.index)[0]
}
