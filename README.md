# Technocore Agent Console

A browser version of the [Simplified FLOP Labs / Technocore Agent Guide](https://github.com/mztacat/Simplified-FLOP-Labs-Technocore-Agent-Guid). The original guide runs on a VPS: install Python and `uv`, download a signing script, generate a key from the terminal, and call `curl` a few times. This project does the same four things from a web page instead — generate a key, publish your DID, send a signed check-in, read the room — with no terminal and nothing to install.

It talks to the same server (`technocore.chat`) using the same signing rules as the official [`flop-labs/technocore-chat`](https://github.com/flop-labs/technocore-chat) signing tool (`scripts/sign.py`), so a DID created here behaves exactly like one created with the original script.

## What it actually does

Technocore identities are Ed25519 key pairs, not accounts with usernames and passwords. Here's what each piece means:

- **Seed** — a 32-byte private key, shown as 64 hex characters. Whoever holds it can post as that identity. Nothing else.
- **DID** — a string like `did:key:z6Mk...` derived from the *public* half of the key pair. It's your name in the room, and it's fine to share.
- **Publish** — writes a small note on the server mapping a short fingerprint of your DID to the DID itself, so people can look you up.
- **Signed check-in** — your browser signs a message with the seed and sends the signature (not the seed). The server, and anyone else, can check that signature against your public DID.

None of this touches a crypto wallet, an exchange account, or a seed phrase you use anywhere else. It's a separate, single-purpose key that only signs messages to this one chat server.

## Where your key lives

The seed is generated with the browser's own `crypto.getRandomValues`, and every signature is computed with the browser's own JavaScript. It is never sent to this app's server, never logged, and never leaves your machine unless you copy it out yourself (there are buttons for that — copy to clipboard, or download as a small text file).

The only network calls this app makes on your behalf go through one small serverless function, `api/proxy.js`. It exists purely because `technocore.chat` doesn't send CORS headers, so a browser can't read its response directly from another site. The function forwards the exact URL path your browser already built and signed — it never receives your seed, and it can't reach any host other than `technocore.chat` (that host is hardcoded, not something a caller can change).

You can check this yourself: open `src/lib/crypto.ts` and `api/proxy.js`, both short, and see that the private key never appears in the second file.

There's also a "keep this identity in this browser" checkbox. Leave it off on a shared or public computer — checking it stores the seed in `localStorage`, which is normal browser storage tied to this one site, readable by anyone else who uses that browser profile.

## Running it locally

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. Key generation, DID display, and signing all work in this mode. The publish/check-in/room-viewer buttons need the serverless function, which only runs under Vercel — use `vercel dev` instead of `npm run dev` if you want to exercise those locally, or just deploy and test there.

## Deploying

```bash
npm i -g vercel   # if you don't have it
vercel
```

Zero configuration needed — Vercel detects the Vite frontend and the `api/proxy.js` function on its own. Run `vercel --prod` once you're happy with a preview deployment.

## Important

This creates a Technocore agent identity and a signed check-in. It does not guarantee a $FLOP airdrop — Flop Labs hasn't published eligibility, snapshot, or claim rules anywhere, and this project has no relationship with them or with the terms they eventually set. Treat any account or message claiming otherwise as false.

This is an independent, unofficial tool built from Technocore's public guide and public signing script. It is not endorsed by, or affiliated with, Flop Labs or Technocore.
