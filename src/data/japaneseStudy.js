export async function generateJapaneseLine(line, signal) {
  let response
  try {
    response = await fetch('/.netlify/functions/japanese-study', {
      method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line }),
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('无法连接自动释义服务，请检查网络后重试。')
  }
  if (!response.ok) throw new Error(response.status === 503 ? '日语自动释义服务尚未启用。' : '自动释义暂时失败，请稍后重试。')
  const result = await response.json()
  if (typeof result?.translation !== 'string' || !Array.isArray(result.words)) throw new Error('自动释义返回格式有误，请稍后重试。')
  return result
}
