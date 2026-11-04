# SingLoop

SingLoop 是英语原创短歌陪练原型：逐句理解歌词、跟读并获得即时的单词级练习反馈。

## 开发

```bash
npm install
npm run dev
```

应用包含一首原创英文短歌《Take a Breath》（四句、20.88 秒），不需要 API Key。支持 Speech Recognition 的浏览器会识别英文跟读；其他浏览器自动进入模拟反馈模式。

## 构建

```bash
npm run build
```

## 公共 HTTPS 演示（Vercel）

本项目是 Vite 单页应用。Vercel 使用仓库中的 `vercel.json` 执行 `npm run build`，发布 `dist/`。选择 GitHub 仓库 `cantaloupeham/Singalong`，将 Production Branch 设为 `work`，即可让后续提交自动部署。无需配置 API Key。

在 Vercel 控制台：Add New → Project → Import Git Repository → 选择 `cantaloupeham/Singalong` → Framework Preset 选 Vite → Root Directory 保持 `./` → Build Command `npm run build` → Output Directory `dist` → Deploy。部署完成后到 Project Settings → Environments / Git，把 Production Branch 设为 `work`；若首次部署来自 `main`，切换后从 `work` 分支重新触发一次生产部署。

演示版音频为用户提供的原创歌曲；“导入我的歌曲”可以选择本地 MP3、WAV 或 M4A 和对应 LRC 文件，在浏览器内播放和同步歌词，文件不会上传。请勿将商业歌曲或任何 API Key 提交到仓库。未来需要 AI 接口时，应使用 Vercel 服务端函数和服务端环境变量，避免把密钥放进 `VITE_` 变量。
