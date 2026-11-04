// SpeechRecognitionResultList contains every result, not only results[0].
export function readRecognitionResults(event) {
  const final = [], interim = []
  const results = event?.results
  for (let index = 0; index < (results?.length || 0); index++) {
    const result = results[index]
    let text = ''
    for (let alternative = 0; alternative < (result?.length || 0); alternative++) {
      text = result[alternative]?.transcript?.trim() || ''
      if (text) break
    }
    if (!text) continue
    ;(result.isFinal ? final : interim).push(text)
  }
  return { finalText: final.join(' ').trim(), interimText: interim.join(' ').trim() }
}

// One recognition session can produce several interim/final events, then onend.
// Only a final result may be committed; cancellation makes late callbacks inert.
export function createSpeechSession(recognition, callbacks, timers = {}) {
  const schedule = timers.setTimeout || setTimeout
  const unschedule = timers.clearTimeout || clearTimeout
  let finished = false, ended = false, stopRequested = false
  let audioStarted = false, speechDetected = false
  let finalText = '', interimText = '', timer = null
  let startTimer = schedule(() => {
    if (finished || stopRequested) return
    finished = true
    callbacks.onError('start-timeout')
    try { recognition.abort?.() } catch { /* already ended */ }
  }, 8000)
  const clearStartTimer = () => { if (startTimer != null) unschedule(startTimer); startTimer = null }
  const clearTimer = () => { if (timer != null) unschedule(timer); timer = null; clearStartTimer() }
  const finish = () => {
    if (finished) return
    finished = true
    clearTimer()
    if (finalText) callbacks.onFinal(finalText)
    else if (interimText || speechDetected) callbacks.onError('no-final')
    else callbacks.onError(audioStarted ? 'no-speech' : 'no-audio')
  }
  const delayFinish = (ms) => { clearTimer(); timer = schedule(finish, ms) }

  recognition.onstart = () => { clearStartTimer(); if (!finished && !stopRequested) callbacks.onListening() }
  recognition.onaudiostart = () => { clearStartTimer(); audioStarted = true; if (!finished && !stopRequested) callbacks.onAudioStart?.() }
  recognition.onspeechstart = () => { speechDetected = true; if (!finished && !stopRequested) callbacks.onSpeechStart?.() }
  recognition.onresult = (event) => {
    if (finished) return
    clearStartTimer()
    const result = readRecognitionResults(event)
    if (result.finalText || result.interimText) speechDetected = true
    if (result.finalText) finalText = result.finalText
    interimText = result.interimText
    if (finalText) {
      callbacks.onInterim(finalText + (interimText ? ` ${interimText}` : ''))
      if (ended) finish()
      else delayFinish(2000) // Some implementations omit onend after a final result.
    } else if (interimText) callbacks.onInterim(interimText)
  }
  recognition.onerror = (event) => {
    if (finished) return
    if (finalText && event?.error === 'no-speech') { finish(); return }
    finished = true
    clearTimer()
    const code = event?.error || 'unknown'
    callbacks.onError(code === 'no-speech' ? interimText || speechDetected ? 'no-final' : audioStarted ? 'no-speech' : 'no-audio' : code)
  }
  recognition.onend = () => {
    if (finished) return
    clearStartTimer()
    ended = true
    if (finalText) finish()
    else { callbacks.onWaiting(); delayFinish(1500) } // Allow a late final callback before declaring an empty result.
  }

  return {
    stop() {
      if (finished || stopRequested) return
      stopRequested = true
      clearStartTimer()
      callbacks.onWaiting()
      try { recognition.stop(); if (!ended && !finished) delayFinish(6000) }
      catch { if (!finished) { finished = true; clearTimer(); callbacks.onError('stop-failed') } }
    },
    cancel() {
      if (finished) return
      finished = true
      clearTimer()
      try { if (recognition.abort) recognition.abort(); else recognition.stop() } catch { /* already ended */ }
    },
  }
}
