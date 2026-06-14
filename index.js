const express = require('express');
const axios   = require('axios');

const TOKEN = process.env.BOT_TOKEN;
const API   = `https://api.telegram.org/bot${TOKEN}`;

const app = express();
app.use(express.json());

const BAR_BLOCKS  = 10;
const DOT_FRAMES  = ['●∙∙', '∙●∙', '∙∙●', '∙●∙'];
const activeTimers = new Map(); // guarda timer ativo por usuário

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

async function cancelarAnterior(chatId) {
  const anterior = activeTimers.get(chatId);
  if (!anterior) return;
  clearInterval(anterior.interval);
  try {
    await axios.post(`${API}/deleteMessage`, {
      chat_id: chatId,
      message_id: anterior.messageId
    });
  } catch {
    // se não conseguir deletar, ignora
  }
  activeTimers.delete(chatId);
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
      activeTimers.delete(chatId);
      axios.post(`${API}/editMessageText`, {
        chat_id: chatId,
        message_id: messageId,
        text: '🔴 *OFERTA ENCERRADA*\n\n⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛\n❌ *Tempo esgotado*\n\n𝗡𝗢𝗩𝗔 ᴘʀᴏᴍᴏᴄ̧ᴀ̃ᴏ ᴀʙᴀɪxᴏ\!👇',
        parse_mode: 'MarkdownV2'
      }).catch(() => {});
    }
    tick++;
  }, 1000);

  activeTimers.set(chatId, { messageId, interval });
}

app.post('/start-timer', async (req, res) => {
  const chatId = req.body?.data?.customer?.telegram_id || null;
  if (!chatId) return res.status(400).json({ error: 'chat_id nao encontrado' });
  res.json({ ok: true });
  await cancelarAnterior(String(chatId));
  startTimer(String(chatId), 180).catch(console.error);
});

app.get('/', (_req, res) => res.send('Timer online ✅'));
app.listen(3000, () => console.log('Servidor rodando'));
