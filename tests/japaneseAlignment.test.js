import test from 'node:test'
import assert from 'node:assert/strict'
import { compareJapanese, japaneseSegments } from '../src/data/japaneseAlignment.js'
import { compareWords, songKey } from '../src/data/practice.js'
import { buildLearningReport } from '../src/data/report.js'

test('Japanese segmentation preserves source offsets, punctuation and spacing', () => {
  const source = '今日、  また　歩こう！'
  const tokens = japaneseSegments(source).tokens
  assert.ok(tokens.length >= 3)
  for (const token of tokens) assert.equal(source.slice(token.start, token.end), token.text)
  assert.equal(compareJapanese(source, '今日また歩こう').parts.map((part) => part.text).join(''), source)
  assert.ok(compareJapanese(source, '今日また歩こう').parts.every((part) => ['matched', 'punctuation'].includes(part.status)))
})

test('repeated Japanese fragments align in sequence', () => {
  const result = compareJapanese('また また 行こう', 'また 行こう')
  assert.equal(result.missing.length, 1)
  assert.equal(result.parts.filter((part) => part.status === 'missing').length, 1)
})

test('kanji and kana variants are cautious transcription differences', () => {
  const result = compareJapanese('今日も行こう', 'きょうも行こう')
  assert.ok(result.missing.length + result.replacements.length + result.unexpected.length > 0)
  assert.equal(result.parts.map((part) => part.text).join(''), '今日も行こう')
  assert.ok(result.parts.some((part) => part.status === 'matched'))
})

test('full-width Latin characters normalize while Japanese punctuation stays visible', () => {
  const result = compareJapanese('ＡＢＣ、行こう！', 'ABC 行こう')
  assert.deepEqual(result.missing, [])
  assert.deepEqual(result.replacements, [])
  assert.equal(result.parts.map((part) => part.text).join(''), 'ＡＢＣ、行こう！')
})

test('without Intl.Segmenter, Unicode characters align with a rough flag', () => {
  const result = compareJapanese('猫、猫！', '猫', false)
  assert.equal(result.rough, true)
  assert.deepEqual(result.missing, ['猫'])
  assert.equal(result.parts.map((part) => part.text).join(''), '猫、猫！')
})

test('English behavior and legacy keys remain unchanged; Japanese records use a separate key', () => {
  assert.deepEqual(compareWords("I'm going", 'I am going').missing, [])
  const lines = [{ text: '行こう', startTime: 0, endTime: 4 }]
  const oldKey = songKey('import', 'audiohash', lines)
  assert.equal(songKey('import', 'audiohash', lines, 'english'), oldKey)
  assert.notEqual(songKey('import', 'audiohash', lines, 'japanese'), oldKey)
})

test('Japanese report counts only its own real transcription records', () => {
  const line = { id: 1, text: 'また行こう', startTime: 0, endTime: 4, words: [] }
  const feedback = compareJapanese(line.text, 'また行く')
  const japaneseKey = songKey('import', 'audiohash', [line], 'japanese')
  const englishKey = songKey('import', 'audiohash', [line], 'english')
  const records = { [japaneseKey]: { '1:0:また行こう': { count: 1, at: '2026-11-05T00:00:00Z', feedback } }, [englishKey]: { '1:0:また行こう': { count: 9 } } }
  const report = buildLearningReport('local', [line], records[japaneseKey], Date.parse('2026-11-05T01:00:00Z'), 'japanese')
  assert.equal(report.language, 'japanese')
  assert.equal(report.totalAttempts, 1)
  assert.ok(report.topReview.length)
})
