export default function UsageCard({ content, draft, onDraftChange, onClose }) {
  return <section className="usage-card" aria-label="这句怎么用">
    <div className="usage-card-head"><h3>这句怎么用</h3><button type="button" onClick={onClose} aria-label="关闭用法卡片">×</button></div>
    <p className="usage-lyric">{content.text}</p><p className="usage-translation">{content.translation}</p>
    <p className="usage-coach">先看看 <strong>{content.expression || '这句歌词'}</strong> 在这里怎么用，再试着说一句自己的话。</p>
    <div className="usage-field"><span>值得学的表达</span><strong>{content.expression || '暂无可查询的重点词'}</strong><p>{content.meaning || '暂无可靠的语境解释'}</p></div>
    <div className="usage-field"><span>{content.source || '用法示例'}</span>{content.example ? <><p lang="en">{content.example}</p>{content.exampleTranslation && <p>{content.exampleTranslation}</p>}</> : <p>暂无用法示例</p>}</div>
    <label className="usage-field usage-draft"><span>换成我的话说</span><p>{content.prompt}</p><textarea value={draft} onChange={(event) => onDraftChange(event.target.value)} placeholder="试着写一句自己的英语…" rows="2" /></label>
    <p className="usage-note">这里只留作练习草稿，不会自动评分或上传。</p>
  </section>
}
