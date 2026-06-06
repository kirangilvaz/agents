// Emits a rendered sample report to output/ so the template can be eyeballed in a browser.
// Reuses the DATA + substitution from _verify_render.js by requiring it is overkill; inline a tiny version.
const fs = require('fs'); const path = require('path');
const harness = fs.readFileSync(path.join(__dirname, '_verify_render.js'), 'utf8');
// pull the DATA + substitution by re-running up to the html build, then write it.
// Simplest: eval the part that builds `html`. We re-derive by executing a trimmed copy.
const tpl = fs.readFileSync(path.join(__dirname, 'gtm_report_template.html'), 'utf8');
// Grab the DATA object literal from the harness source between 'const DATA = {' and the line '// --- Loop 11'
const start = harness.indexOf('const DATA = {');
const end = harness.indexOf('// --- Loop 11 placeholder substitution ---');
const dataSrc = harness.slice(start, end);
const DATA = (new Function(dataSrc + '\nreturn DATA;'))();
let html = tpl
  .replace(/__GTM_DATA__/g, JSON.stringify(DATA))
  .replace(/__PRODUCT_NAME__/g, DATA.brief.product_name)
  .replace(/__GENERATED_AT__/g, DATA.metadata.generated_at_display)
  .replace(/__CYCLE__/g, String(DATA.metadata.cycle))
  .replace(/__RUN_MODE__/g, DATA.metadata.run_mode)
  .replace(/__CONVERGED__/g, DATA.metadata.converged ? 'CONVERGED' : 'IN PROGRESS')
  .replace(/__PASS_BADGE_CLASS__/g, DATA.metadata.converged ? 'badge-pass' : 'badge-progress')
  .replace(/__PASSES__/g, String(DATA.metadata.passes_completed));
const out = path.join(__dirname, '..', '..', 'output', 'gtm-scout-sample.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('wrote', out, '(' + html.length + ' bytes)');
