const express = require('express');
const axios   = require('axios');

const TOKEN = process.env.BOT_TOKEN;
const API   = `https://api.telegram.org/bot${TOKEN}`;

const app = express();
app.use(express.json());

const BAR_BLOCKS = 10;
const DOT_FRAMES = ['●∙∙', '∙●∙', '∙∙●', '∙●∙'];

function render(remaining, total, tick) {
  const frac   = total > 0 ? remaining / total : 0;
  const filled = Math.round(frac * BAR_BLOCKS);

  let bloco, circulo;
  if (frac > 0.5)      { bloco = '🟩'; circulo = '🟢'; }
  else if (frac > 0.2) { bloco = '🟨'; circulo = '🟡'; }
  else                  { bloco = '🟥'; circulo = '🔴'; }

  const barra = bloco.repeat(filled) + '⬛'.repeat(BAR_BLOCKS - filled);
  const mm    = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss    = String(remaining % 60).padStart(2, '0');
  const anim  = DOT_FRAMES[tick % DOT_FRAMES.length];

  return (
    `⏳ *POR TEMPO LIMITADO*\n\n` +
    `${barra}\n` +
    `${circulo} *${mm}:${ss} restantes*\n\n` +
    `${anim} _Oferta acabando_`
  );
}

async function startTimer(chatId, totalSeconds) {
  const res = await axios.post(`${API}/sendMessage`, {
    chat_id: chatId,
    text: render(totalSeconds, totalSeconds, 0),
    parse_mode: 'Markdown'
  });
  const messageId = res.data.result.message_id;

  let tick = 1;
  const interval = setInterval(async () => {
    const remaining = totalSeconds - tick;
    try {
      await axios.post(`${API}/editMessageText`, {
        chat_id: chatId,
        message_id: messageId,
        text: render(remaining, totalSeconds, tick),
        parse_mode: 'Markdown'
      });
    } catch (err) {
      if (err.response?.data?.error_code === 429) {
        const wait = (err.response.data.parameters?.retry_after || 2) * 1000;
        await new Promise(r => setTimeout(r, wait));
      }
    }
    if (remaining <= 0) {
      clearInterval(interval);
      axios.post(`${API}/editMessageText`, {
        chat_id: chatId,
        message_id: messageId,
        text: '🔴 *OFERTA ENCERRADA*\n\n⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛\n❌ *Tempo esgotado*',
        parse_mode: 'Markdown'
      }).catch(() => {});
    }
    tick++;
  }, 1000);
}

function extrairChatId(body) {
  return (
    body.chat_id           ||
    body.telegram_id       ||
    body.user_id           ||
    body.subscriber_id     ||
    body.id                ||
    body.lead?.chat_id     ||
    body.lead?.telegram_id ||
    body.data?.chat_id     ||
    body.data?.telegram_id ||
    null
  );
}

app.post('/start-timer', async (req, res) => {
  console.log('Payload recebido:', JSON.stringify(req.body, null, 2));

  const chatId = extrairChatId(req.body);

  if (!chatId) {
    console.log('chat_id não encontrado');
    return res.status(400).json({ error: 'chat_id nao encontrado', payload: req.body });
  }

  const duracao = req.body.duracao || 180;
  res.json({ ok: true, chat_id: chatId, duracao });
  startTimer(String(chatId), duracao).catch(console.error);
});

app.get('/', (_req, res) => res.send('Timer online ✅'));
app.listen(3000, () => console.log('Servidor rodando'));
