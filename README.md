# GrepWorks

AI 驱动的招聘平台自动扫描工具。跨平台抓岗位 → 多维过滤 → Claude 逐岗评估 → 输出带简历建议的 Markdown 表格。

## 依赖

- Node.js 18+
- [OpenCLI](https://github.com/jackwener/opencli) + Browser Bridge Chrome 扩展（浏览器控制层）
- Chrome 保持登录状态（猎聘等平台）
- Anthropic API Key（评估引擎）

## 安装

```bash
npm install
npm install -g .          # 注册 gwks 命令
```

设置环境变量：

```bash
export ANTHROPIC_API_KEY=sk-...
```

## 配置

编辑 `task.yml`：

```yaml
search:
  keywords: ["agent开发", "AI Agent", "LLM工程师", "大模型应用"]
  platforms: ["liepin"]          # 目前已实现：liepin
  after_date: "2026-05-21"
  location: "苏州"

filter:
  min_salary_k: 25
  exclude_keywords: ["外包", "实习"]

cv_path: ./cv.md                 # 填入你的真实简历

output:
  format: ["md", "json"]
  dir: ./output
```

将 `cv.md` 替换为真实简历内容（工作经历 / 技术栈 / 项目 / 教育背景）。

`cv_path` 为可选项——省略该行或文件不存在时以**无简历模式**运行：正常扫描过滤并导出文件，但跳过 Claude 评估，表格中评分 / 建议列留空。

## 使用

```bash
# 按 task.yml 全量扫描
gwks scan

# 只扫一个平台
gwks scan --platform liepin

# 覆盖关键词和时间
gwks scan --keyword "大模型" --after 2026-05-20

# 试跑（只抓取过滤，不调 Claude）
gwks scan --dry-run

# 查看最近一次结果
gwks results
```

## 输出

`output/results-YYYY-MM-DD.md`：

| # | 公司 | 岗位 | 评分 | 匹配摘要 | 简历建议 | 真实性 | URL |
|---|------|------|------|---------|---------|--------|-----|
| 1 | xxx | AI Agent工程师 | 4.2 | 技术栈匹配 | 突出多智能体经验 | ✅ | [链接] |

同时输出 `output/results-YYYY-MM-DD.json`。

去重记录写入 `data/seen.tsv`，已扫过的岗位不重复评估。

## 项目结构

```
src/
├── adapters/liepin.mjs   # 猎聘浏览器 adapter
├── cli.mjs               # 命令入口
├── scan.mjs              # 主流程
├── filter.mjs            # 过滤 + 去重
├── evaluate.mjs          # Claude API 评估
└── render.mjs            # 输出渲染
tests/
└── eval.mjs              # 端到端测试（node tests/eval.mjs）
```

## 测试

```bash
node tests/eval.mjs
```

filter 阶段不需要 API Key；evaluate 阶段需要 `ANTHROPIC_API_KEY`。

## 平台支持状态

| 平台 | 状态 |
|------|------|
| 猎聘 | ✅ 完成 |
| 智联招聘 | 待实现 |
| 前程无忧 51job | 待实现 |
| 脉脉 | 待实现 |
| Indeed 中国 | 待实现 |
| LinkedIn | 待实现 |

详见 [plan.md](plan.md)。
