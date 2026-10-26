# 正片实现

安装与完整命令见项目根目录 `README.md`，制作思路见 `docs/WORKFLOW.md`。

- `src/core.js`：画布、字体、颜色、投影与基础图形。
- `src/math.js`：矩阵与数学参数。
- `src/manifest.js`：15 个故事拍及卡片、片尾的顺序与时长。
- `src/data.js`：字幕、四问、章节卡与署名。
- `src/stage.js`：网格、像、零空间、向量与解线。
- `src/ui.js`：表格、进度标记、矩阵卡与字幕。
- `src/sections.js`：按帧调度场景与事件。
- `src/main.js`：浏览器入口与 `window.renderFrame(f)`。
- `tools/filmctl.mjs`：关键帧、片段、章节与无声全片导出。
- `tools/score_v3.json`、`soundctl.py`、`audiosynth.py`：事件谱、合成与混流。
- `assets/voice/`：最终使用的 37 句配音。
- `QA.md`：审阅方法及三个修改示例。

渲染输出写入本目录下的 `out/` 和 `qa/`；正式可观看视频位于项目根目录的 `video/`。
