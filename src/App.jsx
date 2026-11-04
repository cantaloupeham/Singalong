import { useEffect, useMemo, useRef, useState } from 'react'
import { song } from './data/song'
import { parseLrc } from './data/parseLrc'
import { compareWords, lineKey, readRecords, songKey, STORAGE_KEY } from './data/practice'
import { chooseWords, lookupWord } from './data/vocabulary'
import { deleteSavedSong, getSavedSong, listSavedSongs, saveSong } from './data/songLibrary'
import { recommendLine } from './data/review'
import { createSpeechSession } from './data/speechSession'
import MicrophoneCheck from './MicrophoneCheck'
import ReportPage from './ReportPage'
import { buildLearningReport } from './data/report'
import { getUsageContent } from './data/usage'
import UsageCard from './UsageCard'

const EMPTY_LINE = { text: '请选择对应的 .lrc 歌词文件', translation: '释义待填写', words: [], startTime: 0, endTime: 4 }
const MicIcon = () => <svg className="mic-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="2.5" width="6" height="12" rx="3" /><path d="M5.5 10.5a6.5 6.5 0 0 0 13 0M12 17v4m-4 0h8" /></svg>

function App() {
  const [selected, setSelected] = useState(0)
  const [speechStatus, setSpeechStatus] = useState('idle')
  const [speechMessage, setSpeechMessage] = useState('点击“开始跟读”，浏览器会请求麦克风权限。')
  const [dismissedSpeechToast, setDismissedSpeechToast] = useState(false)
  const [showSimulation, setShowSimulation] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [usageOpen, setUsageOpen] = useState(false)
  const [usageDrafts, setUsageDrafts] = useState({})
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
  const [records, setRecords] = useState(readRecords)
  const [audioHash, setAudioHash] = useState('')
  const [page, setPage] = useState('practice')
  const [wordNotice, setWordNotice] = useState('')
  const [dictionary, setDictionary] = useState({})
  const [pronunciation, setPronunciation] = useState({ word: '', status: 'idle' })
  const [savedSongs, setSavedSongs] = useState([])
  const [libraryNotice, setLibraryNotice] = useState('')
  const speechControllerRef = useRef(null)
  const speechSessionRef = useRef(0)
  const audioRef = useRef(null)
  const audioInputRef = useRef(null)
  const lrcInputRef = useRef(null)
  const segmentEndRef = useRef(null)
  const importSessionRef = useRef(0)
  const wordAudioRef = useRef(null)
  const pronunciationSessionRef = useRef(0)
  const audioBlobRef = useRef(null)
  const course = mode === 'import' ? (importedSong || { title: audioName || '我的歌曲', subtitle: '请选择同步歌词', artist: '本地文件', lines: [] }) : song
  const currentLine = course.lines[selected] || EMPTY_LINE
  const currentSongKey = songKey(mode, audioHash, course.lines)
  const usageContent = getUsageContent(mode, currentLine, dictionary)
  const usageDraftKey = `${currentSongKey || mode}:${lineKey(currentLine)}`
  const songRecords = currentSongKey ? records[currentSongKey] || {} : {}
  const currentRecord = course.lines[selected] ? songRecords[lineKey(course.lines[selected])] : null
  const displayedFeedback = ['requesting', 'listening', 'processing'].includes(speechStatus) ? null : feedback || currentRecord?.feedback
  const practiced = course.lines.filter((line) => songRecords[lineKey(line)]?.count > 0).length
  const totalPractices = course.lines.reduce((sum, line) => sum + (songRecords[lineKey(line)]?.count || 0), 0)
  const recommendation = recommendLine(course.lines, songRecords)
  const report = buildLearningReport(course.title, course.lines, songRecords)
  const progress = useMemo(() => `${practiced}/${course.lines.length} 句`, [practiced, course.lines.length])
  const permissionNotice = ['requesting', 'denied', 'no-device'].includes(speechStatus)
  const showPermissionToast = permissionNotice && !dismissedSpeechToast

  useEffect(() => () => { speechControllerRef.current?.cancel(); audioRef.current?.pause() }, [])
  useEffect(() => { setDismissedSpeechToast(false) }, [speechStatus])
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl) }, [audioUrl])
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)) } catch { /* session still works */ } }, [records])
  useEffect(() => {
    let active = true
    listSavedSongs().then((items) => {
      if (!active) return
      setSavedSongs(items)
      const lastKey = localStorage.getItem('yuni-chorus-last-song')
      if (lastKey && items.some((item) => item.key === lastKey)) openSavedSong(lastKey)
    }).catch(() => { if (active) setLibraryNotice('浏览器本地歌曲库不可用，仍可临时导入歌曲。') })
    return () => { active = false }
  }, [])
  useEffect(() => {
    if (mode !== 'import' || !currentSongKey || !importedSong || !audioBlobRef.current) return
    const entry = { key: currentSongKey, audioHash, name: importedSong.title, audioName, lrcName, lines: importedSong.lines, blob: audioBlobRef.current, updatedAt: new Date().toISOString() }
    saveSong(entry).then(() => { setSavedSongs((previous) => [entry, ...previous.filter((item) => item.key !== entry.key)]); localStorage.setItem('yuni-chorus-last-song', entry.key); setLibraryNotice('歌曲已保存在此设备的浏览器中。') }).catch(() => setLibraryNotice('本地存储空间不足或不可用；本次仍可播放，刷新后可能需要重新导入。'))
  }, [mode, currentSongKey, importedSong, audioHash, audioName, lrcName])
  useEffect(() => {
    let active = true
    setDictionary({})
    for (const item of currentLine.words) lookupWord(item.word).then((result) => { if (active) setDictionary((previous) => ({ ...previous, [item.word]: result })) })
    return () => { active = false }
  }, [currentLine])

  const handleTimeUpdate = () => {
    const time = audioRef.current?.currentTime || 0
    setProgressTime(time)
    if (segmentEndRef.current != null && time >= segmentEndRef.current - 0.03) { audioRef.current.pause(); segmentEndRef.current = null; setIsPlaying(false); setAudioNotice('本句原唱片段播放完成。'); return }
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
    window.speechSynthesis?.cancel()
    wordAudioRef.current?.pause()
    try { await audio.play(); setIsPlaying(true); setAudioNotice('') }
    catch { setIsPlaying(false); setAudioNotice(mode === 'import' ? '音频加载失败。请重新选择有效的 MP3、WAV 或 M4A 文件。' : '音频素材待加入。跟读练习仍可使用。') }
  }

  const toggleAudio = () => {
    if (isPlaying) { audioRef.current?.pause(); setIsPlaying(false) } else { segmentEndRef.current = null; playAudio() }
  }

  const listenLine = async (index) => {
    const line = course.lines[index], audio = audioRef.current
    if (!line || !audio) return
    resetSpeech(); audio.pause(); setIsPlaying(false); setSelected(index); segmentEndRef.current = Number.isFinite(line.endTime) ? line.endTime : null
    try { audio.currentTime = line.startTime; await playAudio() }
    catch { segmentEndRef.current = null }
  }

  const speakWord = async (word) => {
    const session = ++pronunciationSessionRef.current
    audioRef.current?.pause(); setIsPlaying(false); segmentEndRef.current = null
    wordAudioRef.current?.pause(); window.speechSynthesis?.cancel()
    setPronunciation({ word, status: 'playing' })
    const entry = dictionary[word] || await lookupWord(word)
    if (session !== pronunciationSessionRef.current) return
    if (entry.audio) {
      const pronunciationAudio = new Audio(entry.audio); wordAudioRef.current = pronunciationAudio
      pronunciationAudio.onended = () => { if (session === pronunciationSessionRef.current) setPronunciation({ word, status: 'idle' }) }
      pronunciationAudio.onerror = () => { if (session === pronunciationSessionRef.current) { setWordNotice(`词典发音播放失败：${word}，请重试。`); setPronunciation({ word, status: 'failed' }) } }
      try { await pronunciationAudio.play(); setWordNotice(`词典发音：${word}`); return } catch { /* fall back to system voice */ }
    }
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) { setWordNotice(`没有可播放的单词发音：${word}`); setPronunciation({ word, status: 'failed' }); return }
    const voice = window.speechSynthesis.getVoices().find((item) => item.lang.toLowerCase().startsWith('en-us'))
    if (!voice) { setWordNotice(`没有可用的词典音频或 en-US 系统语音：${word}`); setPronunciation({ word, status: 'failed' }); return }
    const utterance = new SpeechSynthesisUtterance(word); utterance.lang = 'en-US'; utterance.voice = voice
    utterance.onerror = () => { if (session === pronunciationSessionRef.current) { setWordNotice(`合成朗读失败：${word}`); setPronunciation({ word, status: 'failed' }) } }
    utterance.onend = () => { if (session === pronunciationSessionRef.current) setPronunciation({ word, status: 'idle' }) }
    setWordNotice(`浏览器合成朗读：${word}`)
    window.speechSynthesis.speak(utterance)
  }

  const restartAudio = () => {
    if (!audioRef.current) return
    audioRef.current.currentTime = 0; segmentEndRef.current = null; setProgressTime(0); setSelected(0); setLoopLine(false); setAudioNotice(''); playAudio()
  }

  const handleAudioEnded = () => { if (mode === 'import' && loopLine && course.lines[selected]) { audioRef.current.currentTime = course.lines[selected].startTime; playAudio(); return } audioRef.current.currentTime = 0; setIsPlaying(false); setProgressTime(0); setSelected(0); setAudioNotice('播放完成。') }

  const handleAudioError = () => { setIsPlaying(false); setAudioNotice(mode === 'import' ? '音频加载失败。请重新选择有效的 MP3、WAV 或 M4A 文件。' : '音频素材待加入。跟读练习仍可使用。') }

  const compare = (spoken, lineText, lineIndex, sessionKey, line) => {
    const result = compareWords(lineText, spoken)
    const focusWord = result.missing[0] || result.replacements[0]?.expected
    const suggestion = focusWord ? `重听并练习 “${focusWord}”，再读当前句。` : result.unexpected.length ? `重听当前句，留意识别文本中疑似多出的 “${result.unexpected[0]}”，再读一次。` : '再读一遍当前句，或点击下一句继续练习。'
    setFeedback(result)
    if (sessionKey) setRecords((previous) => {
      const oldSong = previous[sessionKey] || {}, key = lineKey(line)
      const oldRecord = oldSong[key], at = new Date().toISOString()
      const attempts = [...(oldRecord?.attempts || (oldRecord?.feedback ? [{ at: oldRecord.at, feedback: oldRecord.feedback }] : [])), { at, feedback: result }].slice(-3)
      return { ...previous, [sessionKey]: { ...oldSong, [key]: { count: (oldRecord?.count || 0) + 1, transcript: spoken, feedback: result, suggestion, at, attempts } } }
    })
  }

  const resetSpeech = () => { speechSessionRef.current += 1; speechControllerRef.current?.cancel(); speechControllerRef.current = null; setSpeechStatus('idle'); setSpeechMessage('点击“开始跟读”，浏览器会请求麦克风权限。'); setTranscript(''); setInterimTranscript(''); setFeedback(null); setShowSimulation(false) }

  const startReading = (lineIndex = selected) => {
    const session = ++speechSessionRef.current
    const line = course.lines[lineIndex]
    if (!line) return
    speechControllerRef.current?.cancel(); speechControllerRef.current = null
    const lineText = line.text, sessionKey = currentSongKey
    audioRef.current?.pause(); setIsPlaying(false); segmentEndRef.current = null; window.speechSynthesis?.cancel()
    setFeedback(null)
    setTranscript('')
    setInterimTranscript('')
    setShowSimulation(false)
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) {
      setSpeechStatus('unsupported')
      setSpeechMessage('此浏览器不支持语音识别。可查看模拟反馈示例；示例不是你的识别结果。建议使用最新版 Chrome 或 Edge。')
      return
    }
    if (!window.isSecureContext) { setSpeechStatus('error'); setSpeechMessage('请在 HTTPS 页面或 localhost 打开后使用跟读。'); return }
    let recognition
    try { recognition = new Recognition() }
    catch { setSpeechStatus('error'); setSpeechMessage('无法创建浏览器语音识别器，请更新浏览器后重试。'); return }
    recognition.lang = 'en-US'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    const active = () => session === speechSessionRef.current
    const controller = createSpeechSession(recognition, {
      onListening: () => { if (active()) { setSpeechStatus('listening'); setSpeechMessage('识别器已启动，正在等待麦克风音频。') } },
      onAudioStart: () => { if (active()) { setSpeechStatus('listening'); setSpeechMessage('麦克风音频已接入，正在识别英文跟读。读完后点击“结束跟读”。') } },
      onSpeechStart: () => { if (active()) { setSpeechStatus('listening'); setSpeechMessage('已检测到语音，正在识别英文跟读。') } },
      onWaiting: () => { if (active()) { setSpeechStatus('processing'); setSpeechMessage('正在等待浏览器返回最终识别文字。') } },
      onInterim: (text) => { if (active()) setInterimTranscript(text) },
      onFinal: (spoken) => {
        if (!active()) return
        setTranscript(spoken); setInterimTranscript(''); compare(spoken, lineText, lineIndex, sessionKey, line)
        setSpeechStatus('success'); setSpeechMessage('已收到浏览器真实识别结果。以下仅比较文字中的单词，不评估音准或发音质量。')
      },
      onError: (code) => {
        if (!active()) return
        setInterimTranscript('')
        const denied = code === 'not-allowed' || code === 'service-not-allowed'
        setSpeechStatus(denied ? 'denied' : code === 'audio-capture' || code === 'no-audio' ? 'no-device' : code === 'no-speech' ? 'no-speech' : 'error')
        setSpeechMessage(denied ? '语音识别权限被拒绝。请在地址栏允许麦克风后重试。' : code === 'audio-capture' ? '识别器无法打开麦克风，请检查浏览器的输入设备设置。' : code === 'no-audio' ? '识别器已启动，但浏览器未报告接入麦克风音频。请检查输入设备后重试。' : code === 'no-speech' ? '麦克风音频已接入，但未检测到语音。请靠近麦克风、读完一句后再结束。' : code === 'no-final' ? '检测到语音或临时文字，但没有收到最终识别结果；本次未计入练习。' : code === 'network' ? '语音识别服务连接失败。请检查网络后重试。' : '识别服务出错或无法返回最终结果，请稍后重试。')
      },
    })
    speechControllerRef.current = controller
    setSpeechStatus('requesting'); setSpeechMessage('正在请求麦克风权限并启动识别服务。')
    try { recognition.start() }
    catch (error) {
      controller.cancel()
      const denied = ['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(error.name)
      setSpeechStatus(denied ? 'denied' : 'error')
      setSpeechMessage(denied ? '麦克风权限被拒绝。请在地址栏允许访问后重试。' : '语音识别无法启动，请刷新页面并重试。')
    }
  }

  const submitRecording = () => {
    if (speechStatus !== 'listening') return
    speechControllerRef.current?.stop()
  }

  const selectLine = (index) => { resetSpeech(); setWordNotice(''); setSelected(index); if (mode === 'import' && audioRef.current && Number.isFinite(course.lines[index].startTime)) { audioRef.current.currentTime = course.lines[index].startTime; setProgressTime(course.lines[index].startTime); setLoopLine(true) } }

  const chooseAudio = async (event) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
    if (!/\.(mp3|wav|m4a)$/i.test(file.name)) { setImportError('文件格式不支持，请选择 MP3、WAV 或 M4A。'); return }
    const importSession = ++importSessionRef.current
    audioBlobRef.current = file
    resetSpeech(); audioRef.current?.pause(); setIsPlaying(false); setAudioUrl(URL.createObjectURL(file)); setAudioName(file.name); setAudioHash(''); setMode('import'); setImportedSong(null); setLrcName(''); setSelected(0); setLoopLine(false); setImportError(''); setAudioNotice('已选择本地音频，正在建立本地内容标识；请再选择 .lrc 歌词。')
    try { const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer()); if (importSession === importSessionRef.current) setAudioHash(Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')) }
    catch { if (importSession === importSessionRef.current) setImportError('无法建立音频内容标识，请在 HTTPS 页面或 localhost 重试。') }
  }
  const chooseLrc = async (event) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
    if (!/\.lrc$/i.test(file.name)) { setImportError('歌词文件格式不支持，请选择 .lrc 文件。'); return }
    try {
      const content = await file.text()
      if (!content.trim()) { setImportError('歌词文件为空，请选择包含时间戳的 .lrc 文件。'); return }
      const lines = parseLrc(content).map((line) => ({ ...line, translation: '释义待填写', words: chooseWords(line.text) }))
      if (!lines.length) { setImportError('未找到有效的时间戳歌词，例如 [00:04.00] Every small step counts today'); return }
      resetSpeech(); setImportedSong({ title: audioName.replace(/\.[^.]+$/, ''), artist: '我的本地歌曲', subtitle: '本地 LRC 歌词', lines }); setLrcName(file.name); setSelected(0); setLoopLine(false); setImportError(''); setAudioNotice('LRC 歌词已加载，可以开始播放。')
    } catch { setImportError('歌词文件读取失败，请重新选择 .lrc 文件。') }
  }
  const resetImport = () => { importSessionRef.current += 1; audioBlobRef.current = null; localStorage.removeItem('yuni-chorus-last-song'); resetSpeech(); audioRef.current?.pause(); setIsPlaying(false); setAudioUrl(''); setAudioName(''); setAudioHash(''); setLrcName(''); setImportedSong(null); setMode('demo'); setImportError(''); setSelected(0); setLoopLine(false); setAudioNotice('') }
  const openSavedSong = async (key) => {
    try {
      const entry = await getSavedSong(key)
      if (!entry?.blob?.size || !Array.isArray(entry.lines) || !entry.lines.length) { setLibraryNotice('保存的歌曲文件已损坏，请删除并重新导入。'); return }
      importSessionRef.current += 1; resetSpeech(); audioRef.current?.pause(); setIsPlaying(false)
      audioBlobRef.current = entry.blob; setAudioUrl(URL.createObjectURL(entry.blob)); setAudioHash(entry.audioHash)
      setAudioName(entry.audioName); setLrcName(entry.lrcName); setImportedSong({ title: entry.name, artist: '我的本地歌曲', subtitle: '本地 LRC 歌词', lines: entry.lines })
      setMode('import'); setSelected(0); setPage('practice'); setImportError(''); setLibraryNotice('已从此设备恢复歌曲。')
      localStorage.setItem('yuni-chorus-last-song', key)
    } catch { setLibraryNotice('无法读取本地歌曲，请检查浏览器站点存储。') }
  }
  const removeSavedSong = async (key) => {
    if (!window.confirm('删除这首歌及其本地音频、歌词和练习记录？')) return
    try {
      await deleteSavedSong(key)
      setSavedSongs((previous) => previous.filter((item) => item.key !== key))
      setRecords((previous) => { const next = { ...previous }; delete next[key]; return next })
      if (localStorage.getItem('yuni-chorus-last-song') === key) localStorage.removeItem('yuni-chorus-last-song')
      if (currentSongKey === key) resetImport()
      setLibraryNotice('已删除这首歌及其本地记录。')
    } catch { setLibraryNotice('删除失败，请检查浏览器站点存储后重试。') }
  }
  const clearCurrentRecords = () => { if (!currentSongKey || !window.confirm('清除这首歌的练习记录？')) return; setRecords((previous) => { const next = { ...previous }; delete next[currentSongKey]; return next }); setFeedback(null); setTranscript('') }
  const openReportLine = (index) => { selectLine(index); setPage('practice') }
  const listenReportLine = (index) => { setPage('practice'); listenLine(index) }
  const listenReportWord = (index, word) => { if (!word) return; selectLine(index); setPage('practice'); speakWord(word) }
  const readReportLine = (index) => { selectLine(index); setPage('practice'); startReading(index) }

  return <main className="app">
    <header className="topbar"><div className="logo">语你合唱</div><nav><button className={page === 'practice' ? 'active' : ''} onClick={() => setPage('practice')}>练习</button><button className={page === 'progress' ? 'active' : ''} onClick={() => { audioRef.current?.pause(); setIsPlaying(false); segmentEndRef.current = null; setPage('progress') }}>学习进度</button></nav><div className="language">English</div></header>
    {showPermissionToast && <div className={`speech-toast ${speechStatus === 'requesting' ? 'pending' : 'error'}`} role={speechStatus === 'requesting' ? 'status' : 'alert'}><span className="speech-toast-symbol" aria-hidden="true">{speechStatus === 'requesting' ? '…' : '!'}</span><p>{speechMessage}</p><button type="button" aria-label="关闭麦克风提示" onClick={() => setDismissedSpeechToast(true)}>×</button></div>}

    <audio ref={audioRef} src={mode === 'import' ? audioUrl || undefined : '/audio/keep-moving.mp3'} preload="metadata" onTimeUpdate={handleTimeUpdate} onEnded={handleAudioEnded} onError={handleAudioError} />

    {page === 'practice' ? <>
    <section className="intro"><h1>语你合唱</h1><p className="intro-copy">陪你从一首喜欢的歌，练到一句自己的表达。</p></section>

    <section className="song-picker"><div><p className="label">当前歌曲</p><h2>{course.title}</h2><p className="muted">{course.subtitle} · {course.artist}</p></div><div className="song-status"><span className="status-dot" />{mode === 'import' ? '我的歌曲 · 本地模式' : '原创演示课程'}<br /><small>{mode === 'import' ? '已保存在此设备的浏览器中' : '原创音频 · 约 21 秒'}</small></div></section>
    <section className="import-panel"><div><strong>导入我的歌曲</strong><p className="muted">歌曲仅保存在此设备的浏览器中。</p>{mode === 'import' && <p className="muted">音频：{audioName || '未选择'} · 歌词：{lrcName || '未选择'}</p>}</div><div className="import-actions"><button className="secondary-button" onClick={() => audioInputRef.current?.click()}>选择音频</button><button className="secondary-button" onClick={() => lrcInputRef.current?.click()} disabled={!audioUrl}>选择 .lrc</button><button className="text-button" onClick={resetImport}>返回演示课程</button><input ref={audioInputRef} type="file" accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4" onChange={chooseAudio} hidden /><input ref={lrcInputRef} type="file" accept=".lrc,text/plain" onChange={chooseLrc} hidden /></div>{importError && <p className="import-error" role="alert">{importError}</p>}{libraryNotice && <p className="muted" role="status">{libraryNotice}</p>}</section>

    <section className="workspace">
      <div className="lyrics-panel">
        <div className="panel-heading"><div><p className="label">LYRICS</p><h2>逐句练习</h2></div><span className="progress-pill">已练习 {progress}</span></div>
        <div className="audio-controls audio-controls-top"><button className="primary-button" onClick={toggleAudio}>{isPlaying ? 'Ⅱ 暂停' : '▶ 播放整首'}</button><button className="secondary-button" onClick={restartAudio}>↺ 重新开始</button>{mode === 'import' && <button className="secondary-button" onClick={() => setLoopLine((value) => !value)}>{loopLine ? '取消循环' : '循环本句'}</button>}</div>
        {audioNotice && <p className="audio-notice">{audioNotice}</p>}<div className="audio-time">{Math.floor(progressTime)}s / {mode === 'import' ? '本地音频' : `${song.lines.at(-1).endTime}s`}</div>
        <div className="lyrics-list">{course.lines.map((line, index) => <div key={line.id} className={`lyric-row ${index === selected ? 'selected' : ''} ${songRecords[lineKey(line)] ? 'practiced' : 'unpracticed'}`}><button className="lyric-line" onClick={() => selectLine(index)}><span className="line-number">{String(line.id).padStart(2, '0')}</span><span>{line.text}</span></button><span className="line-practice-status">{songRecords[lineKey(line)] ? `✓ 练过 ${songRecords[lineKey(line)].count} 次` : '○ 未练习'}</span><div className="line-actions"><button onClick={(event) => { event.stopPropagation(); listenLine(index) }}>▶ 听这一句</button><button onClick={(event) => { event.stopPropagation(); selectLine(index); startReading(index) }} disabled={!currentSongKey}><MicIcon />跟读</button></div></div>)}</div>
      </div>

      <aside className="practice-panel">
        <div className="panel-heading"><div><p className="label">YOUR TURN</p><h2>跟读这一句</h2></div><span className="line-count">{course.lines.length ? selected + 1 : 0} / {course.lines.length}</span></div>
        <div className="focus-line"><p>{(displayedFeedback?.parts || (currentLine.text.match(/[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)?|[^A-Za-z0-9]+/g) || []).map((text) => ({ text, status: /^[A-Za-z0-9]/.test(text) ? 'unjudged' : 'punctuation' }))).map((part, index) => part.status === 'punctuation' ? <span key={index}>{part.text}</span> : <button key={index} className={`inline-word ${part.status}`} onClick={() => speakWord(part.text)} title={`听 ${part.text} 的标准朗读`}>{part.status === 'matched' ? '✓ ' : ['missing','different'].includes(part.status) ? '△ ' : part.status === 'replaced' ? '↔ ' : ''}{part.text}</button>)}</p><span>{currentLine.translation}</span><small className="inline-legend">{displayedFeedback ? '✓ 匹配　△ 疑似漏读　↔ 疑似替换' : '点击英文单词可听标准朗读'} · 识别结果可能有误</small><button className="usage-open" onClick={() => setUsageOpen((open) => !open)} disabled={!course.lines.length}>{usageOpen ? '收起用法' : '这句怎么用'}</button></div>
        <div className="record-actions"><button className={`listen-button ${speechStatus === 'listening' ? 'listening' : ''}`} onClick={() => startReading(selected)} disabled={!currentSongKey || !course.lines.length || ['requesting', 'listening', 'processing'].includes(speechStatus)}><MicIcon />{speechStatus === 'requesting' ? '请求权限或启动中…' : speechStatus === 'listening' ? '正在识别…' : speechStatus === 'processing' ? '等待最终结果…' : '开始跟读'}</button><button className="submit-button" onClick={submitRecording} disabled={speechStatus !== 'listening'}>结束跟读</button></div>
        {usageOpen && course.lines.length > 0 && <UsageCard content={usageContent} draft={usageDrafts[usageDraftKey] || ''} onDraftChange={(value) => setUsageDrafts((previous) => ({ ...previous, [usageDraftKey]: value }))} onClose={() => setUsageOpen(false)} />}
        {interimTranscript && ['listening', 'processing'].includes(speechStatus) && <p className="speech-status" role="status">识别中（临时文字，不计入练习）：{interimTranscript}</p>}
        <div className="detail-card"><p className="label">重点词与发音</p>{currentLine.words.length ? currentLine.words.map((item) => { const entry = dictionary[item.word]; return <div className="word-row" key={item.word}><strong>{item.word}</strong><span>{item.generated ? entry?.definition ? `英文释义：${entry.definition}` : entry?.status === 'missing' ? '词典无结果' : entry?.status === 'error' ? '词典暂不可用' : '词义待查' : item.meaning}</span><small>{entry?.phonetic || item.tip}</small><button className="pronounce-button" onClick={() => speakWord(item.word)}>{pronunciation.word === item.word && pronunciation.status === 'playing' ? '播放中…' : pronunciation.word === item.word && pronunciation.status === 'failed' ? '重试发音' : '▶ 听发音'}</button></div> }) : <p className="muted">重点词待查</p>}</div>{wordNotice && <p className="speech-status" role="status">{wordNotice}</p>}
        {!showPermissionToast && <p className="speech-status" role="status">{speechMessage}</p>}
        {['no-speech', 'no-device', 'error'].includes(speechStatus) && <MicrophoneCheck />}
        <p className="privacy-note">语音识别可能由浏览器服务处理；文字比对不评估音准。</p>
        {['unsupported', 'denied', 'no-device', 'error', 'no-speech'].includes(speechStatus) && <button className="secondary-button" onClick={() => setShowSimulation(true)}>查看模拟反馈示例</button>}
        {showSimulation && <div className="feedback"><strong>模拟反馈模式 · 示例，非你的识别结果</strong><p>示例建议：重新听当前句，留意重点词，再尝试跟读。模拟内容不计入学习进度。</p></div>}
        {displayedFeedback && <div className="feedback"><strong>{displayedFeedback.missing.length || displayedFeedback.replacements?.length || displayedFeedback.unexpected.length ? '已经完成一次跟读，继续练习！' : '这句的文字基本一致！'}</strong><p className="recognized-text">最近一次识别：{transcript || currentRecord?.transcript}</p>{displayedFeedback.missing.length > 0 && <p>疑似漏读：{displayedFeedback.missing.map((word, index) => <mark key={`${word}-${index}`}>{word}</mark>)}</p>}{displayedFeedback.replacements?.length > 0 && <p>疑似替换：{displayedFeedback.replacements.map((item, index) => <mark key={index}>{item.expected} → {item.actual}</mark>)}</p>}{displayedFeedback.unexpected.length > 0 && <p>识别结果中疑似多出的词：{displayedFeedback.unexpected.join('、')}</p>}<p>下一步：{currentRecord?.suggestion || '再读一遍当前句，或点击下一句继续练习。'}</p>{currentRecord && <small>已真实跟读 {currentRecord.count} 次 · 最近一次 {new Date(currentRecord.at).toLocaleString()}</small>}</div>}
      </aside>
    </section>

    <section className="progress-card"><div className="progress-icon">↗</div><div><p className="label">学习进度</p><h3>{progress} · 跟读 {totalPractices} 次</h3></div><div className="progress-track"><span style={{ width: `${course.lines.length ? (practiced / course.lines.length) * 100 : 0}%` }} /></div></section>
    </> : page === 'progress' ? <section className="progress-page">
      <div className="progress-toolbar"><button className="secondary-button" onClick={() => setPage('practice')}>← 返回练习</button><button className="primary-button" onClick={() => setPage('report')}>生成我的学习报告</button></div>
      <div className="saved-library"><h2>我的歌曲</h2><p className="muted">歌曲仅保存在此设备的浏览器中。</p>{libraryNotice && <p className="muted" role="status">{libraryNotice}</p>}{savedSongs.length ? savedSongs.map((item) => { const entries = records[item.key] || {}; const done = item.lines.filter((line) => entries[lineKey(line)]?.count > 0).length; const attempts = item.lines.reduce((sum, line) => sum + (entries[lineKey(line)]?.count || 0), 0); const recent = Object.values(entries).map((record) => record.at).filter(Boolean).sort().at(-1); return <div className="saved-song" key={item.key}><div><strong>{item.name}</strong><small>{done}/{item.lines.length} 句 · 累计跟读 {attempts} 次 · 最近练习 {recent ? new Date(recent).toLocaleString() : '尚未练习'}</small><div className="saved-song-bar"><span style={{ width: `${item.lines.length ? done / item.lines.length * 100 : 0}%` }} /></div></div><div className="saved-song-actions"><button onClick={() => openSavedSong(item.key)}>继续学习</button><button onClick={() => removeSavedSong(item.key)}>删除这首歌</button></div></div> }) : <p className="empty-library">还没有保存的歌曲。可以在练习页导入本地音频和 LRC。</p>}</div>
      <h1>{course.title} · 学习进度</h1><div className="progress-numbers"><div><strong>{practiced}/{course.lines.length}</strong><span>练习过的不同句数</span></div><div><strong>{totalPractices}</strong><span>累计真实跟读次数</span></div></div>
      {recommendation && <div className="review-suggestion"><strong>建议下一句：{course.lines[recommendation.index].text}</strong><p>{recommendation.reason}</p><button onClick={() => { selectLine(recommendation.index); setPage('practice') }}>去练这一句</button></div>}
      {course.lines.map((line, index) => { const record = songRecords[lineKey(line)]; return <button className={`progress-line ${index === selected ? 'selected' : ''} ${record ? 'practiced' : ''}`} key={line.id} onClick={() => { selectLine(index); setPage('practice') }}><span>{line.text}</span><small>{record ? `✓ 已练习 ${record.count} 次 · ${new Date(record.at).toLocaleString()}` : '○ 未练习'}</small></button> })}
      <button className="clear-records" onClick={clearCurrentRecords} disabled={!totalPractices}>清除这首歌的练习记录</button>
    </section> : <ReportPage report={report} onClose={() => setPage('progress')} onPractice={openReportLine} onListenLine={listenReportLine} onListenWord={listenReportWord} onReadLine={readReportLine} />}
    <footer>语你合唱 · 听懂喜欢的歌，跟着伙伴练会一句外语</footer>
  </main>
}

export default App
