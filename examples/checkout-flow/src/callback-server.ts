import { createServer, type IncomingMessage } from 'node:http';
import { once } from 'node:events';

/** Callback'e gelen form alanlarını işleyen fonksiyon. */
export type CallbackHandler = (payload: Record<string, string>) => Promise<{ status: number }>;

/** Çalışan callback sunucusu. */
export interface CallbackServer {
  /** Bankanın kullanıcıyı döndüreceği adres. */
  readonly url: string;
  readonly stop: () => Promise<void>;
}

const CALLBACK_PATH = '/payments/3ds/callback';
/** Beklenenden büyük gövdeler reddedilir; 3DS callback'i birkaç yüz bayttır. */
const MAX_BODY_BYTES = 64 * 1024;

async function readBody(request: IncomingMessage): Promise<string | undefined> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) return undefined;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Mağazanın 3DS dönüş adresini sunan küçük bir HTTP sunucusu başlatır. Express, Fastify
 * veya Next.js kullanan bir uygulamada bunun yerini bir route alır.
 */
export async function startCallbackServer(handler: CallbackHandler): Promise<CallbackServer> {
  const handle = async (request: IncomingMessage): Promise<number> => {
    if (request.method !== 'POST' || request.url !== CALLBACK_PATH) return 404;
    const body = await readBody(request);
    if (body === undefined) return 413;
    return (await handler(Object.fromEntries(new URLSearchParams(body)))).status;
  };

  const server = createServer((request, response) => {
    handle(request)
      .catch(() => 500)
      .then((status) => {
        response.writeHead(status, { connection: 'close' }).end();
      })
      .catch(() => response.destroy());
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('Unexpected address');
  return {
    url: `http://127.0.0.1:${String(address.port)}${CALLBACK_PATH}`,
    stop: async () => {
      server.close();
      server.closeAllConnections();
      await once(server, 'close');
    },
  };
}
