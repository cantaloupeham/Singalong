import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLearningReport } from '../src/data/report.js'
import { lineKey, songKey } from '../src/data/practice.js'

const now = Date.parse('2026-11-04T12:00:00Z')
const at = '2026-11-04T10:00:00Z'
const lines = [
  { id: 1, startTime: 0, endTime: 4, text: 'Go go now' },
  { id: 2, startTime: 4, endTime: 8, text: 'Keep moving' },
  { id: 3, startTime: 8, endTime: 12, text: 'Start again' },
]
const feedback = (missing = [], replacements = [], unexpected = []) => ({ missing, replacements, unexpected })
const attempt = (value, date = at) => ({ at: date, feedback: value })
const record = (attempts, count = attempts.length) => ({ count, at: attempts.at(-1).at, feedback: attempts.at(-1).feedback, attempts })

test('zero records produce an honest empty report', () => {
  const report = buildLearningReport('Song', lines, {}, now)
  assert.equal(report.hasRecords, false)
  assert.equal(report.totalAttempts, 0)
  assert.equal(report.lastAt, null)
  assert.deepEqual(report.topReview, [])
  assert.equal(report.unpracticed.length, 3)
})

test('repeated standard word in one attempt counts once; replacements normalize to the same word', () => {
  const attempts = [
    attempt(feedback(['Go', 'go!', 'GO'], [{ expected: 'go', actual: 'slow' }], ['Please'])),
    attempt(feedback([], [{ expected: 'GO', actual: 'slow' }], ['please'])),
    attempt(feedback()),
  ]
  const report = buildLearningReport('Song', lines, { [lineKey(lines[0])]: record(attempts) }, now)
  assert.deepEqual(report.repeatedWords.map(({ word, count, sampleCount }) => ({ word, count, sampleCount })), [{ word: 'go', count: 2, sampleCount: 3 }])
  assert.equal(report.unexpectedWords[0].word, 'please')
  assert.equal(report.unexpectedWords[0].count, 2)
  assert.equal(report.repeatedWords.some((item) => item.word === 'please'), false)
  assert.deepEqual(report.observations[0].trend, 'decreased')
  assert.equal(report.observations[0].firstDifferenceCount, 1)
  assert.equal(report.observations[0].latestDifferenceCount, 0)
})

test('two or three detailed attempts report decrease, increase and unchanged trends', () => {
  const records = {
    [lineKey(lines[0])]: record([attempt(feedback(['go'])), attempt(feedback())]),
    [lineKey(lines[1])]: record([attempt(feedback()), attempt(feedback(['moving'])), attempt(feedback(['moving', 'keep']))]),
    [lineKey(lines[2])]: record([attempt(feedback(['start'])), attempt(feedback(['start']))]),
  }
  const report = buildLearningReport('Song', lines, records, now)
  assert.deepEqual(report.observations.map((item) => item.trend), ['decreased', 'increased', 'unchanged'])
  assert.deepEqual(report.observations.map((item) => item.sampleCount), [2, 3, 2])
})

test('legacy count with only latest feedback does not invent older detailed attempts', () => {
  const old = { count: 5, at, feedback: feedback(['Go']) }
  const report = buildLearningReport('Song', lines, { [lineKey(lines[0])]: old }, now)
  assert.equal(report.totalAttempts, 5)
  assert.equal(report.repeatedWords.length, 0)
  assert.equal(report.topReview[0].sampleCount, 1)
  assert.equal(report.observations[0].trend, 'insufficient')
})

test('only the latest three saved detailed attempts enter the report', () => {
  const attempts = [attempt(feedback(['go'])), attempt(feedback()), attempt(feedback()), attempt(feedback())]
  const report = buildLearningReport('Song', lines, { [lineKey(lines[0])]: record(attempts) }, now)
  assert.equal(report.totalAttempts, 4)
  assert.equal(report.topReview[0].sampleCount, 3)
  assert.equal(report.repeatedWords.length, 0)
  assert.equal(report.observations[0].firstDifferenceCount, 0)
})

test('current song keys isolate demo and a different imported song', () => {
  const importedLines = [{ ...lines[0], text: 'Go home now' }]
  const demoKey = songKey('demo', '', lines)
  const importedKey = songKey('import', 'audio-hash', importedLines)
  assert.notEqual(demoKey, importedKey)
  assert.notEqual(importedKey, songKey('import', 'other-audio-hash', importedLines))
  const allRecords = {
    [demoKey]: { [lineKey(lines[0])]: record([attempt(feedback(['go']))]) },
    [importedKey]: { [lineKey(importedLines[0])]: record([attempt(feedback())]) },
  }
  const demo = buildLearningReport('Demo', lines, allRecords[demoKey], now)
  const imported = buildLearningReport('Import', importedLines, allRecords[importedKey], now)
  assert.equal(demo.totalLines, 3)
  assert.equal(imported.totalLines, 1)
  assert.equal(imported.repeatedWords.length, 0)
  assert.equal(imported.totalAttempts, 1)
})

test('identical ranking evidence and timestamps keep lyric order stable', () => {
  const same = [attempt(feedback(['go']))]
  const records = {
    [lineKey(lines[0])]: record(same),
    [lineKey(lines[1])]: record([attempt(feedback(['keep']))]),
    [lineKey(lines[2])]: record([attempt(feedback(['start']))]),
  }
  const report = buildLearningReport('Song', lines, records, now)
  assert.deepEqual(report.topReview.map((item) => item.index), [0, 1, 2])
  assert.equal(report.topReview.every((item) => item.score === report.topReview[0].score), true)
})

test('ranking combines repeated differences, unresolved latest result and elapsed days', () => {
  const old = '2026-10-05T10:00:00Z'
  const records = {
    [lineKey(lines[0])]: record([attempt(feedback(['go'])), attempt(feedback(['go']))]),
    [lineKey(lines[1])]: record([attempt(feedback(), old)]),
    [lineKey(lines[2])]: record([attempt(feedback(['start']))]),
  }
  const report = buildLearningReport('Song', lines, records, now)
  assert.deepEqual(report.topReview.map((item) => item.index), [0, 1, 2])
  assert.match(report.topReview[0].facts[0], /最近 2 次中有 2 次/)
  assert.equal(report.topReview[1].ageDays, 30)
  assert.match(report.topReview[2].facts[1], /最近一次有 1 个标准词差异/)
})
