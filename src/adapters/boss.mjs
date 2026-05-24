// BOSS直聘搜索 adapter — API-based via browser fetch (requires login cookies)
import { spawn } from 'child_process';

function runOpencli(args) {
  return new Promise((resolve, reject) => {
    // Quote args containing & to prevent Windows cmd.exe from splitting them
    const safeArgs = args.map(a =>
      typeof a === 'string' && a.includes('&') ? `"${a}"` : a
    );
    const proc = spawn('opencli', safeArgs, { shell: true });
    let out = '';
    let err = '';
    proc.stdout.on('data', d => (out += d));
    proc.stderr.on('data', d => (err += d));
    proc.on('close', code => {
      const realErr = err.split('\n').filter(l => !l.startsWith('(node:') && !l.trimStart().startsWith('(Use `node')).join('\n').trim();
      if (code !== 0) reject(new Error(realErr || err.trim() || `opencli exited ${code}`));
      else resolve(out.trim());
    });
  });
}

// base64 + UTF-8 safe eval
function b64eval(js) {
  const encoded = Buffer.from(js, 'utf8').toString('base64');
  return `eval(decodeURIComponent(escape(atob('${encoded}'))))`;
}

// BOSS直聘 city code map
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

const SEARCH_API = 'https://www.zhipin.com/wapi/zpgeek/search/joblist.json';

// Fetch job list via BOSS直聘 internal API (uses browser session cookies)
const FETCH_JS = (query, cityCode, page) => `
(async () => {
  const params = new URLSearchParams({query: ${JSON.stringify(query)}, city: ${JSON.stringify(cityCode)}, page: ${page}, pageSize: 30});
  const res = await fetch('/wapi/zpgeek/search/joblist.json?' + params, {credentials: 'include'});
  const data = await res.json();
  return JSON.stringify(data);
})()
`.trim();

export async function searchBoss(keyword, afterDate, location, session = 'boss') {
  const cityCode = (location && CITY_CODES[location]) || '101020400'; // default 苏州
  const searchUrl = `https://www.zhipin.com/web/geek/jobs?query=${encodeURIComponent(keyword)}&city=${cityCode}`;

  process.stdout.write(`  [boss] ${searchUrl} `);

  // Ensure the browser is on zhipin.com (needed for same-origin fetch).
  // If the session has a stale tab reference, fall back to opening a new tab.
  try {
    const currentUrl = await runOpencli(['browser', session, 'get', 'url']);
    if (!currentUrl.includes('zhipin.com')) {
      await runOpencli(['browser', session, 'open', 'https://www.zhipin.com']);
      await runOpencli(['browser', session, 'wait', 'time', '5']);
    }
  } catch {
    // Stale or missing session — open a fresh tab
    await runOpencli(['browser', session, 'tab', 'new', 'https://www.zhipin.com']);
    await runOpencli(['browser', session, 'wait', 'time', '5']);
  }

  // Check login — call API page 1
  process.stdout.write('→ api ');
  const rawPage1 = await runOpencli(['browser', session, 'eval', b64eval(FETCH_JS(keyword, cityCode, 1))]);
  let data1;
  try {
    data1 = JSON.parse(rawPage1);
  } catch {
    console.log('0 jobs (parse error)');
    return [];
  }

  if (data1.code !== 0) {
    // 非0通常是未登录或需要验证
    process.stdout.write(`(api error code=${data1.code} — check login) `);
    console.log('0 jobs');
    return [];
  }

  const list1 = data1.zpData?.jobList ?? [];
  if (!list1.length) {
    console.log('0 jobs (empty — check login or no results)');
    return [];
  }

  // Fetch page 2 if there might be more
  let allJobs = [...list1];
  if (data1.zpData?.hasMore) {
    try {
      const rawPage2 = await runOpencli(['browser', session, 'eval', b64eval(FETCH_JS(keyword, cityCode, 2))]);
      const data2 = JSON.parse(rawPage2);
      allJobs.push(...(data2.zpData?.jobList ?? []));
    } catch { /* ignore page 2 errors */ }
  }

  console.log(`${allJobs.length} jobs`);

  return allJobs.map(j => ({
    title:        j.jobName ?? '',
    company:      j.brandName ?? '',
    salary:       j.salaryDesc ?? '',
    location:     `${j.cityName ?? ''}${j.areaDistrict ? '·' + j.areaDistrict : ''}${j.businessDistrict ? '·' + j.businessDistrict : ''}`,
    url:          j.encryptJobId ? `https://www.zhipin.com/job_detail/${j.encryptJobId}.html` : '',
    published_at: null,
    platform:     'boss',
    jd_text:      null,
  }));
}
