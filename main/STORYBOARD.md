# STORYBOARD — 分镜与预算 v0

> 上游：`OUTLINE.md` v3 的 15 拍（钩子 4 + 正章一 4 + 正章二 6 + 尾巴 1）。
> 本文件定：拍序、认知任务、舞台事件、布局、tracker、预算；不定精确帧号、运镜 keyframe、最终字幕。
> 时间单位：30 fps；目标 180 s / 5400 帧。
> 同步：C1B5 / C1B6 已合并为 C1B5B6；拍表、预算、tracker、domainState 均按 15 拍。

## 0. 状态与文档链

```
OUTLINE v3 (15 拍)
  → STYLE v1 (语法)
  → STORYBOARD v0 (本文件：拍 / 事件 / 布局 / 预算；已同步)
  → sections v1 (6 段事件集，带 initial 帧号；已实现)
  → 视觉 v3 (全片 5400 f)
  → TTS timing v1 / 配音 v2 (声音轮)
  → 声音定稿 → 重渲 / 混流
```

- 结构：Hook 4 拍 + Ch1 4 拍 + Ch2 6 拍 + Coda 1 拍 = 15 拍（C1B5 / C1B6 已合并为 C1B5B6）；6 个 section；6 个布局（L0–L5）。
- 本版只冻结构、事件集、布局、预算；不冻帧号。
- Coda 已确定保留；屏幕只写“另一个 2+1 矩阵”，`J3(0)` 是内部叫法。
- 0+3 已补为 C2B4。
- 数学参数（A/B/C/b/b′/x_p/J3）见 `MATH.md`；sections 只引用，不另造数。

## 1. 全局

- 画布 1920×1080 / 30 fps / 5400 帧 / 180 s。
- 字幕承担叙事骨架；配音为逐句云扬（`TTS_TIMING.md`），字幕窗仍按 3.0–3.5 字/秒设计。
- 每拍最多一次相机运动；文字 / UI 不随相机。
- 章节卡保留 2×54f；文案已定；S4→S5 另加 72f Extra 卡（`Extra / 请思考`）。
- 片尾只留 60 f credits 卡；原 72 f 片尾黑场改为 Extra 卡，总长仍是 5400 f。

## 2. 预算总表

| 块 | 拍数 | 布局 | 目标 | 字幕预算（字） |
|---|---:|---|---:|---:|
| S0 Hook | 4 | L1→L2→L3 | 28 s / 840 f | 84–98 |
| S1 四问一答 | 2 | L1 | 34 s / 1020 f | 102–119 |
| S2 方程 | 2 | L1 | 37 s / 1110 f | 111–129 |
| S3 表 | 4 | L4 | 35 s / 1050 f | 105–122 |
| S4 和与定理 | 2 | L4→L3 | 23 s / 690 f | 69–80 |
| S5 Coda | 1 | L5 | 15 s / 450 f | 45–52 |
| **Beats 小计** | **15** | — | **172 s / 5160 f** | **516–600** |
| 章节卡 | 2 张 | L0 | 3.6 s / 108 f | 0 |
| Extra 卡 | 1 张 | L0 | 2.4 s / 72 f | 0 |
| 片尾 credits | — | L0 | 2.0 s / 60 f | — |
| **合计** | — | — | **180 s / 5400 f** | **516–600** |

> S1 v2 实际 84 字，低于 102 的预算；靠屏幕图例、公式和 Hold 承担信息，已接受。

- 目标不是锁；`sections v1` 的估计会在 ±10–15% 内移动，最后必须回到 5400。
- 章节卡是 108 f **实际成本**；卡保留时不做 shrink/flatten；无卡 fallback 才省下换景时间，回 reserve。
- Extra 卡 72 f 是 S4→S5 的实际成本；它替代原来的 72 f 片尾黑场，所以总长仍是 5400 f。
- 字幕预算不含片名卡副题、章节卡标题、表内数字。

## 3. 拍表（15 拍）

| ID | 拍 | 认知任务 | 舞台事件（一行） | Layout | Tracker | 目标 s / f | Section |
|---|---|---|---|---|---|---|---|
| H1 | 塌 | 看见“失去”，但不知道失去了什么 | 坐标系出左；A 右中；q 网格塌到 z=0；cyan 零空间直线 120–130 淡入 + 7 个零空间点随塌落原点；A 只留 A | L1 | — | 9 / 270 | S0 |
| H2 | 四问 | 把四个问题摆出来 | 30 f stage-shift 到中央；四问 300/330/360/390 依次出；矩阵卡淡出 | L2 | full | 9 / 270 | S0 |
| H3 | 承诺 | 四个问题问的是同一件事 | 承诺 hover 卡；四问不 dim；不 dock、不回左；保持 L2 居中 | L2 | — | 6 / 180 | S0 |
| H4 | 片名 | 给片名 | 片名“秩与零”+ 副题；舞台 / 矩阵退 ghost | L3 | behind | 4 / 120 | S0 |
| C1B1 | 命名 + 维数 | 像 / 零空间；2+1 维；回答 Q1 | 入口网格补亮；面 .4 + 线框；线 4.0/3.0；一次只亮一个；`2+1` 进 Q1 | L1 | ① | 12 / 360 | S1 |
| C1B2 | 向量 | 三列相关；a3=a1+a2；回答 Q2 | 恢复 + 坍塌；a3=a1+a2；公式回放；`共面` 进 Q2；不演 b′ | L1 | ② | 22 / 660 | S1 |
| C1B4 | 解 | b 在像上 → 解是一条线 | b 在像面走三下；倒放 q-grid；x 拖出半根解线；hold 两端长到零空间长（可见段上移 0.5）；正放线/点落 b，解线 ghost 改虚线留到段尾；去标签 | L1 | ② | 15 / 450 | S2 |
| C1B5B6 | 无解 → 可逆 | A 够不到 b′；同一个 b′ 在 B 下有唯一解 | b′ 抬起 + 侧视坍塌（③）；换 B；倒放找 x（④）；矩阵卡 A→B | L1 | ③④ | 22 / 660 | S2 |
| C2B1 | 满秩 | 表第一列：满秩 | 第一行矩阵数字 + 第二行 icon；右栏 3/0；四问 compact | L4 | compact | 9 / 270 | S3 |
| C2B2 | 秩2 | 第二列：秩2矩阵 | 矩阵数字 + 面/线 icon；右栏 2/1 | L4 | compact | 8 / 240 | S3 |
| C2B3 | 秩1 | 第三列：秩1矩阵 | 矩阵数字 + 线/面 icon；右栏 1/2 | L4 | compact | 9 / 270 | S3 |
| C2B4 | 零 | 第四列：零矩阵 | 矩阵数字 + 点/整块 icon；右栏 0/3 | L4 | compact | 9 / 270 | S3 |
| C2B5 | 求和 | 和不变 | 第三行 3+0=3 / 2+1=3 / 1+2=3 / 0+3=3 逐列；和行 amber；表满；字幕 | L4 | done | 10 / 300 | S4 |
| C2B6 | 定理 | rank + nullity = n | 表 ghost；和行亮；公式从和行浮出；定理 hold | L4→L3 | done | 13 / 390 | S4 |
| D1 | 同一个 2+1 | 同 2+1，不同命运；留问题 | 三拍作用；ghost 3D 网格每拍塌到 P（对照）；solid A 面不变 / M 面→线→点；列 e_i→a_i；cyan 零空间直线→面→体；底部 A/M 数值标签；问题；credits | L5 | off | 15 / 450 | S5 |

## 4. Tracker schedule

| Beat | 状态 | Token / 备注 |
|---|---|---|
| H2 | full | 四问出现；未答 |
| H3 | — | 承诺卡后保持居中，不再 dock |
| H4 | behind | 片名卡期间隐藏 / 在卡后 |
| C1B1 | ① answered | “2+1” |
| C1B2 | ② answered | “共面” |
| C1B4 | ② | 解线上 b；第三问尚未完成 |
| C1B5B6 | ③ → ④ answered | “b 在像上”（f2609）→ “A 降了一维”（f2939） |
| C2B1 | compact | 四问收成 2×2；表开始 |
| C2B5 | done | 和行出现；tracker 完成 |
| D1 | off | Coda 不再套 tracker |

- ① 在 C1B1 末亮；② 在 C1B2 末；③④ 都在 C1B5B6 内（③ f2609、④ f2939）。一次一拍，不批量亮。
- 已答色用 amber；不用绿色。

## 5. 转场表

| 边界 | 类型 | 默认 | 备注 |
|---|---|---:|---|
| H1→H2 | stage-shift | 30 f | 舞台左→中；矩阵淡出；Q1 在最后 6 f 淡入 |
| H2→H3 | promise overlay | 24 f | 承诺卡 in 24 / out 24；不移动舞台、不 dock；四问保持 full |
| H3→H4 | dip | 18 f | 片名卡；保持居中到 f0719 |
| H4→S1 | L0 card | 54 f | 12 in + 36 hold + 6 out；12f in 就是转场，不再另算 dip |
| S1→S2 | crossfade | 20 f | S1/C1B2 → S2/C1B4；`共面` 落位后直接接方程 |
| S2/C1B4→C1B5B6 | crossfade | 14 f | 同一 L1；b、虚线解线、`Ax=b` 卡连续 |
| S2→S3 | L0 card | 54 f | 12 in + 36 hold + 6 out；卡保留时不做 shrink；无卡 fallback 才用 shrink/flatten |
| S3→S4 | continuous | — | 和行直接接第四列 |
| L4→L3 | overlay | 12–18 f | S4 E07；表 ghost 保留，定理卡浮出 |
| S4→S5 | dip + card | 24 + 72 f | 定理卡 → Extra 卡；卡 12 in / 12 out；卡后接 Coda fade 30 f |
| S5→end | credits | 60 f | f5340–5399；credits 卡淡到黑，无额外黑场 |

- 卡保留时，S2→S3 不做 shrink/flatten，卡就是换景；无卡 fallback 才用 shrink/flatten。
- 卡保留时，C2B1 不再做“舞台→icon B”，改为表 grid + B cell 就位；无卡 fallback 才做 shrink/flatten。
- 章节卡是 108 f 实际成本，不是被 shrink 抵消；无卡 fallback 才省下换景时间，回 reserve。
- 全黑只用于 Act 边界 / 片名 / 定理；拍内“熄灭”用 ghost 0.15。

## 6. 层图（常驻对象）

| Actor | S0 | S1 | S2 | S3 | S4 | S5 |
|---|---|---|---|---|---|---|
| Stage / q-grid | on | on | on | icon | ghost | split |
| 像面 | collapse | on | on | icon | ghost | on |
| 零空间 / 解线 | — | on | on | icon | — | on |
| 矩阵卡 | A | A | A→B | — | — | — |
| Tracker | full | docked + ① | ②③④ | compact | done | off |
| Table | — | — | — | build | sum→ghost | — |
| 字幕 | on | on | on | on | on | on |

- 这张图的用途：检查谁和谁同时在场、哪里有空拍；具体事件在 sections v1 展开。

### 6.1 domainState（定义域状态）

| 段 | domainState | 备注 |
|---|---|---|
| H1 | full3D → collapsed | ghost cube = 3D 定义域；琥珀平面 = 压平后的像 |
| S1 C1B1–B2 | ghost3D + collapsed image | 3D ghost 立方体 + 平面像；不是“只剩一张纸” |
| S1 C1B2 | ghost3D + collapsed image + basis | 基向量从 3D 定义域出现；列落在像面 |
| S2 C1B4 | flat image → full3D ghost → flat | 回看 A 时 3D ghost 回来；正放后回到平面 |
| S2 C1B5B6 | A 段 flat image + b′；B 段 full3D | b′ 从像外抬起；A→B 是 30 f reset（不是硬切）；B 的形变在 full3D |
| S3 | icon | 无 stage；icon 的 cube 是 domain frame |
| S4 | table ghost | stage 不在；表 ghost |
| S5 | split + ghost/solid | 左 A 面不动；右 M 面→线→点；ghost 3D 每拍塌到 P；右零空间直线→面→体；左 A 零空间横穿像面 |

- 这张表解决“ghost 是 3D 还是压平像”的歧义；sections v2 按此实现。


## 7. 章节卡

| 卡 | 位置 | 帧 | 工作标题 | 状态 |
|---|---|---:|---|---|
| 01 | S0→S1 | 54 f | 四问一答 / 留下与压掉 | 保留；已定 |
| 02 | S2→S3 | 54 f | 变与不变 / 秩与零度，和不变 | 保留；已定 |
| Extra | S4→S5 | 72 f | Extra / 请思考 | 新增；替代 72 f 片尾黑场 |

- 格式在 `STYLE` L0；文案在 `sections` / 时间锁时定。
- Extra 卡不算章节卡，也不占 15 拍；它是 Coda 前的 L0 停顿。
- 若 animatic 后节奏不需要整屏卡，降级为 L1/L4 角落小标题（22 px mono，2 s），不占 54 f。

## 8. Sections v1 要产出的东西

sections v1 已产出（`sections/`，帧号按 `manifest.js` 实现），直接带 **initial 帧号**：是初始参数，不是锁。

每个 section 一份文档，包含：

- 头部：section、beats、layout、entry / exit state、initial 帧范围。
- 事件表：`id | 帧 | beat | actor | action | 字幕 | camera / transition | tracker / QA`。
- v2 再把 camera / transition 拆开，并补 `from→to`、`layer`；现在先保持 initial 表可读。
- 字幕表：帧、文本、字数；字幕帧可跨事件，以字幕表为准。
- `## 公式` 表（若有）。
- 转场 in / out。
- 未决项。

约束：

- **帧号是 initial**：可以直接写绝对帧号，但不算锁；animatic 后统一调。
- 事件集要内容完整：每个视觉变化、字幕、camera intent、tracker / table 更新都要有。
- 字幕帧可跨事件；事件表只标归属，实际 in/out 看字幕表。
- camera intent 只写“推 / 拉 / 保持 / 跟到哪”，不写 keyframe。
- 每拍至少 2 个 QA 帧：事件前 / 事件后；长拍加 hold。

## 9. 本版不包含

- 精确帧号：本文件只到拍与预算；帧号在 sections v1（已按 `manifest.js` 实现）。
- 相机 keyframe、逐拍 `origin / scale` 取值。
- 字幕措辞的逐字修订：以 `sections/` 与 `data.js` 为准。
- Cover、声音 cue：见 `TTS_TIMING.md` / `film/AUDIO.md`。
- 公式的最终排版细节（只在 sections 的 `## 公式` 表登记）。

## 10. 待拍板 / 备注

- 目标时长：先按 172 s 试跑；animatic 后再调，不现在锁死。
- C1B5B6 已合并并回写（660 f，f2364–3023，A 无解 → B 唯一解）；故事拍 15；`sections/s2_b5b6_draft.md` 只留作过程稿。
- 字幕：sections 当前合计约 418 字（S0 63 / S1 84 / S2 76 / S3 83 / S4 66 / S5 46；含标点口径，`filmctl check` 去标点为 396），低于 516–600 预算；S0/S1 靠屏幕字和画面承担信息，暂不补。
- ID 口径：sections 用 `S2-1…S2-11`（撤销的条目留空号）；`TTS_TIMING` 用连续的 `S2-01…S2-09`；两者按句子次序对应，改字幕时不要混号。
- 章节卡：已保留 2×54f；文案已定；若 animatic 后节奏不需要，降级角落小标题。
- Cover：平台封面不占片长；片头卡就是 H4；若要另加 2s 片头，从 4.4s reserve 出，仍够。
- 片尾：f5340–f5399 的 2 s credits 卡已上屏（标题 / 线 / 匿名版留空）；不再有额外黑场；不占 Beats。
- Extra 卡：f4818–4889 的 2.4 s L0 卡（`Extra / 请思考`）；不占 Beats。
- v2 校准：卡面 surface、L0 线色、卡成本、min/target/max、事件表 camera/transition 拆列、标签字号、有限边缘、预算裕量；见 `STYLE §12.1`。

## 11. 下一步

```
OUTLINE v3 (15 拍)
  → STYLE v1 (语法；H3 / 相机已同步)
  → STORYBOARD v0 (本文件，已同步)
  → sections v1 (S0–S5，已实现)
  → 视觉 v3 (全片 5400 f 已渲)
  → TTS timing v1 + 配音 v2 (声音轮)
  → 声音定稿 → 重渲 / 混流
```
