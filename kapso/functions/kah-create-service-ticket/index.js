async function handler(request, env) {
  // Creates a ticket number for a KAH service request and prepares
  // the customer confirmation and the internal team alert.
  const payload = await request.json();
  const ctx = (payload && payload.execution_context) || {};
  const vars = ctx.vars || {};
  const customerPhone = (ctx.context && ctx.context.phone_number) || '';

  // Response targets shown to the customer. Adjust to KAH service levels.
  const RESPONSE_TIME = {
    high: 'within 4 hours',
    normal: 'within 24 hours',
    maintenance: 'within 1 working day to confirm the visit date',
    quotation: 'within 1 working day'
  };

  function asText(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
    if (typeof value === 'object') {
      const nested =
        (value.interactive && (value.interactive.list_reply || value.interactive.button_reply)) ||
        value.list_reply ||
        value.button_reply;
      if (nested && typeof nested === 'object') return String(nested.title || nested.id || '').trim();
      const loc = value.location || (value.latitude !== undefined ? value : null);
      if (loc && loc.latitude !== undefined) {
        const label = [loc.name, loc.address].filter(Boolean).join(', ');
        const map = 'https://maps.google.com/?q=' + loc.latitude + ',' + loc.longitude;
        return label ? label + ' (' + map + ')' : map;
      }
      if (value.text && typeof value.text === 'object' && value.text.body) return String(value.text.body).trim();
      const direct = value.text || value.body || value.caption || value.title || value.id;
      if (direct) return String(direct).trim();
      if (value.type === 'image' || value.image) return '[photo received]';
      if (value.type === 'video' || value.video) return '[video received]';
    }
    return '';
  }

  const requestType = ['fault', 'maintenance', 'quotation'].includes(vars.request_type) ? vars.request_type : 'fault';
  const name = asText(vars.customer_name) || 'Customer';
  const location = asText(vars.site_location) || 'Not provided';
  const condition = asText(vars.door_condition);

  let priority = 'Normal';
  let responseTime = RESPONSE_TIME.normal;
  if (requestType === 'fault' && /stuck/i.test(condition)) {
    priority = 'High';
    responseTime = RESPONSE_TIME.high;
  } else if (requestType === 'maintenance') {
    responseTime = RESPONSE_TIME.maintenance;
  } else if (requestType === 'quotation') {
    responseTime = RESPONSE_TIME.quotation;
  }

  // Ticket number: KAH-<type>-<YYMMDD>-<4 random characters>
  const prefix = { fault: 'SR', maintenance: 'PM', quotation: 'QT' }[requestType];
  const d = new Date();
  const date = String(d.getUTCFullYear()).slice(2) +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    String(d.getUTCDate()).padStart(2, '0');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  const ticketNo = 'KAH-' + prefix + '-' + date + '-' + code;

  const typeLabel = {
    fault: 'Door fault report',
    maintenance: 'Maintenance / AMC request',
    quotation: 'Quotation request'
  }[requestType];

  const confirmMessage =
    'Thank you, ' + name + '. ✅\n' +
    'Your ' + typeLabel.toLowerCase() + ' has been received.\n\n' +
    'Ticket number: *' + ticketNo + '*\n' +
    (requestType === 'fault' ? 'Priority: ' + priority + '\n' : '') +
    'Our team will contact you ' + responseTime + '.\n\n' +
    'Please keep this ticket number for any follow-up.\n' +
    'KAH Middle East Co. – in partnership with GEZE';

  const details = [];
  if (requestType === 'fault') {
    details.push('Door type: ' + (asText(vars.door_type) || '-'));
    details.push('Condition: ' + (condition || '-'));
    details.push('Problem: ' + (asText(vars.problem_details) || '-'));
  } else if (requestType === 'maintenance') {
    details.push('AMC: ' + (asText(vars.amc_status) || '-'));
    details.push('Details: ' + (asText(vars.maintenance_details) || '-'));
  } else {
    details.push('Project: ' + (asText(vars.project_details) || '-'));
  }

  const teamAlert =
    '🔔 NEW ' + typeLabel.toUpperCase() + '\n' +
    'Ticket: ' + ticketNo + '\n' +
    'Priority: ' + priority + '\n' +
    'Customer: ' + name + '\n' +
    'Phone: ' + customerPhone + '\n' +
    'Location: ' + location + '\n' +
    details.join('\n');

  // Quotations go to Sales; faults and maintenance go to the service dispatcher.
  const teamPhone = requestType === 'quotation'
    ? (env.KAH_SALES_WHATSAPP || env.KAH_TEAM_WHATSAPP || '')
    : (env.KAH_TEAM_WHATSAPP || '');

  return new Response(JSON.stringify({
    vars: {
      ticket_no: ticketNo,
      request_type: requestType,
      priority: priority,
      response_time: responseTime,
      customer_name_text: name,
      site_location_text: location,
      confirm_message: confirmMessage,
      team_alert: teamAlert,
      team_phone: teamPhone
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}
