import { writeFile, readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function renderResults(results, cfg) {
  const date = new Date().toISOString().slice(0, 10);
  const dir = cfg?.output?.dir ?? './output';
  const formats = cfg?.output?.format ?? ['md', 'json'];

  if (formats.includes('json')) {
    const p = join(dir, `results-${date}.json`);
    await writeFile(p, JSON.stringify(results, null, 2), 'utf8');
    console.log(`[render] ${p}`);
  }

  if (formats.includes('md')) {
    const p = join(dir, `results-${date}.md`);
    await writeFile(p, buildMarkdown(results, date), 'utf8');
    console.log(`[render] ${p}`);
  }
}

function buildMarkdown(results, date) {
  const rows = results.map((r, i) => {
    const suggestions = (r.cv_suggestions ?? []).join(' / ') || '-';
    const legit = { high: '✅', medium: '⚠️', low: '❌' }[r.legitimacy] ?? '-';
    const url = r.url ? `[链接](${r.url})` : '-';
    const score = typeof r.score === 'number' ? r.score.toFixed(1) : r.score ?? '-';
    const role = r.role ?? r.title ?? '-';
    return `| ${i + 1} | ${r.company ?? '-'} | ${role} | ${score} | ${r.match_summary ?? '-'} | ${suggestions} | ${legit} | ${url} |`;
  });

  const hardStopSection = results
    .filter(r => r.hard_stops?.length)
    .map(r => `**${r.company} — ${r.role ?? r.title}**: ${r.hard_stops.join(', ')}`)
    .join('\n');

  return [
    `# 岗位扫描结果 — ${date}`,
    '',
    '| # | 公司 | 岗位 | 评分 | 匹配摘要 | 简历建议 | 真实性 | URL |',
    '|---|------|------|------|---------|---------|--------|-----|',
    ...rows,
    ...(hardStopSection ? ['\n## Hard Stops\n', hardStopSection] : []),
    '',
  ].join('\n');
}

export async function showResults() {
  const dir = './output';
  if (!existsSync(dir)) { console.log('No results yet. Run `gwks scan` first.'); return; }
  const files = (await readdir(dir)).filter(f => f.endsWith('.md')).sort().reverse();
  if (!files.length) { console.log('No results yet.'); return; }
  console.log(await readFile(join(dir, files[0]), 'utf8'));
}
