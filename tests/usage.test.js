import test from 'node:test'
import assert from 'node:assert/strict'
import { song } from '../src/data/song.js'
import { getUsageContent } from '../src/data/usage.js'

test('each demo line has its own verified local example and existing translation', () => {
  const cards = song.lines.map((line) => getUsageContent('demo', line))
  assert.deepEqual(cards.map((card) => card.expression), ['start again', 'counts', 'rhythm', 'keep moving'])
  cards.forEach((card, index) => {
    assert.equal(card.text, song.lines[index].text)
    assert.equal(card.translation, song.lines[index].translation)
    assert.ok(card.example && card.exampleTranslation && card.prompt)
    assert.equal(card.source, '本项目编写的练习例句')
  })
})

test('imported content uses only dictionary data and never borrows demo explanations', () => {
  const line = { id: 1, text: 'Take a breath and start again', words: [{ word: 'breath' }] }
  const found = getUsageContent('import', line, { breath: { status: 'ok', definition: 'air taken into the lungs', example: 'Take a deep breath.' } })
  assert.equal(found.translation, '释义待填写')
  assert.equal(found.meaning, '词典英文释义：air taken into the lungs')
  assert.equal(found.example, 'Take a deep breath.')
  assert.equal(found.source, '词典例句')
  assert.equal(found.exampleTranslation, '')
  const missing = getUsageContent('import', line, { breath: { status: 'missing' } })
  assert.equal(missing.example, '')
  assert.equal(missing.meaning, '词典无结果')
})
