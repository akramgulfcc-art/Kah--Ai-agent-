// One-step setup of the KAH Door Service WhatsApp auto-reply on Kapso.
//
// Needs: KAPSO_API_KEY, KAPSO_API_BASE_URL (for example https://api.kapso.ai)
// Usage: node kapso/deploy.mjs --phone-number-id <meta-phone-number-id>
//
// The workflow is created as a draft. Activate it in Kapso after a test.
import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const root = new URL('..', import.meta.url).pathname;
const scripts = join(root, '.claude/skills/automate-whatsapp/scripts');
const here = join(root, 'kapso');

const phoneIdx = process.argv.indexOf('--phone-number-id');
const phoneNumberId = phoneIdx > -1 ? process.argv[phoneIdx + 1] : '';
if (!process.env.KAPSO_API_KEY || !process.env.KAPSO_API_BASE_URL) {
  console.error('Missing KAPSO_API_KEY or KAPSO_API_BASE_URL. See kapso/README.md.');
  process.exit(1);
}
if (!phoneNumberId) {
  console.error('Missing --phone-number-id. Find it with:\n  node .claude/skills/automate-whatsapp/scripts/list-whatsapp-phone-numbers.js');
  process.exit(1);
}

function run(script, args) {
  const out = execFileSync('node', [join(scripts, script), ...args], { encoding: 'utf8' });
  const result = JSON.parse(out);
  if (!result.ok) throw new Error(`${script} failed: ${out}`);
  return result;
}

// Finds the first "id" in an API response, whatever the envelope shape.
function findId(value) {
  if (!value || typeof value !== 'object') return undefined;
  if (typeof value.id === 'string' || typeof value.id === 'number') return String(value.id);
  for (const v of Object.values(value)) {
    const id = findId(v);
    if (id) return id;
  }
  return undefined;
}

function createFunction(slug, description) {
  const created = run('create-function.js', [
    '--name', slug,
    '--description', description,
    '--code-file', join(here, 'functions', slug, 'index.js')
  ]);
  const id = findId(created);
  run('deploy-function.js', ['--function-id', id]);
  console.log(`✓ Function ${slug} deployed (${id})`);
  return id;
}

const routeId = createFunction('kah-route-menu', 'KAH Door Service: routes the customer menu choice');
const ticketId = createFunction('kah-create-service-ticket', 'KAH Door Service: ticket number, confirmation and team alert');

run('project-event-definitions.js', [
  'create',
  '--name', 'service.request_created',
  '--description', 'A customer service request (fault, maintenance or quotation) was received on WhatsApp',
  '--property-schema', JSON.stringify({
    ticket_no: { type: 'string' },
    request_type: { type: 'string' },
    priority: { type: 'string' },
    customer_name: { type: 'string' },
    customer_phone: { type: 'string' },
    site_location: { type: 'string' }
  })
]);
console.log('✓ Event service.request_created registered');

const definition = readFileSync(join(here, 'workflows/kah-door-service/definition.json'), 'utf8')
  .replaceAll('KAH_ROUTE_MENU_FUNCTION_ID', routeId)
  .replaceAll('KAH_CREATE_TICKET_FUNCTION_ID', ticketId);
const defFile = join(mkdtempSync(join(tmpdir(), 'kah-')), 'definition.json');
writeFileSync(defFile, definition);

run('validate-graph.js', ['--definition-file', defFile]);
const workflow = run('create-workflow.js', [
  '--name', 'KAH Door Service Auto-Reply',
  '--description', 'WhatsApp auto-reply for door faults, maintenance / AMC and quotation requests',
  '--definition-file', defFile
]);
const workflowId = findId(workflow);
console.log(`✓ Workflow created (${workflowId})`);

run('create-trigger.js', [workflowId, '--trigger-type', 'inbound_message', '--phone-number-id', phoneNumberId]);
console.log('✓ Trigger added: runs on every new WhatsApp message to this number');

console.log(`\nDone. Next:
1. In Kapso, open each function and add the secrets KAH_TEAM_WHATSAPP and KAH_SALES_WHATSAPP
   to "kah-create-service-ticket" (team numbers in international format, e.g. +9665XXXXXXXX).
2. Send "Hi" from a test phone and check the replies.
3. When it works, set the workflow status to Active.`);
