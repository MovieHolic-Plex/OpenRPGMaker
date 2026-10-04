/** Give input/abort events a task boundary without waiting for paint or throttled timers. */
export function yieldToTask(): Promise<void> {
  return new Promise(resolve => {
    let channel: MessageChannel | undefined;
    try {
      channel = new MessageChannel();
      channel.port1.onmessage = () => {
        channel?.port1.close();
        channel?.port2.close();
        resolve();
      };
      channel.port2.postMessage(null);
    } catch {
      channel?.port1.close();
      channel?.port2.close();
      setTimeout(resolve, 0);
    }
  });
}
