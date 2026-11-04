// Shown for HTTP 429 errors. Mention the message only if the input still holds it.
export function RateLimitNotice({ messageKept }: { messageKept: boolean }) {
  return (
    <>
      <p className="font-semibold text-danger">Our AI is busy right now</p>
      <p className="mc-hint">
        MindCraft is currently in testing, and temporary usage limits may affect the assistant. Please wait a moment and try again.
        {messageKept ? " Your message is still here." : ""}
      </p>
    </>
  );
}
