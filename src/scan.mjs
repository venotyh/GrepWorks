import { readFile, writeFile, mkdir } from 'fs/promises';
import { spawn } from 'child_process';
import yaml from 'js-yaml';
import { filterJobs } from './filter.mjs';
import { searchLiepin } from './adapters/liepin.mjs';
import { searchBoss } from './adapters/boss.mjs';

const ADAPTERS = {
  liepin: (keyword, afterDate, location) => searchLiepin(keyword, afterDate, location),
  boss:   (keyword, afterDate, location) => searchBoss(keyword, afterDate, location),
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const jitter = (min, max) => min + Math.floor(Math.random() * (max - min));

async function loadConfig(opts = {}) {
  const raw = await readFile('./task.yml', 'utf8');
  const cfg = yaml.load(raw);
  if (opts.keyword) cfg.search.keywords = [opts.keyword];
  if (opts.after) cfg.search.after_date = opts.after;
  if (opts.platform) cfg.search.platforms = [opts.platform];
  if (opts.location) cfg.search.location = opts.location;
  return cfg;
}

function runOpencli(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('opencli', args, { shell: true });
    let out = '';
    let err = '';
    proc.stdout.on('data', d => (out += d));
    proc.stderr.on('data', d => (err += d));
    proc.on('close', code => {
      if (code !== 0) reject(new Error(err.trim() || `opencli exited ${code}`));
      else resolve(out.trim());
    });
  });
}

async function searchPlatform(platform, keyword, afterDate, location) {
  if (ADAPTERS[platform]) {
    return ADAPTERS[platform](keyword, afterDate, location).catch(e => {
      console.warn(`  [${platform}] adapter error: ${e.message.split('\n')[0]}`);
      return [];
    });
  }
  try {
    const raw = await runOpencli([platform, 'search', keyword, '--after', afterDate, '-f', 'json']);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : parsed.jobs ?? parsed.results ?? [];
  } catch (e) {
    console.warn(`  [${platform}] skip: ${e.message.split('\n')[0]}`);
    return [];
  }
}

export async function scan(opts = {}) {
  const cfg = await loadConfig(opts);

  await mkdir('./evaluation_results', { recursive: true });
  await mkdir('./search_results', { recursive: true });

  const raw = [];
  let first = true;
  for (const platform of cfg.search.platforms) {
    for (const keyword of cfg.search.keywords) {
      if (!first) {
        const ms = jitter(4000, 8000);
        console.log(`[pause] ${(ms / 1000).toFixed(1)}s`);
        await sleep(ms);
      }
      first = false;
      process.stdout.write(`[scan] ${platform} "${keyword}"... `);
      const jobs = await searchPlatform(platform, keyword, cfg.search.after_date, cfg.search.location);
      console.log(`${jobs.length} jobs`);
      raw.push(...jobs);
    }
  }
  console.log(`[scan] ${raw.length} total before filter`);

  const jobs = await filterJobs(raw, cfg);
  console.log(`[filter] ${jobs.length} new jobs`);

  if (!jobs.length) { console.log('Nothing new.'); return; }

  if (opts.dryRun) {
    jobs.forEach(j => console.log(`  ${j.company} | ${j.title} | ${j.url}`));
    return;
  }

  await writeFile('./search_results/pending.json', JSON.stringify(jobs, null, 2), 'utf8');
  console.log(`[done] ${jobs.length} jobs saved → search_results/pending.json`);
  console.log('[next] Run /evaluate-jobs in Claude Code to evaluate and render results.');
}
