export const demoUsage = {
  1: { text: 'Take a breath and start again', expression: 'start again', meaning: '在这里指调整好状态后重新尝试。', example: 'I made a mistake, so I will start again.', exampleTranslation: '我犯了个错，所以我要重新开始。', prompt: '想想一件你愿意重新尝试的事，用 start again 写一句话。' },
  2: { text: 'Every small step counts today', expression: 'counts', meaning: '在这里指每一小步都有价值、都算数。', example: 'Your effort counts, even on slow days.', exampleTranslation: '即使进展缓慢，你的努力也有价值。', prompt: '想想今天做过的一件小事，用 counts 写一句话。' },
  3: { text: 'Let the rhythm lead you through', expression: 'rhythm', meaning: '在这里指帮助你继续往前的音乐节奏。', example: 'The rhythm helps me remember the words.', exampleTranslation: '这个节奏帮助我记住单词。', prompt: '想想一段你喜欢的节奏，用 rhythm 写一句话。' },
  4: { text: 'Keep moving, you are breaking through', expression: 'keep moving', meaning: '在这里指即使进展慢，也继续向前。', example: 'Keep moving, even if you need to go slowly.', exampleTranslation: '即使你需要慢慢来，也要继续前进。', prompt: '用 keep moving 写一句鼓励自己的话。' },
}

export function getUsageContent(mode, line, dictionary = {}) {
  if (mode === 'demo' && demoUsage[line.id]?.text === line.text)
    return { ...demoUsage[line.id], translation: line.translation, source: '本项目编写的练习例句' }
  const candidate = line.words?.find((item) => dictionary[item.word]?.status === 'ok') || line.words?.[0]
  const entry = candidate ? dictionary[candidate.word] : null
  return {
    text: line.text,
    translation: '释义待填写',
    expression: candidate?.word || '',
    meaning: entry?.definition ? `词典英文释义：${entry.definition}` : entry?.status === 'error' ? '词典暂不可用' : entry?.status === 'missing' ? '词典无结果' : '词义待查',
    example: entry?.example || '',
    exampleTranslation: '',
    source: entry?.example ? '词典例句' : '',
    prompt: candidate ? `试着用 ${candidate.word} 写一句自己的英语。` : '试着用这句歌词中的一个词写一句自己的英语。',
  }
}
