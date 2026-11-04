import { useEffect, useMemo, useRef, useState } from 'react'
import { song } from './data/song'
import { parseLrc } from './data/parseLrc'

const normalize = (value) => value.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean)

function App() {
  const [selected, setSelected] = useState(0)
  const [speechStatus, setSpeechStatus] = useState('idle')
  const [speechMessage, setSpeechMessage] = useState('点击“开始跟读”，浏览器会请求麦克风权限。')
  const [showSimulation, setShowSimulation] = useState(false)
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
  const speechSessionRef = useRef(0)
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

  const handleAudioEnded = () => { if (mode === 'import' && loopLine && course.lines[selected]) { audioRef.current.currentTime = course.lines[selected].startTime; playAudio(); return } audioRef.current.currentTime = 0; setIsPlaying(false); setProgressTime(0); setSelected(0); setFeedback(null); setTranscript(''); setAudioNotice('播放完成，可以继续练习任意句子。') }

  const handleAudioError = () => { setIsPlaying(false); setAudioNotice(mode === 'import' ? '音频加载失败。请重新选择有效的 MP3、WAV 或 M4A 文件。' : '音频素材待加入。跟读练习仍可使用。') }

  const compare = (spoken, lineText, lineIndex, sessionMode) => {
    const expected = normalize(lineText)
    const actual = normalize(spoken)
    const remaining = [...actual]
    const missing = expected.filter((word) => { const index = remaining.indexOf(word); if (index < 0) return true; remaining.splice(index, 1); return false })
    setFeedback({ missing, unexpected: remaining })
    if (sessionMode === 'import') setImportProgress((count) => Math.max(count, lineIndex + 1))
    else setDemoProgress((count) => Math.max(count, lineIndex + 1))
  }

  const resetSpeech = () => { speechSessionRef.current += 1; recognitionRef.current?.stop(); recognitionRef.current = null; setSpeechStatus('idle'); setSpeechMessage('点击“开始跟读”，浏览器会请求麦克风权限。'); setTranscript(''); setFeedback(null); setShowSimulation(false) }

  const startReading = async () => {
    if (speechStatus === 'requesting' || speechStatus === 'listening' || speechStatus === 'processing') return
    const session = ++speechSessionRef.current
    const lineText = currentLine.text, lineIndex = selected, sessionMode = mode
    setFeedback(null)
    setTranscript('')
    setShowSimulation(false)
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) {
      setSpeechStatus('unsupported')
      setSpeechMessage('此浏览器不支持语音识别。可查看模拟反馈示例；示例不是你的识别结果。建议使用最新版 Chrome 或 Edge。')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) { setSpeechStatus('no-device'); setSpeechMessage('无法访问麦克风。请确认设备已连接，并在 HTTPS 页面或 localhost 打开。'); return }
    setSpeechStatus('requesting')
    setSpeechMessage('正在请求麦克风权限，请在浏览器弹窗中选择“允许”。')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
    } catch (error) {
      if (session !== speechSessionRef.current) return
      const denied = ['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(error.name)
      setSpeechStatus(denied ? 'denied' : error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError' ? 'no-device' : 'error')
      setSpeechMessage(denied ? '麦克风权限被拒绝。请点地址栏的麦克风图标允许访问，再重新跟读。' : error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError' ? '未找到麦克风。请连接设备并检查系统输入设置。' : '无法使用麦克风，请检查设备是否被其他应用占用后重试。')
      return
    }
    if (session !== speechSessionRef.current) return
    const recognition = new Recognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      if (session !== speechSessionRef.current) return
      const spoken = event.results?.[0]?.[0]?.transcript?.trim()
      if (!spoken) { setSpeechStatus('no-speech'); setSpeechMessage('没有识别到文字。请靠近麦克风，清楚读出当前句后重试。'); return }
      setTranscript(spoken); compare(spoken, lineText, lineIndex, sessionMode)
      setSpeechStatus('success'); setSpeechMessage('已收到浏览器真实识别结果。以下仅比较文字中的单词，不评估音准或发音质量。')
    }
    recognition.onerror = (event) => {
      if (session !== speechSessionRef.current) return
      const code = event.error
      setSpeechStatus(code === 'not-allowed' || code === 'service-not-allowed' ? 'denied' : code === 'audio-capture' ? 'no-device' : code === 'no-speech' ? 'no-speech' : 'error')
      setSpeechMessage(code === 'not-allowed' || code === 'service-not-allowed' ? '语音识别权限被拒绝。请在地址栏允许麦克风后重试。' : code === 'audio-capture' ? '未检测到可用麦克风，请检查设备。' : code === 'no-speech' ? '没有识别到语音。请靠近麦克风并重试。' : '语音识别失败或服务不可用，请稍后重试。')
    }
    recognition.onend = () => { if (session === speechSessionRef.current) setSpeechStatus((status) => { if (status === 'listening' || status === 'processing') { setSpeechMessage('跟读已结束，但没有收到识别文字。请检查麦克风后重试。'); return 'no-speech' } return status }) }
    recognitionRef.current = recognition
    try { recognition.start(); setSpeechStatus('listening'); setSpeechMessage('麦克风已允许，正在识别英文跟读。读完后点击“结束跟读”。') }
    catch { setSpeechStatus('error'); setSpeechMessage('语音识别无法启动，请刷新页面并重试。') }
  }

  const submitRecording = () => {
    if (speechStatus !== 'listening') return
    setSpeechStatus('processing'); setSpeechMessage('已结束跟读，正在等待浏览器返回识别文字。')
    recognitionRef.current?.stop()
  }

  const selectLine = (index) => { resetSpeech(); setSelected(index); if (mode === 'import' && audioRef.current && Number.isFinite(course.lines[index].startTime)) { audioRef.current.currentTime = course.lines[index].startTime; setProgressTime(course.lines[index].startTime); setLoopLine(true) } }

  const chooseAudio = (event) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
    if (!/\.(mp3|wav|m4a)$/i.test(file.name)) { setImportError('文件格式不支持，请选择 MP3、WAV 或 M4A。'); return }
    resetSpeech(); audioRef.current?.pause(); setIsPlaying(false); setAudioUrl(URL.createObjectURL(file)); setAudioName(file.name); setMode('import'); setImportedSong(null); setLrcName(''); setSelected(0); setLoopLine(false); setImportProgress(0); setImportError(''); setAudioNotice('已选择本地音频，请选择对应的 .lrc 歌词文件。')
  }
  const chooseLrc = async (event) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
    if (!/\.lrc$/i.test(file.name)) { setImportError('歌词文件格式不支持，请选择 .lrc 文件。'); return }
    try {
      const content = await file.text()
      if (!content.trim()) { setImportError('歌词文件为空，请选择包含时间戳的 .lrc 文件。'); return }
      const lines = parseLrc(content)
      if (!lines.length) { setImportError('未找到有效的时间戳歌词，例如 [00:04.00] Every small step counts today'); return }
      resetSpeech(); setImportedSong({ title: audioName.replace(/\.[^.]+$/, ''), artist: '我的本地歌曲', subtitle: '本地 LRC 歌词', lines }); setLrcName(file.name); setSelected(0); setLoopLine(false); setImportProgress(0); setImportError(''); setAudioNotice('LRC 歌词已加载，可以开始播放。')
    } catch { setImportError('歌词文件读取失败，请重新选择 .lrc 文件。') }
  }
  const resetImport = () => { resetSpeech(); audioRef.current?.pause(); setIsPlaying(false); setAudioUrl(''); setAudioName(''); setLrcName(''); setImportedSong(null); setMode('demo'); setImportError(''); setSelected(0); setLoopLine(false); setAudioNotice('') }

  return <main className="app">
    <header className="topbar"><div className="logo">Sing<span>Loop</span></div><nav><a className="active">练习</a><a>学习进度</a></nav><div className="language">English <span>⌄</span></div></header>

    <section className="intro"><p className="kicker">ENGLISH SONG PRACTICE · 01</p><h1>跟着一首歌，<span>练好一句英语。</span></h1><p className="intro-copy">SingLoop 是你的英语歌曲陪练搭子。先听、再跟读，慢慢把每一句唱成自己的表达。</p></section>

    <audio ref={audioRef} src={mode === 'import' ? audioUrl || undefined : '/audio/keep-moving.mp3'} preload="metadata" onTimeUpdate={handleTimeUpdate} onEnded={handleAudioEnded} onError={handleAudioError} />
    <section className="song-picker"><div><p className="label">当前歌曲</p><h2>{course.title}</h2><p className="muted">{course.subtitle} · {course.artist}</p></div><div className="song-status"><span className="status-dot" />{mode === 'import' ? '我的歌曲 · 本地模式' : '原创演示课程'}<br /><small>{mode === 'import' ? '刷新后需要重新选择文件' : '原创音频 · 约 21 秒'}</small></div></section>
    <section className="import-panel"><div><p className="label">IMPORT MY SONG</p><strong>导入我的歌曲</strong><p className="muted">文件只在本机使用，不上传服务器；刷新页面后需要重新选择。</p>{mode === 'import' && <p className="muted">音频：{audioName || '未选择'} · 歌词：{lrcName || '未选择'}</p>}</div><div className="import-actions"><button className="secondary-button" onClick={() => audioInputRef.current?.click()}>选择音频</button><button className="secondary-button" onClick={() => lrcInputRef.current?.click()} disabled={!audioUrl}>选择 .lrc</button><button className="text-button" onClick={resetImport}>返回演示课程</button><input ref={audioInputRef} type="file" accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4" onChange={chooseAudio} hidden /><input ref={lrcInputRef} type="file" accept=".lrc,text/plain" onChange={chooseLrc} hidden /></div>{importError && <p className="import-error" role="alert">{importError}</p>}</section>

    <section className="workspace">
      <div className="lyrics-panel"><div className="panel-heading"><div><p className="label">LYRICS</p><h2>逐句练习</h2></div><span className="progress-pill">已练习 {progress}</span></div><div className="lyrics-list">{course.lines.map((line, index) => <button key={line.id} className={`lyric-line ${index === selected ? 'selected' : ''}`} onClick={() => selectLine(index)}><span className="line-number">{String(line.id).padStart(2, '0')}</span><span>{line.text}</span>{index === selected && <span className="playing">●</span>}</button>)}</div><div className="audio-controls"><button className="secondary-button" onClick={restartAudio}>↺ <span>重新开始</span></button><button className="primary-button" onClick={toggleAudio}>{isPlaying ? 'Ⅱ' : '▶'} <span>{isPlaying ? '暂停' : '播放整首'}</span></button><button className="secondary-button" onClick={() => setLoopLine((value) => !value)}>{loopLine ? '取消循环' : '循环本句'}</button></div>{audioNotice && <p className="audio-notice">{audioNotice}</p>}<div className="audio-time">{Math.floor(progressTime)}s / {mode === 'import' ? '本地音频' : `${song.lines.at(-1).endTime}s`}</div></div>

      <aside className="practice-panel">
        <div className="panel-heading"><div><p className="label">YOUR TURN</p><h2>跟读这一句</h2></div><span className="line-count">{course.lines.length ? selected + 1 : 0} / {course.lines.length}</span></div>
        <div className="focus-line"><p>{currentLine.text}</p><span>{currentLine.translation}</span></div>
        <div className="detail-card"><p className="label">重点词与发音</p>{currentLine.words.length ? currentLine.words.map((item) => <div className="word-row" key={item.word}><strong>{item.word}</strong><span>{item.meaning}</span><small>{item.tip}</small></div>) : <p className="muted">重点词与发音提示待填写</p>}</div>
        <div className="record-actions"><button className={`listen-button ${speechStatus === 'listening' ? 'listening' : ''}`} onClick={startReading} disabled={!course.lines.length || ['requesting', 'listening', 'processing'].includes(speechStatus)}>🎙 {speechStatus === 'requesting' ? '等待麦克风权限' : speechStatus === 'listening' ? '正在识别…' : '开始跟读'}</button><button className="submit-button" onClick={submitRecording} disabled={speechStatus !== 'listening'}>结束跟读</button></div>
        <p className="speech-status" role="status">{speechMessage}</p>
        <p className="privacy-note">不保存录音；语音识别可能由浏览器服务处理。文字比对不评估音准或发音质量。</p>
        {['unsupported', 'denied', 'no-device', 'error', 'no-speech'].includes(speechStatus) && <button className="secondary-button" onClick={() => setShowSimulation(true)}>查看模拟反馈示例</button>}
        {showSimulation && <div className="feedback"><strong>模拟反馈模式 · 示例，非你的识别结果</strong><p>示例建议：重新听当前句，留意重点词，再尝试跟读。模拟内容不计入学习进度。</p></div>}
        {transcript && <p className="recognized-text">浏览器识别文字：{transcript}</p>}
        {feedback && <div className="feedback"><strong>{feedback.missing.length || feedback.unexpected.length ? '已经完成一次跟读，继续练习！' : '这句的文字基本一致！'}</strong>{feedback.missing.length > 0 && <p>可能漏读或不同的词：{feedback.missing.map((word, index) => <mark key={`${word}-${index}`}>{word}</mark>)}</p>}{feedback.unexpected.length > 0 && <p>识别结果中多出的词：{feedback.unexpected.join('、')}</p>}<p>{feedback.missing.length ? `下一步：重听并练习 “${feedback.missing[0]}”，再读当前句。` : '下一步：再读一遍当前句，或点击下一句继续练习。'}</p></div>}
      </aside>
    </section>

    <section className="progress-card"><div className="progress-icon">↗</div><div><p className="label">本次学习进度</p><h3>已练习 {progress}</h3><p className="muted">下一次复习：<b>{course.lines.length ? course.lines[Math.min(selected + 1, course.lines.length - 1)].text : '选择歌词后开始练习'}</b></p></div><div className="progress-track"><span style={{ width: `${course.lines.length ? (practiced / course.lines.length) * 100 : 0}%` }} /></div></section>
    <footer>SingLoop · 持续陪练，慢慢唱成自己的英语</footer>
  </main>
}

export default App
