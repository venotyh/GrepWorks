// BOSS直聘搜索 adapter
//
// Anti-bot bypass: eval via chrome.scripting.executeScript (--via-extension) instead of
// chrome.debugger.attach (CDP). BOSS detects debugger attach and redirects to about:blank;
// scripting API is invisible to page-level fingerprinting.
// User still navigates manually — programmatic navigation is a separate vector.
//
// Usage: run `gwks scan --platform boss`, then follow the prompt to navigate manually.
import { spawn } from 'child_process';
import { writeFile } from 'fs/promises';
import readline from 'readline';

function runOpencli(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('opencli', args, { shell: true });
    let out = '', err = '';
    proc.stdout.on('data', d => (out += d));
    proc.stderr.on('data', d => (err += d));
    proc.on('close', code => {
      const realErr = err.split('\n')
        .filter(l => !l.startsWith('(node:') && !l.trimStart().startsWith('(Use `node'))
        .join('\n').trim();
      if (code !== 0) reject(new Error(realErr || err.trim() || `opencli exited ${code}`));
      else resolve(out.trim());
    });
  });
}

function b64eval(js) {
  const encoded = Buffer.from(js, 'utf8').toString('base64');
  return `eval(decodeURIComponent(escape(atob('${encoded}'))))`;
}

const CITY_CODES = {
  '北京':   '101010100',
  '上海':   '101020100',
  '广州':   '101280100',
  '深圳':   '101280600',
  '杭州':   '101210100',
  '苏州':   '101020400',
  '南京':   '101190100',
  '武汉':   '101200100',
  '成都':   '101270100',
  '西安':   '101110100',
  '天津':   '101030100',
  '重庆':   '101040100',
  '厦门':   '101230200',
  '长沙':   '101250100',
  '郑州':   '101180100',
  '青岛':   '101120200',
  '合肥':   '101220100',
};

// Extract jobs from already-loaded BOSS page.
// BOSS uses Vue 2: el.__vue__.jobList (NOT __vueParentComponent).
// Selectors confirmed via boss-helper source (useHookVueData).
const EXTRACT_JS = `
(async () => {
  const sels = [
    '#wrap .page-job-wrapper',
    '.job-recommend-main',
    '.page-jobs-main',
  ];

  // Poll up to 4.5s — page may still be rendering
  for (let i = 0; i < 15; i++) {
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (!el?.__vue__) continue;
      const jobs = el.__vue__.jobList;
      if (jobs?.length > 0) {
        // Unproxy Vue reactive array → plain objects for JSON serialization
        const plain = JSON.parse(JSON.stringify(jobs.slice(0, 60)));
        return JSON.stringify({ source: 'vue', count: plain.length, jobs: plain });
      }
    }
    await new Promise(r => setTimeout(r, 300));
  }

  // Fallback: DOM card extraction (less data, but at least gets encryptJobId from href)
  const cards = [...document.querySelectorAll('.job-card-wrapper, .job-list-box .job-card')];
  if (cards.length) {
    const jobs = cards.map(c => {
      const a = c.querySelector('a[href*="job_detail"]') ?? c.querySelector('a');
      return {
        jobName:    c.querySelector('.job-name,[class*=job-name]')?.textContent?.trim() ?? '',
        brandName:  c.querySelector('.company-name,[class*=company-name]')?.textContent?.trim() ?? '',
        salaryDesc: c.querySelector('.salary,[class*=salary]')?.textContent?.trim() ?? '',
        cityName:   c.querySelector('.job-area,[class*=job-area]')?.textContent?.trim() ?? '',
        encryptJobId: a?.href?.match(/job_detail\\/([^.?#]+)/)?.[1] ?? '',
      };
    }).filter(j => j.jobName);
    return JSON.stringify({ source: 'dom', count: jobs.length, jobs });
  }

  return JSON.stringify({ error: 'no-results', url: location.href, title: document.title });
})()
`.trim();

function waitForEnter() {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('', () => { rl.close(); resolve(); });
  });
}

export async function searchBoss(keyword, afterDate, location, session = 'work') {
  const cityCode = CITY_CODES[location] || '101020400';

  // Use tab list (tabs API, no CDP) to read current URL without triggering debugger attach
  let currentUrl = '';
  try {
    const tabsRaw = await runOpencli(['browser', session, 'tab', 'list']);
    const tabs = JSON.parse(tabsRaw);
    const activeTab = tabs.find(t => t.active) ?? tabs[0];
    currentUrl = activeTab?.url ?? '';
  } catch { /* treat as not on BOSS */ }

  const isSearchPage = currentUrl.includes('zhipin.com') &&
    (currentUrl.includes('/web/geek/jobs') || currentUrl.includes('/web/geek/job-recommend'));

  if (!isSearchPage) {
    const searchUrl = `https://www.zhipin.com/web/geek/jobs?query=${encodeURIComponent(keyword)}&city=${cityCode}`;
    console.log(`\n[boss] 手动导航步骤:`);
    console.log(`  1. 在 Chrome 中打开: ${searchUrl}`);
    console.log(`  2. 等待职位列表完全加载`);
    console.log(`  3. 回到这里按 Enter 继续...`);
    await waitForEnter();
    process.stdout.write(`  [boss] "${keyword}" → 提取中... `);
  } else {
    process.stdout.write(`(已在搜索页) → 提取中... `);
  }

  const raw = await runOpencli(['browser', session, 'eval', b64eval(EXTRACT_JS), '--via-extension'])
    .catch(e => JSON.stringify({ error: e.message.split('\n')[0] }));

  await writeFile('./debug-boss.json', raw, 'utf8').catch(() => {});

  let parsed;
  try { parsed = JSON.parse(raw); } catch {
    console.log('0 jobs (parse error)');
    return [];
  }

  if (parsed.error) {
    console.log(`0 jobs (${parsed.error})`);
    if (parsed.url) console.log(`  当前页面: ${parsed.url}`);
    return [];
  }

  const allJobs = parsed.jobs ?? [];
  console.log(`${allJobs.length} jobs (src:${parsed.source})`);

  return allJobs.map(j => ({
    title:        j.jobName ?? '',
    company:      j.brandName ?? '',
    salary:       j.salaryDesc ?? '',
    location:     [j.cityName, j.areaDistrict, j.businessDistrict].filter(Boolean).join('·'),
    url:          j.encryptJobId ? `https://www.zhipin.com/job_detail/${j.encryptJobId}.html` : '',
    published_at: null,
    platform:     'boss',
    jd_text:      null,
  }));
}
