-- ============================================================
-- MIGRATION: 007_waha_debt_alert_workflow.sql
-- Description: Injects the WhatsApp Debt Alert n8n workflow.
-- ============================================================

INSERT INTO n8n.workflow_entity (
    id, 
    name, 
    active, 
    nodes, 
    connections, 
    settings, 
    "createdAt", 
    "updatedAt",
    "versionId"
) VALUES (
    'BrtxwMY3malrlZKW',
    'Production: WhatsApp Debt Alert',
    true,
    '[{"parameters":{"httpMethod":"POST","path":"send-debt-alert","responseMode":"onReceived","options":{}},"id":"webhook-trigger","name":"Webhook","type":"n8n-nodes-base.webhook","typeVersion":1,"position":[0,304]},{"parameters":{"jsCode":"const data = $input.first().json.body;\nconst name = data.name;\nconst phone = data.phone;\nconst amount = Number(data.amount || 0);\nconst currentDebt = Number(data.current_debt || 0);\nconst creditLimit = Number(data.credit_limit || 0);\nconst type = data.type; // ''new_debt'' or ''reminder''\n\nconst fmt = (n) => new Intl.NumberFormat(''id-ID'', { style: ''currency'', currency: ''IDR'', minimumFractionDigits: 0 }).format(n);\nconst dateStr = new Date().toLocaleDateString(''id-ID'', { day: ''numeric'', month: ''long'', year: ''numeric'' });\n\nlet message = '''';\nif (type === ''new_debt'') {\n  message += `Halo *${name}*,\\n\\n`;\n  message += `Terima kasih telah berbelanja di *Warung Rafilah*.\\n\\n`;\n  message += `Kami mencatat bon baru sebesar *${fmt(amount)}* pada tanggal ${dateStr}.\\n`;\n  message += `Sisa saldo bon Anda saat ini adalah *${fmt(currentDebt)}* (Batas Limit: ${fmt(creditLimit)}).\\n\\n`;\n  message += `Salam hangat,\\n*Warung Rafilah*`;\n} else {\n  message += `Halo *${name}*,\\n\\n`;\n  message += `Ini adalah pengingat ramah untuk sisa saldo bon Anda di *Warung Rafilah* sebesar *${fmt(currentDebt)}* (Batas Limit: ${fmt(creditLimit)}).\\n\\n`;\n  message += `Mohon dapat diselesaikan ketika ada waktu luang. Terima kasih banyak atas kepercayaan Anda!\\n\\n`;\n  message += `Salam hangat,\\n*Warung Rafilah*`;\n}\n\n// Format phone number for WAHA\nlet cleanPhone = phone.replace(/[^0-9]/g, '''');\nif (cleanPhone.startsWith(''0'')) {\n  cleanPhone = ''62'' + cleanPhone.slice(1);\n}\nif (!cleanPhone.endsWith(''@c.us'')) {\n  cleanPhone = cleanPhone + ''@c.us'';\n}\n\nreturn [{ json: { chatId: cleanPhone, message } }];"},"id":"code-format-message","name":"Format Alert Message","type":"n8n-nodes-base.code","typeVersion":2,"position":[224,304]},{"parameters":{"resource":"Chatting","operation":"Send Text","session":"default","chatId":"={{ $json.chatId }}","text":"={{ $json.message }}"},"id":"waha-send-message","name":"Send WhatsApp","type":"@devlikeapro/n8n-nodes-waha.WAHA","typeVersion":202502,"position":[448,304],"credentials":{"wahaApi":{"id":"uXjZvjc5y9NnRc37","name":"WAHA account"}}}]'::jsonb,
    '{"Webhook":{"main":[[{"node":"Format Alert Message","type":"main","index":0}]]},"Format Alert Message":{"main":[[{"node":"Send WhatsApp","type":"main","index":0}]]}}'::jsonb,
    '{}'::jsonb,
    NOW(),
    NOW(),
    'a98b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d'
) ON CONFLICT (id) DO UPDATE SET
    nodes = EXCLUDED.nodes,
    connections = EXCLUDED.connections,
    active = EXCLUDED.active,
    "versionId" = EXCLUDED."versionId",
    "updatedAt" = NOW();
