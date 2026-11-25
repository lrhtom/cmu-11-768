# Humans are Missing from AI Coding Agent Research（AI 编程智能体研究里缺了人）

> Zora Z. Wang、John Yang、Kilian Lieret、Alexa Tartaglini、Valerie Chen、Yuxiang Wei、Zijian Wang、Lingming Zhang、Karthik Narasimhan、Ludwig Schmidt、Graham Neubig、Daniel Fried、Diyi Yang（卡内基梅隆、斯坦福、普林斯顿、伊利诺伊香槟等）。arXiv 2608.12355v1，2026-07-04，立场论文（PDF 标题前有"Position:"）。DOI 10.48550/arXiv.2608.12355。全文 30 页已读完（`paper.pdf` / `fulltext.txt`）。本课第 19 讲讲者 Valerie Chen 是第 5 作者，本课两位主讲 Graham Neubig、Daniel Fried 也在作者里。

---

## 中文：通俗版说明书

### 一句话概括
编程智能体已经越来越能"自己把活干完"，可真正卡住大家用的，是人和它怎么配合：人说不清，它猜不准；它做的东西人看不懂、管不住、信不过。论文主张研究方向要从"更自主"转到"以人为中心"，并把人机协作拆成四件可以量化的事。

### 问题从哪来
- 现在的编程智能体研究几乎都在比"独立完成任务"：做更难的基准、更长的任务、更复杂的框架、更多能自动验证的训练环境。论文说大家把"基准有多难"当成了"实际有多有用"。
- 可真实的编程很少一次做完：要反复交互、只委派一部分、目标会变、人一直在盯着。论文认为一味追更难的任务，边际收益可能越来越小，真正的提升方向在人机交互上。
- 他们拿 SWE-bench Verified 举证（图 1 和附录 A）：
  - 只看"已解决"的题，把智能体的补丁和人写的标准补丁比长度（先去掉新增文件、非 Python 文件、测试文件的改动，算字符数之比）。所有模型都有超过 15% 的补丁长度是标准补丁的 1.5 倍以上；这个"臃肿度"和成功率基本没关系，越新的模型补丁反而越长。
  - 用 GPT-5 mini 和 Claude Haiku 4.5 当评审标注变长的原因：啰嗦的实现（多余的中间变量等）约 60%，扩大改动范围 50–65%，过度防御 20–30%，过多文档 20–30%，过度设计约 10%。
  - 更要紧的是"功能差异"：两个评审都认为和标准补丁行为有出入才算，所有模型都超过 50%（Haiku 标了 66%，GPT-5 mini 标了 62%，两者都标的 57%）。也就是说"过了测试"不等于"做的就是对方要的"，测试管不到的地方还有很多决定。
- 开发者调查（Stack Overflow 2025）：84% 的开发者在用 AI 编程工具，但近一半不信任输出，三分之二说半成品让调试更费劲。

### 怎么做的（四根柱子）
论文把"人 H、编程智能体 C、代码环境 T"之间的一圈交互拆成四件事，每件都给了一个能算的定义（图 2 用"做一个个人作品集网站"走了一遍）：
1. **对齐任务（task alignment）**：双方对"要做什么"的理解一致。用户心里的意图 z_H，智能体从指令里推出来的意图 z_C，看两者有多像：G = sim(z_H, z_C)（可以用余弦相似度、词重合度）。
   - 痛点"澄清螺旋"：模型一拿到任务就开写，没推断出没说出口的约束，做了错误假设；用户退回去补要求，又冒出新误解。现在多半是人迁就模型的说法。
   - 难点：编程对话比订酒店那种"填表"难得多，要引用代码、报错、文档，还有风格、架构这些默认期待。开放的人与编程智能体对话数据很缺；基准只报 pass@k，把沟通质量压成了一个比特。
2. **可引导（steerability）**：执行过程中，智能体能把关键决策点暴露出来，让人改方向。把轨迹切成段，每段末尾一个"控制点"（分支选择、确认提示）；量法是人在控制点插一句后，新轨迹和"该有的轨迹"有多像，还可以把智能体的切分和专家示范比。论文说自主程度不能是一个全局开关：同一个人有时想"给个方向你随便发挥"，有时要"精确改这一处"。现在的系统困在"全自主"和"时时盯着"两个极端之间。
3. **可验证（verification）**：人能不能准确判断产出对不对。量法是人的判断和真值的一致率 V。
   - 单元测试的问题：测试和代码都由 AI 写时，测试不再是独立证据，人还得检查测试是否写对了意图，负担只是挪了地方；对不懂编程的人、对数据分析、界面设计等非软件任务也不合适。
   - 人和人不一样：老手爱看底层实现，新手更依赖自然语言解释和看得见的结果；新手生产力提升最多，复查也最吃力。
   - 设想"变形的验证"（图 4）：按任务和用户换证据的形态。训练模型给损失曲线；家居自动化给模拟时间线；个人网站给浏览器渲染；命令行工具给终端录屏（asciinema）；数据流水线配一份 .md 写清关键步骤（比如缺失值怎么处理的）。
4. **会适应（adaptability）**：用积累的经验更新自己（记住用户偏好、任务说明，学会可复用的技能），以后做得更好、旧本事不丢。量法是 k 次会话后比一开始提升多少。
   - 痛点"提示疲劳"：每次会话重新交代上下文。现在的"记忆""技能"多是带索引的 markdown 文件；用户自己用 AGENTS.md、自定义规则凑合。
   - 研究空白：任务全是一次性的（SWE-bench 里 Django 的 850 道题互不影响），研究适应性也只量任务成功率，不看人是否受益。例子：你让它用 logging 别用 print，下周还记得吗？偏好冲突时它会来确认吗？

**四根柱子以外的性质**（附录 B.1）：安全被看成四者坏掉的结果（不可逆动作前没检查点是可引导的问题，提交前没人验是可验证的问题）；主动性来自会适应（要知道什么时候主动是受欢迎的）；可定制（技能、钩子、规则文件）和可引导的区别在时间尺度（可引导管当下，可定制跨会话）；多智能体编排要建在"一人一智能体"这对搭档的四件事之上。

### 怎么补上（四个研究方向，第 4 节）
1. **规模化地建模人**：上面四个量都要从人的行为里采样（意图、判断、插手）。真人研究贵，全自主基准又绕开了人。模拟用户是一条路，但"让 LLM 演人"会千人一面、过度配合；要建模偏好、专业程度、真实的出错方式（人常有没说出口的期待、会中途改主意）。设想用 GitHub 的 PR 历史、真实人机交互数据去参数化模拟用户（按清晰度、一致性、专业程度）。另一条路是做大家真用的平台顺带收数据，比如 Copilot Arena 在 IDE 里收偏好，排名和静态基准差得很多。
2. **让监督更省力**：智能体应主动支持监督（主动生成相关测试、交付前自查），并按任务和用户挑选最容易让人验的证据形态。
3. **定义交互的指标**：借 HCI 和软件工程的成果。例如 CUPS 把程序员和 AI 的交互分成 12 种状态（"写提示""编辑最近的建议"等）看时间分布和转移；区分"加速模式"和"探索模式"；PULSE 从交互记录预测用户满意度。还可以挖大规模轨迹：Cursor 的 Tab 在线强化学习每天挖 4 亿多次接受和拒绝，发现"什么时候建议"和"建议什么"一样重要。
4. **走出软件工程**：编程智能体其实是通用智能体（管理投资组合、控制智能家居、照看温室、办婚礼……），这些场景里四件事天然都出现：一句"保守一点"对退休老人和刚毕业的人意思不同；"打开前门锁"出错没法 git revert；行程会被取消；温室浇水既要看今早湿度也要看上一季的收成。

### 反方意见和回应（第 5 节）
- "AI 很快会写完所有代码，研究人机交互是一时之需"：就算如此人也不离场，工作从实现挪到"说明要什么"和"评估结果"。辅助类工具（代码审查、可视化编辑、补全、调试）反而越来越多，说明人在不同任务里想要不同界面。
- "人工交互和评估太贵、没法扩展"：可以像 NLP 用奖励模型、LM 当评审那样做可扩展的代理；圈复杂度、认知复杂度、可维护性指数、可读性等指标也能算；模拟用户、自然使用中收偏好已经可行。
- "先把能力做上去，人的事交给产品"：论文不反对扩展算力，但"往什么方向扩"很重要；只优化自主，就只会得到自主的智能体。GPT-3 到 ChatGPT 的飞跃正是把人的偏好写进训练目标。

### 结论
如果研究一直只盯排行榜，智能体会越来越强，会用的人却可能越来越少。论文呼吁把人的交互写进基础设施、基准和评测，而不是事后补。

### 局限（论文自己和读者要注意的）
- 是立场论文，四个量的公式大多是定义和设想，论文没有在真实系统上把它们都测一遍。
- 作者承认四根柱子不一定穷尽，安全、主动性等被归为"组合性质"是作者的取舍。
- 附录 A 的臃肿和功能差异分析用 LLM 当评审打标签，本身有评审误差；只覆盖 SWE-bench Verified 上已解决的题。
- 附录 B.2 作者也承认："我们的框架会不会只是在帮自主系统收集人的信号、反而加速替代？我们不知道。"

### (a) 这篇论文到底讲了什么
一篇立场论文：用数据说明"能过测试"的智能体补丁仍然臃肿、行为常和人要的不一样；提出人机协作的四根柱子（对齐任务、可引导、可验证、会适应）和各自的量法；指出四个研究方向（规模化建模人、省力的监督、交互指标、走出软件工程）；回应三种反对意见。

### (b) 它对这份笔记有什么用
- 第 19 讲（11 月 10 日，Valerie Chen，"人与智能体的交互"）已上但没有讲义和录像。讲者是这篇的作者之一，所以笔记第 10 章第 3 讲用它搭骨架：
  - 第 1 节"瓶颈挪到了人这边"：补丁臃肿（代码例子算臃肿比）、功能差异超过 50%、开发者调查数字。
  - 第 2 节"四件事"：四个定义和公式的表、作品集网站的时序图、附录 B.1 对安全和主动性的定位。
  - 第 3 节"对齐任务"：澄清螺旋、订酒店对比、pass@k 压成一个比特（代码例子用集合重合度当 sim）。
  - 第 4 节"可引导"：控制点、两种量法、全局开关不行（代码例子只在有分岔的地方问）。
  - 第 6 节"可验证"：测试不是独立证据、老手新手差异、变形的验证（代码例子算 V）。
  - 第 7 节"会适应"和模拟用户的局限：提示疲劳、Django 850 题、logging 的例子、模拟用户千人一面、Copilot Arena（代码例子是跨会话记忆）。
  - 第 8 节末尾的交互指标（CUPS、Cursor Tab）。
- "课上会讲这篇"只是我们根据讲者身份的推测，笔记里已写明，官方材料出来后核对。

---

## English

**Summary.** A position paper arguing that coding-agent research over-optimizes autonomous task completion and that the bottleneck to usefulness has shifted to human-agent interaction. Evidence from SWE-bench Verified: resolved patches are consistently longer than gold patches (every model has >15% of resolved patches with bloat ratio >1.5, uncorrelated with resolve rate, increasing with release date; causes: verbose implementation ~60%, scope creep 50–65%, defensive code 20–30%), and >50% of resolved patches show functional discrepancies from the gold patch (flagged by both LLM judges). The paper defines four interaction pillars with measurable formulations — task alignment G = sim(z_H, z_C), steerability S = E[sim(τ′, τ*)] (plus structural steerability), verification V = E[A(s_H, y*)], adaptability A = E[Perf(C_k) − Perf(C_0)] — and proposes four directions: scalable human modeling (simulators are homogeneous and over-cooperative), efficient "shapeshifting" oversight, interaction-quality metrics (CUPS, Cursor Tab RL), and applications beyond software engineering. It answers three counter-arguments and treats safety, proactivity, customizability and orchestration as compositions of the four pillars.

**Limitations:** Position paper; the metrics are mostly proposed rather than empirically validated; the pillar list is not claimed to be exhaustive; the patch analyses rely on LLM judges and cover resolved SWE-bench Verified instances only; the authors acknowledge uncertainty about whether the framework ultimately accelerates displacement (App. B.2).

**Claim-by-claim check (claims used in c10.html lecture 3):**

| Claim in notes | Paper evidence | Verdict |
|---|---|---|
| §1: Research fixates on autonomous completion / benchmark difficulty as proxy; harder benchmarks, frameworks, training environments | p.1 Position; §2 (p.3) | supported |
| §1: Real programming is iterative, partial delegation, evolving goals, continuous oversight; possibly diminishing returns; interaction is not a temporary workaround and enables new workflows | p.2; p.4 | supported |
| §1: Patch-bloat method (resolved only; drop new/non-Python/test changes; char-length ratio); >15% bloated (ratio >1.5) for all models; uncorrelated with resolve rate; grows with release date | Fig. 1; App. A.1 (p.22) | supported |
| §1: Bloat causes ~60% / 50–65% / 20–30% | App. A.2 (p.22) | supported |
| §1: Functional discrepancy >50% for all models when both judges flag | App. A.3 (p.25) | supported |
| §1: Stack Overflow 2025: 84% use, ~half distrust, two-thirds heavier debugging | §3.3 (p.7) | supported |
| §1 code: retry patch with bloat ratio 2.39 | not from paper | illustrative example, labeled 示意 |
| §2: Four pillars with G, S, V, A formulations | §3.1–3.4 (pp.4–8) | supported |
| §2: Portfolio-website loop (Fig. 2 dialogue lines) | Fig. 2 (p.5) | supported |
| §2: Safety/proactivity/customizability/orchestration as compositions (App. B.1 examples) | App. B.1 (pp.29–30) | supported |
| §3: Task-alignment definition, clarification spiral, users adapt to agents, hotel-booking contrast, lack of open data, pass@k collapses to one bit | §3.1 (pp.4–5) | supported |
| §3 code: Jaccard overlap as sim | paper allows "cosine similarity, lexical overlap"; the sets are illustrative | supported as illustration |
| §4: Steerability definition, control points, response vs structural measures, autonomy not a global setting, false dichotomy | §3.2 (p.6) | supported |
| §6: Verifiability definition; AI-written tests not independent evidence; unsuitable for non-technical users/tasks; expert vs novice; novices gain most and struggle most | §3.3 (p.7) | supported |
| §6: Shapeshifting verification (loss curves, browser render, simulated timeline, asciinema; .md summary); open questions | §4.2 & Fig. 4 (pp.10–11) | supported |
| §7: Adaptability definition; prompt fatigue; memory/skills as markdown; AGENTS.md; Django 850 tasks; success-only metrics; logging vs print example | §3.4 (pp.8–9) | supported |
| §7: Simulators homogeneous & over-cooperative; need preferences/expertise/failure modes; GitHub-based parameterization (clarity, consistency, expertise); Copilot Arena divergence | §4.1, Fig. 3 (pp.9–10) | supported |
| §8: CUPS 12 states; Cursor Tab RL 400M+ daily decisions, when vs what | §4.3 (p.11) | supported |
| Intro box: the lecture may cover this paper | not in paper | our inference (speaker is a co-author), labeled in the notes |
