# GrepWorks

招聘平台自动扫描工具。浏览器爬取猎聘岗位 → 关键词过滤去重 → Claude Code 内联评估 → 输出带简历建议的 Markdown 表格。

## 依赖

- Node.js 18+
- [OpenCLI](https://github.com/jackwener/opencli) + Browser Bridge Chrome 扩展
- Chrome 保持登录状态（猎聘等平台）
- Claude Code（评估在 session 内完成，不需要单独 API Key）

## 安装

```bash
npm install
npm install -g .    # 注册 gwks 命令
```

## Quick Start

**第一次使用：**

1. 复制 `task_template.yml` 为 `task.yml`，填写关键词、城市、after_date
2. 复制 `cv-template.md` 为 `cv.md`，填入真实简历内容（模板内有字段说明）
3. 打开 Chrome，登录猎聘，确保 Browser Bridge 扩展已连接

**每次使用（两步）：**

```bash
# Step 1 — 抓取 + 过滤，结果写入 search_results/pending.json
gwks scan --platform liepin
```

```
# Step 2 — 在 Claude Code 对话里说：
按照 EVALUATE_JOBS.md 的规范评估 pending.json 里的岗位
```

评估结果输出到 `evaluation_results/evaluation-{timestamp}.md` 和 `.json`。

> **评估规范**见 [`EVALUATE_JOBS.md`](EVALUATE_JOBS.md)。AI 读取该文件后按 Block A–G 框架逐岗分析，输出带简历建议的 Markdown 表格。

---

## 工作流详解

```
gwks scan
  ↓ OpenCLI Browser Bridge 控制 Chrome
  ↓ 打开猎聘搜索页，点击城市筛选，提取搜索结果卡片
  ↓ filter.mjs：去重 / 关键词 / 地点 / 薪资过滤
  ↓ 写入 search_results/pending.json

/evaluate-jobs  (Claude Code skill)
  ↓ 读取 pending.json + cv.md
  ↓ 逐岗评估：匹配度评分 / 公司分析 / 简历修改建议 / 真实性判断
  ↓ 写入 evaluation_results/evaluation-{timestamp}.md + .json
  ↓ 清空 pending.json
```

---

## 配置（task.yml）

```yaml
search:
  keywords: ["agent开发", "AI Agent", "LLM工程师", "大模型应用"]
  platforms: ["liepin"]       # 已实现：liepin；其余待开发
  after_date: "2026-05-21"
  location: "苏州"

filter:
  min_salary_k: 15
  exclude_keywords: ["外包", "实习"]

cv_path: ./cv.md              # 可选——无此文件时跳过评估，仅输出原始岗位数据

output:
  format: ["md", "json"]
  dir: ./evaluation_results
```

---

## 输出格式

`evaluation_results/evaluation-2026-05-24T10-10-37.md`：

```
# 2026-05-24 10:10:37

| # | 公司 | 岗位 | 评分 | 匹配摘要 | 简历建议 | 真实性 | URL |
|---|------|------|------|---------|---------|--------|-----|
| 1 | 开途科技 | AI Agent工程师 | 3.8 | 方向对口，缺项目经历 | 将GrepWorks写入简历 | ✅ | https://... |
```

去重记录写入 `search_results/seen.tsv`，扫过的 URL 下次自动跳过。

---

## CLI 参数

```bash
gwks scan                          # 按 task.yml 全量扫描
gwks scan --platform liepin        # 只扫猎聘
gwks scan --keyword "大模型"        # 覆盖关键词
gwks scan --after 2026-05-20       # 覆盖日期
gwks scan --dry-run                # 只打印过滤结果，不写文件（调试用）
gwks results                       # 显示最近一次评估结果
```

---

## 项目结构

```
src/
├── adapters/liepin.mjs              # 猎聘浏览器 adapter（b64eval + 城市筛选）
├── cli.mjs                          # gwks 命令入口
├── scan.mjs                         # 抓取主流程
├── filter.mjs                       # 过滤 + 去重
└── render.mjs                       # 输出渲染
.agents/skills/evaluate-jobs/
└── evaluate-jobs-skill.md           # /evaluate-jobs Claude Code skill
tests/
└── eval.mjs                         # filter 单元测试
search_results/
├── pending.json                     # 待评估岗位（scan 写入，evaluate-jobs 清空）
└── seen.tsv                         # 去重记录
evaluation_results/
└── evaluation-{timestamp}.md/.json  # 评估结果
```

---

## 平台支持

| 平台 | 状态 |
|------|------|
| 猎聘 | ✅ 完成 |
| BOSS 直聘 | 开发中 |
| 智联招聘 | 待实现 |
| 前程无忧 51job | 待实现 |
| 脉脉 | 待实现 |
| LinkedIn | 待实现 |

详见 [plan.md](plan.md)。
