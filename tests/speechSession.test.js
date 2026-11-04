import test from 'node:test'
import assert from 'node:assert/strict'
import { createSpeechSession, readRecognitionResults } from '../src/data/speechSession.js'

const result = (text, isFinal) => Object.assign([{ transcript: text }], { isFinal })
const clock = () => {
  const pending = new Map()
  let nextId = 0
  return {
    setTimeout(callback) { const id = ++nextId; pending.set(id, callback); return id },
    clearTimeout(id) { pending.delete(id) },
    flush() { const tasks = [...pending.values()]; pending.clear(); tasks.forEach((callback) => callback()) },
  }
}
const setup = () => {
  const events = [], timers = clock()
  const recognition = { stop() { this.onend?.() }, abort() { this.onend?.() } }
  const session = createSpeechSession(recognition, {
    onListening: () => events.push('listening'),
    onAudioStart: () => events.push('audio-start'),
    onSpeechStart: () => events.push('speech-start'),
    onWaiting: () => events.push('waiting'),
    onInterim: (text) => events.push(`interim:${text}`),
    onFinal: (text) => events.push(`final:${text}`),
    onError: (code) => events.push(`error:${code}`),
  }, timers)
  return { recognition, session, events, timers }
}

test('reads a final transcript outside results[0] and ignores empty alternatives', () => {
  assert.deepEqual(readRecognitionResults({ results: [result('', false), result('Take a breath', true)] }), { finalText: 'Take a breath', interimText: '' })
  assert.equal(readRecognitionResults({ results: [Object.assign([{ transcript: '' }, { transcript: 'Keep moving' }], { isFinal: true })] }).finalText, 'Keep moving')
  const { recognition, events } = setup()
  recognition.onstart()
  recognition.onresult({ resultIndex: 1, results: [result('', false), result('Take a breath', true)] })
  recognition.onend()
  recognition.onend()
  assert.deepEqual(events.filter((item) => item.startsWith('final:')), ['final:Take a breath'])
})

test('interim text is shown but only a later final text is committed, even after onend', () => {
  const { recognition, session, events, timers } = setup()
  recognition.onresult({ results: [result('Take a', false)] })
  session.stop()
  assert.equal(events.some((item) => item.startsWith('final:')), false)
  recognition.onresult({ results: [result('Take a breath', true)] })
  timers.flush()
  assert.deepEqual(events.filter((item) => item.startsWith('final:')), ['final:Take a breath'])
  assert.equal(events.some((item) => item.startsWith('error:')), false)
})

test('silence and interim-only endings never produce a final result', () => {
  const quiet = setup()
  quiet.recognition.onaudiostart()
  quiet.session.stop(); quiet.timers.flush()
  assert.ok(quiet.events.includes('error:no-speech'))
  const noAudio = setup()
  noAudio.recognition.onstart(); noAudio.session.stop(); noAudio.timers.flush()
  assert.ok(noAudio.events.includes('error:no-audio'))
  const partial = setup()
  partial.recognition.onaudiostart()
  partial.recognition.onresult({ results: [result('Take a', false)] })
  partial.session.stop(); partial.timers.flush()
  assert.ok(partial.events.includes('error:no-final'))
})

test('service errors and cancelled old sessions do not commit late results', () => {
  const failed = setup()
  failed.recognition.onerror({ error: 'network' })
  failed.recognition.onend()
  assert.deepEqual(failed.events, ['error:network'])
  const old = setup()
  old.session.cancel()
  old.recognition.onresult({ results: [result('wrong line', true)] })
  assert.deepEqual(old.events, [])
  const unrecognized = setup()
  unrecognized.recognition.onaudiostart(); unrecognized.recognition.onspeechstart()
  unrecognized.recognition.onerror({ error: 'no-speech' })
  assert.ok(unrecognized.events.includes('error:no-final'))
})

test('an unresponsive recognition service leaves the startup state with an error', () => {
  const stalled = setup()
  stalled.timers.flush()
  assert.deepEqual(stalled.events, ['error:start-timeout'])
})
