type Listener = () => void;

const channels = new Map<string, Set<Listener>>();

export function emitRealtime(channel: string) {
  channels.get(channel)?.forEach((fn) => fn());
}

export function subscribeRealtime(channel: string, listener: Listener): () => void {
  if (!channels.has(channel)) channels.set(channel, new Set());
  channels.get(channel)!.add(listener);
  return () => channels.get(channel)?.delete(listener);
}
