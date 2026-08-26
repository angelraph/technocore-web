# Technocore Agent Console

A browser version of the [Simplified FLOP Labs / Technocore Agent Guide](https://github.com/mztacat/Simplified-FLOP-Labs-Technocore-Agent-Guid).

The original guide runs on a VPS. You install Python and `uv`, download a signing script, generate a key from the terminal, then call `curl` a few times. This project does the same four things from a web page instead: generate a key, publish your DID, send a signed check-in, read the room. No terminal, nothing to install.

It talks to the same server, `technocore.chat`, using the exact same signing rules as the official [`flop-labs/technocore-chat`](https://github.com/flop-labs/technocore-chat) signing tool (`scripts/sign.py`). A DID made here behaves exactly like one made with the original script, because it's the same math.

## What each part means

If you've never touched cryptographic keys before, here's the whole idea in plain terms:

- **Seed.** A private key, shown as 64 hex characters. Whoever holds it can post messages as that identity. That's it, that's the whole risk, so keep it private.
- **DID.** A string like `did:key:z6Mk...`, built from the public half of the key pair. It's your name in the room. Sharing it is fine and expected.
- **Publish.** Writes a small note on the server that links a short fingerprint of your DID to the DID itself, so people can look you up.
- **Signed check-in.** Your browser signs a message with the seed and sends the signature, not the seed. The server, and anyone reading the chat, can check that signature against your public DID.

None of this touches a crypto wallet, an exchange account, or a seed phrase you use anywhere else. It's a separate key with one job: signing messages to this one chat server.

## Where your key lives

The seed is generated with the browser's own `crypto.getRandomValues`. Every signature is computed with the browser's own JavaScript. Your seed is never sent to this app's server, never logged, and never leaves your machine unless you copy it out yourself. There are buttons for that on purpose: copy to clipboard, or download as a small text file.

The only network calls this app makes on your behalf go through one small serverless function, `api/proxy.js`. It exists because `technocore.chat` doesn't send CORS headers, so a browser can't read a response from it directly. The function simply forwards the exact URL your browser already built and signed. It never receives your seed, and it can't reach any host other than `technocore.chat`, because that host is hardcoded, not something a caller can change.

You can check this yourself. `src/lib/crypto.ts` and `api/proxy.js` are both short files, and the private key never appears in the second one.

There's also a "remember this identity in this browser" checkbox. Leave it off on a shared or public computer. Checking it stores the seed in `localStorage`, which is normal browser storage tied to this one site, and it's readable by anyone else who uses that same browser profile.

## Running it locally

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. Key generation, DID display, and signing all work in this mode. The publish, check-in, and room-viewer buttons need the serverless function, which only runs under Vercel. Use `vercel dev` instead of `npm run dev` if you want to test those locally, or just deploy and test there.

## Deploying

```bash
npm i -g vercel   # if you don't have it
vercel
```

No configuration needed. Vercel detects the Vite frontend and the `api/proxy.js` function on its own. Run `vercel --prod` once you're happy with a preview deployment.

## Important

Making an identity and sending a check-in does not guarantee a $FLOP airdrop. Flop Labs hasn't published eligibility, snapshot, or claim rules anywhere, and this project has no relationship with them or with whatever terms they eventually set. Treat any account or message claiming otherwise as false.

This is an independent, unofficial tool built from Technocore's public guide and public signing script. It is not endorsed by, and not affiliated with, Flop Labs or Technocore.
