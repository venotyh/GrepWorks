# evaluate-jobs 评估规范

读取 `search_results/pending.json` 和 `cv.md`，按 Block A–G 框架逐岗评估，输出结果文件，清空 pending.json。

## 执行步骤

1. 读取 `search_results/pending.json` — `gwks scan` 写入的待评估岗位列表
2. 读取 `cv.md` — 候选人简历
3. 若 `pending.json` 为空或不存在，告知用户先运行 `gwks scan`，停止
4. 按下方框架逐岗评估
5. 写入 `evaluation_results/evaluation-{timestamp}.json` — 完整评估数组
6. 写入 `evaluation_results/evaluation-{timestamp}.md` — Markdown 表格
7. 将 `search_results/pending.json` 写为 `[]`，防止重复处理

timestamp 格式：`YYYY-MM-DDTHH-MM-SS`（冒号改短横线，Windows 文件名安全）。

---

## 输出 schema（每岗位一个 JSON 对象）

```json
{
  "company": "公司名",
  "role": "岗位名",
  "url": "https://...",
  "salary": "30-50K",
  "location": "苏州",
  "score": 4.2,
  "archetype": "agentic | platform | infra | ops | other",
  "match_summary": "一句话说明匹配情况",
  "cv_suggestions": ["针对此岗位的简历修改建议1", "建议2"],
  "hard_stops": ["硬性不匹配项，没有则留空数组"],
  "legitimacy": "high | medium | low",
  "final_decision": "apply | maybe | skip"
}
```

---

## 评估框架

### Block A — 岗位分类
判断职能方向（Agent开发 / 平台工程 / 基础设施 / 运营 / 其他）、级别（初级/中级/高级/负责人）、远程政策。

### Block B — 简历匹配度（score 1–5）
- 技术栈重叠程度
- 经验年限匹配
- 领域背景契合度
- 综合给 score，保留一位小数

### Block C — 公司分析
规模、融资阶段、业务方向、增长信号或风险信号。影响 legitimacy 判断。

### Block D — 薪资评估
posted_range 与苏州市场水位对比（below / at / above market）。

### Block E — 简历修改建议
针对**此岗位**给出 2–4 条具体可操作的建议，例如"将 FunctionGraph 自动化部署 SLA 从30天→2天的成果写入项目经历"，而非泛泛建议。

### Block G — 招聘真实性
- **high**：公司名清晰，JD 具体，岗位合理
- **medium**：公司脱敏或描述模糊
- **low**：无公司名、JD 极度模糊、明显幽灵岗

---

## 输出格式

文件：`evaluation_results/evaluation-{timestamp}.md` 和 `.json`
表头时间戳格式：`YYYY-MM-DD HH:MM:SS`

```markdown
# 2026-05-24 15:30:00

| # | 公司 | 岗位 | 评分 | 匹配摘要 | 简历建议 | 真实性 | URL |
|---|------|------|------|---------|---------|--------|-----|
| 1 | xxx | AI Agent工程师 | 4.2 | 技术栈匹配 | 突出多智能体经验 | ✅ | https://... |
```

真实性 emoji：high → ✅ / medium → ⚠️ / low → ❌

有 hard_stops 的岗位在表格下方追加 `## Hard Stops` 段落。

---

## 注意事项

- `jd_text: null` 时，仅凭 title / company / salary / location 评估，在 match_summary 中注明限制
- cv_suggestions 必须具体，引用 cv.md 中的实际项目和岗位的具体要求，不写泛泛建议
- 候选人背景明显不符（纯运营/非技术岗）时，final_decision 设为 `skip`，cv_suggestions 从简
