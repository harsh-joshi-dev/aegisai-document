type QueuedRequest = {
  id: string;
  createdAt: number;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  body: any;
};

const KEY = 'aegis_mobile_offline_queue_v1';

function load(): QueuedRequest[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function save(items: QueuedRequest[]) {
  localStorage.setItem(KEY, JSON.stringify(items.slice(-200)));
}

export function enqueue(req: Omit<QueuedRequest, 'id' | 'createdAt'>) {
  const items = load();
  items.push({
    ...req,
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: Date.now(),
  });
  save(items);
}

export function getQueueSize() {
  return load().length;
}

export async function flushQueue(send: (req: QueuedRequest) => Promise<void>) {
  const items = load();
  if (items.length === 0) return { sent: 0, failed: 0 };

  const remaining: QueuedRequest[] = [];
  let sent = 0;
  let failed = 0;

  for (const item of items) {
    try {
      await send(item);
      sent++;
    } catch {
      failed++;
      remaining.push(item);
    }
  }

  save(remaining);
  return { sent, failed };
}

