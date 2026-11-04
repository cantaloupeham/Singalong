import test from 'node:test'
import assert from 'node:assert/strict'
import { compareWords, lineKey } from '../src/data/practice.js'
import { recommendLine } from '../src/data/review.js'

test('repeated words align in sequence without losing the later match', () => {
  const result = compareWords('go go now', 'go now')
  assert.equal(result.missing.length, 1)
  assert.deepEqual(result.parts.filter((part) => part.status !== 'punctuation').map((part) => part.status).sort(), ['matched', 'matched', 'missing'])
  assert.deepEqual(result.replacements, [])
})

test('substitution and extra recognition words are distinct', () => {
  const result = compareWords('go go now', 'go slow now please')
  assert.deepEqual(result.replacements, [{ expected: 'go', actual: 'slow' }])
  assert.deepEqual(result.unexpected, ['please'])
  assert.deepEqual(result.missing, [])
})

test('case, punctuation and common contractions normalize without changing displayed lyrics', () => {
  const original = "I'm moving, don't stop!"
  const result = compareWords(original, 'I AM moving do not stop')
  assert.equal(result.parts.map((part) => part.text).join(''), original)
  assert.deepEqual(result.parts.filter((part) => part.status !== 'punctuation').map((part) => part.status), Array(4).fill('matched'))
  assert.deepEqual(compareWords("can't go", 'cannot go').missing, [])
})

test('empty recognition text marks every expected word as possibly missing', () => {
  const result = compareWords('Take a breath', '')
  assert.deepEqual(result.missing, ['take', 'a', 'breath'])
  assert.deepEqual(result.unexpected, [])
})

const lines = [
  { id: 1, startTime: 0, text: 'one two' },
  { id: 2, startTime: 4, text: 'three four' },
  { id: 3, startTime: 8, text: 'five six' },
]
const now = Date.parse('2026-11-04T12:00:00Z')
const attempt = (at, expected, spoken) => ({ at, feedback: compareWords(expected, spoken) })
const record = (items) => ({ count: items.length, at: items.at(-1).at, feedback: items.at(-1).feedback, attempts: items })

test('no real records recommends first line; repeated unresolved difference takes priority', () => {
  assert.deepEqual(recommendLine(lines, {}, now), { index: 0, reason: '还没有真实跟读记录，先从第一句开始。' })
  const recent = '2026-11-04T10:00:00Z'
  const records = {
    [lineKey(lines[0])]: record([attempt(recent, 'one two', 'one two')]),
    [lineKey(lines[1])]: record([attempt(recent, 'three four', 'three'), attempt(recent, 'three four', 'three')]),
  }
  const first = recommendLine(lines, records, now)
  assert.equal(first.index, 1)
  assert.match(first.reason, /最近 2 次中有 2 次/)
  assert.deepEqual(recommendLine(lines, records, now), first)
})

test('recent improvement reduces priority; stale line and unpracticed line remain eligible', () => {
  const old = '2026-10-05T10:00:00Z', recent = '2026-11-04T10:00:00Z'
  const records = {
    [lineKey(lines[0])]: record([attempt(old, 'one two', 'one two')]),
    [lineKey(lines[1])]: record([attempt(recent, 'three four', 'three'), attempt(recent, 'three four', 'three four')]),
  }
  assert.equal(recommendLine(lines, records, now).index, 0)
  assert.match(recommendLine(lines, records, now).reason, /30 天未练习/)
  assert.equal(recommendLine(lines, { [lineKey(lines[0])]: record([attempt(recent, 'one two', 'one two')]) }, now).index, 1)
})
