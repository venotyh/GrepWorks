// 单岗位端到端测试：filter + evaluate + render
// 用法: node tests/eval.mjs
import { filterJobs } from '../src/filter.mjs';
import { evaluateJob } from '../src/evaluate.mjs';
import { renderResults } from '../src/render.mjs';
import { mkdir } from 'fs/promises';

await mkdir('./output', { recursive: true });
await mkdir('./data', { recursive: true });

const SAMPLE_JOBS = [
  {
    title: 'AI Agent 开发工程师',
    company: '某AI独角兽',
    url: 'https://example.com/job/1',
    location: '上海',
    salary: '30-50K',
    published_at: '2026-05-22',
    description: `职位描述：
负责基于 LLM 的 Agent 系统设计与开发，包括多智能体编排、工具调用、RAG 系统建设。
要求：
- 3年以上 Python 开发经验
- 熟悉 LangChain / LangGraph / AutoGen
- 有大规模 RAG 系统落地经验
- 了解 Prompt Engineering 最佳实践`,
  },
  {
    title: '前端实习生',
    company: '某公司',
    url: 'https://example.com/job/999',
    location: '北京',
    salary: '3K',
    published_at: '2026-05-23',
    description: '前端实习，要求会 HTML/CSS',
  },
];

const SAMPLE_CV = `
## 工作经历
- 大模型应用工程师，XX公司，2023-至今
  - 搭建多智能体RAG系统，支持10万级文档检索，召回率92%
  - 使用LangGraph实现复杂Agent编排，接入GPT-4/Claude API
  - 优化Prompt，降低幻觉率40%

## 技术栈
Python, LangChain, LangGraph, RAG, FastAPI, PostgreSQL, Docker

## 教育
计算机科学学士，某985高校，2020
`;

const cfg = {
  search: { keywords: ['agent开发', 'AI Agent', 'LLM'], after_date: '2026-05-20' },
  filter: { exclude_keywords: ['实习'], min_salary_k: 10 },
};

console.log('--- filter test ---');
const filtered = await filterJobs(SAMPLE_JOBS, cfg);
console.log(`filtered: ${filtered.length} jobs (expected 1)`);
filtered.forEach(j => console.log(` ✓ ${j.company} | ${j.title}`));

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('\n⚠  ANTHROPIC_API_KEY not set — skipping evaluate test');
  process.exit(0);
}

console.log('\n--- evaluate test ---');
const job = filtered[0];
const result = await evaluateJob(job, SAMPLE_CV);
console.log(JSON.stringify(result, null, 2));

console.log('\n--- render test ---');
await renderResults([{ ...job, ...result }], cfg);
console.log('Done.');
