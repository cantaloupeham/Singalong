import { useEffect, useRef, useState } from 'react'

// Checks microphone input level locally. No recording or audio data leaves the page.
export default function MicrophoneCheck() {
  const [status, setStatus] = useState('idle')
  const [level, setLevel] = useState(0)
  const activeRef = useRef(null)
  const unmountedRef = useRef(false)

  useEffect(() => {
    unmountedRef.current = false
    return () => { unmountedRef.current = true; activeRef.current?.stop() }
  }, [])

  const check = async () => {
    setStatus('requesting')
    let stream, context
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) throw new Error('unsupported')
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (unmountedRef.current) { stream.getTracks().forEach((track) => track.stop()); return }
      context = new AudioContext()
      await context.resume()
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)
      const samples = new Float32Array(analyser.fftSize)
      const started = performance.now()
      let peak = 0, lastShown = 0
      const active = {
        frame: null,
        stop: () => {
          if (active.frame != null) cancelAnimationFrame(active.frame)
          source.disconnect(); stream.getTracks().forEach((track) => track.stop())
          context.close().catch(() => {})
          if (activeRef.current === active) activeRef.current = null
        },
      }
      activeRef.current = active
      setStatus('measuring')
      const sample = (now) => {
        if (activeRef.current !== active) return
        analyser.getFloatTimeDomainData(samples)
        let energy = 0
        for (const value of samples) energy += value * value
        const rms = Math.sqrt(energy / samples.length)
        peak = Math.max(peak, rms)
        if (now - lastShown > 120) { setLevel(Math.min(rms / 0.12, 1)); lastShown = now }
        if (now - started < 5000) active.frame = requestAnimationFrame(sample)
        else { active.stop(); setLevel(0); setStatus(peak >= 0.01 ? 'audible' : 'quiet') }
      }
      active.frame = requestAnimationFrame(sample)
    } catch {
      stream?.getTracks().forEach((track) => track.stop())
      context?.close().catch(() => {})
      if (!unmountedRef.current) setStatus('error')
    }
  }

  return <div className="mic-check">
    <button className="secondary-button" onClick={check} disabled={status === 'requesting' || status === 'measuring'}>检查麦克风输入（5 秒）</button>
    {status === 'idle' && <p>只检测此设备的输入音量，不保存音频。</p>}
    {status === 'requesting' && <p>正在打开麦克风…</p>}
    {status === 'measuring' && <><p>请连续说话，观察输入音量条。</p><meter min="0" max="1" value={level} aria-label="麦克风输入音量" /></>}
    {status === 'audible' && <p>检测到较明显的输入音量。如果跟读仍无法识别，可能是浏览器语音识别服务的问题。</p>}
    {status === 'quiet' && <p>未测到明显的输入音量。请检查 Edge 选择的麦克风、系统静音和输入音量。</p>}
    {status === 'error' && <p>无法读取麦克风输入，请检查浏览器和系统的麦克风设置。</p>}
  </div>
}
