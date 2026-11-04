# SingLoop

SingLoop 是英语原创短歌陪练原型：逐句理解歌词、跟读并获得即时的单词级练习反馈。

## 开发

```bash
npm install
npm run dev
```

应用包含一首原创英文短歌《Take a Breath》（四句、20.88 秒），不需要 API Key。支持 Speech Recognition 的浏览器会在获得麦克风权限后识别英文跟读，并对识别文字进行简单单词比对。浏览器的识别服务可能在云端处理音频；应用本身不保存录音。缺少识别能力、权限或设备时会显示原因，并提供明确标注的模拟反馈示例；示例不作为识别结果或学习成绩。

每句旁可听原唱片段或开始跟读；点击单词使用浏览器的 en-US 合成语音朗读。真实跟读的次数、最近识别文字、逐词差异与建议保存在当前浏览器的 `localStorage`，切换句子或刷新后仍可查看。导入歌曲的记录按音频文件内容与 LRC 内容关联；刷新后仍需重新选择文件，音频文件本身不会写入 `localStorage`。这些结果仅是识别文字与歌词的对照，不能判断音准或具体发音。

## 构建

```bash
npm run build
```

## 公共 HTTPS 演示（Vercel）

本项目是 Vite 单页应用。Vercel 使用仓库中的 `vercel.json` 执行 `npm run build`，发布 `dist/`。选择 GitHub 仓库 `cantaloupeham/Singalong`，将 Production Branch 设为 `work`，即可让后续提交自动部署。无需配置 API Key。

在 Vercel 控制台：Add New → Project → Import Git Repository → 选择 `cantaloupeham/Singalong` → Framework Preset 选 Vite → Root Directory 保持 `./` → Build Command `npm run build` → Output Directory `dist` → Deploy。部署完成后到 Project Settings → Environments / Git，把 Production Branch 设为 `work`；若首次部署来自 `main`，切换后从 `work` 分支重新触发一次生产部署。

演示版音频为用户提供的原创歌曲；“导入我的歌曲”可以选择本地 MP3、WAV 或 M4A 和对应 LRC 文件，在浏览器内播放和同步歌词，文件不会上传。请勿将商业歌曲或任何 API Key 提交到仓库。未来需要 AI 接口时，应使用 Vercel 服务端函数和服务端环境变量，避免把密钥放进 `VITE_` 变量。
