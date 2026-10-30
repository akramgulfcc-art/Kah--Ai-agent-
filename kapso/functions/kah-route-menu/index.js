async function handler(request, env) {
  // Decide-node helper for the KAH Door Service workflow.
  // Reads the customer's menu choice and returns the matching edge label.
  const payload = await request.json();
  const vars = (payload && payload.execution_context && payload.execution_context.vars) || {};
  const availableEdges = Array.isArray(payload && payload.available_edges) ? payload.available_edges : [];

  function extractChoice(value) {
    if (!value) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (typeof value === 'object') {
      const nested =
        (value.interactive && (value.interactive.list_reply || value.interactive.button_reply)) ||
        value.list_reply ||
        value.button_reply;
      if (nested && typeof nested === 'object') return String(nested.id || nested.title || '');
      return String(value.list_id || value.button_id || value.id || value.text || value.body || value.title || '');
    }
    return '';
  }

  // Map menu IDs and free-text replies (English and Arabic) to a request type.
  function toRequestType(raw) {
    const text = raw.toLowerCase().trim();
    if (['fault', 'maintenance', 'quotation', 'team'].includes(text)) return text;
    if (/fault|broken|stuck|not working|repair|emergency|عطل|خراب|معطل|طوارئ|اصلاح|إصلاح/.test(text)) return 'fault';
    if (/maint|amc|service|visit|contract|صيانة|عقد|زيارة/.test(text)) return 'maintenance';
    if (/quot|price|project|new door|offer|عرض|سعر|مشروع|جديد/.test(text)) return 'quotation';
    if (/team|talk|call|human|agent|person|موظف|تواصل|اتصال/.test(text)) return 'team';
    return '';
  }

  const requestType = toRequestType(extractChoice(vars.menu_choice));

  let nextEdge;
  if (availableEdges.includes(requestType)) {
    nextEdge = requestType;
  } else if (requestType && requestType !== 'team' && availableEdges.includes('request')) {
    nextEdge = 'request';
  } else if (availableEdges.includes('team')) {
    // Unclear reply on the first menu: let a person take over.
    nextEdge = 'team';
  } else {
    nextEdge = availableEdges[0] || 'next';
  }

  return new Response(JSON.stringify({ next_edge: nextEdge, vars: { request_type: requestType || 'team' } }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
