/* 课程清单：顶栏的章节切换、左栏的每一讲、每讲标题条都从这里生成。
 * 来源：课程官网 https://www.cmu-agents.com/ （Fall 2026 课表、讲义 PDF）与 YouTube 播放列表；视频 id、时长取自 播放列表元数据。
 * 讲师取自课表的 lecturer 字段和视频简介；第 13、14 讲的录像 2026-10 下旬才出现在播放列表里。第 15 讲以后按 2026-11-12 的官网课表，还没发的标“未发布 / 几月几号上”。
 * 每一讲：num 左栏序号 · no 标题条上的课号 · yt 视频 id（正文里的时间戳点一下跳到视频对应位置）· doc 官方讲义 PDF。 */
(function () {
  var S = 'https://www.cmu-agents.com/slides/';
  var L = function (o) {
    if (o.yt) o.url = 'https://www.youtube.com/watch?v=' + o.yt;
    if (o.pdf) { o.src = '讲义 ' + o.pdf.replace('.pdf', ''); o.doc = S + o.pdf; }
    return o;
  };
  var X = function (pdf, t) { return { t: '讲义 · ' + t + '（官方 PDF）', url: S + pdf }; };
  var A1 = { t: '作业 1 · Harness 代码仓库', url: 'https://github.com/cmu-agents/assignment-1' };
  var A2 = { t: '作业 2 · Eval 代码仓库', url: 'https://github.com/cmu-agents/assignment-2' };
  var A3 = { t: '作业 3 · Training 代码仓库', url: 'https://github.com/cmu-agents/assignment-3' };

  window.COURSE = {
    ns: 'cmu768',                    // 本地存储键前缀（已看标记、主题、文字修改）
    brand: '11-768',
    brandSub: ' · AI 智能体',
    unit: '讲',
    extraLabel: '讲义与作业',
    zh: 'CMU 11-768：AI 智能体',
    en: 'CMU 11-768: AI Agents (Fall 2026)',
    home: 'https://www.cmu-agents.com/',
    playlist: 'https://www.youtube.com/playlist?list=PLSN0qpDfUvTM',
    links: [{ tag: '复原', zh: '作业复原笔记', en: 'Assignments 1–3 restored: filled TODOs, step-by-step code and real runs', href: '作业复原/作业笔记/index.html' }],
    modules: [
      { key: "c1", tag: "01", zh: "智能体入门与工具调用", en: "What Is an Agent · Tool Use",
        desc: "智能体是什么、由哪几块组成、怎么一圈一圈地跑起来；模型怎么学会调用工具：工具的描述、调用格式、聊天模板和 MCP。",
        lessons: [
          L({ num: "1", no: "Lecture 1", zh: "智能体是什么、怎么工作", en: "What are Agents and How Do They Work?", who: "Daniel Fried · Graham Neubig", dur: "1:07:52", yt: "UwfjzyLnvMg", pdf: "lecture-01-agents.pdf" }),
          L({ num: "2", no: "Lecture 2", zh: "工具调用", en: "Tool Use for Language Model Agents", who: "Graham Neubig", dur: "57:22", yt: "jXChFB4JSyw", pdf: "lecture-02-tool-use.pdf" })
        ],
        extra: [X('lecture-01-agents.pdf', '第 1 讲'), X('lecture-02-tool-use.pdf', '第 2 讲'), A1] },
      { key: "c2", tag: "02", zh: "长上下文、记忆与技能", en: "Long Context · Memory & Skills",
        desc: "上下文越来越长时，模型结构和推理系统要怎么改、智能体自己又该怎么管理上下文；跨任务记住东西的记忆，以及按需加载的技能。",
        lessons: [
          L({ num: "3", no: "Lecture 3", zh: "长上下文与上下文管理", en: "Context Management for Long-Context Agents", who: "Graham Neubig", dur: "1:15:39", yt: "AiwCCvFW1uE", pdf: "lecture-03-long-context.pdf" }),
          L({ num: "4", no: "Lecture 4", zh: "记忆与技能", en: "Skills and Memory", who: "Daniel Fried", dur: "1:15:23", yt: "6zigF2a-2Pw", pdf: "lecture-04-memory-and-skills.pdf" })
        ],
        extra: [X('lecture-03-long-context.pdf', '第 3 讲'), X('lecture-04-memory-and-skills.pdf', '第 4 讲'), A1] },
      { key: "c3", tag: "03", zh: "规划与多智能体协作", en: "Planning · Decomposition · Multi-Agent",
        desc: "先想再做：规划、把大任务拆成小任务，以及多个智能体之间怎么分工、怎么协调。",
        lessons: [
          L({ num: "5", no: "Lecture 5", zh: "规划、任务分解与多智能体协作", en: "Planning, Task Decomposition, and Multi-Agent Coordination", who: "Daniel Fried", dur: "1:15:14", yt: "S8v-dR4s29M", pdf: "lecture-05-planning.pdf" })
        ],
        extra: [X('lecture-05-planning.pdf', '第 5 讲')] },
      { key: "c4", tag: "04", zh: "领域智能体：编程、操作电脑、深度研究", en: "Coding · Computer Use · Deep Research",
        desc: "三类最成熟的智能体各自怎么做：写代码修 bug 的编程智能体、看屏幕点鼠标的电脑操作智能体、上网查资料写报告的深度研究智能体。",
        lessons: [
          L({ num: "6", no: "Lecture 6", zh: "编程智能体", en: "Agents for Coding and Software Development", who: "Graham Neubig", dur: "1:18:49", yt: "1BWeH1oOM7k", pdf: "lecture-06-coding-agents.pdf" }),
          L({ num: "7", no: "Lecture 7", zh: "电脑操作智能体", en: "Computer Use Agents", who: "JY Koh", dur: "1:14:26", yt: "jwGluLrrqjQ", pdf: "lecture-07-computer-use-agents.pdf" }),
          L({ num: "10", no: "Lecture 10", zh: "深度研究智能体", en: "Deep Research Agents", who: "Akari Asai", dur: "1:12:25", yt: "nKUBrXFQBUM", pdf: "lecture-10-deep-research-agents.pdf" })
        ],
        extra: [X('lecture-06-coding-agents.pdf', '第 6 讲'), X('lecture-07-computer-use-agents.pdf', '第 7 讲'), X('lecture-10-deep-research-agents.pdf', '第 10 讲'), A2] },
      { key: "c5", tag: "05", zh: "训练（上）：SFT 与强化学习基础", en: "Training: SFT · RL Basics",
        desc: "怎么用轨迹数据做监督微调，让模型学会当智能体；强化学习的基本概念：策略、奖励、策略梯度，以及它在智能体上的样子。",
        lessons: [
          L({ num: "8", no: "Lecture 8", zh: "监督微调（SFT）", en: "Supervised Fine-Tuning", who: "Yueqi Song", dur: "1:04:59", yt: "O3HSU0AoILc", pdf: "lecture-08-sft.pdf" }),
          L({ num: "9", no: "Lecture 9", zh: "强化学习基础", en: "Reinforcement Learning Basics", who: "Daniel Fried", dur: "1:17:46", yt: "paAcPaaYZGM", pdf: "lecture-09-rl-basics.pdf" })
        ],
        extra: [X('lecture-08-sft.pdf', '第 8 讲'), X('lecture-09-rl-basics.pdf', '第 9 讲'), A3] },
      { key: "c6", tag: "06", zh: "训练（下）：进阶 RL 算法与 RL 系统", en: "Training: Advanced RL · RL Systems",
        desc: "智能体 RL 里常用的算法改进，以及把多轮、长时间的智能体 RL 真正跑起来的系统：采样和训练怎么分开、怎么异步。",
        lessons: [
          L({ num: "11", no: "Lecture 11", zh: "进阶 RL 算法", en: "Advanced RL Algorithms", who: "Graham Neubig", dur: "1:08:15", yt: "jKx7_fOZRzg", pdf: "lecture-11-rl-advanced.pdf" }),
          L({ num: "12", no: "Lecture 12", zh: "RL 系统", en: "RL Systems", who: "Apurva Gandhi", dur: "1:06:27", yt: "dwR6NP9nI-8", pdf: "lecture-12-rl-systems.pdf" })
        ],
        extra: [X('lecture-11-rl-advanced.pdf', '第 11 讲'), X('lecture-12-rl-systems.pdf', '第 12 讲'), A3] },
      { key: "c7", tag: "07", zh: "安全与框架：沙箱、攻击与 OpenHands", en: "Agent Safety · OpenHands",
        desc: "智能体能动手之后会出什么事、怎么防：沙箱、权限和凭据、提示注入；以及一个真实的开源智能体框架 OpenHands 是怎么搭的。（两讲的录像 2026-10 下旬才发布，已补上时间戳。）",
        lessons: [
          L({ num: "13", no: "Lecture 13", zh: "智能体安全", en: "Agentic Safety", who: "Graham Neubig", dur: "54:11", yt: "Mbonnq-PUGM", pdf: "lecture-13-agent-safety.pdf" }),
          L({ num: "14", no: "Lecture 14", zh: "OpenHands 框架", en: "Frameworks 1: OpenHands", who: "Graham Neubig", dur: "1:09:20", yt: "VAzZkT68h2Q", pdf: "lecture-14-openhands.pdf" })
        ],
        extra: [X('lecture-13-agent-safety.pdf', '第 13 讲'), X('lecture-14-openhands.pdf', '第 14 讲')] },
      { key: "c8", tag: "08", zh: "作业：Harness、Eval 与 Training", en: "Assignments 1–3",
        desc: "三个公开作业的代码走读：作业 1 从零写一个 ReAct 智能体外壳（提示、工具循环、沙箱、技能、上下文压缩），作业 2 给智能体设计评测，作业 3 在小框架 scottyrl 里用 REINFORCE、GRPO 和异步 GRPO 训练智能体。",
        lessons: [
          { num: "A1", no: "作业 1", zh: "Harness：从零写智能体外壳", en: "Assignment 1 · Harness", who: "截止 Mon, Sep 14", url: "https://github.com/cmu-agents/assignment-1" },
          { num: "A2", no: "作业 2", zh: "Eval：给智能体设计评测", en: "Assignment 2 · Eval", who: "截止 Thu, Oct 1", url: "https://github.com/cmu-agents/assignment-2" },
          { num: "A3", no: "作业 3", zh: "Training：用 RL 训练智能体", en: "Assignment 3 · Training", who: "截止 Thu, Oct 29", url: "https://github.com/cmu-agents/assignment-3" }
        ],
        extra: [A1, A2, A3] },
      { key: "c9", tag: "09", zh: "框架与安全（下）：编排、监控与可观测性", en: "Orchestration · Monitoring · Observability",
        desc: "智能体从一个循环变成一套系统之后：怎么编排多个步骤和多个智能体、怎么监控它们在做什么、出事时怎么查。（第 16 讲还没有官方材料，按现有材料预写。）",
        lessons: [
          L({ num: "15", no: "Lecture 15", zh: "编排与监控", en: "Frameworks 2: Orchestration and Monitoring", who: "Daniel Fried", dur: "暂无录像", pdf: "lecture-15-orchestration-and-monitoring.pdf" }),
          L({ num: "16", no: "Lecture 16", zh: "可观测性与监控", en: "Safety 2: Observability and Monitoring", who: "Eric Wallace", dur: "预写" })
        ],
        extra: [X('lecture-15-orchestration-and-monitoring.pdf', '第 15 讲')] },
      { key: "c10", tag: "10", zh: "交互：智能体与人的工作、多智能体、人机协作", en: "Agents & Work · Multi-Agent · Human-Agent",
        desc: "智能体走进真实的工作：它们在人的工作里能做什么、和别的智能体怎么互动、和人怎么配合。（第 18 讲只有讲义，没有录像。第 19 讲还没有官方材料，按现有材料预写。）",
        lessons: [
          L({ num: "17", no: "Lecture 17", zh: "智能体与人的工作", en: "Agents and the Future of Work", who: "Zora Wang", dur: "暂无录像", pdf: "2026-10-27-zora-wang.pdf" }),
          L({ num: "18", no: "Lecture 18", zh: "多智能体交互", en: "Interaction 1: Multi-Agent Interaction", who: "Saujas Vaduguru", dur: "暂无录像", pdf: "lecture-18-multi-agent-systems.pdf" }),
          L({ num: "19", no: "Lecture 19", zh: "人与智能体的交互", en: "Interaction 2: Human-Agent Interaction", who: "Valerie Chen", dur: "预写" })
        ],
        extra: [X('2026-10-27-zora-wang.pdf', '第 17 讲'), X('lecture-18-multi-agent-systems.pdf', '第 18 讲')] },
      { key: "c11", tag: "11", zh: "搜索：重排序、评判模型与树搜索", en: "Reranking · Critic Models · Tree Search",
        desc: "推理时多花算力：多采几个候选再挑、训练评判模型打分、在真实环境里做树搜索。最后是两场客座讲座。（这几讲都还没有官方材料，按现有材料预写，客座讲座题目未公布。）",
        lessons: [
          { num: "20", no: "Lecture 20", zh: "重排序与评判模型", en: "Search 1: Reranking and Critic Models", who: "讲者未公布", dur: "预写" },
          { num: "21", no: "Lecture 21", zh: "树搜索", en: "Search 2: Tree Search", who: "JY Koh", dur: "11/17 上", url: "https://arxiv.org/abs/2407.01476v3", src: "讲者论文 arXiv 2407.01476v3", doc: "https://arxiv.org/abs/2407.01476v3" },
          { num: "22", no: "Lecture 22", zh: "客座讲座（题目未公布）", en: "Guest Lecture", who: "Karthik Narasimhan", dur: "11/19 上" },
          { num: "23", no: "Lecture 23", zh: "客座讲座（题目未公布）", en: "Guest Lecture", who: "Sasha Rush", dur: "11/24 上" }
        ],
        extra: [{ t: '树搜索 · 讲者的论文（TMLR 2025，arXiv v3）', url: 'https://arxiv.org/abs/2407.01476v3' }] }
    ]
  };
})();
