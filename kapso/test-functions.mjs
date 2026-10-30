// Local test for the KAH Door Service functions. Run: node kapso/test-functions.mjs
import { readFileSync } from 'fs';
import assert from 'assert/strict';

function load(slug) {
  const code = readFileSync(new URL(`./functions/${slug}/index.js`, import.meta.url), 'utf8');
  return new Function(`${code}\nreturn handler;`)();
}
async function call(fn, vars, edges = [], env = {}) {
  const body = { execution_context: { vars, context: { phone_number: '+966500000000' } }, available_edges: edges };
  const res = await fn(new Request('https://local/', { method: 'POST', body: JSON.stringify(body) }), env);
  return res.json();
}

const route = load('kah-route-menu');
const ticket = load('kah-create-service-ticket');
const env = { KAH_TEAM_WHATSAPP: '+966511111111', KAH_SALES_WHATSAPP: '+966522222222' };

// Menu routing
const listReply = { interactive: { list_reply: { id: 'fault', title: 'Report a door fault' } } };
assert.equal((await call(route, { menu_choice: listReply }, ['request', 'team'])).next_edge, 'request');
assert.equal((await call(route, { menu_choice: listReply }, ['fault', 'maintenance', 'quotation'])).next_edge, 'fault');
assert.equal((await call(route, { menu_choice: 'team' }, ['request', 'team'])).next_edge, 'team');
assert.equal((await call(route, { menu_choice: 'hello' }, ['request', 'team'])).next_edge, 'team');
assert.equal((await call(route, { menu_choice: 'الباب معطل' }, ['fault', 'maintenance', 'quotation'])).next_edge, 'fault');
assert.equal((await call(route, { menu_choice: 'need AMC visit' }, ['fault', 'maintenance', 'quotation'])).next_edge, 'maintenance');
assert.equal((await call(route, { menu_choice: 'price for new project' }, ['fault', 'maintenance', 'quotation'])).next_edge, 'quotation');

// Fault ticket, door stuck -> High priority
const fault = (await call(ticket, {
  request_type: 'fault',
  customer_name: 'Ahmed - City Mall',
  site_location: { location: { latitude: 24.71, longitude: 46.67, name: 'City Mall' } },
  door_type: { list_reply: { id: 'sliding', title: 'Sliding door' } },
  door_condition: { button_reply: { id: 'stuck_closed', title: 'Stuck closed' } },
  problem_details: 'Main entrance door not opening'
}, [], env)).vars;
assert.match(fault.ticket_no, /^KAH-SR-\d{6}-[A-Z2-9]{4}$/);
assert.equal(fault.priority, 'High');
assert.equal(fault.team_phone, env.KAH_TEAM_WHATSAPP);
assert.match(fault.site_location_text, /maps\.google\.com\/\?q=24\.71,46\.67/);

// Quotation goes to Sales
const quote = (await call(ticket, { request_type: 'quotation', customer_name: 'Sara', project_details: '12 sliding doors' }, [], env)).vars;
assert.match(quote.ticket_no, /^KAH-QT-/);
assert.equal(quote.team_phone, env.KAH_SALES_WHATSAPP);

console.log('All tests passed.\n');
console.log('--- Customer sees ---\n' + fault.confirm_message);
console.log('\n--- Team receives ---\n' + fault.team_alert);
