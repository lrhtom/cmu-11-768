# Tree Search for Language Model Agents（语言模型智能体的树搜索）

> Jing Yu Koh、Stephen McAleer、Daniel Fried、Ruslan Salakhutdinov（都在卡内基梅隆大学）。TMLR 2025 年 9 月正式发表；本项目读的是 arXiv 2407.01476 的 v3（2025-09-24，就是 TMLR 正式版，26 页，含附录）。DOI 10.48550/arXiv.2407.01476。全文 26 页已读完，读的是 `paper.pdf` / `fulltext.txt`。

---

## 中文：通俗版说明书

### 一句话概括
让网页上干活的 AI 智能体"别走一步算一步"：每走一步之前，先在真实的网站里试走好几条路，用另一个模型给每个走到的页面打分，挑分最高的那条路再真正走下去——就像下棋前先在脑子里推几步，只不过这里是真的在网站上点一点、走不通就退回来。

### 问题从哪来
- 现在的网页智能体（让大语言模型看网页、决定点哪里、输入什么）还远不如人。论文里给的数：在两个很真实的网页测试集 WebArena 和 VisualWebArena 上，人能做成 78% 和 89% 的任务，智能体通常不到 20%。
- 作者认为一个大短板是：智能体**只会一步一步往前走**。每一步只看当前页面就决定下一个动作，走错一步，后面越错越远（错误会累积），而且一旦进了坏页面就很难回头。
- 下棋、围棋、扑克这些游戏里，"搜索"（把可能的走法展开成一棵树、评估、剪掉差的）是让 AI 超越人类的关键手段。但网页任务和游戏不一样：一页上能做的动作非常多，而且**没有明确的输赢信号**——做到一半时你不知道自己离成功有多近。

### 怎么做的
1. **底座不变**：用现成的、靠提示词驱动的网页智能体（比如 GPT-4o 看带编号标框的网页截图，或者 Llama-3-70B 读网页的无障碍树文字）。搜索算法套在它外面，不需要重新训练模型。
2. **价值函数（给页面打分的"裁判"）**：再用一个多模态大模型，给它看任务说明、到目前为止的几张截图、做过的动作和当前网址，让它判断：成功了（记 1 分）、失败了（0 分）、还没成但看起来在正轨上（0.5 分）。为了让分数更细、更稳，同一个问题让它独立想 20 次（每次都先写推理再给结论），把 20 个分数平均——这叫"自一致"。所以最后的分数是 0 到 1 之间的一个数。
3. **最佳优先树搜索**（有点像 A* 搜索）：
   - 有一个"待探索清单"（叫 frontier，是一个按分数从高到低排的优先队列）。
   - 每一轮：从清单里拿出分最高的那个页面状态 → 让裁判给它打分 → 如果这个分是目前最好的，就记下来 → 如果分数已经够高（超过阈值 θ，说明大概率已经成功），或者已经展开了 c 个节点（预算用完），就停下 → 否则如果这条路还没到最大深度 d，就让智能体对这个页面提出 b 个候选动作，逐个真的执行，得到 b 个新页面，放进清单（先用父页面的分数排队，不马上打分，省得来回折腾）。
   - 候选动作怎么来：让模型对同一页面生成 20 次输出，数一数每个动作出现几次，取最多的前 b 个。
   - 搜索结束后，走到搜到的最好页面，把那一段动作真正执行掉，然后从新的位置再开始下一轮搜索。
4. **怎么"回溯"**：网页没有"存档读档"。作者的办法是记住到达每个状态需要的整串动作；要回到某个状态，就把环境重置到起点（通常是首页），再把那串动作从头重新执行一遍。不用浏览器的"后退"按钮，因为后退会丢掉滚动位置和已经填进输入框的文字。
5. **实验设置**：深度 d = 5、分支 b = 5、预算 c = 20，每个任务最多真正执行 5 个动作（受算力和费用限制）。动作采样用 nucleus 采样，温度 1.0、top-p 0.95；裁判采样温度 1.0、top-p 1.0。全部 910 个 VisualWebArena 任务和 812 个 WebArena 任务都跑了。

### 关键结果（数字全列）
**主结果（表 2）**

| 测试集 | 智能体 | 不搜索 | 加搜索 | 相对提升 |
|---|---|---|---|---|
| VisualWebArena | GPT-4o + 标框截图（SoM） | 18.9% | **26.4%**（当时最好） | +39.7% |
| VisualWebArena | Llama-3-70B + 图片说明 | 7.6% | 16.7% | +119.7% |
| WebArena | GPT-4o（只看文字） | 15.0% | 19.2% | +28.0% |
| WebArena | Llama-3-70B | 7.6% | 10.1% | +32.3% |

注意：表里"不搜索"这一列是最多执行 5 步的结果；同一篇论文里列的别人的方法最多走 30 步（比如 GPT-4o + SoM 30 步是 19.8%）。作者强调：自己限制 5 步加搜索，还是比不搜索走 30 步强。WebArena 上别的方法（比如 AgentOccam 45.7%）分数更高，作者说那些是针对网站的专门技巧，和搜索不冲突、可以叠加。

**附录表 8 的补充**：用开源的 LLaVA-1.6-34B 当裁判时，Llama-3-70B 智能体 7.6% → 13.5%（+77.6%），全开源可复现；Llama-3.1-70B 9.1% → 16.2%（+78.0%）；GPT-4o-mini 自己当智能体也当裁判：9.1% → 14.4%（+58.2%）。

**消融（在 200 个 VisualWebArena 任务的子集上，GPT-4o 智能体）**
- 搜索预算 c：0（不搜）24.5%，5 → 32.0%（+30.6%），20 → 37.0%（+51.0%）。预算越大越好。
- 深度和分支（预算都是 20）：d=1,b=3 26.0%；d=1,b=5 32.0%；d=2,b=3 31.5%；d=2,b=5 35.0%；d=3,b=5 35.5%；d=5,b=5 37.0%。两个都要放大才强。
- 裁判换人：LLaVA 30.0%；GPT-4o 不做自一致 28.5%；自一致 5 次 32.5%；20 次 37.0%；直接用测试集的真实成败（只有 0/1）43.5%——说明裁判再好一点还有很大提升空间，自一致非常关键。
- 和"整条轨迹重排序"比：采 n 条完整轨迹、用同一个裁判挑最好的，约 7 条时走平在 30%；树搜索 c=5 时就有 32.0%，c=20 是 37.0%。c=5 和 n=5 算力差不多。
- 按难度（表 5，全量 VWA，GPT-4o）：简单 34.2% → 42.3%（+24%）；中等 12.7% → 22.2%（+75%，提升最大）；困难 10.2% → 14.9%（+47%）。作者推测深度 5 正好适合中等任务，困难任务要更深的树。
- 按网站（表 6、7）：VWA 分类广告 18.4 → 26.5、Reddit 17.1 → 20.5、购物 20.0 → 29.0；WA 内容管理 11.0 → 16.5（+50%）、地图 21.1 → 25.8、购物 24.0 → 28.1、Reddit 7.9 → 10.5、GitLab 10.2 → 13.3。

**定性例子**：VWA 购物任务 #256（把同一品牌两种罐装水果加入对比清单）——不搜索的智能体加了第一个以后跑回首页就乱了；搜索版本探索、回溯后找到"加第一件 → 搜索 → 加第二件"的成功路线。分类广告任务 #48（找一张特定图片的帖子）——每步都执行第一次采样到的动作会失败，搜索能试多种可能。附录里 WA 任务 #14：没找到满分页面、预算用完时，选了当时最高的 0.68 那条路，结果是对的——裁判不必完美也能帮上忙。

### 结论
在真实网页环境里做推理时搜索是有效的：同一个模型、不重新训练，只是在执行时多花算力去探索和回溯，成功率就明显上升，而且算力（预算）越多越好。作者说这是第一次在真实网页环境上展示树搜索能显著提升语言模型智能体。

### 局限（作者自己写的）
- **慢**：c = 20 时每轮最多要多 20 倍的模型调用；重置再重放动作也很花时间。实际部署要权衡 b、d、c。
- **破坏性动作**：真实网站上下单、删东西是不能撤销的，搜索时必须限制。可以加一个分类器预测哪些动作危险、不展开它们；也可以把这个约束直接放进价值函数；或者训练一个"世界模型"在模拟里搜。代码、Excel 这类能撤销的场景更适合搜索。
- **裁判是为网页定制的**：看截图和浏览历史；换到软件工程智能体可能要换成看代码执行轨迹等。
- 只测了比较简单的提示词智能体；最多 5 步让一些需要 10 步以上的困难任务根本做不完。
- 价值函数很依赖图像，这可能是它在多模态的 VWA 上比纯文字的 WA 更有效的原因之一。

### 原文前后不一致的地方（原文如此）
- 正文把"目前最好分数"初始化为 0、更新条件写"严格大于"；附录算法 1 初始化为负无穷、条件写"大于等于"。
- 表 2 里 SteP 是 33.5%，附录表 8 里 SteP 写成 35.8%（表 2 里 35.8% 是另一行 GUI-API Hybrid Agent）。
- 摘要里有个笔误 "kenvironmental"。

### (a) 这篇论文到底讲了什么
一种"边走边试"的推理方法：把网页智能体每一步的决策变成一次小型的最佳优先树搜索——在真实网站里展开候选动作、用一个会给页面打 0–1 分的多模态模型当裁判、靠"重置 + 重放"回溯，最后挑最好的路走。它证明了在测试时多花算力搜索，能让现成的智能体明显变强。

### (b) 它对本项目（CMU 11-768 中文笔记）有什么帮助
- 课程第 21 讲"搜索 2：树搜索"由 JY Koh 主讲（11 月 17 日），他就是这篇的第一作者，第二作者 Daniel Fried 是本课主讲老师之一。课还没上、讲义还没发，所以先用这篇论文写"树搜索"那一节，等录像和讲义出来再补讲师的说法。
- 用在：第 11 章第 2 节的正文（问题、算法、价值函数、回溯、结果、消融、局限）和一个动画演示（最佳优先搜索的待探索清单怎么变、裁判打分怎么平均、回溯怎么重置重放）。演示里的玩具网站和分数是示意；论文里的数（d=5、b=5、c=20、20 次自一致、各表的成功率）照原文。
- 和前面几章的联系：第 3 章（规划、长程任务里错误连乘）、第 4 章（电脑操作智能体和 VisualWebArena 的评测）、第 6 章（价值函数、评论家）都能在这里对上。

---

## English

**Summary.** The paper adds an inference-time, best-first tree search on top of prompt-based web agents. A multimodal LM value function scores each visited state in [0, 1] (success 1, failure 0, on-track 0.5, averaged over 20 self-consistent CoT samples). At each step the search pops the highest-priority state from a max-priority frontier, scores it, keeps the best state, stops when the value reaches θ or the budget c is exhausted, and otherwise expands b candidate actions (the top-b most frequent among 20 sampled outputs) if the depth limit d is not reached; children are enqueued with the parent's value. Backtracking resets the environment and replays the action sequence. With d = 5, b = 5, c = 20 and at most 5 executed actions, search lifts GPT-4o+SoM on VisualWebArena from 18.9% to 26.4% (+39.7%) and GPT-4o on WebArena from 15.0% to 19.2% (+28.0%); ablations show gains grow with budget, depth and breadth, depend strongly on value-function quality (ground-truth reward gives 43.5% vs 37.0%), and beat trajectory-level reranking.

**Limitations.** Slow (up to 20× more LM calls at c = 20, plus reset/replay overhead); destructive actions must be restricted for real deployment; the value function is web-specific and heavily visual; only simple prompt-based agents and a 5-action cap were tested. Internal inconsistencies: initial best value (0 in §3.3 vs −∞ in Algorithm 1) and the SteP number (33.5% in Table 2 vs 35.8% in Table 8).

**Claim-by-claim check (claims used in the notes):**

| Claim in notes | Paper evidence | Verdict |
|---|---|---|
| Best-first tree search in the real environment, guided by a value function, with backtracking | p.1 abstract; p.2 Fig. 1; §3.3; Alg. 1 | ✅ supported |
| Value v = f_v(I, {o1..ot}) ∈ [0,1]; success/failure/on-track = 1/0/0.5; 20 CoT samples averaged | §3.2 (p.5); §4.1 (p.7) | ✅ supported |
| Hyperparameters d, b, c, θ; experiments d=5, b=5, c=20, ≤5 actions; top-b of 20 sampled outputs | §3.3 (p.5); §4.1 (p.6) | ✅ supported |
| Children enqueued with parent's value to save backtracking | footnote 2 (p.6) | ✅ supported |
| Main results 18.9→26.4 (VWA GPT-4o), 7.6→16.7 (VWA Llama), 15.0→19.2 (WA GPT-4o), 7.6→10.1 (WA Llama) | Table 2 (p.7) | ✅ supported |
| Ablations: c 0/5/20 → 24.5/32.0/37.0; value functions 30.0/28.5/32.5/37.0/43.5; reranking plateaus ≈30% at ~7 trajectories | Fig. 2, Tab. 3–4 (p.8); Fig. 3 (p.10) | ✅ supported |
| Difficulty breakdown easy/medium/hard | Table 5 (p.10) | ✅ supported |
| Backtracking by reset + replay because go_back loses scroll offset and typed text | §5.4 (p.12); App. A.4.1 (p.21) | ✅ supported |
| Limitations: slow, destructive actions, domain-specific value function | §5.4 (p.12) | ✅ supported |
| The course lecture "Search 2: Tree Search" (JY Koh) will follow this paper | Not in the paper; inference from the lecturer being first author and the course instructor being an author | ⚠ our own inference — stated as such in the notes, to be checked when the lecture is released |
