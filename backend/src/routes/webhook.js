import { Router } from 'express';
import { processMessage } from '../services/ai.js';
import { sendMessage, markAsRead } from '../services/whatsapp.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log('WhatsApp webhook verified successfully');
      return res.status(200).send(challenge);
    }

    return res.status(403).send('Verification failed');
  } catch (err) {
    console.error('Webhook verification error:', err);
    return res.status(500).send('Internal error');
  }
});

router.post('/', async (req, res) => {
  try {
    const body = req.body;

    if (body.object !== 'whatsapp_business_account') {
      return res.sendStatus(404);
    }

    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== 'messages') continue;

        const messages = change.value?.messages || [];
        for (const message of messages) {
          if (message.type === 'text') {
            const from = message.from;
            const messageText = message.text?.body || '';
            const messageId = message.id;

            await markAsRead(messageId);

            const session = {
              userPhone: from,
              state: 'idle',
              data: {},
            };

            const response = await processMessage(session, messageText);
            await sendMessage(from, response.text);
          }
        }
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Webhook message processing error:', err);
    return res.status(500).json({ success: false, error: 'Mesaj işlenirken hata oluştu' });
  }
});

export default router;
