# 秩与零：数学概念片与制作工作流

三分钟数学概念片，围绕“什么留下，什么被压掉”，用同一个线性映射连接像、零空间、列向量、方程的解与可逆性，最后引向秩－零度定理。

- **看作品**：[三分钟成片](video/秩与零.mp4)
- **看说明**：[作品说明 PDF](docs/秩与零_作品说明.pdf)
- **学方法**：[制作工作流](docs/WORKFLOW.md)

公开视频已去掉片尾署名卡，时长 178 秒、5340 帧，1920×1080、30 fps。原作及剧本的时间基准为 180 秒、5400 帧；源码保留最后两秒时段，但署名数据已清空，重新渲染时该时段为黑场。正文档与代码以最终 6 节／15 个故事拍为口径；两张章节卡、Extra 卡与片尾另列为时间轴条目。

## 从哪里开始读

```text
video/秩与零.mp4                  最终有声成片
docs/                            作品说明与工作流
main/
  OUTLINE.md                     讲什么：15 拍总纲
  STYLE.md                       怎么呈现：视觉与叙事语法
  STORYBOARD.md                  怎么安排：分镜与时间预算
  MATH.md                        数学对象、参数与边界
  sections/                      六段详细脚本与事件
  TTS_TIMING.md                   配音时间分析
  tts_timing.json                 37 句旁白的帧号与文字
  film/
    index.html                   浏览器画布入口
    src/                         Canvas 2D 渲染器
    assets/voice/                实际使用的 37 句云扬旁白
    tools/filmctl.mjs            关键帧、单拍、章节、全片导出
    tools/score_v3.json          事件谱
    tools/soundctl.py            音表检查、合成、分轨与混流
    tools/audiosynth.py          声音合成器
    tools/generate_tts.py        可选：生成缺失的逐句旁白
    QA.md                        审阅方法与实例
```

阅读顺序建议：先看影片，再读总纲与数学参数；选择感兴趣的一段，对照 `sections/`、`src/sections.js` 与 `src/stage.js` 查看实现。

## 环境准备

原工程在 Windows、Node.js 24、Chrome 与 FFmpeg 环境中制作。画面工具使用 Node 内置模块，不需要 npm 安装依赖；声音工具使用 Python 3、NumPy 和 SciPy。

请安装 Chrome 与 FFmpeg，并确保 `ffmpeg` 在 PATH 中。工具也接受以下环境变量（PowerShell 示例，路径按本机实际位置修改）：

```powershell
$env:CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:FFMPEG_PATH = 'C:\tools\ffmpeg\bin\ffmpeg.exe'
python -m pip install -r requirements.txt
```

未配置 `CHROME_PATH` 时，Windows 使用标准 Chrome 安装位置，macOS 使用标准应用路径，Linux 尝试 `google-chrome`；其他平台尚未验证。画面使用系统字体，原环境以微软雅黑、Cascadia Mono、Cambria Math 为主，其他字体可能改变字宽与布局；字体文件不随项目分发。

以下命令均在本 README 所在目录执行。

## 查看与检查画面

```powershell
node main/film/tools/filmctl.mjs list
node main/film/tools/filmctl.mjs check
node main/film/tools/filmctl.mjs qa --beat S1/C1B2 --frames 0,120,240
node main/film/tools/filmctl.mjs clip --beat S1/C1B2 --no-burn-in
```

`qa` 从源码重新渲染指定帧，默认不带审阅标记；`clip` 默认带标记，正式画面可加 `--no-burn-in`。输出分别位于 `main/film/qa/` 和 `main/film/out/clips/`。已有字幕速度警告是成片保留的节奏选择，`check` 会如实列出。

如需在浏览器中检查任意全局帧，可运行：

```powershell
python -m http.server 8000 --bind 127.0.0.1 --directory main/film
```

打开 http://127.0.0.1:8000，在开发者控制台调用 `window.renderFrame(1100)`。这是逐帧画布入口，不含播放器或旁白；观看成片请打开 `video/秩与零.mp4`。

## 修改与检查声音

```powershell
python main/film/tools/soundctl.py check
python main/film/tools/soundctl.py list
python main/film/tools/soundctl.py window --at 147.6 --len 8 --tag theorem
```

声音由 `score_v3.json` 控制，包括 41 个事件、58 个音与 6 次低频短音效；37 句旁白已包含在 `assets/voice/` 中，复现现有声音不需要调用在线 TTS。听音乐分轨可在 `window` 后加 `--no-voice`，输出位于 `main/film/out/audio/v3/`。

如果修改了字幕并需要新旁白，可另行安装 `requirements-tts.txt`，运行 `python main/film/tools/generate_tts.py`。该步骤需要网络，使用 Edge TTS 云扬、0% 语速，已有同名片段会复用；重新生成某句前需先移走对应旧音频。新时长写入 `generated_tts_timing.json`，应审阅后再调整正式时间表；在线服务和声音可能发生变化，不能保证重新生成的音频与原片逐样本一致。

## 完整导出

```powershell
# 无声画面
node main/film/tools/filmctl.mjs render

# 配音、事件谱与母带
python main/film/tools/soundctl.py render --stems

# 将声音混入视频
python main/film/tools/soundctl.py mux --video main/film/out/rank_and_nullity_1080p.mp4 --audio main/film/out/audio/v3/v3_full_master.wav --out main/film/out/rank_and_nullity_1080p_vo3.mp4
```

全片渲染包含 5400 帧，耗时取决于本机环境。工具从绝对帧号重算状态，便于单独检查局部画面；改动时长时仍需同步分镜、字幕和声音事件。原始视频、公开代码与新环境重渲结果可能存在字体、编码等差异。

## 创作与参考

人负责选题、数学口径、叙事、审美与验收，AI 辅助代码、文档、渲染、音频制作和检查。主片使用 Canvas 2D 与手写正交投影。

架构参考 歌词 MV 参考项目 的逐帧、无头浏览器与 FFmpeg 组织方式，本项目据此自建数学动画实现。教学用法为设计建议，尚未完成课堂效果验证。

## 本地整理检查

公开副本已在原 Windows 环境完成时间轴检查、音表校验、一张关键帧导出和一段含旁白的声音窗口合成；37 句音频齐全，公开视频与说明 PDF 已另行匿名处理。没有为此次目录整理重新渲染完整影片；其他平台与不同字体环境尚未实测。

## 匿名公开版

公开内容已去除作者姓名与个人账号链接。视频在 178 秒处结束，去掉原片最后两秒署名卡；说明 PDF 保留对原作 180 秒规格的介绍，封面封底不含姓名。原始时间轴与声音合成仍按 180 秒工作，渲染器的署名数据为空。
