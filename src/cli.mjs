#!/usr/bin/env node
import { program } from 'commander';
import { createRequire } from 'module';
import { scan } from './scan.mjs';
import { showResults } from './render.mjs';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

program.name('gwks').version(pkg.version);

program
  .command('scan')
  .description('Scan job platforms and evaluate postings')
  .option('-k, --keyword <kw>', 'Search keyword (overrides config)')
  .option('-a, --after <date>', 'After date YYYY-MM-DD (overrides config)')
  .option('-p, --platform <name>', 'Only scan this platform')
  .option('-l, --location <city>', 'Filter by city (e.g. 苏州)')
  .option('--dry-run', 'Fetch & filter but skip Claude evaluation')
  .action(scan);

program
  .command('results')
  .description('Show most recent scan results')
  .action(showResults);

program.parseAsync();
