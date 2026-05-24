// 猎聘搜索 adapter — browser-based, no API key needed
import { spawn } from 'child_process';

function runOpencli(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('opencli', args, { shell: true });
    let out = '';
    let err = '';
    proc.stdout.on('data', d => (out += d));
    proc.stderr.on('data', d => (err += d));
    proc.on('close', code => {
      // Strip Node.js runtime warnings (e.g. UNDICI-EHPA) that pollute stderr
      const realErr = err.split('\n').filter(l => !l.startsWith('(node:') && !l.trimStart().startsWith('(Use `node')).join('\n').trim();
      if (code !== 0) reject(new Error(realErr || err.trim() || `opencli exited ${code}`));
      else resolve(out.trim());
    });
  });
}

// Encode JS as base64 so it passes through Windows cmd.exe without being split at spaces.
// atob() decodes to Latin-1 bytes; escape()+decodeURIComponent() re-interprets them as UTF-8,
// so Chinese string literals in the JS (e.g. '苏州') survive the round-trip correctly.
function b64eval(js) {
  const encoded = Buffer.from(js, 'utf8').toString('base64');
  return `eval(decodeURIComponent(escape(atob('${encoded}'))))`;
}

const EXTRACT_JS = `
(() => {
  const wrappers = [...document.querySelectorAll('div._40108yn42Q')];
  return wrappers.map(w => {
    const a = w.querySelector('a[data-nick="job-detail-job-info"]');
    if (!a) return null;
    const href = a.getAttribute('href') || '';
    const url = href.split('?')[0];
    const title = (a.querySelector('[title]')?.getAttribute('title') || '').replace(/^招聘/, '');
    const salary = a.querySelector('._40108E8PWS')?.textContent.trim() ?? '';
    const location = a.querySelector('._40108__9nJ .ellipsis-1')?.textContent.trim() ?? '';
    const company = w.querySelector('._40108K6Y1c')?.textContent.trim() ?? '';
    return { title, company, salary, location, url };
  }).filter(Boolean);
})()
`.trim();

function clickCityJS(city) {
  return `
(() => {
  const cityLabel = [...document.querySelectorAll('div')]
    .find(d => d.textContent.trim() === '城市' && d.nextElementSibling?.tagName === 'UL');
  const ul = cityLabel?.nextElementSibling;
  const li = (ul ? [...ul.querySelectorAll('li')] : [...document.querySelectorAll('li')])
    .find(l => l.textContent.trim() === ${JSON.stringify(city)});
  if (!li) return 'not-found';
  li.click();
  return 'clicked';
})()
`.trim();
}

export async function searchLiepin(keyword, afterDate, location, session = 'liepin') {
  const searchUrl = `https://www.liepin.com/zhaopin/?key=${encodeURIComponent(keyword)}`;
  process.stdout.write(`  [liepin] ${searchUrl} `);

  await runOpencli(['browser', session, 'open', searchUrl]);
  await runOpencli(['browser', session, 'wait', 'selector', 'div._40108yn42Q', '--timeout', '12000']);

  if (location) {
    process.stdout.write(`→ city:${location} `);
    try {
      const result = await runOpencli(['browser', session, 'eval', b64eval(clickCityJS(location))]);
      if (result.includes('not-found')) {
        process.stdout.write('(city not in filter, showing all) ');
      } else {
        await runOpencli(['browser', session, 'wait', 'selector', 'div._40108yn42Q', '--timeout', '8000']);
      }
    } catch (e) {
      process.stdout.write(`(city click failed: ${e.message.split('\n')[0]}) `);
    }
  }

  process.stdout.write('→ extracting ');
  const raw = await runOpencli(['browser', session, 'eval', b64eval(EXTRACT_JS)]);
  const jobs = JSON.parse(raw);
  console.log(`${jobs.length} cards`);

  return jobs.map(j => ({
    ...j,
    platform: 'liepin',
    published_at: null,
    jd_text: null,
  }));
}
