function extrairChatId(body) {
  return (
    body.chat_id                    ||
    body.telegram_id                ||
    body.user_id                    ||
    body.subscriber_id              ||
    body.id                         ||
    body.data?.customer?.telegram_id ||
    body.data?.customer?.chat_id    ||
    body.lead?.chat_id              ||
    body.lead?.telegram_id          ||
    body.data?.chat_id              ||
    body.data?.telegram_id          ||
    null
  );
}
