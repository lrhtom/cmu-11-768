# CollabSkill: Evaluating Human-Agent Collaboration On Real-World Tasks（CollabSkill：在真实职业任务上评测人和智能体的协作）

> Yijia Shao、Zora Zhiruo Wang、Neel Ahuja、Yicheng Wang、Bowen Liu、Diyi Yang（斯坦福、卡内基梅隆、罗切斯特大学、独立研究者）。COLM 2026（PDF 页眉），arXiv 2606.09833v2（2026-07-25；v1 2026-04-20）。DOI 10.48550/arXiv.2606.09833。全文 28 页已读完（`paper.pdf` / `fulltext.txt`）。

---

## 中文：通俗版说明书

### 一句话概括
想知道"哪个 AI 智能体最会和人一起干活"，不能只看智能体单干的分，也不能简单按智能体求平均（谁碰上了高手谁占便宜）。这篇让 93 位真实从业者配不同的智能体做真实的职业任务，再用一个像游戏天梯的贝叶斯评分系统，把"人的本事"和"智能体的本事"拆开算，得出和单干榜单不一样的排名。

### 问题从哪来
- 现在评测职业任务的基准（GDPval、APEX 等）几乎都评"智能体自己干"。可"单干强"不等于"会帮人"，结果还受人的 AI 素养、模型的协作行为、交互设计影响。
- 评协作更难：常见做法是用 LLM 扮演用户，但模拟用户过度配合、风格单一、没有真实的挫败感，也看不出真人怎么用。用真人的研究又多是简单任务或只做网页导航。
- 还有一个统计问题：协作得分混着人和智能体两边的本事，人和人差别很大，直接按智能体求平均，排名不可靠。

### 怎么做的
1. **收数据的基础设施**：
   - 统一的任务格式 TaskInstance：自然语言提示、隐藏的评分信息（标准答案、领域知识）、参考文件、需要的软件、要交的东西，并打上 O*NET 职业标签，方便按职业背景给人配任务。
   - 任务来自三个公开数据集：GDPval（44 个职业的 220 个任务）、APEX（投行、咨询、法律、初级医疗）、APEX-Agents（要跨应用操作、参考文件多）。共 165 个不同任务，覆盖 20 个职业门类里的 10 个。
   - 在 Upwork 招美国从业者，每完成一个任务给 20 美元，建议做 5 个；排名前三另有奖金。按职业背景匹配任务，再随机配一个智能体，给安装说明和教程视频，人在自己电脑上和智能体一起完成任务，交成果和交互记录。
   - 五个智能体：三个终端里用的 Codex（gpt-5.2-codex-medium）、Gemini CLI（gemini-3-auto）、Claude Code（claude-sonnet-4.6）；Claude Cowork（同一个 claude-sonnet-4.6，图形界面，为非开发者设计）；Manus（manus-1.6-lite，浏览器里用）。
   - 最终 93 人、386 次会话、1,500 多条提示，会话时长中位数 76.7 分钟；平均职业经验 9.6 年；76 人填了前后两份问卷。
2. **自动打分（不需要标准答案）**：
   - 先让一个智能体（无头模式的 Gemini CLI）读任务和参考文件，生成 JSON 格式的 rubric，分四类：正确性与准确性 40 分、完整性 20 分、任务要求 25 分、技术质量 15 分。每条标准写明分值、期望值、怎么核对。
   - 再请两个不同家族的评审（Gemini CLI 和 Claude Code）各自按 rubric 给 0–100 分，取平均。用不同家族是为了减轻"评审偏爱自家输出"的偏差。
   - 验证：和 GDPval 后来公开的官方人写 rubric 比，在 27 个任务上召回 82.1%（1,216 条官方标准覆盖了 998 条）、精确 92.2%（322 条生成标准里 297 条有官方依据），作者认为生成的 322 条都重要。在 135 对（任务，成果）上，自动打分和官方 rubric 打分的相关系数 r = 0.72（去掉 3 对离群），全部算是 0.66。
3. **把分数拆成人和智能体两部分**（第 4 节、附录 F）：
   - 每次得分 y = s_A（智能体本事）+ s_H（人的本事）+ 噪声 ε。每个智能体、每个人都有一个高斯分布的"本事"，初始 N(0, 1)。
   - 来一条新观测，就用卡尔曼滤波的测量更新：预测误差 r = y − xᵀm（这次比预期高多少），增益 K = Σx / (xᵀΣx + β²)，新均值 m′ = m + K r，方差也随之缩小。得分超预期时两边都上调，谁的不确定性大谁调得多。
   - 关键是"配对图要连通"：同一个人用过不同的智能体，分差才能归到智能体身上；随机配对自然满足。规模大时用信息形式（稀疏矩阵）更新，再用 Hutchinson 估计器算方差。
   - 排名用保守分 μ − 3σ（约正态 1% 下分位），观测少、不确定的会被压低。附录 G：直接按智能体平均，顺序其实一样，但每个智能体标准差都超过 19，得不出统计结论。
4. **人的一侧**：前后测问卷（按技术接受模型设计）：LLM 熟悉度、工作中用不用、对智能体的熟悉度、信任、授权意愿、觉得 AI 能做到哪一级自主（人类能动性量表 HAS 的 H1–H5）、希望到哪一级、担不担心工作变得没意义、对智能体的情绪。还用 Anthropic 的"AI 熟练度"11 种行为给交互记录编码（gemini-3-pro 标注）。

### 关键结果（数字全列）
**智能体排名（表 2）**：Claude Cowork 76.738（μ 77.206，σ 0.156）> Claude Code 74.778 > Codex 71.267 > Manus 71.204 > Gemini CLI 69.555。
**和单干对比（表 5）**：
| 智能体 | 协作 CollabSkill | 单干得分（同 165 个任务） | SWE-bench Verified | GDPval | SciCode |
|---|---|---|---|---|---|
| Claude Code | 74.778 | 77.17 | 71.40 | 42.5% | 46.8 |
| Codex | 71.267 | 78.02 | 72.80 | 49.7% | 54.6 |
| Gemini CLI | 69.555 | 79.44 | 69.60 | 40.3% | 56.1 |
- 三个终端智能体里，协作是 Claude Code 第一（p(Claude Code > Codex) > 0.999），而单干和三个公开榜单都是 Codex 领先 Claude Code：排名反转。
- 同一个模型，图形界面的 Cowork 排在终端的 Code 前面（p > 0.999）；只看自评熟悉智能体（≥4/7）的 81 人，Cowork 76.403 vs Code 74.349，结论不变。
- 稳健性：bootstrap 10,000 次，Cowork 71.3% 排第一（平均名次 1.36），平均 Kendall τ = 0.64，主要是 Codex 和 Manus 互换；留一人、留一任务，前两名和最后一名名次完全不变。
**人的一侧**：
- 和同一个智能体单干（研究者精心写的系统提示）比，协作本事前四分之一（Q4）的人 74% 的时候赢，后四分之一（Q1）只有 27%。
- 11 种 AI 熟练行为的总数和得分相关（Pearson r = 0.262）；6 种单独显著：说清输出给谁看（r = 0.345，有这条的会话 84.7 分 vs 68.1 分）、说明语气风格（83.9 vs 73.2）、给好结果的例子（82.8 vs 73.5）、设定交互方式（82.6 vs 74.9）、求助前先说清目标（79.8 vs 69.6）、指定格式结构（79.6 vs 71.1）。说话轮数和得分无关（r = 0.046）："怎么说比说多少重要"。Cowork 最能引出这些好习惯（平均 6.0/11 种）。
- LLM 熟悉度和协作本事正相关（Spearman ρ = 0.297；原文 p 值前后不一，引言 0.041、正文 0.010）；授权意愿也正相关（ρ = 0.238, p = 0.041）；其他态度类指标不显著。
- 合作后：信任 +0.58、授权意愿 +0.45；觉得 AI 能做到的自主程度往"更自主"挪（−0.50），但希望的自主程度没显著变化（−0.16, p = 0.105）。协作本事低的那一半人，信任涨得更多（+1.03 vs +0.16）、对 AI 自主能力的看法变得更多（−0.89 vs −0.13）。

### 结论
人机协作要专门评、专门优化，单干能力强不等于协作好；界面设计很重要；对雇主来说，员工对智能体的熟悉度能预测协作本事，好的协作能超过 AI 单干；对员工来说，亲手和智能体合作是提升 AI 素养的有效途径。

### 局限（论文自己写的）
- 只招了美国的 Upwork 用户，有选择偏差；386 次会话、10/20 个职业门类，样本还不够做细分分析，也不代表全部职业。
- 现成的用户模拟器在这种多模态、真动手的场景里用不上。
- 打分用 LLM 评审而非人工（人工太贵）；评分器还要继续改进。
- 加性模型没有把"会做这个任务"和"会协作"分开，只是一个起点。
- 伦理声明：估出来的人的分数只是本研究里 AI 素养的代理，别拿去筛选或评价求职者。

### (a) 这篇论文到底讲了什么
一个评测人机协作的框架：统一的任务格式 + 真实从业者 + 自动 rubric 评分 + 把团队得分拆成人和智能体两份本事的贝叶斯评分系统（卡尔曼更新、μ − 3σ 排名）。结果是协作排名和单干榜单不一样，界面影响大，人的"会用 AI 的习惯"比说话多少更关键。

### (b) 它对这份笔记有什么用
- 第 17 讲讲义第 39 页直接展示了它的 rubric 生成提示（40/20/25/15 四类），这一讲的笔记（第 10 章第 1 讲第 5 节）已经写过这个分配。第 19 讲没有讲义，笔记第 10 章第 3 讲用它写：
  - 第 7 节：模拟用户过度配合、风格单一、缺挫败感，在真实职业任务里用不上。
  - 第 8 节整节：为什么要把人和智能体的分拆开（代码例子用最小二乘示意"同一个人换了搭档"的分差）；数据怎么收；rubric + 两个不同家族评审的打分和验证数字；加性模型和卡尔曼更新公式；μ − 3σ；表 2 与表 5 的对比表；排名反转、界面的作用、稳健性；人这一侧的 74% vs 27%、6 种显著行为、轮数无关、熟悉度相关（注明 p 值原文不一致）、合作后的态度变化；局限和伦理提醒。
- 第 11 章第 1 讲（第 20 讲，重排序与评判模型）第 8 节的表格里，站内链接到第 19 讲第 8 节，用"换不同家族的评审交叉判、再平均"作为压住 LLM 评审自偏好的一种做法。第 20 讲本身不引外部文献，这里只是站内互链。

---

## English

**Summary.** CollabSkill evaluates human-agent collaboration on realistic occupational tasks. A unified TaskInstance schema (prompt, hidden evaluator info, reference files, software, deliverables, O*NET tags) pulls 165 tasks from GDPval, APEX and APEX-Agents (10 of 20 O*NET sectors). 93 U.S. Upwork workers (avg. 9.6 years' experience, $20/task) were matched to tasks by background and randomly paired with one of five agents (Codex, Gemini CLI, Claude Code, Claude Cowork, Manus), yielding 386 sessions and 1,500+ prompts. Deliverables are scored reference-free: an agent generates a 4-category rubric (40/20/25/15), and two judges from different model families (Gemini CLI, Claude Code) score and are averaged to mitigate self-preference (rubric recall 82.1%, precision 92.2% vs. official GDPval rubrics; score correlation r = 0.72 / 0.66). Outcomes are modeled as y = s_A + s_H + ε with N(0,1) priors and Kalman updates; agents are ranked by μ − 3σ. Claude Cowork (76.738) > Claude Code (74.778) > Codex (71.267) > Manus (71.204) > Gemini CLI (69.555): Claude Code beats Codex in collaboration though Codex leads in solo/leaderboard settings, and the GUI agent beats the terminal agent with the same model. Rankings are stable under bootstrap (Cowork first 71.3%) and leave-one-out. Top-quartile humans beat the solo agent 74% of the time vs. 27% for the bottom quartile; 6 of 11 AI-fluency behaviors correlate with outcomes while turn count does not; LLM familiarity correlates with collaboration skill (ρ = 0.297; p reported as 0.041 in the intro and 0.010 in §6.2); collaboration raises trust and perceived AI autonomy but not desired autonomy.

**Limitations:** U.S. Upwork sample only; 10 of 20 sectors; limited power for subgroup analysis; LLM judges instead of human graders; additive model does not separate task skill from collaboration skill; individual skill estimates should not be used for employment decisions. Internal inconsistency in the reported p-value noted above.

**Claim-by-claim check (claims used in c10.html lecture 3 and c11.html lecture 1):**

| Claim in notes | Paper evidence | Verdict |
|---|---|---|
| c10 §7: LLM user simulators are over-cooperative, uniform, lack realistic frustration; off-the-shelf simulators not usable in this multimodal occupational setting | §1 (p.2); Limitations (p.16) | supported |
| c10 §8: 93 U.S. Upwork workers, 9.6 yrs avg, $20/task; 165 tasks from GDPval/APEX/APEX-Agents, 10 sectors; background matching + random agent pairing; 386 sessions, 1,500+ prompts; median 76.7 min; five agents incl. Cowork sharing Claude Code's model | §3.1, §3.3, Tab. 1 (pp.4–5); Limitations (p.16) | supported |
| c10 §8: Rubric categories 40/20/25/15; two judges from different families averaged to reduce self-preference; recall 82.1%, precision 92.2%; r = 0.72 (excl. 3 outliers) / 0.66 over 135 pairs | §3.2 (p.5); Fig. 7 (p.19); App. I (p.26) | supported |
| c10 §8 code: least-squares split of team scores | not from paper | illustrative simplification, labeled 示意 (paper uses Bayesian/Kalman) |
| c10 §8: y = s_A + s_H + ε; N(0,1) priors; Kalman update r, K, m′; larger update for more uncertain entity; connectivity; μ − 3σ ≈ 1% lower quantile | §4 (pp.6–7) | supported |
| c10 §8: Tables 2 and 5 numbers; Claude Code first among terminal agents while Codex leads solo and on leaderboards; Cowork above Code; unchanged for 81 familiar users; bootstrap 71.3%; leave-one-out stability; naive averaging same order but σ > 19 | Tab. 2–5 (pp.8–9); §1 (p.2); App. G (p.24) | supported |
| c10 §8: Q4 74% vs Q1 27%; 6 of 11 behaviors significant; audience 84.7 vs 68.1; turns r = 0.046; LLM familiarity ρ = 0.297 with inconsistent p (0.041 / 0.010); attitudes mostly not significant; trust up, perceived autonomy up, desired autonomy unchanged | §6.2 (pp.9–10); §1 (p.2); App. J (p.27) | supported |
| c10 §8: Limitations (U.S. Upwork, 10/20 sectors, LLM judges, task vs collaboration skill not separated); don't use scores to screen workers | Limitations (p.16); Ethics (p.11) | supported |
| c11 §8 table: cross-family judges averaged to counter self-preference (internal link to c10 §8) | §3.2 (p.5) | supported |
