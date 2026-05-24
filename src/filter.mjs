import { readFile, appendFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

const SEEN_PATH = './search_results/seen.tsv';

async function loadSeen() {
  if (!existsSync(SEEN_PATH)) return new Set();
  const content = await readFile(SEEN_PATH, 'utf8');
  return new Set(content.split('\n').map(l => l.split('\t')[0]).filter(Boolean));
}

function matchesKeyword(job, keywords) {
  const text = `${job.title ?? ''} ${job.description ?? ''}`.toLowerCase();
  return keywords.some(k => text.includes(k.toLowerCase()));
}

function parseSalaryMin(salaryStr) {
  if (!salaryStr) return null;
  const nums = salaryStr.match(/\d+/g);
  if (!nums) return null;
  return parseInt(nums[0], 10);
}

export async function filterJobs(jobs, cfg) {
  const seen = await loadSeen();
  const seenThisRun = new Set();
  const afterDate = new Date(cfg.search.after_date);
  const excludeKw = cfg.filter?.exclude_keywords ?? [];
  const minSalary = cfg.filter?.min_salary_k ?? 0;
  const keywords = cfg.search.keywords;

  const filtered = [];
  const newUrls = [];

  for (const job of jobs) {
    if (!job.url) continue;
    if (seen.has(job.url)) continue;
    if (seenThisRun.has(job.url)) continue;
    seenThisRun.add(job.url);

    if (job.published_at && new Date(job.published_at) < afterDate) continue;

    if (!matchesKeyword(job, keywords)) continue;

    const text = `${job.title ?? ''} ${job.description ?? ''}`.toLowerCase();
    if (excludeKw.some(k => text.includes(k.toLowerCase()))) continue;

    if (minSalary > 0) {
      const sal = parseSalaryMin(job.salary);
      if (sal !== null && sal < minSalary) continue;
    }

    // Location filter (post-filter as fallback, adapter should already filter on-site)
    if (cfg.search?.location) {
      if (!job.location?.includes(cfg.search.location)) continue;
    }

    filtered.push(job);
    newUrls.push(job.url);
  }

  if (newUrls.length > 0) {
    const lines = newUrls.map(u => `${u}\t${new Date().toISOString()}`).join('\n') + '\n';
    await appendFile(SEEN_PATH, lines, 'utf8').catch(() =>
      writeFile(SEEN_PATH, lines, 'utf8')
    );
  }

  return filtered;
}
