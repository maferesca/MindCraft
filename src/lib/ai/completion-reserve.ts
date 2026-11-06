// Groq counts the prompt plus the reserved completion against tokens per minute,
// and rejects the request up front if the total is over, even on an idle account.
// Reserving what is left keeps a long prompt or chat history inside the limit.
export function completionReserve(promptCharacters: number, tokensPerMinute: number) {
  const promptTokens = Math.ceil(promptCharacters / 3.2);
  return Math.max(800, Math.min(3000, tokensPerMinute - promptTokens));
}

// The rules already fill most of a small token limit, and the reserve can't shrink
// below 800, so a long chat would be rejected on an idle account. Older messages go
// first, and the latest message always stays.
export function trimHistory<T extends { content: string }>(messages: T[], maxCharacters = 4500) {
  const kept = [messages[messages.length - 1]];
  let total = kept[0].content.length;
  for (const message of messages.slice(0, -1).reverse()) {
    total += message.content.length;
    if (total > maxCharacters) break;
    kept.unshift(message);
  }
  return kept;
}
