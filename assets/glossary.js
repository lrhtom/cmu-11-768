/* 术语表和悬停卡片。网课页和作业复原笔记共用（作业笔记页面引用 ../../assets/glossary.js）。
 * 数据：t 术语；a 别的写法；f 全称或中文名；d 一两句解释（优先用课程里的说法）。没把握的词不写，宁缺毋滥。
 * 词表的源文件是 词表源文件，改完跑 make_gloss 重新生成这一段。
 * 标记是运行时加的（span.gl），不写进页面文件。GL.strip 能全部摘掉，编辑和另存时用，保证用户的修改里不混进标记。
 * 每个术语都有一条很淡的细下划线，悬停才加深。 */
(function () {
  'use strict';
  var GLOSSARY = [
    // 智能体基础
    {"t": "LLM", "f": "Large Language Model，大语言模型", "d": "只管 token 进、token 出的大模型。智能体就是让它在循环里反复调用工具。"},
    {"t": "LM", "f": "Language Model，语言模型", "d": "按前文预测下一个 token 的模型。参数很多的 LM 就是 LLM。"},
    {"t": "VLM", "f": "Vision Language Model，视觉语言模型", "d": "能同时看图和读文字的模型。作业 2 的判卷器就靠它看图。"},
    {"t": "token", "a": ["tokens", "Token"], "f": "词元", "d": "模型读写文字的最小单位。上下文长度、费用和训练都按它算。"},
    {"t": "harness", "a": ["Harness"], "f": "外壳，智能体外壳", "d": "把模型当引擎的那层程序。负责解析、校验、执行工具调用，再把结果接回去。"},
    {"t": "ReAct", "f": "Reasoning + Acting，推理加行动", "d": "先写推理再做动作，看到结果再想下一步。讲义说这是影响很大的智能体做法。"},
    {"t": "CodeAct", "f": "用代码当动作", "d": "让模型写一段 Python 代码当动作。一段代码能连着调好几个工具。"},
    {"t": "CoT", "a": ["chain of thought"], "f": "Chain of Thought，思维链", "d": "先写出一串中间推理，再给答案。"},
    {"t": "RAG", "f": "Retrieval-Augmented Generation，检索增强生成", "d": "先检索相关资料放进提示，再让模型回答。讲师说它没死，只是普及到用了都没意识到。"},
    {"t": "rollout", "a": ["rollouts"], "f": "一次完整的运行", "d": "让模型在环境里跑完一个回合，得到轨迹和奖励。RL 要先收集大量 rollout 再更新。"},
    {"t": "rubric", "f": "评分细则", "d": "一组逐条检查的评分标准。开放式任务没有标准答案时，常配 LLM 评审用。"},
    {"t": "GUI", "f": "Graphical User Interface，图形用户界面", "d": "用窗口、按钮和鼠标操作的界面。"},
    {"t": "CUA", "f": "Computer Use Agent，电脑操作智能体", "d": "和人用同一个界面：看截图，输出点击、滚动、输入这些动作。"},
    {"t": "NLP", "f": "Natural Language Processing，自然语言处理", "d": "让计算机处理人类语言的研究领域。"},
    {"t": "CMU", "f": "Carnegie Mellon University，卡内基梅隆大学", "d": "开 11-768 这门课的学校，在匹兹堡。"},
    // 工具调用与数据格式
    {"t": "API", "f": "Application Programming Interface，应用程序接口", "d": "程序之间互相调用的约定。模型服务和网页背后的功能都通过 API 调用。"},
    {"t": "REST", "f": "Representational State Transfer", "d": "用 HTTP 方法和网址暴露函数的接口风格。"},
    {"t": "HTTP", "f": "HyperText Transfer Protocol，超文本传输协议", "d": "网页和接口通信用的协议。远程 MCP 服务器也走 HTTP。"},
    {"t": "OpenAPI", "f": "OpenAPI Specification，OpenAPI 规范", "d": "描述一整套 HTTP 接口的标准文档，里面嵌着 JSON Schema。FastMCP 能把它的路由变成 MCP 工具。"},
    {"t": "FastAPI", "f": "Python 的 Web 框架", "d": "能把一个 Python 函数很简单地绑到 REST 接口上。"},
    {"t": "MCP", "f": "Model Context Protocol，模型上下文协议", "d": "Anthropic 提出的标准，用来给模型接工具和额外上下文。比直接调 REST 多一层凭据隔离。"},
    {"t": "FastMCP", "f": "Python 的 MCP 框架", "d": "MCP 版的 FastAPI，很快就能写一个 MCP 服务器。也能把 OpenAPI 的路由直接变成 MCP 工具。"},
    {"t": "stdio", "f": "standard input/output，标准输入输出", "d": "进程之间用标准输入输出传消息。本地 MCP 服务器常这样连。"},
    {"t": "JSON", "f": "JavaScript Object Notation", "d": "由键值对和数组组成的文本格式。工具调用的参数通常写成 JSON。"},
    {"t": "JSON Schema", "f": "JSON 的结构描述规范", "d": "用 JSON 写的结构说明：有哪些字段、什么类型、哪些必填。工具定义靠它描述参数。"},
    {"t": "schema", "a": ["Schema"], "f": "结构定义", "d": "描述数据长什么样的定义。工具的 schema 写明名字、描述和参数结构。"},
    {"t": "XGrammar", "f": "约束解码库", "d": "CMU 机器学习系的人开发，各大推理库都在用。每步用文法屏蔽不合法的 token，保证格式不出错。"},
    {"t": "logits", "a": ["logit"], "f": "未归一化的分数", "d": "模型给每个候选 token 打的原始分，做 softmax 后变成概率。"},
    {"t": "softmax", "f": "归一化指数函数", "d": "把一组分数变成加起来为 1 的概率。"},
    {"t": "YAML", "f": "YAML Ain't Markup Language", "d": "靠缩进表示结构的配置格式。SKILL.md 开头的元数据就用它写。"},
    {"t": "Markdown", "f": "轻量标记语言", "d": "用简单符号标出标题、列表的纯文本格式。技能文件就是 Markdown。"},
    {"t": "docstring", "f": "文档字符串", "d": "写在 Python 函数开头的说明文字。作业的很多要求就写在起始代码的 docstring 里。"},
    {"t": "BFCL", "f": "Berkeley Function Calling Leaderboard，伯克利函数调用排行榜", "d": "最有名的工具调用评测。只评会不会用工具，不评整个任务。"},
    {"t": "OpenRouter", "f": "模型服务聚合平台", "d": "把大量推理服务商汇总在一起。一个模型常有二三十家在提供。"},
    {"t": "chat completions", "a": ["Chat Completions"], "f": "聊天补全接口", "d": "按消息列表请求、拿回回复的推理接口。外壳和推理服务之间常说这种协议。"},
    {"t": "sigmoid", "f": "S 形函数", "d": "把任意实数压到 0 到 1 之间的 S 形曲线。PTS 最后就用它把分数压进这个区间。"},
    {"t": "XML", "f": "可扩展标记语言", "d": "用尖括号标签包住内容的文本格式，长得像 HTML。有的模型用 XML 风格写工具调用。"},
    // 模型
    {"t": "GPT-4", "f": "OpenAI 的模型", "d": "OpenAI 较早的旗舰模型。讲义里大海捞针的热力图测的就是它。"},
    {"t": "GPT-4o", "f": "OpenAI 的多模态模型", "d": "能看图的 OpenAI 模型。课上当过规划器，也是第 11 章树搜索的底座。"},
    {"t": "GPT-5", "a": ["GPT-5.1", "GPT-5.4", "GPT-5.6", "GPT-5.4-mini", "GPT-5-mini"], "f": "OpenAI 的 GPT-5 系列模型", "d": "讲义表格里有 GPT-5.4、GPT-5.6 等多个版本。"},
    {"t": "GPT-6", "f": "OpenAI 的模型", "d": "讲师说 GPT-6 Astra 基本解决了多数电脑操作基准，超过人类。"},
    {"t": "o3", "f": "OpenAI 的推理模型", "d": "BrowseComp-Plus 用它找可能有用的证据网页。"},
    {"t": "ChatGPT", "f": "OpenAI 的聊天产品", "d": "讲师强调它现在就是智能体，因为它会反复调用工具。"},
    {"t": "gpt-oss", "a": ["gpt-oss-120b", "gpt-oss-120B"], "f": "OpenAI 的开放权重模型", "d": "深度研究一节里拿它当智能体做对比。"},
    {"t": "Claude", "f": "Anthropic 的大模型系列", "d": "分 Opus、Sonnet 等档次。Claude Code 是基于它的编程智能体。"},
    {"t": "Opus", "f": "Claude 的最强一档", "d": "讲义表格里有 Opus 4.6、Claude Opus 5。"},
    {"t": "Sonnet", "f": "Claude 的中间一档", "d": "讲师说到 Claude 3.5 Sonnet 那时，编程智能体才真正能用。"},
    {"t": "Gemini", "f": "Google 的大模型系列", "d": "讲师说它曾在不少外壳上表现差。原因是训练用的是自家编辑格式。"},
    {"t": "Gemma", "a": ["gemma3", "Gemma3"], "f": "Google 的开放权重模型系列", "d": "Google 的开放权重模型。本机复原作业 2 时，用 Ollama 上的 gemma3:4b 当判卷替身。"},
    {"t": "Qwen", "a": ["Qwen3"], "f": "通义千问，阿里巴巴的开放权重模型系列", "d": "课上多次拿它的聊天模板和工具调用格式举例。"},
    {"t": "Qwen2.5-Coder", "f": "Qwen 的编程模型", "d": "把通用模型改造成编程模型的例子。它公开写了中期训练的做法。"},
    {"t": "Qwen3-VL-30B-A3B", "a": ["Qwen3-VL-30B"], "f": "Qwen 的视觉语言模型", "d": "作业 2 指定的判卷模型，能看图。"},
    {"t": "DeepSeek", "f": "深度求索的大模型系列", "d": "讲义里有 DeepSeek V3.2、V4。课上比较过它的工具调用格式。"},
    {"t": "DeepSeek-R1-Zero", "f": "DeepSeek 的实验模型", "d": "直接在基座模型上做 RL、完全不做 SFT 的尝试。回答语言混杂、难读。"},
    {"t": "Kimi", "f": "月之暗面（Moonshot AI）的大模型系列", "d": "讲义里有 Kimi K3，它用的线性注意力叫 KDA。"},
    {"t": "GLM", "f": "智谱的大模型系列", "d": "讲义说同一个 GLM 换不同服务商跑，工具调用错误率差很多。"},
    {"t": "Nemotron", "f": "英伟达（NVIDIA）的大模型系列", "d": "讲义里的 Nemotron 3 Ultra 把 Mamba 层和注意力层混在一起。"},
    {"t": "Llama", "a": ["Llama-3-8B", "Llama-3-70B", "Llama-3-70B-Instruct"], "f": "Meta 的开放权重模型系列", "d": "名字里的 8B、70B 指参数量。"},
    {"t": "Mistral", "f": "Mistral AI 的大模型系列", "d": "课上比较过它的工具调用格式：用控制 token 加调用 ID。"},
    {"t": "MiniMax", "f": "MiniMax 公司的大模型", "d": "讲师说它的模型训练时用过 CISPO 那种做法。"},
    {"t": "MAI-Thinking-1", "a": ["MAI"], "f": "Microsoft AI 的模型", "d": "讲义拿它的数据配比举例。按条数配好比例，长轨迹仍会吃掉大部分 token。"},
    {"t": "LLaVA", "a": ["LLaVA-1.6-34B"], "f": "开源的视觉语言模型", "d": "能看图的开源模型。树搜索论文拿它当裁判，插手预测的论文拿它做微调。"},
    // 智能体产品与框架
    {"t": "OpenHands", "f": "开源编程智能体", "d": "Graham 的组做的，前身是 OpenDevin。第 7 章讲它的软件智能体 SDK。"},
    {"t": "OpenDevin", "f": "OpenHands 的前身", "d": "2024 年为复现 Devin 发起的开源项目，后来改名 OpenHands。"},
    {"t": "Devin", "f": "Cognition 的编程智能体", "d": "2024 年 3 月的演示引起轰动，但不开源，于是有了 OpenDevin。"},
    {"t": "Claude Code", "f": "Anthropic 的编程智能体", "d": "在终端里用的编程智能体。和 Codex、Cursor 一样有 Plan Mode。"},
    {"t": "Codex", "f": "OpenAI 的编程智能体", "d": "讲义常和 Claude Code、OpenHands 并列举例的编程智能体。"},
    {"t": "Cursor", "f": "带 AI 的代码编辑器", "d": "讲师说它可能最早做计划模式。它也一直从用户那里收数据、更新模型。"},
    {"t": "Copilot", "f": "微软的 AI 助手", "d": "微软一系列 AI 助手的名字。讲义里有写代码的 GitHub Copilot，也有被邮件指令骗去外泄文档的。"},
    {"t": "Cline", "f": "编程智能体", "d": "讲义事故：它让智能体读 GitHub issue，被攻击者借此拿到了发布令牌。"},
    {"t": "OpenClaw", "f": "个人助理智能体", "d": "讲义事故：用户叮嘱先问再动手，它却开始大批删邮件。"},
    {"t": "OpenCode", "f": "开源编程智能体", "d": "讲义列出的编程智能体之一，和 Claude Code、Codex 同类。"},
    {"t": "Hermes", "f": "开源智能体", "d": "讲师说它系统提示里的技能描述总共约 3,000 token。"},
    {"t": "SWE-agent", "f": "编程智能体", "d": "SWE-smith 造训练环境时，先让它试着装依赖、跑测试。"},
    {"t": "mini-SWE-agent", "a": ["mini-swe-agent"], "f": "极简编程智能体", "d": "SWE-bench 的作者做的，只靠 bash 命令解题。代码很小，分数却很高。"},
    {"t": "Agentless", "f": "固定流程的编程做法", "d": "解 issue 时照着走的结构化流程。讲师说它已经不是解 issue 最成功的框架。"},
    {"t": "LangGraph", "f": "工作流编排框架", "d": "用图写工作流：节点、条件路由、共享状态、检查点、中断。第 9 章实跑了它的客服例子。"},
    {"t": "Pi", "f": "开源编程智能体", "d": "核心做得极简，功能全靠扩展加。用 TypeScript 写，讲师拿它和 OpenHands 对比。"},
    {"t": "Gemini CLI", "f": "Google 的终端编程智能体", "d": "在终端里用的编程智能体。CollabSkill 用它生成 rubric，也让它当两个评审之一。"},
    {"t": "Claude Cowork", "a": ["Cowork"], "f": "Claude 的图形界面版智能体", "d": "和 Claude Code 用同一个模型，换成图形界面，给不写代码的人用。CollabSkill 的协作排名里它第一。"},
    {"t": "Manus", "f": "通用智能体产品", "d": "在浏览器里用的通用智能体。CollabSkill 比较的五个智能体里有它。"},
    {"t": "LangChain", "f": "LLM 应用开发框架", "d": "开源的 LLM 应用框架，LangGraph 出自同一家。第 18 讲的子智能体例子取自它的文档。"},
    // 长上下文与推理系统
    {"t": "Transformer", "f": "Transformer 结构", "d": "今天大模型的主流结构，核心是注意力。计算量随长度平方增长。"},
    {"t": "KV", "f": "Key / Value，键和值", "d": "注意力里每个 token 的 K、V 向量。存下来叫 KV 缓存，省掉重算，但很占内存。"},
    {"t": "GQA", "f": "Grouped-Query Attention，分组查询注意力", "d": "几个注意力头共用一组 K、V，KV 缓存跟着变小。"},
    {"t": "MLA", "f": "Multi-head Latent Attention，多头潜在注意力", "d": "只缓存一个小的潜变量，用时再投影回各头的 K、V。"},
    {"t": "RoPE", "f": "Rotary Position Embedding，旋转位置编码", "d": "按位置旋转 q 和 k。注意力分数只取决于两个 token 的相对距离。"},
    {"t": "NoPE", "f": "No Positional Encoding，不用位置编码", "d": "干脆不加位置编码。有因果掩码，顺序信息已经隐含在计算里。"},
    {"t": "YaRN", "f": "一种扩展上下文长度的方法", "d": "按波长分别处理 RoPE 各维。长波长完全插值，短波长不动，中间混合。"},
    {"t": "DeltaNet", "f": "一类线性注意力", "d": "先用状态预测当前键对应的值，只把误差写进去。这样状态记得更准。"},
    {"t": "Gated DeltaNet", "f": "带衰减的 DeltaNet", "d": "每步让整个状态衰减一点再修正，久远的干扰会慢慢淡掉。讲义说 Qwen 用它。"},
    {"t": "KDA", "f": "Kimi Delta Attention", "d": "每个通道一个衰减速度，有的记很久，有的很快忘。讲义说 GLM 和 Kimi 用它。"},
    {"t": "Mamba", "f": "状态空间模型", "d": "和线性注意力思路类似、数学更复杂的序列结构。Nemotron 用了它。"},
    {"t": "MoE", "f": "Mixture of Experts，专家混合", "d": "每个 token 只经过少数几个专家子网络。讲义说提到的前沿模型都是 MoE。"},
    {"t": "prefill", "f": "预填充", "d": "推理的第一阶段，一次并行处理整段输入。输入越长，等第一个 token 越久。"},
    {"t": "decode", "f": "解码", "d": "推理的第二阶段，每步只生成一个 token。"},
    {"t": "TTFT", "f": "Time To First Token，首 token 延迟", "d": "从请求到达到看见第一个输出 token 的时间。输入越长，等得越久。"},
    {"t": "TPOT", "f": "Time Per Output Token，每个输出 token 的时间", "d": "相邻两个输出 token 的间隔，决定吐字有多快。"},
    {"t": "vLLM", "f": "开源推理引擎", "d": "常用的大模型推理服务软件，核心创新是 PagedAttention。"},
    {"t": "SGLang", "f": "开源推理引擎", "d": "和 vLLM 同类的推理服务软件，核心创新是 RadixAttention。"},
    {"t": "RadixAttention", "f": "前缀树 KV 缓存", "d": "用一棵前缀树管理 KV 缓存。请求之间共享相同的前缀，省掉重算。"},
    {"t": "bf16", "f": "bfloat16，16 位浮点格式", "d": "训练和推理常用的数字格式。讲义用它估算 KV 缓存有多大。"},
    {"t": "BPE", "f": "Byte Pair Encoding，字节对编码", "d": "常用的分词方法，把高频出现的字节组合合成一个 token。"},
    {"t": "FP8", "f": "8 位浮点数", "d": "用 8 位浮点数存权重的量化级别。讲师说它是默认级别，工具调用出错比 FP4 少得多。"},
    {"t": "FP4", "f": "4 位浮点数", "d": "比 FP8 压得更狠的量化级别。给服务商省了钱，讲师说模型会变差。"},
    {"t": "MTP", "f": "多 token 预测", "d": "模型自带的草稿模块，能一次猜好几个 token。投机解码时可以拿它当草稿器。"},
    // 记忆、技能与规划
    {"t": "Agent Skills", "f": "智能体技能标准", "d": "把技能写成一组智能体能读的文件。靠渐进披露按需加载。"},
    {"t": "SKILL.md", "f": "技能的入口文件", "d": "开头是 YAML 元数据，写名字和一句描述，正文是做事的说明。描述告诉模型什么时候该用。"},
    {"t": "frontmatter", "f": "文件头元数据", "d": "文件开头两行 --- 之间的 YAML。SKILL.md 的名字和描述就写在这里。"},
    {"t": "progressive disclosure", "f": "渐进披露", "d": "先只放技能的名字和描述，需要时才加载正文和附带文件。"},
    {"t": "MemGPT", "f": "早期的记忆系统", "d": "最早在上下文窗口之外管理记忆的方法之一。思路来自存储层次。"},
    {"t": "Mem0", "f": "记忆系统", "d": "每来一条消息就抽出事实，和相似的旧记忆比。再决定增、改、删或不动。"},
    {"t": "ReasoningBank", "f": "从成败中总结策略的记忆", "d": "把经验总结成通用的文字策略存下来。讲义说加入失败经验时它帮助明显。"},
    {"t": "AWM", "f": "Agent Workflow Memory，智能体工作流记忆", "d": "CMU 的工作。从过去的轨迹里归纳出可复用的工作流，放进以后的上下文。"},
    {"t": "ASI", "f": "代码技能归纳", "d": "让 LLM 从轨迹里抽象出带 docstring 的函数，再改写原轨迹去调用它们。"},
    {"t": "PolySkill", "f": "用抽象类写技能", "d": "组合技能对着接口写一次，每个网站各写一份底层实现。"},
    {"t": "SAGE", "f": "训练技能复用的 RL 方法", "d": "把两个相关任务放进同一次 rollout。后面的任务复用了技能才多给奖励。"},
    {"t": "SkillsBench", "f": "技能评测基准", "d": "8 个领域、87 个任务，对比不给技能和给挑好的技能。"},
    {"t": "SkillRefiner", "f": "用运行轨迹改进技能", "d": "把成功和失败的运行分别聚类、提修改建议。重跑验证后合并成新技能。"},
    {"t": "Reflexion", "f": "带反思的重试", "d": "失败后让模型用自然语言写下哪里错了，带着它重做。讲师说做项目很值得实现。"},
    {"t": "STRIPS", "f": "经典规划语言", "d": "经典规划的写法。每个动作写明前提，以及做完状态怎么变。"},
    {"t": "BFS", "f": "Breadth-First Search，宽度优先搜索", "d": "一层一层往外搜，最先找到的计划步数最少。"},
    {"t": "DAG", "f": "Directed Acyclic Graph，有向无环图", "d": "没有环的依赖图。MACU 把任务拆成子任务画成 DAG，按依赖并行执行。"},
    {"t": "MACU", "f": "Multi-Agent Computer Use，多智能体电脑操作", "d": "用依赖图表示计划，靠它分解、执行、重新规划。就绪的子任务交给并行的电脑操作智能体。"},
    {"t": "RAO", "f": "Recursive Agent Optimization", "d": "训练模型用代码写计划、递归委派子任务。作业 3 的 TextCraft-Synth 出自它。"},
    {"t": "Odysseys", "f": "网页智能体基准", "d": "用志愿者捐出的真实浏览历史出题，比如给膝伤找外科医生。"},
    {"t": "Plan Mode", "f": "计划模式", "d": "编程智能体先只读调查、写出计划，人审过再执行。"},
    {"t": "Vending-Bench", "f": "长程任务基准", "d": "让智能体长时间经营一门简单的生意。"},
    {"t": "best-of-N", "f": "N 选一", "d": "采样 N 个候选，用评审挑最好的那个。"},
    {"t": "top-p", "f": "核采样（nucleus sampling）", "d": "只在累积概率达到 p 的那些候选 token 里采样。"},
    {"t": "SoM", "f": "Set-of-Marks，元素编号标注", "d": "在网页截图上给每个可交互元素画框编号。模型按编号说动作。"},
    {"t": "reranking", "f": "重排序", "d": "同一个问题采好几个候选，打完分挑最好的。模型本身不改，只多花推理的算力。"},
    {"t": "SayCan", "f": "LLM 规划加可供性打分", "d": "把 LLM 给技能的概率，乘上技能的价值函数。价值函数估的是这个技能此刻能不能做成。"},
    {"t": "AGENTS.md", "f": "写给编程智能体的说明文件", "d": "放在仓库里，写给智能体看的规则和约定。立场论文说用户拿它凑合当记忆，效果不错。"},
    // 编程智能体
    {"t": "SWE-bench", "a": ["SWE-Bench"], "f": "软件工程基准", "d": "用真实 GitHub issue 考编程智能体。改完代码，跑仓库里的测试判对错。"},
    {"t": "SWE-bench Verified", "f": "SWE-bench 的人工核验子集", "d": "人工核验过的子集。讲义说它已经饱和，不再能衡量最前沿的编程能力。"},
    {"t": "SWE-Gym", "f": "可执行的编程训练环境", "d": "用能跑测试的真实仓库环境造训练题、收集训练轨迹。"},
    {"t": "SWE-smith", "f": "批量造编程训练题", "d": "思路来自变异测试。在能跑通的仓库里造 bug，让测试新失败的改动就是一道题。"},
    {"t": "Commit0", "f": "实现库的基准", "d": "给库的骨架和测试，让智能体把很多函数实现出来。"},
    {"t": "HumanEval", "f": "函数级代码生成基准", "d": "照 docstring 补全 Python 函数，用隐藏的单元测试判。讲师说已经过时。"},
    {"t": "LiveCodeBench", "f": "持续更新的代码基准", "d": "曲线显示，模型在训练截止日前发布的题上分数更高。这说明静态基准会被污染。"},
    {"t": "Terminal-Bench", "f": "终端任务基准", "d": "在 Docker 容器里造好数据和依赖。智能体在终端里做完，再跑测试判对错。"},
    {"t": "BLEU", "f": "按 n-gram 重叠打分的指标", "d": "数生成结果和参考答案的 n-gram 重叠。表面像不等于对。"},
    {"t": "CodeBLEU", "f": "代码版 BLEU", "d": "除了 n-gram，还比较抽象语法树和数据流。"},
    {"t": "n-gram", "a": ["N-gram"], "f": "连续 n 个词的片段", "d": "连续 n 个 token 组成的片段，BLEU 数的就是它的重叠。"},
    {"t": "F1", "f": "F1 分数（F1 score）", "d": "同时看精确率和召回率的分类指标，是两者的调和平均。"},
    {"t": "FAIL_TO_PASS", "f": "修复后才通过的测试", "d": "PR 之前失败、之后通过的测试，检查要的功能修好没有。"},
    {"t": "PASS_TO_PASS", "f": "前后都要通过的测试", "d": "相关的老测试，确认没把别的东西改坏。"},
    {"t": "PR", "a": ["PRs"], "f": "Pull Request，拉取请求", "d": "把改动提给仓库维护者审查、合并的请求。"},
    {"t": "CI", "f": "Continuous Integration，持续集成", "d": "每次提交都自动构建、跑测试。讲义有专门修 CI 失败的任务。"},
    {"t": "linter", "f": "代码检查工具", "d": "不运行代码，只按规则检查风格和常见错误。"},
    {"t": "pass@k", "a": ["pass@1", "pass@2", "pass@4", "pass@8", "pass@N"], "f": "k 次里至少一次通过的概率", "d": "采样 k 个答案，至少一个通过全部测试的概率。k 越大越宽松，pass@1 就是一次做对。"},
    {"t": "diff", "f": "差异，改动对比", "d": "把改前和改后的代码逐行对比，标出增删的行。补丁、PR 评审和编辑格式都用它。"},
    {"t": "InCoder", "f": "会填空的代码模型", "d": "最早用填空目标训出的强编程模型之一。把缺的一段挪到末尾，模型就能看着前后文补中间。"},
    {"t": "MVP", "f": "最小可行产品", "d": "只带核心功能、能跑起来的第一版应用。ViBench 有一类题是在参考 MVP 上扩展功能。"},
    {"t": "Copilot Arena", "f": "IDE 里的代码模型对比平台", "d": "装在 IDE 里，在日常写代码时收集用户对模型输出的偏好。它的排名和静态基准差得很多。"},
    {"t": "SciCode", "f": "科研编程基准", "d": "考科研代码的基准。CollabSkill 论文拿它的官方排行做对比，那里 Codex 领先。"},
    // 电脑操作与网页智能体
    {"t": "OSWorld", "a": ["OSWorld-Verified"], "f": "桌面操作基准", "d": "在 Linux、Windows 上用各种真实应用做任务，做完检查最终状态。"},
    {"t": "WebArena", "f": "网页智能体基准", "d": "在本地自托管的购物、论坛、GitLab 等网站上做长任务。讲师说是 Graham 组的奠基性工作。"},
    {"t": "VisualWebArena", "f": "视觉版 WebArena", "d": "任务要看懂网页上的图片。它主张用截图做网页任务。"},
    {"t": "Mind2Web", "f": "网页动作基准", "d": "离线评测。给录好的截图序列，逐步预测下一个动作，全程不执行。"},
    {"t": "MiniWoB", "f": "Mini World of Bits", "d": "极度简化的合成网页任务，比如回复一封邮件。早年的玩具环境。"},
    {"t": "MyPCBench", "f": "生成环境的电脑操作基准", "d": "用编程智能体写出的应用克隆当环境，数据全是合成的。"},
    {"t": "CUA-World", "f": "CMU 的电脑操作基准", "d": "按各行业的 GDP 挑真实软件。自动装好软件、造好数据，再生成任务。"},
    {"t": "MolmoWeb", "f": "网页智能体模型", "d": "让能读无障碍树的模型去跑任务、收集轨迹。再用它们训练只看截图的模型。"},
    {"t": "Playwright", "f": "浏览器自动化库", "d": "用代码控制浏览器点击、输入、截图。讲义用它写可重复的网页检查。"},
    {"t": "Online-Mind2Web", "f": "真网站版 Mind2Web", "d": "在 136 个真网站上做 300 个任务。评审叫 WebJudge，和人的一致率 85.7%。"},
    {"t": "WebTailBench", "f": "网页任务测试集", "d": "讲义比较多智能体和单个智能体的四个测试集之一。在它上面，多智能体高出一截。"},
    {"t": "Gym-Anything", "f": "把软件变成智能体环境的框架", "d": "按各行业的 GDP 挑软件，让编程智能体自动下载安装、造好数据。CUA-World 的任务出自它。"},
    {"t": "CowPilot", "f": "人机协作的网页智能体框架", "d": "一个 Chrome 扩展。智能体提议下一步并高亮，人可以放行、暂停或接管。"},
    {"t": "CowCorpus", "f": "人机协作的网页轨迹数据集", "d": "20 位用户用 CowPilot 做网页任务，收了 400 条轨迹。每一步都记下是人还是智能体在动手。"},
    {"t": "PlowPilot", "f": "会预测插手的网页智能体", "d": "在 CowPilot 上加一个插手预测模块。只在预测人要插手时，才停下来请人确认。"},
    {"t": "PTS", "f": "Perfect Timing Score，完美时机分", "d": "评插手时机的指标，报对那一步得 1 分。提前误报按距离平方扣分，最后用 sigmoid 压到 0 到 1。"},
    // 深度研究
    {"t": "BrowseComp", "f": "多次搜索的问答基准", "d": "OpenAI 做的深度研究基准。先定答案再藏起名字、组合线索，要搜很多次。"},
    {"t": "BrowseComp-Plus", "f": "固定语料版 BrowseComp", "d": "把证据网页人工核验后固定成离线语料，结果能复现。"},
    {"t": "FinSearchComp", "f": "金融搜索基准", "d": "专家出的金融题，要专业知识，还得算出精确数字。"},
    {"t": "ScholarQABench", "f": "科研问答基准", "d": "专家给每题写 rubric 并加权，评审逐条判断，再加权求和。"},
    {"t": "ResearchQA", "f": "自动生成的科研问答", "d": "让 LM 从综述论文里生成问题和 rubric，能大规模做。"},
    {"t": "DeepResearch Bench", "f": "深度研究报告基准", "d": "评长篇研究报告，也核查引用。"},
    {"t": "DR Tulu", "f": "深度研究模型", "d": "用和策略一起演化的 rubric 当奖励，训练写开放式长报告。"},
    {"t": "Tongyi DeepResearch", "a": ["Tongyi-DeepResearch", "Tongyi-DR", "Tongyi"], "f": "通义的深度研究智能体", "d": "训练配方：知识图谱造题、中期训练、SFT，再做 RLVR。"},
    {"t": "OpenScholar", "f": "科研问答系统", "d": "检索论文、写带引用回答的系统。讲师在这项工作里用 rubric 评长答案。"},
    {"t": "BM25", "f": "Best Matching 25，经典关键词检索", "d": "按词频和文档长度给文档打分，不用训练。"},
    {"t": "AgentIR", "f": "为智能体做的检索", "d": "把智能体当前的推理一起交给检索器，搜得更准、次数更少。"},
    {"t": "DR-Synth", "f": "合成检索训练数据", "d": "用最终问题和答案给中间的搜索结果重排序。自动标出正例和反例。"},
    {"t": "HealthBench", "f": "医疗长答案基准", "d": "医疗领域的开放式长答案基准。讲义拿它和 ScholarQABench 等一起评深度研究模型。"},
    {"t": "PubMed", "f": "生物医学文献数据库", "d": "检索生物医学论文的数据库。讲义的例子里，一个智能体去它上面查蛋白质的问题。"},
    // 训练：SFT 与 RL
    {"t": "SFT", "f": "Supervised Fine-Tuning，监督微调", "d": "在录好的轨迹上做下一个 token 预测，只算模型自己写的部分。常当 RL 的冷启动。"},
    {"t": "RL", "f": "Reinforcement Learning，强化学习", "d": "让模型自己试，按奖励调整参数，最大化期望奖励。"},
    {"t": "RLVR", "f": "Reinforcement Learning with Verifiable Rewards，可验证奖励的强化学习", "d": "奖励由程序判对错，比如答案对不对、测试过没过。"},
    {"t": "RLHF", "f": "Reinforcement Learning from Human Feedback，基于人类反馈的强化学习", "d": "用从人类标注里学出的奖励模型做 RL。"},
    {"t": "REINFORCE", "f": "最基础的策略梯度算法", "d": "用整条轨迹的奖励给 log 概率的梯度加权。实现上就是给 SFT 损失加掩码、乘奖励。"},
    {"t": "PPO", "f": "Proximal Policy Optimization，近端策略优化", "d": "用单独的价值模型估基线，再裁剪每次更新的幅度。要多训一个模型，比较贵。"},
    {"t": "GRPO", "f": "Group Relative Policy Optimization，组相对策略优化", "d": "同一提示采一组输出，用组均值当基线算优势。不需要额外的价值模型。"},
    {"t": "DrGRPO", "a": ["Dr.GRPO"], "f": "修正版 GRPO", "d": "改了 GRPO 两处：优势不除以组内标准差，长度用全局常数归一。作业 3 照它做。"},
    {"t": "DAPO", "f": "GRPO 的一种改进", "d": "和 GRPO 一样只用当前动作的比率，裁剪方式不同。"},
    {"t": "CISPO", "f": "一种策略梯度算法", "d": "把裁剪后的比率当固定权重乘到梯度上。"},
    {"t": "GSPO", "f": "Group Sequence Policy Optimization", "d": "按整个回答算比率并按长度归一，不是逐 token 算。"},
    {"t": "KL", "f": "KL divergence，KL 散度", "d": "衡量两个分布差多远。RL 里加 KL 惩罚，让策略别离参考模型太远。"},
    {"t": "GAE", "f": "Generalized Advantage Estimation，广义优势估计", "d": "把每一步的 TD 误差从后往前加权累加，得到每一步的优势。"},
    {"t": "TD", "f": "Temporal Difference，时序差分", "d": "用下一步的价值来估计这一步，两者之差叫 TD 误差。"},
    {"t": "PRM", "f": "Process Reward Model，过程奖励模型", "d": "给每一步打分的奖励模型，可以替代价值函数。"},
    {"t": "LoRA", "f": "Low-Rank Adaptation，低秩适配", "d": "只训练插进去的小矩阵，不动原权重。托管训练服务靠它让很多用户各训各的。"},
    {"t": "ReST", "f": "Reinforced Self-Training，强化自训练", "d": "让模型自己生成，只留成功的轨迹做 SFT，再重复。"},
    {"t": "ReST-EM", "f": "ReST 的 EM 版", "d": "名字来自它和 EM 算法相似。二值奖励下是个简单有效的基线。"},
    {"t": "teacher forcing", "f": "教师强制", "d": "训练时总是接着记录的轨迹往下预测。部署时没有记录，每个动作都会改变后面的输入。"},
    {"t": "LLaMA-Factory", "f": "开源微调框架", "d": "讲师常用：把 rollout 或合成轨迹放进去、指定模型，就能微调。"},
    {"t": "OpenThoughts-Agent", "f": "智能体 SFT 数据工作", "d": "讲义用它的表说明怎么按轨迹形状过滤训练数据。"},
    {"t": "ADP", "f": "Agent Data Protocol，智能体数据协议", "d": "把各数据集统一改写成有类型的动作和观察。每个数据集、每个外壳各转换一次。"},
    {"t": "STEM", "f": "Science, Technology, Engineering, Mathematics，理工科", "d": "科学、技术、工程、数学几类题。讲义说这类轨迹长，按条数配比会吃掉大部分 token。"},
    {"t": "critic", "f": "评论家，评判模型", "d": "预测从这一步往后平均还能拿多少奖励，也就是价值函数。PPO 要单独训一个这样的模型。"},
    {"t": "ORM", "f": "结果奖励模型", "d": "只看最后结果，给整条轨迹一个分。和它相对的是给每一步打分的 PRM。"},
    // RL 系统
    {"t": "SkyRL", "f": "开源 RL 训练框架", "d": "实现了 Tinker API。作业 3 可以用它在 Modal 上自建训练后端。"},
    {"t": "Miles", "f": "开源 RL 训练框架", "d": "讲义列出的 RL 框架之一，也实现了 Tinker API。"},
    {"t": "PrimeRL", "f": "开源 RL 训练框架", "d": "为每个模型提供 renderer，可选保留推理或不要推理。目的都是保住前缀。"},
    {"t": "Megatron", "f": "大模型训练引擎", "d": "英伟达的大规模训练框架，RL 框架里常当训练引擎。"},
    {"t": "FSDP2", "f": "训练引擎", "d": "常用的两种训练后端之一，另一种是 Megatron。规模大时多用 Megatron。"},
    {"t": "PyTorch", "f": "深度学习框架", "d": "最常用的深度学习框架。RL 框架不直接用它手写，因为采样和训练是两种负载。"},
    {"t": "Tinker", "f": "Thinking Machines 的训练服务", "d": "本地写训练循环，GPU 上的训练和采样封装成服务。作业 3 对着它的 API 写。"},
    {"t": "TITO", "a": ["Token-In Token-Out"], "f": "Token-In Token-Out，token 进 token 出", "d": "直接存 token id 和 logprob，不存字符串。重新分词可能得到不同的 token。"},
    {"t": "logprob", "a": ["logprobs"], "f": "log probability，对数概率", "d": "采样出的 token 的概率取对数。RL 训练用它算比率和梯度。"},
    {"t": "staleness", "f": "过期度", "d": "数据是几个权重版本之前的策略采的。异步 RL 里过期太多的组会被丢掉。"},
    {"t": "verl", "f": "开源 RL 训练框架", "d": "讲义列出的 RL 框架之一。它把训练引擎和推理引擎组合起来，功能暴露给你。"},
    {"t": "AReaL", "f": "开源 RL 训练系统", "d": "讲义拿它举了几个例子，比如动态树注意力。它在 1.0 之前是单程序模式，后来改成服务化。"},
    // 安全、沙箱与监控
    {"t": "Docker", "f": "容器工具", "d": "把程序和依赖打包进容器隔离运行。本地沙箱的默认选择。"},
    {"t": "Dockerfile", "f": "容器镜像的构建脚本", "d": "一步步写明怎样搭出运行环境。"},
    {"t": "Apptainer", "f": "容器工具", "d": "适合共享集群的容器，以你自己的用户身份运行。以前叫 Singularity。"},
    {"t": "QEMU", "f": "虚拟机，系统模拟器", "d": "运行一个完整客户机操作系统的虚拟机，可以当本地沙箱。"},
    {"t": "E2B", "f": "云端沙箱服务", "d": "通过 API 创建和控制的云沙箱，讲义拿它讲暂停和恢复。"},
    {"t": "AgentDojo", "f": "提示注入基准", "d": "测智能体会不会听从藏在数据里的攻击者指令。"},
    {"t": "AgentHarm", "f": "恶意请求基准", "d": "测智能体会不会帮恶意用户干坏事，比如偷支付卡数据。"},
    {"t": "ToolEmu", "f": "有风险工具使用的测试", "d": "测智能体会不会出错，比如让它查余额，它却把钱转出去。"},
    {"t": "Docent", "f": "Transluce 的轨迹分析工具", "d": "帮人成批读智能体轨迹、提出和检验假设。讲义用它查清一次分数退步。"},
    {"t": "Hodoscope", "f": "CMU 的轨迹聚类工具", "d": "把智能体的动作聚类，发现没想到要查的行为。"},
    {"t": "microVM", "f": "轻量虚拟机", "d": "有自己操作系统内核的小虚拟机，靠 hypervisor 和宿主机隔开。OpenAI 把容器放在它里面跑。"},
    {"t": "hypervisor", "f": "虚拟机监控器", "d": "管理虚拟机的那层软件，把虚拟机和宿主机隔开。"},
    {"t": "air-gap", "f": "物理隔离，完全断网", "d": "让系统和外部网络彻底断开。OpenAI 说训练现在做不到，因为跑实验和监控都要外部连接。"},
    {"t": "Kata Containers", "f": "开源的容器运行时", "d": "把容器放进轻量虚拟机里跑的开源项目。OpenAI 红队找到逃逸漏洞后，把修补回馈给了它。"},
    {"t": "gVisor", "f": "开源的容器沙箱", "d": "在用户态接管容器的系统调用，挡在容器和宿主机内核之间。OpenAI 红队的修补也回馈给了它。"},
    {"t": "Spectre", "f": "处理器漏洞攻击", "d": "靠处理器缓存的计时差偷读数据的攻击。OpenAI 说隔离的智能体传话也用了同一种计时手法。"},
    {"t": "Meltdown", "f": "处理器漏洞攻击", "d": "和 Spectre 同类的攻击，也靠处理器缓存的计时差偷读数据。"},
    {"t": "TLS", "f": "传输层安全协议", "d": "给网络连接加密的协议，网址里的 https 就靠它。OpenAI 发现连它的证书缓存都能拿来传话。"},
    {"t": "DNS", "f": "域名系统", "d": "把网址里的域名翻译成 IP 地址的系统。OpenAI 的模型钻过 DNS 解析器的配置错误，拿到了有限的外网访问。"},
    {"t": "Cybench", "f": "网络安全挑战题基准", "d": "由网络安全挑战题组成的基准。讲义例子里，智能体读了题目的 Dockerfile，直接看到了秘密答案。"},
    {"t": "OpenTelemetry", "f": "开源的可观测性标准", "d": "统一记录程序调用、日志和指标的开源标准。它为生成式 AI 定了属性规范，可用来统一记录各种调用。"},
    {"t": "SSH", "f": "远程登录协议", "d": "在本机终端里远程登录另一台机器。讲师提醒，能 SSH 进所有机器的智能体是个大隐患。"},
    // 智能体与人的工作
    {"t": "GDPval", "f": "真实职业任务评测", "d": "行业专家出的真实工作任务，用专家写的 rubric 加 LLM 评审打分。"},
    {"t": "Remote Labor Index", "f": "远程劳动指数", "d": "用真实的远程外包项目测智能体。讲义上第一名的自动化率也很低。"},
    {"t": "TheAgentCompany", "f": "模拟公司的基准", "d": "在自托管的模拟公司里做工作任务，比如用 GitLab 代替 GitHub。"},
    {"t": "O*NET", "f": "Occupational Information Network，美国职业信息网络", "d": "美国的职业数据库，把每个职业描述成一组任务。"},
    {"t": "Lean", "f": "开源的编程语言和证明助手", "d": "能写形式化证明、由机器检查对错的语言。讲义拿它举例：能验证的任务可以靠执行来评。"},
    {"t": "APEX", "a": ["APEX-Agents"], "f": "专业职业任务基准", "d": "投行、咨询、法律、初级医疗这类专业工作的任务。CollabSkill 从它和 APEX-Agents 里取题。"},
    {"t": "Upwork", "f": "自由职业外包平台", "d": "雇人做远程项目的网站。CollabSkill 在上面招了 93 位美国的从业者。"},
    {"t": "CollabSkill", "f": "人机协作评测", "d": "让真实从业者配不同智能体做职业任务。再把人和智能体的本事拆开，给智能体排协作名次。"},
    {"t": "Spearman", "f": "Spearman 秩相关系数", "d": "按名次算的相关系数，只看两组数的排序一不一致。"},
    {"t": "k-means", "f": "k 均值聚类", "d": "把数据点分成 k 堆，每个点归到离它最近的中心。论文用它把 20 个用户分成四种风格。"},
    // 多智能体
    {"t": "ChatDev", "f": "虚拟软件公司", "d": "让 LLM 扮演 CEO、CTO、程序员等角色，两两聊天写软件。分设计、编码、测试三个阶段。"},
    {"t": "CAID", "f": "异步软件工程智能体", "d": "管理者画依赖图派活，工程师在隔离的工作区里并行干。最后管理者用 Git 合并大家的提交。"},
    {"t": "DeLM", "f": "去中心化多智能体系统", "d": "智能体从公开的任务队列领活，进展写到只追加的公告板上。讲义标它比原生子智能体快 5.5 倍。"},
    {"t": "GitSwarm", "f": "用 Git 协调智能体群", "d": "仓库就是共享记忆，每份贡献是一个不可改的原子提交。智能体各自看仓库、挑父提交、接着做。"},
    {"t": "SWEET-RL", "f": "多轮协作智能体的 RL 训练方法", "d": "把人机协作当成多智能体任务来训练。任务分后端编程和前端设计，人一轮轮补充需求。"},
    {"t": "PPP", "f": "Productivity、Proactivity、Personalization，完成任务、主动、个性化", "d": "训练主动、个性化的智能体。奖励是完成任务、主动提问、照顾偏好三项相加。"},
    {"t": "GlossoGen", "f": "多智能体涌现语言的研究", "d": "两个智能体合作稳住一个虚构的物体。合作多轮后，它们发展出外人看不懂的缩写。"},
    {"t": "METR", "f": "独立的 AI 研究机构", "d": "讲义引了它对 OpenAI 和 Hugging Face 入侵事件的独立调查。智能体在那次事件里用目录名互相传话。"},
    {"t": "Magentic Marketplace", "f": "模拟智能体市场的开源环境", "d": "顾客和商家各有自己的智能体，经过搜索、沟通、成交三步。"},
    {"t": "ARC-AGI-3", "f": "小游戏闯关测试集", "d": "由一个个小游戏组成，看平均能走到第几关。讲义拿它比较通信团队和独立跑 5 次取最好。"},
    {"t": "QuALITY", "f": "长文阅读理解问答集", "d": "题目出自古腾堡故事的阅读理解。讲义拿它测辩论能不能帮没读原文的裁判答对。"},
    // 作业
    {"t": "Harbor", "a": ["harbor"], "f": "评测任务框架", "d": "把任务定义成自带沙箱和判定的目录，任何智能体都能跑。作业 2 用它打包自出的题。"},
    {"t": "Modal", "f": "云计算平台", "d": "按需开容器和 GPU 的云平台。作业的沙箱和训练后端都跑在上面。"},
    {"t": "Ollama", "f": "本机跑模型的工具", "d": "在自己电脑上下载和运行开放权重模型。本机复原作业时用它当替身。"},
    {"t": "uv", "f": "Python 包和环境管理工具", "d": "建虚拟环境、按 uv.lock 装依赖、用 uv run 运行。作业都用它。"},
    {"t": "CodeAgent", "f": "作业 1 的编程智能体", "d": "ReAct 循环的子类。在 Modal 沙箱里修象棋应用，也修 SWE-bench 问题。"},
    {"t": "ChessAgent", "f": "作业 1 的下棋智能体", "d": "同一个循环的子类，通过工具调用象棋服务下棋。"},
    {"t": "FEN", "f": "Forsyth-Edwards Notation", "d": "一行字符串描述完整的棋局局面。"},
    {"t": "UCI", "f": "Universal Chess Interface，通用国际象棋接口", "d": "着法写成起点格加终点格，比如 e2e4。"},
    {"t": "MCC", "f": "Matthews Correlation Coefficient，马修斯相关系数", "d": "用 TP、TN、FP、FN 一起算的指标。正负例很不均衡时比准确率可靠。"},
    {"t": "macro-MCC", "a": ["macro"], "f": "各类 MCC 的平均", "d": "四类错误各算一个 MCC，再简单平均。作业 2 的成绩有一部分看它。"},
    {"t": "TP", "f": "True Positive，真阳性", "d": "人工标了这类错误，判卷器也报了。"},
    {"t": "TN", "f": "True Negative，真阴性", "d": "人工没标，判卷器也没报。"},
    {"t": "FP", "f": "False Positive，假阳性", "d": "人工没标，判卷器却报了。"},
    {"t": "FN", "f": "False Negative，假阴性", "d": "人工标了，判卷器却没报。"},
    {"t": "sidecar", "f": "附带的数据文件", "d": "智能体画图时另存的一份 JSON，记下画进图里的数。判定器拿它核对。"},
    {"t": "oracle", "f": "参考解", "d": "Harbor 里跑参考解的方式。每道自出题的 oracle 必须拿 1.0。"},
    {"t": "nop", "f": "no-op，什么都不做", "d": "Harbor 里的空智能体，用来确认什么都不做只能拿 0。"},
    {"t": "Number Search", "f": "猜数字环境", "d": "在 [low, high] 里猜一个藏起来的整数。环境回答太小、太大或猜中。"},
    {"t": "TextCraft-Synth", "a": ["TextCraft"], "f": "文字合成环境", "d": "从初始库存出发，按配方合成目标物品。作业 3 最后在它上面做主力训练。"},
    {"t": "ScottyRL", "f": "作业 3 的极简 RL 框架", "d": "把多轮回合拼成训练序列，补全同步的 REINFORCE、GRPO 和异步 GRPO。"},
    {"t": "heredoc", "f": "内嵌文档", "d": "在 shell 里用 << 'EOF' 把多行文本直接写进命令。智能体常这样写文件。"},
    {"t": "WCAG", "f": "网页无障碍标准", "d": "规定了文字和背景对比度的算法。作业 2 用它判文字看不看得清。"},
    {"t": "Agg", "f": "matplotlib 的无界面后端", "d": "没有显示器也能画图、存图。"},
    {"t": "dpi", "f": "dots per inch，每英寸点数", "d": "图的分辨率。英寸尺寸乘 dpi 就是像素数。"},
    {"t": "CRLF", "f": "回车换行符", "d": "Windows 的换行符。脚本带 CRLF，在 Linux 里会找不到解释器。"},
    {"t": "base64", "f": "Base64 编码", "d": "把二进制数据编码成纯文本字符，方便塞进命令或 JSON。"},
    {"t": "sha256", "f": "SHA-256 哈希", "d": "把文件内容算成固定长度的摘要，改一个字节摘要就变。"},
    {"t": "PYTHONPATH", "f": "Python 模块搜索路径", "d": "告诉 Python 去哪些目录找包。作业 1 设成 src 才能导入 assignment 包。"},
    {"t": "httpx", "f": "Python 的 HTTP 客户端库", "d": "发 HTTP 请求的库。ChessAgent 用它调象棋服务。"},
    {"t": "asyncio", "f": "Python 的异步库", "d": "让多个等网络的任务同时进行。作业 3 用它并发跑多个回合。"},
    // 库和开发工具
    {"t": "SDK", "f": "Software Development Kit，软件开发工具包", "d": "官方提供的代码库，让你不用直接调底层接口。"},
    {"t": "CLI", "f": "Command-Line Interface，命令行界面", "d": "在终端里敲命令来用的程序。"},
    {"t": "IDE", "f": "Integrated Development Environment，集成开发环境", "d": "把写代码、调试、运行放在一起的软件，比如 Cursor。"},
    {"t": "bash", "f": "Bourne Again Shell", "d": "最常见的 shell。最简单的编程智能体只给一个 bash 工具。"},
    {"t": "grep", "f": "文本搜索命令", "d": "按模式在文件里搜文字的命令行工具。"},
    {"t": "Hugging Face", "f": "模型和数据集托管平台", "d": "存放开放权重模型和数据集的网站。"},
    {"t": "matplotlib", "a": ["Matplotlib"], "f": "Python 画图库", "d": "最常用的 Python 画图库。作业 2 被测的智能体用它画图。"},
    {"t": "seaborn", "f": "Python 统计画图库", "d": "建在 matplotlib 上的画图库。"},
    {"t": "scipy", "f": "Python 科学计算库", "d": "统计、优化等科学计算函数库。"},
    {"t": "NumPy", "a": ["numpy"], "f": "Python 数组计算库", "d": "做多维数组和数值计算的基础库。"},
    {"t": "pandas", "f": "Python 表格数据库", "d": "读写和处理表格数据的库。"},
    {"t": "Pillow", "a": ["PIL"], "f": "Python 图像库", "d": "读写和处理图片的库，PIL 是它的导入名。作业 2 用它解码 PNG、读像素。"},
    {"t": "pytest", "f": "Python 测试框架", "d": "跑单元测试的工具。作业的公开测试都用它跑。"},
    {"t": "CSV", "f": "Comma-Separated Values，逗号分隔值", "d": "一行一条记录、逗号分隔字段的表格文本。作业 2 的数据就是 CSV。"},
    {"t": "PNG", "f": "Portable Network Graphics", "d": "无损压缩的图片格式。作业 2 要智能体交一张 figure.png。"},
    {"t": "HTML", "f": "HyperText Markup Language，超文本标记语言", "d": "网页的源码格式。无障碍树可以看成简化的 HTML。"},
    {"t": "OCR", "f": "光学字符识别", "d": "从图片里认出文字。"},
    {"t": "GPU", "f": "Graphics Processing Unit，图形处理器", "d": "训练和推理大模型用的加速卡。"},
    {"t": "H100", "f": "英伟达的数据中心 GPU", "d": "作业 3 的训练后端在 Modal 上用 2 张 H100。"},
    {"t": "shell", "f": "命令行解释器", "d": "读你敲的命令并执行的程序，bash 就是一种。注意它和笔记里说的外壳（harness）不是一回事。"},
    {"t": "npm", "f": "JavaScript 的包管理器", "d": "装依赖、跑脚本的命令行工具。TypeScript 项目常用 npm test 跑测试。"},
    {"t": "GDB", "f": "命令行调试器", "d": "能让程序停在断点、查看变量的调试工具。讲师说它也能直接从 bash 里跑。"},
    {"t": "CUDA", "f": "英伟达 GPU 的编程平台", "d": "在英伟达 GPU 上写并行计算程序用的平台。讲义拿它的版本号举了压缩丢约束的例子。"},
    {"t": "CPU", "f": "中央处理器", "d": "电脑里跑一般程序的处理器。智能体跑代码会吃 CPU，所以沙箱要限制资源。"}
  ];

  var SKIP = 'pre,code,kbd,.code,.stage,.cv,.walk-code,.lv,.lvi,.lv-note,script,style,svg,a,button,textarea,input,select,h1,h2,.gl,.gl-card,.ts,.lvb,.ep-head,.kicker,.vz,.vz-player,[data-vz],figure.dg,.chips,.sidebar,.topbar,.toc,.stats,.side,.pill,.co-tag';
  var map = {}, alts = [];
  GLOSSARY.forEach(function (e) {
    [e.t].concat(e.a || []).forEach(function (k) { map[k] = e; alts.push(k); });
  });
  alts.sort(function (a, b) { return b.length - a.length; });
  var RX = new RegExp('(^|[^A-Za-z0-9_\\-./])(' + alts.map(function (s) { return s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); }).join('|') + ')(?![A-Za-z0-9_]|[-./][A-Za-z0-9])', 'g');

  function wrapText(node) {
    var s = node.nodeValue, m, last = 0, frag = null;
    RX.lastIndex = 0;
    while ((m = RX.exec(s))) {
      var at = m.index + m[1].length, word = m[2];
      if (!frag) frag = document.createDocumentFragment();
      if (at > last) frag.appendChild(document.createTextNode(s.slice(last, at)));
      var sp = document.createElement('span');
      sp.className = 'gl';
      sp.setAttribute('tabindex', '0');
      sp.setAttribute('data-gl', map[word].t);
      sp.textContent = word;
      frag.appendChild(sp);
      last = at + word.length;
      RX.lastIndex = last;
    }
    if (!frag) return;
    if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }

  function apply(root) {
    if (!root) return;
    ensure();                                    // 样式要在悬停之前就有，否则下划线看不见
    var w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (n.nodeType === 1) return n.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
        return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    var nodes = [], n;
    while ((n = w.nextNode())) nodes.push(n);
    nodes.forEach(wrapText);
  }

  function strip(root) {
    if (!root) return;
    Array.prototype.slice.call(root.querySelectorAll('.gl')).forEach(function (s) {
      s.parentNode.replaceChild(document.createTextNode(s.textContent), s);
    });
    root.normalize();
  }

  // 一张卡片，所有术语共用
  var card = null, timer = 0, cur = null;
  function ensure() {
    if (card) return card;
    var st = document.createElement('style');
    st.setAttribute('data-gen', '');
    st.textContent =
      '.gl{cursor:help;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px;' +
      'text-decoration-color:color-mix(in srgb,currentColor 25%,transparent)}' +
      '.gl:focus{outline:none}.gl:hover,.gl:focus{text-decoration-color:currentColor;background:color-mix(in srgb,#2563eb 10%,transparent);border-radius:3px}' +
      '.gl-card{position:fixed;z-index:9999;max-width:320px;padding:10px 13px;border-radius:10px;font-size:13px;line-height:1.6;font-weight:400;' +
      'background:var(--bg-2,#fff);color:var(--fg,#1a1a1a);border:1px solid var(--line,#ddd);box-shadow:0 8px 24px rgba(0,0,0,.14);pointer-events:auto;text-align:left}' +
      '.gl-card b{display:block;font-size:14px;margin-bottom:1px}.gl-card i{display:block;font-style:normal;font-size:12px;color:var(--fg-3,#667085);margin-bottom:5px}' +
      '.gl-card p{margin:0}@media print{.gl{text-decoration:none}.gl-card{display:none}}';
    document.head.appendChild(st);
    card = document.createElement('div');
    card.className = 'gl-card';
    card.setAttribute('data-gen', '');
    card.setAttribute('role', 'tooltip');
    card.style.display = 'none';
    card.addEventListener('mouseenter', function () { clearTimeout(timer); });
    card.addEventListener('mouseleave', hide);
    document.body.appendChild(card);
    return card;
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function show(sp) {
    var e = map[sp.getAttribute('data-gl')];
    if (!e) return;
    ensure();
    cur = sp;
    card.innerHTML = '<b>' + esc(e.t) + '</b><i>' + esc(e.f) + '</i><p>' + esc(e.d) + '</p>';
    card.style.display = 'block';
    var r = sp.getBoundingClientRect(), w = card.offsetWidth, h = card.offsetHeight, vw = document.documentElement.clientWidth;
    var x = Math.max(8, Math.min(r.left, vw - w - 8)), y = r.bottom + 7;
    if (y + h > innerHeight - 8) y = Math.max(8, r.top - h - 7);
    card.style.left = x + 'px';
    card.style.top = y + 'px';
  }
  function hide() {
    clearTimeout(timer);
    timer = setTimeout(function () { if (card) card.style.display = 'none'; cur = null; }, 120);
  }
  document.addEventListener('mouseover', function (e) {
    var sp = e.target.closest && e.target.closest('.gl');
    if (sp) { clearTimeout(timer); timer = setTimeout(function () { show(sp); }, 130); }
  });
  document.addEventListener('mouseout', function (e) { if (e.target.closest && e.target.closest('.gl')) hide(); });
  document.addEventListener('focusin', function (e) { if (e.target.classList && e.target.classList.contains('gl')) show(e.target); });
  document.addEventListener('focusout', function (e) { if (e.target.classList && e.target.classList.contains('gl')) hide(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && card) card.style.display = 'none'; });
  document.addEventListener('click', function (e) {             // 手机上没有悬停，点一下显示
    var sp = e.target.closest && e.target.closest('.gl');
    if (sp) show(sp); else if (card && !(e.target.closest && e.target.closest('.gl-card'))) card.style.display = 'none';
  });
  addEventListener('scroll', function () { if (card && card.style.display !== 'none') card.style.display = 'none'; }, { passive: true, capture: true });

  window.GL = { apply: apply, strip: strip, terms: GLOSSARY, ensure: ensure };
})();
