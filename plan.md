# GrepWorks — Build Plan

## 目标

自动扫描国内外主流招聘平台，按关键词和时间过滤岗位，对每个岗位做结构化分析，输出可操作的表格。

**核心交付物：** 一张表，每行一个岗位，包含：公司分析 / JD分析 / 简历修改建议 / 岗位URL / 综合评分。

---

## 架构

```
gwks scan
  ↓
[OpenCLI Browser Bridge]
  browser adapter 打开搜索页 → 点城市筛选 → 提取搜索结果卡片
  字段：title / company / salary / location / url
        ↓
[过滤层 filter.mjs]
  - 关键词命中（title）
  - 地点过滤
  - 薪资下限
  - URL 去重（seen.tsv 跨次 + 本次内去重）
        ↓
  写入 search_results/pending.json
        ↓
AI 读取 EVALUATE_JOBS.md 规范，在当前 session 内执行
  读取 pending.json + cv.md
  Block A–G 逐岗评估
        ↓
[输出层]
  evaluation_results/evaluation-{date}-{N}.md + .json
  清空 pending.json
```

---

## 技术栈

| 层 | 技术 |
|----|------|
| CLI 入口 | `gwks` 命令（`npm install -g .`） |
| 浏览器控制 | OpenCLI + Browser Bridge Chrome 扩展 |
| 爬虫适配器 | `src/adapters/*.mjs`，browser-based |
| 评估引擎 | `EVALUATE_JOBS.md` 规范，AI 读取后按 Block A–G 框架执行，无需独立 API Key |
| 脚本语言 | Node.js (ESM .mjs) |
| 数据存储 | `search_results/`（中间数据）+ `evaluation_results/`（最终结果） |
| 运行方式 | 手动触发，本地运行，Chrome 保持登录 |

**CLI 用法示例：**
```bash
gwks scan                          # 用 task.yml 配置扫描
gwks scan --keyword "agent开发" --after 2026-05-20
gwks scan --platform liepin
gwks results                       # 查看最近一次输出
```

---

## 组件详情

### 1. OpenCLI 适配器层

**目标平台：**

| 平台 | adapter 状态 | 备注 |
|------|-------------|------|
| 猎聘 | ✅ 完成 | `adapters/liepin.mjs`，browser-based |
| 智联招聘 | 待写 | |
| 前程无忧 51job | 待写 | |
| 脉脉 | 待写 | 职言区也可抓公司舆情 |
| Indeed 中国 | 待写 | indeed.com.cn |
| LinkedIn | 待写 | 原计划用内置 adapter，待验证 |

**猎聘 adapter 实现方式（browser-based，已完成）：**
- `adapters/liepin.mjs`：`searchLiepin(keyword, afterDate, location, session)`
- 打开搜索页 → 点城市筛选（`b64eval` + `li.click()`）→ `browser eval` 提取 card 数据
- 字段：`title / company / salary / location / url / platform`
- `published_at` 不在搜索 card 里，暂为 null（详情页才有）⚠️ 导致 after_date 过滤失效
- `jd_text` 不在搜索 card 里，暂为 null（详情页才有）⚠️ 评估引擎只能基于 title/salary/location，建议质量有限
- 城市筛选在猎聘侧生效，`filter.mjs` 同时做 location 后过滤兜底
- **下一步**：`fetchLiepinDetail(url)` 进入详情页抓取 JD 全文 + published_at，在 scan 写 pending.json 前批量富化

**输出 schema：**
```json
{
  "title": "AI Agent 开发工程师",
  "company": "某公司",
  "url": "https://...",
  "location": "上海",
  "published_at": "2026-05-21",
  "salary": "30-50K"
}
```

---

### 2. 过滤层

文件：`filter.mjs`

```
输入：岗位列表（JSON）
规则：
  - published_at >= 配置的截止日期
  - title 包含任意正向关键词（可配置）
  - url 不在 seen.tsv 去重记录中
输出：待评估岗位列表
副作用：新 url 追加写入 seen.tsv
```

---

### 3. 评估引擎

参考 career-ops 的 Block 框架，每个岗位输出：

| Block | 内容 |
|-------|------|
| A | 岗位分类（职能 / 级别 / 远程政策） |
| B | 与用户简历的匹配度（技术栈 / 经验） |
| C | 公司分析（规模 / 融资 / 业务方向） |
| D | 薪资水位判断 |
| E | **简历修改建议**（针对此岗位需要调整哪些） |
| G | 招聘真实性（幽灵岗检测） |

**实现方式：Claude Code skill `/evaluate-jobs`**，在当前 session 内执行，无需独立 API Key。prompt 包含：用户简历 + JD全文 + 评估指令。

**输出 schema（machine-readable YAML）：**
```yaml
company: xxx
role: xxx
url: https://...
score: 4.2          # 1-5
archetype: agentic
match_summary: "技术栈高度匹配，缺乏大规模部署经验"
cv_suggestions:
  - "突出 LangGraph 多智能体编排经验"
  - "加入 RAG 系统吞吐量指标"
hard_stops: []
legitimacy: high
final_decision: apply
```

---

### 4. 输出层

文件：`evaluation_results/evaluation-{date}-{N}.md`（date=当天日期，N=当日序号两位数字）

```markdown
# 2026-05-25 #1

| # | 公司 | 岗位 | 评分 | 匹配摘要 | 简历建议 | 真实性 | URL |
|---|------|------|------|---------|---------|--------|-----|
| 1 | xxx  | AI Agent工程师 | 4.2 | 技术栈匹配 | 突出多智能体经验 | ✅ | [...] |
```

同时输出 `evaluation_results/evaluation-{date}-{N}.json` 供后续分析。

---

## 文件结构

```
grepworks/
├── src/
│   ├── adapters/
│   │   └── liepin.mjs                      # 猎聘 browser adapter（b64eval + 城市筛选）
│   ├── cli.mjs                             # gwks 命令入口（commander）
│   ├── scan.mjs                            # 抓取主流程：adapter → 过滤 → pending.json
│   ├── filter.mjs                          # 过滤逻辑（关键词 / 地点 / 薪资 / 去重）
│   └── render.mjs                          # 输出渲染
├── .agents/skills/evaluate-jobs/
│   └── evaluate-jobs-skill.md              # /evaluate-jobs Claude Code skill
├── tests/
│   └── eval.mjs                            # filter 单元测试
├── search_results/
│   ├── pending.json                        # 待评估岗位（scan 写，evaluate-jobs 清）
│   └── seen.tsv                            # 去重记录
├── evaluation_results/
│   └── evaluation-{date}-{N}.md/.json     # 评估结果（同一天多次序号递增）
├── task.yml                                # 用户配置（关键词 / 日期 / 平台 / 地点）
├── cv.md                                   # 用户简历（gitignored）
├── plan.md                                 # 本文件
└── README.md                               # 快速上手
```

## 技术发现（开发过程中积累）

### Windows Node.js spawn：eval JS 参数被 shell 拆分
- `spawn('opencli', [..., 'eval', jsCode], { shell: true })` 在 Windows 下，Node.js 把整个命令拼成 `cmd /c "opencli ... eval <js>"` 传给 `cmd.exe`；cmd.exe 在 js 字符串里按空格拆参数，导致 opencli 收到多个参数报错
- `shell: false` + `opencli.cmd` 不行：`.cmd` 文件在 Windows 必须通过 shell 执行
- `browser get html --as json` 也不行：多 selector 匹配时永远只返回第一个 match（`matched: N` 但 `tree` 为单数）
- **最终解法**：`b64eval(js)` —— 把 JS base64 编码，调用 `eval(atob('<b64>'))` 传参，base64 字符串无空格不会被 shell 拆分

### atob() 的 UTF-8 中文损坏问题
- `atob()` 按 Latin-1（单字节）解码 base64，中文 UTF-8 多字节序列会被截断，导致 JS 里的中文字面量（如 `'苏州'`）与 DOM 读出的字符串比对永远失败
- **解法**：改用 `eval(decodeURIComponent(escape(atob('<b64>'))))` —— `escape()` 把 Latin-1 高字节转成 `%XX`，`decodeURIComponent()` 再按 UTF-8 还原，中文完整保留

### Node.js 进程警告混入 stderr
- opencli 自身会输出 `(node:XXXX) [UNDICI-EHPA] Warning: EnvHttpProxyAgent is experimental` 到 stderr，即使命令成功
- 若 opencli 以非零退出，警告和真正的错误混在一起，错误信息被淹没
- **解法**：过滤 stderr 中以 `(node:` 开头的行，只保留真正的 opencli 错误内容

### 猎聘 DOM 结构（截至 2026-05-24）
- 搜索结果 card wrapper：`div._40108yn42Q`
- 职位链接：`a[data-nick="job-detail-job-info"]`
- 标题：`[title^="招聘"]`（去掉"招聘"前缀即职位名）
- 薪资：`._40108E8PWS`
- 地点：`._40108__9nJ > .ellipsis-1`
- 公司名：`._40108K6Y1c`（未登录可见，猎头帖脱敏）
- `published_at` 不在 card 里，在详情页

---

## 配置文件示例

```yaml
# task.yml
search:
  keywords: ["agent开发", "AI Agent", "LLM工程师", "大模型应用"]
  platforms: ["liepin", "zhilian", "51job", "maimai", "indeed-cn", "linkedin"]
  after_date: "2026-05-20"

filter:
  min_salary_k: 25       # 可选，低于此薪资跳过
  exclude_keywords: ["外包", "实习"]

cv_path: ./cv.md

output:
  format: ["md", "json"]
  dir: ./output
```

---

## 实施阶段

### Phase 1 — 基础跑通（1-2天）
- [x] 安装 OpenCLI `@jackwener/opencli@1.8.0`
- [x] Browser Bridge 扩展安装完毕，profile: `a6htcuvk`（已用 `opencli profile rename a6htcuvk work` 设别名）
- [x] `opencli doctor` 验证通过（daemon v1.8.0，extension v1.0.15）
- [x] `opencli-browser` skill 装入 Claude Code（`.agents/skills/opencli-browser`）
- [x] GrepWorks 项目初始化（`package.json`，ESM，bin: `gwks`）
- [x] opencli PATH 问题解决：`opencli.ps1 / .cmd / 无后缀` 均在 `D:\DevTools\nodejs\npm\` 下，PowerShell / Bash 均可直接调用
- [x] 核心代码文件全部写完：`cli.mjs` / `scan.mjs` / `filter.mjs` / `evaluate.mjs` / `render.mjs` / `task.yml` / `cv.md` / `test-eval.mjs`；依赖 `@anthropic-ai/sdk js-yaml commander` 已装
- [x] 猎聘浏览器抓取验证：手动用 `opencli browser eval` 抓到 40 个岗位，字段 title/company/salary/location/url 全部干净；公司名未登录也可见（猎头帖脱敏为"某XXX公司"，直招帖显示真名）；`published_at` 不在搜索结果 card 里，需进详情页才有
- [x] 猎聘 adapter 完成：`adapters/liepin.mjs`，用 `get html --as json` 替代 eval（避免 Windows shell 引号问题），`findNode` 解析 JSON 树提取字段
- [x] `scan.mjs` 接入 liepin adapter，`filter.mjs` 加地点过滤，`cli.mjs` 加 `--location` flag
- [x] 两个 bug 全部修完，`gwks scan --platform liepin --dry-run` 端到端跑通
  - `get html` 永远只返回第一个 match，改回 `browser eval` + base64 编码绕过 Windows shell 拆参问题
  - 城市点击：`atob()` 按 Latin-1 解码，中文 UTF-8 损坏导致字符串比对失败；改用 `eval(decodeURIComponent(escape(atob('...'))))` 正确还原 UTF-8
  - stderr 过滤：剔除 `(node:` 开头的 Node.js 运行时警告，只保留真正的 opencli 错误
  - 验证：苏州筛选在猎聘侧生效，"大模型应用"关键词在苏州找到 42 条结果，最终过滤出 17 个新岗位
- [x] `filter.mjs` 去重逻辑验证：seen.tsv 正常写入，重复 URL 被过滤
- [x] `evaluate.mjs`（Claude API 方案）替换为 `/evaluate-jobs` Claude Code skill，`scan.mjs` 已对接（写 pending.json，提示用户执行 skill）
- [x] 完整流程端到端验证：猎聘扫描 134 条 → 过滤 5 条 → `/evaluate-jobs` 输出 md/json；`jd_text: null` 限制评估深度，详情页抓取列入下阶段

### Phase 1.5 — 详情页富化（猎聘，~1天）

> 当前 `jd_text` 和 `published_at` 均为 null，评估质量受限、after_date 过滤失效。本阶段解决这两个问题。

- [ ] `adapters/liepin.mjs` 新增 `fetchLiepinDetail(url)`：用 `b64eval` 进入详情页，提取 JD 全文（`div.job-desc` 或等价选择器）和发布时间
- [ ] `scan.mjs` 在过滤前批量调用 `fetchDetail`，节流 2–4s/条，富化 `jd_text` 和 `published_at` 字段
- [ ] `filter.mjs` 验证 `published_at` 过滤生效（当前因字段为 null 跳过该规则）
- [ ] 验证：`pending.json` 中 `jd_text` 不为 null，`/evaluate-jobs` 给出基于 JD 正文的具体建议

### Phase 2 — 平台 adapter（3-4天，可并行）
- [ ] 智联招聘：`zhilian/search` adapter
- [ ] 前程无忧：`51job/search` adapter
- [ ] 脉脉：`maimai/search` adapter（职言舆情可选）
- [ ] Indeed 中国：`indeed-cn/search` adapter
- [ ] 每个 adapter 验证：支持关键词 + 发布时间参数，输出统一 JSON schema

### Phase 3 — 串联 pipeline（1天）
- [ ] `scan.mjs` 串联所有组件：抓取 → 过滤 → 评估 → 输出
- [ ] 测试 10 个岗位的完整流程
- [ ] 调整 prompt，确保评估质量

### Phase 4 — 完善（按需）
- [ ] 加 LinkedIn adapter
- [ ] 批量并发（多岗位同时评估）
- [ ] `analyze-patterns.mjs`：分析哪类岗位评分高（参考 career-ops）

---

## 从 career-ops 直接复用

| 文件 | 用途 |
|------|------|
| `templates/cv-template.html` | 生成定制 PDF（Phase 4） |
| `analyze-patterns.mjs` 逻辑 | 后续做漏斗分析 |
| `followup-cadence.mjs` 逻辑 | 投递后跟进提醒 |
| Block A–G prompt 框架 | 评估引擎的 prompt 设计参考 |
| Machine summary YAML schema | 输出格式直接沿用 |

---

## 关键约束

- 运行时 Chrome 必须开着且已登录猎聘/LinkedIn
- 评估引擎每个岗位消耗约 1 次 Claude API 调用（含简历 + JD，约 2-4K tokens）
- 不做自动投递，所有操作止步于"生成建议"，投递由用户决定
