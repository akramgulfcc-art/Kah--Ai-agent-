# KAH Door Service – WhatsApp Auto-Reply

An automatic WhatsApp assistant for KAH Middle East Co. Customers can report a
door fault, book maintenance or an AMC visit, or ask for a quotation, 24/7. Every
request gets a ticket number, and the team is alerted on WhatsApp straight away.

## How it works for the customer

```
Customer sends any message
        │
        ▼
Welcome message + menu
 ├─ Report a door fault ──┐
 ├─ Book maintenance / AMC├─► Name & company ─► Site location ─┐
 ├─ New door quotation ───┘                                    │
 └─ Talk to our team ─► Team member replies                    │
                                                               ▼
   Fault:       door type ─► door condition ─► problem + photo
   Maintenance: AMC yes/no ─► number of doors + preferred date
   Quotation:   project details + drawings
                                                               │
                                                               ▼
        Ticket number sent to the customer (e.g. KAH-SR-261030-BCHM)
        Alert sent to the dispatcher (or Sales for quotations)
        Conversation handed to the team in the Kapso inbox
```

| Request | Ticket prefix | Sent to | Response promise |
|---|---|---|---|
| Door fault – stuck open / closed | `KAH-SR` | Service dispatcher | High priority – within 4 hours |
| Door fault – other issue | `KAH-SR` | Service dispatcher | Normal – within 24 hours |
| Maintenance / AMC | `KAH-PM` | Service dispatcher | Visit date confirmed within 1 working day |
| Quotation | `KAH-QT` | Sales | Within 1 working day |

You can change the response promises at the top of
`functions/kah-create-service-ticket/index.js` (`RESPONSE_TIME`).

Customers can also type instead of using the menu. For example, "الباب معطل"
or "door stuck" goes to the fault path, and "صيانة" or "AMC" goes to maintenance.

## Files

| File | Purpose |
|---|---|
| `workflows/kah-door-service/definition.json` | The conversation steps and messages |
| `functions/kah-route-menu/index.js` | Reads the customer's choice (English or Arabic) |
| `functions/kah-create-service-ticket/index.js` | Ticket number, priority, customer confirmation, team alert |
| `deploy.mjs` | One-step setup on Kapso |
| `test-functions.mjs` | Local test: `node kapso/test-functions.mjs` |

## Setup (one time)

1. **Kapso account:** sign up at kapso.ai and connect the KAH WhatsApp Business number.
2. **API key:** in Kapso, create an API key. Set it in this environment:
   ```bash
   export KAPSO_API_KEY=your-key
   export KAPSO_API_BASE_URL=https://api.kapso.ai
   ```
3. **Find the phone number ID:**
   ```bash
   cd .claude/skills/automate-whatsapp && npm i && cd -
   node .claude/skills/automate-whatsapp/scripts/list-whatsapp-phone-numbers.js
   ```
4. **Upload everything:**
   ```bash
   node kapso/deploy.mjs --phone-number-id <phone_number_id>
   ```
5. **Team numbers:** in Kapso, open the function `kah-create-service-ticket` and add two secrets:
   - `KAH_TEAM_WHATSAPP`: the service dispatcher's WhatsApp number, e.g. `+9665XXXXXXXX`
   - `KAH_SALES_WHATSAPP`: the sales WhatsApp number
6. **Test:** send "Hi" from your mobile, go through each option, then set the workflow to **Active**.

## Important note on team alerts

WhatsApp only allows free-text messages to a number that has messaged the business
in the last 24 hours. The dispatcher and sales phones should send a short message
(for example "Hi") to the KAH business number each morning. A better long-term
option is an approved WhatsApp template for the team alert, which always delivers.
