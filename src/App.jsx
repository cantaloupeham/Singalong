import { useEffect, useMemo, useRef, useState } from 'react'
import { song } from './data/song'

const normalize = (value) => value.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean)

function App() {
  const [selected, setSelected] = useState(0)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioNotice, setAudioNotice] = useState('')
  const [progressTime, setProgressTime] = useState(0)
  const [practicedCount, setPracticedCount] = useState(0)
  const recognitionRef = useRef(null)
  const audioRef = useRef(null)
  const currentLine = song.lines[selected]
  const progress = useMemo(() => `${practicedCount}/${song.lines.length} 句`, [practicedCount])

  useEffect(() => () => { recognitionRef.current?.stop(); audioRef.current?.pause() }, [])

  const handleTimeUpdate = () => {
    const time = audioRef.current?.currentTime || 0
    setProgressTime(time)
    const next = song.lines.findIndex((line) => time >= line.startTime && time < line.endTime)
    if (next >= 0 && next !== selected) { setSelected(next); setTranscript(''); setFeedback(null) }
  }

  const playAudio = async () => {
    const audio = audioRef.current
    if (!audio) return
    try { await audio.play(); setIsPlaying(true); setAudioNotice('') }
    catch { setIsPlaying(false); setAudioNotice('音频加载失败，请确认 public/audio/keep-moving.mp3 文件存在。') }
  }

  const toggleAudio = () => {
    if (isPlaying) { audioRef.current?.pause(); setIsPlaying(false) } else playAudio()
  }

  const restartAudio = () => {
    if (!audioRef.current) return
    audioRef.current.currentTime = 0; setProgressTime(0); setSelected(0); setAudioNotice(''); playAudio()
  }

  const handleAudioEnded = () => { setIsPlaying(false); setProgressTime(0); setSelected(0); setFeedback(null); setTranscript(''); setAudioNotice('播放完成，可以继续练习任意句子。') }

  const handleAudioError = () => { setIsPlaying(false); setAudioNotice('暂时无法加载原创音频，请将音频文件放入 public/audio/keep-moving.mp3。') }

  const compare = (spoken) => {
    const expected = normalize(currentLine.text)
    const actual = normalize(spoken)
    const missing = expected.filter((word) => !actual.includes(word))
    const matched = expected.filter((word) => actual.includes(word)).length
    setFeedback({ missing, matched, simulated: !spoken })
    setPracticedCount((count) => Math.max(count, selected + 1))
  }

  const startReading = () => {
    setFeedback(null)
    setTranscript('')
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) {
      setIsListening(true)
      setTranscript('take a breath and start again')
      return
    }
    const recognition = new Recognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => { const text = event.results[0][0].transcript; setTranscript(text); compare(text) }
    recognition.onerror = () => { setTranscript('take a breath and start again'); compare(''); setIsListening(false) }
    recognition.onend = () => setIsListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  const submitRecording = () => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false) }
    if (!feedback) compare(transcript)
  }

  const selectLine = (index) => { setSelected(index); setTranscript(''); setFeedback(null) }

  return <main className="app">
    <header className="topbar"><div className="logo">Sing<span>Loop</span></div><nav><a className="active">练习</a><a>学习进度</a></nav><div className="language">English <span>⌄</span></div></header>

    <section className="intro"><p className="kicker">ENGLISH SONG PRACTICE · 01</p><h1>跟着一首歌，<span>练好一句英语。</span></h1><p className="intro-copy">SingLoop 是你的英语歌曲陪练搭子。先听、再跟读，慢慢把每一句唱成自己的表达。</p></section>

    <audio ref={audioRef} src="/audio/keep-moving.mp3" preload="metadata" onTimeUpdate={handleTimeUpdate} onEnded={handleAudioEnded} onError={handleAudioError} />
    <section className="song-picker"><div><p className="label">当前歌曲</p><h2>{song.title}</h2><p className="muted">{song.subtitle} · {song.artist}</p></div><div className="song-status"><span className="status-dot" />原创短歌<br /><small>音频素材待加入 · 约 25 秒</small></div></section>

    <section className="workspace">
      <div className="lyrics-panel"><div className="panel-heading"><div><p className="label">LYRICS</p><h2>逐句练习</h2></div><span className="progress-pill">已练习 {progress}</span></div><div className="lyrics-list">{song.lines.map((line, index) => <button key={line.id} className={`lyric-line ${index === selected ? 'selected' : ''}`} onClick={() => selectLine(index)}><span className="line-number">{String(line.id).padStart(2, '0')}</span><span>{line.text}</span>{index === selected && <span className="playing">●</span>}</button>)}</div><div className="audio-controls"><button className="secondary-button" onClick={restartAudio}>↺ <span>重新开始</span></button><button className="primary-button" onClick={toggleAudio}>{isPlaying ? 'Ⅱ' : '▶'} <span>{isPlaying ? '暂停' : '播放整首'}</span></button></div>{audioNotice && <p className="audio-notice">{audioNotice}</p>}<div className="audio-time">{Math.floor(progressTime)}s / 25s</div></div>

      <aside className="practice-panel"><div className="panel-heading"><div><p className="label">YOUR TURN</p><h2>跟读这一句</h2></div><span className="line-count">{selected + 1} / {song.lines.length}</span></div><div className="focus-line"><p>{currentLine.text}</p><span>{currentLine.translation}</span></div><div className="detail-card"><p className="label">重点词与发音</p>{currentLine.words.map((item) => <div className="word-row" key={item.word}><strong>{item.word}</strong><span>{item.meaning}</span><small>{item.tip}</small></div>)}</div><div className="record-actions"><button className={`listen-button ${isListening ? 'listening' : ''}`} onClick={startReading}>{isListening ? '正在聆听…' : '🎙 开始跟读'}</button><button className="submit-button" onClick={submitRecording}>提交录音</button></div><p className="privacy-note">仅在当前浏览器处理声音，不上传录音</p>{feedback && <div className="feedback"><strong>{feedback.simulated ? '这是模拟反馈模式' : feedback.missing.length ? '很棒，继续保持节奏！' : '太棒了，这句基本完整！'}</strong>{feedback.missing.length > 0 && <p>可以再听一遍并留意：{feedback.missing.map((word) => <mark key={word}>{word}</mark>)}</p>}{feedback.missing.length === 0 && <p>下一步：试着不看文字，再唱一遍这一句。</p>}</div>}</aside>
    </section>

    <section className="progress-card"><div className="progress-icon">↗</div><div><p className="label">本次学习进度</p><h3>已练习 {progress}</h3><p className="muted">下一次复习：<b>{song.lines[Math.min(selected + 1, song.lines.length - 1)].text}</b></p></div><div className="progress-track"><span style={{ width: `${(practicedCount / song.lines.length) * 100}%` }} /></div></section>
    <footer>SingLoop · 持续陪练，慢慢唱成自己的英语</footer>
  </main>
}

export default App
