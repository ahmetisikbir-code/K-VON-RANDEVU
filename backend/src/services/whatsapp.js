const WHATSAPP_API_BASE = 'https://graph.facebook.com/v18.0';

function getApiUrl() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    throw new Error('WHATSAPP_PHONE_NUMBER_ID is not configured');
  }
  return `${WHATSAPP_API_BASE}/${phoneNumberId}/messages`;
}

function getHeaders() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('WHATSAPP_ACCESS_TOKEN is not configured');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
}

export async function sendMessage(to, text) {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: text },
    };

    const response = await fetch(getApiUrl(), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('WhatsApp send message error:', data);
      throw new Error(data.error?.message || 'WhatsApp mesaj gönderilemedi');
    }

    return data;
  } catch (err) {
    console.error('WhatsApp sendMessage error:', err);
    throw err;
  }
}

export async function sendTemplate(to, templateName, params = []) {
  try {
    const components = [
      {
        type: 'body',
        parameters: params.map((p) => ({
          type: 'text',
          text: String(p),
        })),
      },
    ];

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'tr' },
        components,
      },
    };

    const response = await fetch(getApiUrl(), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('WhatsApp template error:', data);
      throw new Error(data.error?.message || 'WhatsApp şablon gönderilemedi');
    }

    return data;
  } catch (err) {
    console.error('WhatsApp sendTemplate error:', err);
    throw err;
  }
}

export async function markAsRead(messageId) {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    };

    const response = await fetch(getApiUrl(), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json();
      console.error('WhatsApp markAsRead error:', data);
    }
  } catch (err) {
    console.error('WhatsApp markAsRead error:', err);
  }
}
