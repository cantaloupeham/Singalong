import test from 'node:test'
import assert from 'node:assert/strict'
import { handler, validateStudyContent } from '../netlify/functions/japanese-study.mjs'
import { generateJapaneseLine } from '../src/data/japaneseStudy.js'

test('study result keeps a faithful line translation and rejects invented vocabulary', () => {
  const result = validateStudyContent({ translation: '今天也继续前进。', words: [
    { word: '今日', reading: 'きょう', meaning: '今天', note: '表示现在这一天' },
    { word: '明日', reading: 'あした', meaning: '明天', note: 'not in source' },
  ] }, '今日も進もう')
  assert.equal(result.translation, '今天也继续前进。')
  assert.deepEqual(result.words.map((item) => item.word), ['今日'])
  assert.equal(result.needsReview, true)
  assert.equal(validateStudyContent({ translation: '', words: [] }, '今日も進もう'), null)
})

test('server accepts only one lyric line and fails clearly without a server key', async () => {
  const oldKey = process.env.OPENAI_API_KEY
  delete process.env.OPENAI_API_KEY
  try {
    const event = { httpMethod: 'POST', headers: { host: 'example.netlify.app', origin: 'https://example.netlify.app' }, body: JSON.stringify({ line: '今日も進もう' }) }
    assert.equal((await handler(event)).statusCode, 503)
    assert.equal((await handler({ ...event, body: JSON.stringify({ line: '' }) })).statusCode, 400)
    assert.equal((await handler({ ...event, httpMethod: 'GET' })).statusCode, 405)
    assert.equal((await handler({ ...event, headers: { host: 'example.netlify.app', origin: 'https://other.example' } })).statusCode, 403)
    assert.equal((await handler({ ...event, body: 'x'.repeat(2001) })).statusCode, 413)
  } finally { if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey }
})

test('server sends only the current line to the model and validates its reply', async () => {
  const oldKey = process.env.OPENAI_API_KEY, oldFetch = globalThis.fetch
  process.env.OPENAI_API_KEY = 'test-only'
  let request
  globalThis.fetch = async (_url, options) => {
    request = JSON.parse(options.body)
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ translation: '今天也前进。', words: [{ word: '今日', reading: 'きょう', meaning: '今天', note: '时间词' }] }) } }] }) }
  }
  try {
    const reply = await handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ line: '今日も進もう' }) })
    assert.equal(reply.statusCode, 200)
    assert.equal(JSON.parse(reply.body).words[0].word, '今日')
    assert.deepEqual(JSON.parse(request.messages[1].content), { line: '今日も進もう' })
    assert.ok(!request.messages[1].content.includes('audio'))
  } finally { globalThis.fetch = oldFetch; if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey }
})

test('client distinguishes unavailable service from successful generated content', async () => {
  const oldFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => ({ ok: false, status: 503 })
    await assert.rejects(generateJapaneseLine('今日も進もう'), /尚未启用/)
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ translation: '今天也前进。', words: [] }) })
    assert.equal((await generateJapaneseLine('今日も進もう')).translation, '今天也前进。')
  } finally { globalThis.fetch = oldFetch }
})
