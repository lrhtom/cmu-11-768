# Modeling Distinct Human Interaction in Web Agents（为网页智能体建模不同的人类介入方式）

> Faria Huq、Zora Zhiruo Wang（共同一作）、Zhanqiu Guo、Venu Arvind Arangarajan、Tianyue Ou、Frank Xu、Shuyan Zhou、Graham Neubig、Jeffrey P. Bigham（卡内基梅隆、杜克）。arXiv 2602.17588v4（2026-07-07，arXiv 备注 Preprint；v1 是 2026-02-19）。DOI 10.48550/arXiv.2602.17588。OpenAlex 另记有 Findings of EMNLP 2026 的会议版，本项目没有核对，只用 arXiv v4。全文 23 页已读完（`paper.pdf` / `fulltext.txt`）。

---

## 中文：通俗版说明书

### 一句话概括
人在用网页智能体时，什么时候会插手、为什么插手，是有规律的，而且每个人有自己的"风格"。作者收集了真人和智能体一起上网办事的记录，学出一个模型来预测"这一步用户会不会想插手"，再把它装进智能体：只在预测会插手时才停下来问，结果用户打分平均高了 36.8%。

### 问题从哪来
- 网页智能体越来越强，但人还是得在旁边：纠正它、补充偏好。
- 现有系统不懂人什么时候、为什么会插手：要么在关键决定前一路自己做下去，要么动不动就停下来要确认，烦死人；用户只好一直盯着。
- 以前的工作只研究具体机制（追问、一起做计划），没有看"执行中途插手、换个做法、交出或收回控制"这一整套行为模式。

### 怎么做的
1. **把问题写成预测任务**：人和智能体轮流在同一个网页任务上做动作。每一步给模型看历史轨迹、当前截图和无障碍树、智能体打算做的动作，让它判断人这一步会不会插手（输出 `<ask_user>` 或 `<agent_continue>`）。用 SFT 训练多模态模型。
2. **评价指标**：步准确率、F1（插手类和不插手类分开报），再加一个自创的"完美时机分"PTS：在真实插手那一步报对得 1 分；在它之前的误报，按离真实插手点的距离平方扣分（α 默认 0.2）；最后用 sigmoid 压到 0–1 并除以 σ(1) 归一化。多次插手的轨迹取平均。附录 B.5 显示 α 在 0.1–0.5 之间变化时，模型排名稳定。
3. **收数据 CowCorpus**：招 20 位用户（20–30 岁，每个任务 0.5 美元），用开源的 Chrome 扩展 CowPilot（智能体提议动作并高亮，用户可放行、暂停或插手接管，随时、不限次数，全程记录；底座统一用 GPT-4o）。每人做 20 个任务：10 个从 Mind2Web 里挑的标准任务（航空、餐厅、租房、招聘、健康、政务、游戏、汽车、票务、音乐网站各一个）+ 10 个自选任务。共 400 条轨迹，2,748 个智能体步骤、1,476 个人的步骤。标准任务里人的动作约占 21.63%，自选任务约 16.06%；平均每个标准任务智能体 7.1 步、人 1.6 步，耗时智能体 93.1 秒、人 23.9 秒。自选任务里 57.98% 是查信息。
4. **为什么插手**（访谈和标注）：
   - 纠错救场：选错元素、前提没满足就动手（比如还没搜商品就先选了地点筛选）、卡住或绕圈。
   - 偏好不符：漏了用户说过的要求（"100 美元以内"、"匹兹堡的天气"），或者一开始就没说清，看到中间步骤才想起来（比如牙膏要哪个牌子）。
   - 帮它应付复杂网页：下拉框、验证码、动态布局、资源没加载；或者怕出不可逆的错，干脆先停下自己来。
5. **四种风格**：给每个用户算四个特征——插手频率（插手事件数 / 总动作数）、插手强度（人的步数 / 智能体步数）、平均插手位置（人的动作在轨迹里的相对位置）、交还率（插手后智能体还接着干的比例）。k-means 分 4 类：
   - 接管型（3 人）：很少插手，几乎都在最后；一接手就自己做完，不交还。
   - 动手型（3 人）：插得多、插得重，偏后；和智能体来回交接。
   - 放手型（3 人）：从不插手。
   - 协作型（11 人）：插得少、插得轻，插完很快交还。
6. **训练和对比**：训练集 1,247 步、测试集 251 步（插手和不插手约 1:7；放手型没有插手，不参与）。比较两个"笨基线"（永远不插手、永远插手）、三个直接提示的闭源模型（Claude 4 Sonnet、GPT-4o、Gemini 2.5 Pro）、两个开源模型（Gemma 27B、LLaVA 8B）微调前后；再按风格分别微调。
7. **部署 PlowPilot**：执行网页任务的智能体和 CowPilot 完全一样，只多了"插手预测"模块：只在预测用户很可能插手时才停下来请确认，其余时间不打扰。

### 关键结果（数字全列）
**表 4（测试集）**：步准确率 / 插手 F1 / 不插手 F1 / PTS
- 永远插手：0.147 / 0.257 / 0.000 / 0.151
- 永远不插手：0.853 / 0.000 / 0.920 / 0.000
- Claude 4 Sonnet：0.681 / 0.231 / 0.799 / 0.293
- GPT-4o：0.741 / 0.198 / 0.846 / 0.147
- Gemini 2.5 Pro：0.681 / 0.286 / 0.795 / 0.262
- Gemma 27B（原版）：0.239 / 0.264 / 0.214 / 0.187
- LLaVA 8B（原版）：0.183 / 0.000 / 0.343 / 0.017
- Gemma 27B（微调）：0.853 / 0.302 / 0.918 / **0.303**（最好）
- LLaVA 8B（微调）：0.817 / 0.296 / 0.897 / 0.201

解读：
- 闭源大模型"太保守"：GPT-4o 不插手类 F1 0.846，插手类只有 0.198，PTS 0.147。
- 在 CowCorpus 上微调的开源模型最会挑时机，小模型（LLaVA 8B）也超过 GPT-4o。
- 摘要里"准确率提升 61.4–63.4%"指步准确率的百分点：0.239→0.853 是 61.4 个点，0.183→0.817 是 63.4 个点（本项目核对过）。
- 注意：永远不插手的基线步准确率也是 0.853，和最好的微调模型一样，说明步准确率被类别不平衡"骗"了，差别靠 PTS 和插手类 F1 看出来。论文自己也说两个极端基线说明"要时间定位，不只是二分类"。

**按风格微调（图 5）**：大多是"对口"模型在对口人群上最好；接管型例外（131 步里只有 11 个插手步），动手型模型在接管型上最好（动手型 296 步里有 37 个插手步）。作者的建议：反馈少的用户可以借用插手多的人群训出的模型。

**消融（附录 B）**：
- 两样本提示对不同闭源模型效果不一，Claude 反而变差。
- 让闭源模型先写推理，PTS 普遍下降：更倾向于"不吭声"，插得太晚。
- 输入加上人的动作历史：步准确率 76.27% → 81.36%（Claude 两样本、不推理）。
- 截图 + 无障碍树 74.9%，只截图 72.9%，只无障碍树 69.7%。

**用户研究（第 5 节、图 6、附录 A.3.2）**：原来 20 人里 4 人回来，又新招 12 人（检验两组无显著差异），共 16 人。六项 7 分量表平均比 CowPilot 高 36.8%。"完成得比不用智能体快"一项从 4.05（CowPilot）到 5.25；"智能体没有不必要地打断我"5.75。作者说是初步结果。

### 结论
人的插手是有结构的行为信号，反映不同的协作风格。专门的交互数据微调的小模型，比通用的大模型更会判断"什么时候该问人"；把它装进智能体，用户觉得更有用。作者主张从"优化自主"转向"按人的偏好和风格动态调整"。

### 局限（论文没单列，读者要注意的）
- 只有 20 位参与者，都在 20–30 岁；用户研究 16 人，且和"之前给 CowPilot 打的分"对比，不是同时随机对照。
- 测试集只有 251 步、插手步更少；按风格微调时接管型只有 11 个插手步。
- PTS 公式对"一次都没报"的情形怎么记分，正文没写清（表里永不插手基线记 0）。
- 风格描述有小出入：图 3 说协作型"通常偏后"，正文说"插手位置更早"。
- 只在网页任务、GPT-4o 底座上做。

### (a) 这篇论文到底讲了什么
一个"人什么时候会插手"的数据集（CowCorpus）、一套描述用户风格的四个特征和四种风格、一个把"插手预测"做成逐步二分类并用 PTS 评时机的任务，以及把预测模块装进真实网页智能体（PlowPilot）后的用户研究。

### (b) 它对这份笔记有什么用
- 第 17 讲讲义第 49 页直接用了这篇的聚类图（四种风格），第 48 页的 CowPilot 是它收数据用的工具。第 19 讲（人与智能体的交互）没有讲义，所以笔记第 10 章第 3 讲用它写：
  - 第 4 节末尾：CowPilot 的交互方式（照本文附录 A.2）。
  - 第 5 节整节：为什么插手的三类原因表；四个特征（代码例子从一条示意轨迹算出频率、强度、位置、交还率）；四种风格和人数表；预测任务；类别不平衡的坑（代码例子：永远猜不插手准确率 0.857，一次也没抓到）；PTS 公式和图 2 例子（代码算出 0.065）；表 4 的 PTS 条形图；按风格微调、消融、PlowPilot 的 36.8%。
  - co ext 框里写了我们自己的提醒（样本小、准确率没拉开）。

---

## English

**Summary.** The paper introduces human intervention modeling for collaborative web agents. CowCorpus contains 400 real-user trajectories (20 users × 10 Mind2Web + 10 free-form tasks, collected with the CowPilot Chrome extension on GPT-4o) with 2,748 agent and 1,476 human steps. Users intervene for error correction, preference misalignment, and assistance with complex web environments. Four per-user features (frequency, intensity, normalized position, handback rate) cluster users (k-means, k=4) into Takeover (3), Hands-on (3), Hands-off (3), and Collaborative (11). Intervention prediction is cast as step-wise binary classification (<ask_user>/<agent_continue>) trained by SFT (1,247 train / 251 test steps, ~1:7 imbalance), evaluated with step accuracy, per-class F1, and a Perfect Timing Score (PTS = σ(I_correct − Σ α d_i²)/σ(1), α = 0.2). Fine-tuned Gemma-27B reaches the best PTS (0.303) vs. Claude 4 Sonnet 0.293, Gemini 2.5 Pro 0.262, GPT-4o 0.147; fine-tuned LLaVA-8B gets 0.201. Style-specific fine-tuning mostly helps matched clusters (except Takeover). Deployed as PlowPilot (same executor, asks only when intervention is predicted), it improves six user ratings by 36.8% on average (n = 16).

**Limitations:** Small participant pool (20, aged 20–30) and small preliminary user study (16, compared against earlier CowPilot ratings); tiny test set and very few Takeover intervention steps; PTS handling of no-prediction cases not fully specified in the text; step accuracy of the best model equals the always-no-intervene baseline (0.853); web-only, GPT-4o executor. Minor inconsistency on the Collaborative cluster's intervention position (Fig. 3 "usually later" vs. text "earlier").

**Claim-by-claim check (claims used in c10.html lecture 3):**

| Claim in notes | Paper evidence | Verdict |
|---|---|---|
| §4: CowPilot is a Chrome extension; agent proposes highlighted UI actions; user can allow, pause, or intervene/take over at any time, unlimited; everything logged; GPT-4o backbone | App. A.2 (p.17) | supported |
| §5: CowCorpus: 20 users aged 20–30; 10 Mind2Web + 10 free-form tasks each; 400 trajectories; 2,748 agent / 1,476 human steps; human-action share 21.63% / 16.06% | §1 (p.2), §3.1 (p.4), Tab. 3 (p.5), App. A.1 (p.17) | supported |
| §5: Three reasons for intervening with the listed examples | §3.2.2 (pp.6–7) | supported |
| §5: Four features; k-means k=4; four styles with 3/3/3/11 users and their descriptions | §3.2.1 (p.6), §3.3 & Fig. 3 (p.7) | supported |
| §5 code: toy trajectory feature values (0.29, 0.75, 0.76, 0.5) | not from paper | illustrative example following Eqs. (2)–(5), labeled 示意 |
| §5: Prediction task inputs/outputs, SFT, ~1:7, 1,247/251 steps, Hands-off excluded | §2 (p.3), §4.1 (p.8) | supported |
| §5: Always-no baseline step accuracy 0.853 | Tab. 4 (p.9) | supported |
| §5: PTS formula, α = 0.2, Z = σ(1); Fig. 2 example (d = 4, 2) → 0.065 | §2 & Fig. 2 (p.3); value computed locally | supported (computation ours) |
| §5: PTS bars (0 / 0.151 / 0.147 / 0.262 / 0.293 / 0.201 / 0.303) | Tab. 4 (p.9) | supported |
| §5: GPT-4o non-interv F1 0.846 vs interv F1 0.198 | Tab. 4 & §4.2 (p.9) | supported |
| §5: "61.4–63.4%" = step-accuracy percentage-point gains 0.239→0.853, 0.183→0.817 | abstract; Tab. 4 | supported (interpretation checked locally) |
| §5: Style-specific models; Takeover exception (11 of 131 steps); Hands-on model best on Takeover; borrow high-frequency users' model | §4.3 & Fig. 5 (p.10) | supported |
| §5: Reasoning lowers PTS; human-action history 76.27%→81.36%; multimodal 74.9% vs 72.9% / 69.7% | App. B.2–B.4 (pp.20–21) | supported |
| §5: PlowPilot keeps the executor, asks only when intervention predicted; 4 + 12 = 16 participants; +36.8% average over six Likert items; preliminary | §5 & Fig. 6 (pp.10–11) | supported |
| §5 co-ext: small study, compared to earlier ratings, accuracy not separated | our critique based on §5 and Tab. 4 | our opinion, labeled in the notes |
