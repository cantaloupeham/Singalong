import { useEffect, useMemo, useRef, useState } from 'react'
import { song } from './data/song'
import { parseLrc } from './data/parseLrc'

const normalize = (value) => value.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean)

function App() {
  const [selected, setSelected] = useState(0)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioNotice, setAudioNotice] = useState('')
  const [progressTime, setProgressTime] = useState(0)
  const [mode, setMode] = useState('demo')
  const [importedSong, setImportedSong] = useState(null)
  const [importError, setImportError] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [loopLine, setLoopLine] = useState(false)
  const [audioName, setAudioName] = useState('')
  const [lrcName, setLrcName] = useState('')
  const [demoProgress, setDemoProgress] = useState(0)
  const [importProgress, setImportProgress] = useState(0)
  const recognitionRef = useRef(null)
  const audioRef = useRef(null)
  const audioInputRef = useRef(null)
  const lrcInputRef = useRef(null)
  const course = mode === 'import' ? (importedSong || { title: audioName || '我的歌曲', subtitle: '请选择同步歌词', artist: '本地文件', lines: [] }) : song
  const currentLine = course.lines[selected] || { text: '请选择对应的 .lrc 歌词文件', translation: '释义待生成/待填写', words: [{ word: '—', meaning: '重点词待填写', tip: '发音提示待填写' }], startTime: 0, endTime: 4 }
  const practiced = mode === 'import' ? importProgress : demoProgress
  const progress = useMemo(() => `${practiced}/${course.lines.length} 句`, [practiced, course.lines.length])

  useEffect(() => () => { recognitionRef.current?.stop(); audioRef.current?.pause() }, [])
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl) }, [audioUrl])

  const handleTimeUpdate = () => {
    const time = audioRef.current?.currentTime || 0
    setProgressTime(time)
    if (mode === 'import' && loopLine && course.lines[selected] && time >= course.lines[selected].endTime && Number.isFinite(course.lines[selected].endTime)) {
      audioRef.current.currentTime = course.lines[selected].startTime
      return
    }
    const next = course.lines.findIndex((line) => time >= line.startTime && time < line.endTime)
    if (next >= 0 && next !== selected) { setSelected(next); setTranscript(''); setFeedback(null) }
  }

  const playAudio = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (mode === 'import' && !audioUrl) { setAudioNotice('请先选择本地音频文件。'); return }
    try { await audio.play(); setIsPlaying(true); setAudioNotice('') }
    catch { setIsPlaying(false); setAudioNotice(mode === 'import' ? '音频加载失败。请重新选择有效的 MP3、WAV 或 M4A 文件。' : '音频素材待加入。跟读练习仍可使用。') }
  }

  const toggleAudio = () => {
    if (isPlaying) { audioRef.current?.pause(); setIsPlaying(false) } else playAudio()
  }

  const restartAudio = () => {
    if (!audioRef.current) return
    audioRef.current.currentTime = 0; setProgressTime(0); setSelected(0); setLoopLine(false); setAudioNotice(''); playAudio()
  }

  const handleAudioEnded = () => { if (mode === 'import' && loopLine && course.lines[selected]) { audioRef.current.currentTime = course.lines[selected].startTime; playAudio(); return } setIsPlaying(false); setProgressTime(0); setSelected(0); setFeedback(null); setTranscript(''); setAudioNotice('播放完成，可以继续练习任意句子。') }

  const handleAudioError = () => { setIsPlaying(false); setAudioNotice(mode === 'import' ? '音频加载失败。请重新选择有效的 MP3、WAV 或 M4A 文件。' : '音频素材待加入。跟读练习仍可使用。') }

  const compare = (spoken) => {
    const expected = normalize(currentLine.text)
    const actual = normalize(spoken)
    const missing = expected.filter((word) => !actual.includes(word))
    const matched = expected.filter((word) => actual.includes(word)).length
    setFeedback({ missing, matched, simulated: !spoken })
    if (mode === 'import') setImportProgress((count) => Math.max(count, selected + 1))
    else setDemoProgress((count) => Math.max(count, selected + 1))
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

  const selectLine = (index) => { setSelected(index); setTranscript(''); setFeedback(null); if (mode === 'import' && audioRef.current && Number.isFinite(course.lines[index].startTime)) { audioRef.current.currentTime = course.lines[index].startTime; setProgressTime(course.lines[index].startTime); setLoopLine(true) } }

  const chooseAudio = (event) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
    if (!/\.(mp3|wav|m4a)$/i.test(file.name)) { setImportError('文件格式不支持，请选择 MP3、WAV 或 M4A。'); return }
    audioRef.current?.pause(); setIsPlaying(false); setAudioUrl(URL.createObjectURL(file)); setAudioName(file.name); setMode('import'); setImportedSong(null); setLrcName(''); setSelected(0); setLoopLine(false); setImportProgress(0); setImportError(''); setAudioNotice('已选择本地音频，请选择对应的 .lrc 歌词文件。')
  }
  const chooseLrc = async (event) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
    if (!/\.lrc$/i.test(file.name)) { setImportError('歌词文件格式不支持，请选择 .lrc 文件。'); return }
    try {
      const content = await file.text()
      if (!content.trim()) { setImportError('歌词文件为空，请选择包含时间戳的 .lrc 文件。'); return }
      const lines = parseLrc(content)
      if (!lines.length) { setImportError('未找到有效的时间戳歌词，例如 [00:04.00] Every small step counts today'); return }
      setImportedSong({ title: audioName.replace(/\.[^.]+$/, ''), artist: '我的本地歌曲', subtitle: '本地 LRC 歌词', lines }); setLrcName(file.name); setSelected(0); setLoopLine(false); setImportProgress(0); setImportError(''); setAudioNotice('LRC 歌词已加载，可以开始播放。')
    } catch { setImportError('歌词文件读取失败，请重新选择 .lrc 文件。') }
  }
  const resetImport = () => { audioRef.current?.pause(); setIsPlaying(false); setAudioUrl(''); setAudioName(''); setLrcName(''); setImportedSong(null); setMode('demo'); setImportError(''); setSelected(0); setLoopLine(false); setAudioNotice('') }

  return <main className="app">
    <header className="topbar"><div className="logo">Sing<span>Loop</span></div><nav><a className="active">练习</a><a>学习进度</a></nav><div className="language">English <span>⌄</span></div></header>

    <section className="intro"><p className="kicker">ENGLISH SONG PRACTICE · 01</p><h1>跟着一首歌，<span>练好一句英语。</span></h1><p className="intro-copy">SingLoop 是你的英语歌曲陪练搭子。先听、再跟读，慢慢把每一句唱成自己的表达。</p></section>

    <audio ref={audioRef} src={mode === 'import' ? audioUrl || undefined : '/audio/keep-moving.mp3'} preload="metadata" onTimeUpdate={handleTimeUpdate} onEnded={handleAudioEnded} onError={handleAudioError} />
    <section className="song-picker"><div><p className="label">当前歌曲</p><h2>{course.title}</h2><p className="muted">{course.subtitle} · {course.artist}</p></div><div className="song-status"><span className="status-dot" />{mode === 'import' ? '我的歌曲 · 本地模式' : '原创演示课程'}<br /><small>{mode === 'import' ? '刷新后需要重新选择文件' : '音频素材待加入 · 约 25 秒'}</small></div></section>
    <section className="import-panel"><div><p className="label">IMPORT MY SONG</p><strong>导入我的歌曲</strong><p className="muted">文件只在本机使用，不上传服务器；刷新页面后需要重新选择。</p>{mode === 'import' && <p className="muted">音频：{audioName || '未选择'} · 歌词：{lrcName || '未选择'}</p>}</div><div className="import-actions"><button className="secondary-button" onClick={() => audioInputRef.current?.click()}>选择音频</button><button className="secondary-button" onClick={() => lrcInputRef.current?.click()} disabled={!audioUrl}>选择 .lrc</button><button className="text-button" onClick={resetImport}>返回演示课程</button><input ref={audioInputRef} type="file" accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4" onChange={chooseAudio} hidden /><input ref={lrcInputRef} type="file" accept=".lrc,text/plain" onChange={chooseLrc} hidden /></div>{importError && <p className="import-error" role="alert">{importError}</p>}</section>

    <section className="workspace">
      <div className="lyrics-panel"><div className="panel-heading"><div><p className="label">LYRICS</p><h2>逐句练习</h2></div><span className="progress-pill">已练习 {progress}</span></div><div className="lyrics-list">{course.lines.map((line, index) => <button key={line.id} className={`lyric-line ${index === selected ? 'selected' : ''}`} onClick={() => selectLine(index)}><span className="line-number">{String(line.id).padStart(2, '0')}</span><span>{line.text}</span>{index === selected && <span className="playing">●</span>}</button>)}</div><div className="audio-controls"><button className="secondary-button" onClick={restartAudio}>↺ <span>重新开始</span></button><button className="primary-button" onClick={toggleAudio}>{isPlaying ? 'Ⅱ' : '▶'} <span>{isPlaying ? '暂停' : '播放整首'}</span></button><button className="secondary-button" onClick={() => setLoopLine((value) => !value)}>{loopLine ? '取消循环' : '循环本句'}</button></div>{audioNotice && <p className="audio-notice">{audioNotice}</p>}<div className="audio-time">{Math.floor(progressTime)}s / {mode === 'import' ? '本地音频' : '25s'}</div></div>

      <aside className="practice-panel"><div className="panel-heading"><div><p className="label">YOUR TURN</p><h2>跟读这一句</h2></div><span className="line-count">{course.lines.length ? selected + 1 : 0} / {course.lines.length}</span></div><div className="focus-line"><p>{currentLine.text}</p><span>{currentLine.translation}</span></div><div className="detail-card"><p className="label">重点词与发音</p>{currentLine.words.length ? currentLine.words.map((item) => <div className="word-row" key={item.word}><strong>{item.word}</strong><span>{item.meaning}</span><small>{item.tip}</small></div>) : <p className="muted">重点词与发音提示待填写</p>}</div><div className="record-actions"><button className={`listen-button ${isListening ? 'listening' : ''}`} onClick={startReading} disabled={!course.lines.length}>{isListening ? '正在聆听…' : '🎙 开始跟读'}</button><button className="submit-button" onClick={submitRecording} disabled={!course.lines.length}>提交录音</button></div><p className="privacy-note">仅在当前浏览器处理声音，不上传录音</p>{transcript && <p className="muted">识别文字：{transcript}</p>}{feedback && <div className="feedback"><strong>{feedback.simulated ? '这是模拟反馈模式' : feedback.missing.length ? '很棒，继续保持节奏！' : '太棒了，这句基本完整！'}</strong>{feedback.missing.length > 0 && <p>可以再听一遍并留意：{feedback.missing.map((word) => <mark key={word}>{word}</mark>)}</p>}{feedback.missing.length === 0 && <p>下一步：试着不看文字，再唱一遍这一句。</p>}</div>}</aside>
    </section>

    <section className="progress-card"><div className="progress-icon">↗</div><div><p className="label">本次学习进度</p><h3>已练习 {progress}</h3><p className="muted">下一次复习：<b>{course.lines.length ? course.lines[Math.min(selected + 1, course.lines.length - 1)].text : '选择歌词后开始练习'}</b></p></div><div className="progress-track"><span style={{ width: `${course.lines.length ? (practiced / course.lines.length) * 100 : 0}%` }} /></div></section>
    <footer>SingLoop · 持续陪练，慢慢唱成自己的英语</footer>
  </main>
}

export default App
