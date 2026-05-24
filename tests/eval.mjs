// filter 单元测试 + pending.json 输出验证
// 用法: node tests/eval.mjs
import { filterJobs } from '../src/filter.mjs';
import { writeFile, mkdir } from 'fs/promises';

await mkdir('./evaluation_results', { recursive: true });
await mkdir('./search_results', { recursive: true });

const SAMPLE_JOBS = [
  {
    title: 'AI Agent 开发工程师',
    company: '某AI独角兽',
    url: 'https://example.com/job/1',
    location: '苏州',
    salary: '30-50K',
    published_at: '2026-05-22',
    description: '负责基于LLM的Agent系统设计，熟悉LangChain/LangGraph，RAG系统建设',
  },
  {
    title: '前端实习生',
    company: '某公司',
    url: 'https://example.com/job/999',
    location: '北京',
    salary: '3K',
    published_at: '2026-05-23',
    description: '前端实习，要求会HTML/CSS',
  },
];

const cfg = {
  search: { keywords: ['agent开发', 'AI Agent', 'LLM'], after_date: '2026-05-20', location: '苏州' },
  filter: { exclude_keywords: ['实习'], min_salary_k: 10 },
};

console.log('--- filter test ---');
const filtered = await filterJobs(SAMPLE_JOBS, cfg);
console.log(`filtered: ${filtered.length} jobs (expected 1)`);
filtered.forEach(j => console.log(` ✓ ${j.company} | ${j.title}`));

await writeFile('./search_results/pending.json', JSON.stringify(filtered, null, 2), 'utf8');
console.log('\n[done] data/pending.json written — run /evaluate-jobs in Claude Code to evaluate.');
