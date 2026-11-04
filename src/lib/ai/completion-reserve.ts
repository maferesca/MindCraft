// Groq counts the prompt plus the reserved completion against tokens per minute,
// and rejects the request up front if the total is over, even on an idle account.
// Reserving what is left keeps a long prompt or chat history inside the limit.
export function completionReserve(promptCharacters: number, tokensPerMinute: number) {
  const promptTokens = Math.ceil(promptCharacters / 3.5);
  return Math.max(800, Math.min(3000, tokensPerMinute - promptTokens));
}
