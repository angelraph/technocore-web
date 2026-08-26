// technocore.chat sends no Access-Control-Allow-Origin header, so the browser
// can't read a direct cross-origin response. /api/proxy (a Vercel function)
// forwards the already-built, already-signed path server-side. It never sees
// a private key, only public paths the client has already signed.
export interface ProxyResult {
  ok: boolean;
  status: number;
  body: string;
}

export async function tcGet(path: string): Promise<ProxyResult> {
  const res = await fetch(`/api/proxy?path=${encodeURIComponent(path)}`);
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}
