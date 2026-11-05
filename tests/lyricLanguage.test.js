import test from 'node:test'
import assert from 'node:assert/strict'
import { parseLrc } from '../src/data/parseLrc.js'
import { classifyLyrics } from '../src/data/lyricLanguage.js'

const classify = (source) => classifyLyrics(parseLrc(source))
test('clear English and mostly English with a short Chinese note remain English', () => {
  assert.equal(classify('[00:01]Take a breath and start again\n[00:05]Every small step counts today'), 'english')
  assert.equal(classify('[00:01]Take a breath and start again\n[00:05]Every small step counts today\n[00:09]继续'), 'english')
})
test('Japanese, Chinese and Korean lyrics with dominant native script are non-English', () => {
  assert.equal(classify('[00:01]今日はここから歩こう\n[00:05]少しずつ進んでいこう'), 'non-english')
  assert.equal(classify('[00:01]今天我们一起向前走\n[00:05]慢慢来不要停下来'), 'non-english')
  assert.equal(classify('[00:01]오늘도 천천히 앞으로 가자\n[00:05]다시 한번 시작해 보자'), 'non-english')
})
test('Latin-script non-English and short ambiguous lyrics are not confidently English', () => {
  assert.equal(classify('[00:01]Yo te quiero mucho\n[00:05]Vamos a bailar esta noche'), 'unknown')
  assert.equal(classify('[00:01]Je suis ici avec toi\n[00:05]Nous allons danser ce soir'), 'unknown')
  assert.equal(classify('[00:01]Watashi wa koko ni iru\n[00:05]Kimi to arukou'), 'unknown')
})
test('metadata, timestamps, symbols and empty lines provide no language evidence', () => {
  assert.deepEqual(parseLrc('[ar:Someone]\n[ti:Title]\n[00:01]\n[00:02] ♪ ♪\n\n[00:04]!!!'), [])
  assert.equal(classify('[ar:Someone]\n[00:01]\n[00:02] ♪ ♪'), 'unknown')
})
