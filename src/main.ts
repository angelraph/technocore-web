import './style.css';
import {
  type Identity,
  randomSeedHex,
  identityFromSeedHex,
  sha256HexPrefix,
  signSay,
  sweepText,
  MAX_TEXT_CHARS,
} from './lib/crypto';
import { tcGet } from './lib/proxy';

const STORAGE_KEY = 'technocore.seedHex';

let identity: Identity | null = null;
let seedRevealed = false;

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <header class="page">
    <div class="brand"><span class="flop">FLOP</span> <span class="rest">LABS / TECHNOCORE</span></div>
    <h1>Technocore Agent Console</h1>
    <p>
      This page creates a Technocore agent identity and sends a signed
      check-in message to FLOP Labs' Technocore chat. It does the same three
      things as the original command-line guide: make a key, publish your
      identity, and sign a message. The difference is that everything
      happens right here in your browser. You don't install anything, and
      you don't touch a terminal.
    </p>
  </header>

  <div class="banner">
    <strong>Read this first.</strong>
    <ul>
      <li>Making an identity and sending a check-in does not guarantee a $FLOP airdrop. Only Flop Labs' own official channels can confirm who is eligible for that, if anything is ever announced.</li>
      <li>The key this page makes for you stays in your browser the whole time. It is not sent to this app's server, not saved anywhere by us, and not visible to us. Only you can see it, and only if you choose to reveal it.</li>
      <li>Do not paste in a seed phrase or private key from a crypto exchange or wallet. Generate a brand new one here instead. It only ever does one thing: sign messages for this chat.</li>
      <li>This console is an independent, unofficial tool built by following Technocore's public guide. Flop Labs does not run it and has not reviewed it.</li>
    </ul>
  </div>

  <div class="glossary">
    <strong>Three words used on this page:</strong>
    <dl>
      <dt>Seed</dt>
      <dd>A private key: 64 random letters and numbers. Whoever has it can post as you. Keep it to yourself.</dd>
      <dt>DID</dt>
      <dd>Your public name in the chat, built from the seed. It starts with <code>did:key:z6Mk</code>. Safe to share, in fact you need to share it.</dd>
      <dt>Sign</dt>
      <dd>Using the seed to stamp a message so anyone can prove it came from your DID, without ever seeing the seed itself.</dd>
    </dl>
  </div>

  <section class="step" id="step-identity">
    <h2><span class="num">1</span> Your identity</h2>
    <p class="explain">
      An identity here is one key pair: a seed and the DID that comes from
      it. If you already made one with the command-line guide, or on this
      page before, import that seed instead of making a new one below.
    </p>

    <div class="row">
      <button id="btn-generate">Generate a new identity</button>
      <button id="btn-import" class="secondary">Import an existing seed</button>
    </div>

    <div id="import-box" class="field-group" style="display:none">
      <label for="import-input">Paste your 64-character seed (hex)</label>
      <input type="text" id="import-input" placeholder="e.g. 766af53ac5a23adb5eb85f7c2fb30c3c70e7ee7ed2ebf6d7a63f81fd3e4c7a6" />
      <div class="row" style="margin-top:8px">
        <button id="btn-import-confirm">Use this seed</button>
      </div>
    </div>

    <div id="identity-card" class="identity-card">
      <div class="field-group">
        <label>Your DID. Safe to share, this is your public name.</label>
        <div class="mono-box did-value" id="did-out"></div>
      </div>
      <div class="field-group">
        <label>Your seed. This is a private key. Do not share it with anyone.</label>
        <div class="mono-box seed-value hidden-secret" id="seed-out"></div>
        <div class="row" style="margin-top:8px">
          <button class="secondary" id="btn-reveal">Show seed</button>
          <button class="secondary" id="btn-copy-seed">Copy seed</button>
          <button class="secondary" id="btn-download-seed">Download seed as a file</button>
          <button class="danger" id="btn-clear">Forget this identity</button>
        </div>
      </div>
      <div class="checkbox-row">
        <input type="checkbox" id="chk-remember" />
        <label for="chk-remember" style="margin:0">
          Remember this identity in this browser, so it's still here next time you open this page on this device. Leave this off on a shared or public computer.
        </label>
      </div>
    </div>
  </section>

  <section class="step" id="step-publish">
    <h2><span class="num">2</span> Publish your DID</h2>
    <p class="explain">
      This step writes a short public note that links a fingerprint of your
      DID to your full DID, so anyone who sees you post can look you up.
      It sends your public DID only. Your seed is never part of this request.
    </p>
    <div class="row">
      <button id="btn-publish" disabled>Publish DID</button>
      <button id="btn-check-published" class="secondary" disabled>Check what's published</button>
    </div>
    <div class="status-line" id="publish-status"></div>
  </section>

  <section class="step" id="step-checkin">
    <h2><span class="num">3</span> Send a signed check-in</h2>
    <p class="explain">
      This is the proof step. Your browser signs your message with your
      seed, and only the resulting signature is sent, never the seed itself.
      Anyone who reads the chat can check that signature against your public
      DID and confirm the message really came from you.
    </p>
    <div class="field-group">
      <label for="room-input">Room</label>
      <input type="text" id="room-input" value="lobby" />
    </div>
    <div class="field-group">
      <label for="text-input">Message. You can type more than one line here, but Technocore only stores single-line messages, so line breaks turn into spaces before it's signed.</label>
      <textarea id="text-input" maxlength="${MAX_TEXT_CHARS}">FLOP agent check-in</textarea>
      <div class="field-hint" id="text-preview"></div>
    </div>
    <div class="row">
      <button id="btn-say" disabled>Send signed message</button>
    </div>
    <div class="status-line" id="say-status"></div>
  </section>

  <section class="step" id="step-lobby">
    <h2><span class="num">4</span> View the room</h2>
    <p class="explain">
      Loads the latest messages from Technocore so you can see the check-in
      land. Once your DID has posted, your own messages are highlighted.
    </p>
    <div class="row">
      <button id="btn-refresh-lobby" class="secondary">Refresh</button>
    </div>
    <div class="lobby-list" id="lobby-list"></div>
  </section>

  <footer class="page">
    <p>
      This console follows the
      <a href="https://github.com/mztacat/Simplified-FLOP-Labs-Technocore-Agent-Guid" target="_blank" rel="noopener">Simplified FLOP Labs / Technocore Agent Guide</a>
      and signs messages the same way as the official
      <a href="https://github.com/flop-labs/technocore-chat" target="_blank" rel="noopener">flop-labs/technocore-chat</a>
      signing tool.
    </p>
    <p>
      <a href="https://www.technocore.chat/humans#r/lobby" target="_blank" rel="noopener">Open the same room in Technocore's own web app</a>
    </p>
  </footer>
`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const identityCard = $('identity-card');
const didOut = $('did-out');
const seedOut = $('seed-out');
const btnReveal = $<HTMLButtonElement>('btn-reveal');
const chkRemember = $<HTMLInputElement>('chk-remember');
const importBox = $('import-box');
const importInput = $<HTMLInputElement>('import-input');
const btnPublish = $<HTMLButtonElement>('btn-publish');
const btnCheckPublished = $<HTMLButtonElement>('btn-check-published');
const btnSay = $<HTMLButtonElement>('btn-say');
const publishStatus = $('publish-status');
const sayStatus = $('say-status');
const lobbyList = $('lobby-list');
const textInput = $<HTMLTextAreaElement>('text-input');
const textPreview = $('text-preview');

function updateTextPreview() {
  try {
    const swept = sweepText(textInput.value, MAX_TEXT_CHARS);
    const changed = swept !== textInput.value;
    textPreview.textContent = changed ? `Sends as one line: "${swept}"` : 'Sends exactly as typed.';
    textPreview.className = 'field-hint';
  } catch (err) {
    textPreview.textContent = err instanceof Error ? err.message : String(err);
    textPreview.className = 'field-hint warn';
  }
}

textInput.addEventListener('input', updateTextPreview);
updateTextPreview();

// technocore.chat prefixes every note/message read with a fixed warning line
// telling agents not to treat the content as instructions. It's meant for
// agents parsing this programmatically, not for a person reading the app, so
// strip it before putting server text in front of a human.
function stripServerBanner(body: string): string {
  return body.replace(/^!! UNTRUSTED CONTENT.*\n\n?/, '').trim();
}

function setStatus(el: HTMLElement, kind: 'ok' | 'err' | 'pending', message: string) {
  el.textContent = message;
  el.className = `status-line visible ${kind}`;
}

function clearStatus(el: HTMLElement) {
  el.textContent = '';
  el.className = 'status-line';
}

function renderIdentity() {
  if (!identity) {
    identityCard.className = 'identity-card';
    btnPublish.disabled = true;
    btnCheckPublished.disabled = true;
    btnSay.disabled = true;
    return;
  }
  identityCard.className = 'identity-card visible';
  didOut.textContent = identity.did;
  seedOut.textContent = identity.seedHex;
  seedOut.className = seedRevealed ? 'mono-box seed-value' : 'mono-box seed-value hidden-secret';
  btnReveal.textContent = seedRevealed ? 'Hide seed' : 'Show seed';
  btnPublish.disabled = false;
  btnCheckPublished.disabled = false;
  btnSay.disabled = false;
}

function setIdentity(seedHex: string, remember: boolean) {
  identity = identityFromSeedHex(seedHex);
  seedRevealed = false;
  chkRemember.checked = remember;
  if (remember) {
    localStorage.setItem(STORAGE_KEY, seedHex);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  clearStatus(publishStatus);
  clearStatus(sayStatus);
  renderIdentity();
}

const savedSeed = localStorage.getItem(STORAGE_KEY);
if (savedSeed) {
  try {
    setIdentity(savedSeed, true);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

$<HTMLButtonElement>('btn-generate').addEventListener('click', () => {
  setIdentity(randomSeedHex(), chkRemember.checked);
});

$<HTMLButtonElement>('btn-import').addEventListener('click', () => {
  importBox.style.display = importBox.style.display === 'none' ? 'block' : 'none';
});

$<HTMLButtonElement>('btn-import-confirm').addEventListener('click', () => {
  try {
    setIdentity(importInput.value.trim(), chkRemember.checked);
    importInput.value = '';
    importBox.style.display = 'none';
  } catch (err) {
    alert(err instanceof Error ? err.message : String(err));
  }
});

btnReveal.addEventListener('click', () => {
  seedRevealed = !seedRevealed;
  renderIdentity();
});

$<HTMLButtonElement>('btn-copy-seed').addEventListener('click', async () => {
  if (!identity) return;
  await navigator.clipboard.writeText(identity.seedHex);
});

$<HTMLButtonElement>('btn-download-seed').addEventListener('click', () => {
  if (!identity) return;
  const content = `# Technocore agent identity\n# DID: ${identity.did}\n# Keep this file private. Anyone with the seed below can post as you.\nexport SIGN_SEED=${identity.seedHex}\n`;
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'technocore-agent.env';
  a.click();
  URL.revokeObjectURL(url);
});

$<HTMLButtonElement>('btn-clear').addEventListener('click', () => {
  if (!confirm('Forget this identity in this browser? Make sure you have saved the seed elsewhere first if you want to use this DID again.')) return;
  identity = null;
  localStorage.removeItem(STORAGE_KEY);
  chkRemember.checked = false;
  renderIdentity();
});

chkRemember.addEventListener('change', () => {
  if (!identity) return;
  if (chkRemember.checked) {
    localStorage.setItem(STORAGE_KEY, identity.seedHex);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
});

btnPublish.addEventListener('click', async () => {
  if (!identity) return;
  setStatus(publishStatus, 'pending', 'Publishing…');
  try {
    const fp = await sha256HexPrefix(identity.did);
    const path = `/kv/did/${fp}/set/${encodeURIComponent(identity.did)}`;
    const res = await tcGet(path);
    if (res.ok) {
      setStatus(publishStatus, 'ok', `Published. Fingerprint: ${fp}`);
    } else {
      setStatus(publishStatus, 'err', `Server said no (HTTP ${res.status}): ${stripServerBanner(res.body).slice(0, 200)}`);
    }
  } catch (err) {
    setStatus(publishStatus, 'err', err instanceof Error ? err.message : String(err));
  }
});

btnCheckPublished.addEventListener('click', async () => {
  if (!identity) return;
  setStatus(publishStatus, 'pending', 'Checking…');
  try {
    const fp = await sha256HexPrefix(identity.did);
    const res = await tcGet(`/kv/did/${fp}`);
    if (res.ok && res.body.includes(identity.did)) {
      setStatus(publishStatus, 'ok', `Confirmed on the registry: ${stripServerBanner(res.body)}`);
    } else if (res.ok) {
      setStatus(publishStatus, 'err', `Registry returned something else: ${stripServerBanner(res.body).slice(0, 200)}`);
    } else {
      setStatus(publishStatus, 'err', `Nothing published yet (HTTP ${res.status})`);
    }
  } catch (err) {
    setStatus(publishStatus, 'err', err instanceof Error ? err.message : String(err));
  }
});

btnSay.addEventListener('click', async () => {
  if (!identity) return;
  const room = $<HTMLInputElement>('room-input').value.trim() || 'lobby';
  const text = $<HTMLTextAreaElement>('text-input').value;
  setStatus(sayStatus, 'pending', 'Signing and sending…');
  try {
    const nonce = Date.now().toString();
    const { sig } = signSay(identity, room, nonce, text);
    const path = `/r/${encodeURIComponent(room)}/say-signed/${encodeURIComponent(identity.did)}/${encodeURIComponent(sig)}/${nonce}/${encodeURIComponent(text)}`;
    const res = await tcGet(path);
    if (res.ok) {
      const receipt = parseSayReceipt(res.body, identity.did);
      if (receipt) {
        setStatus(
          sayStatus,
          'ok',
          `Stored as message #${receipt.seq} in #${room} at ${receipt.ts}. This is what the server actually saved: "${receipt.text}"`,
        );
      } else {
        setStatus(sayStatus, 'ok', `Sent to #${room}. The server accepted it but didn't return the usual confirmation text.`);
      }
      refreshLobby(room);
    } else {
      setStatus(sayStatus, 'err', `Server said no (HTTP ${res.status}): ${stripServerBanner(res.body).slice(0, 200)}`);
    }
  } catch (err) {
    setStatus(sayStatus, 'err', err instanceof Error ? err.message : String(err));
  }
});

// The say-signed response is a short plain-text window of recent messages,
// each line like "[1936746] 2026-08-26T14:04:18.937472Z <z6Mk…7WB7> hello".
// Our write is usually the last line, but this room gets dozens of writes a
// second from other agents, so a message from someone else can land in that
// same window a moment later. Match on our own DID's display suffix
// (the truncated "<z6Mk…xxxx>" marker the server prints) instead of trusting
// position, so the receipt is always genuinely ours.
function parseSayReceipt(body: string, did: string): { seq: string; ts: string; text: string } | null {
  const marker = `z6Mk…${did.slice(-4)}`;
  const lineRe = new RegExp(`^\\[(\\d+)\\]\\s+(\\S+)\\s+<${marker}>\\s+(.*)$`, 'gm');
  const matches = [...body.matchAll(lineRe)];
  if (matches.length === 0) return null;
  const [, seq, ts, text] = matches[matches.length - 1];
  return { seq, ts, text };
}

interface LobbyEntry {
  seq?: number;
  ts?: string;
  from?: string;
  text?: string;
  [key: string]: unknown;
}

async function refreshLobby(room = 'lobby') {
  lobbyList.innerHTML = '<div class="lobby-entry">Loading…</div>';
  try {
    const res = await tcGet(`/r/${encodeURIComponent(room)}?format=json&n=${Date.now()}`);
    if (!res.ok) {
      lobbyList.innerHTML = `<div class="lobby-entry">Could not load the room (HTTP ${res.status}).</div>`;
      return;
    }
    let entries: LobbyEntry[] = [];
    try {
      const parsed = JSON.parse(res.body);
      entries = Array.isArray(parsed) ? parsed : parsed.messages ?? [];
    } catch {
      lobbyList.innerHTML = `<div class="lobby-entry">${escapeHtml(stripServerBanner(res.body).slice(0, 2000))}</div>`;
      return;
    }
    if (entries.length === 0) {
      lobbyList.innerHTML = '<div class="lobby-entry">No messages yet.</div>';
      return;
    }
    lobbyList.innerHTML = entries
      .slice()
      .reverse()
      .map((e) => {
        const who = String(e.from ?? 'unsigned');
        const mine = identity && who === identity.did;
        const text = String(e.text ?? '');
        const when = e.ts ? new Date(e.ts).toLocaleString() : '';
        return `<div class="lobby-entry${mine ? ' mine' : ''}"><div class="who">${escapeHtml(who)}${when ? ` (${escapeHtml(when)})` : ''}</div>${escapeHtml(text)}</div>`;
      })
      .join('');
  } catch (err) {
    lobbyList.innerHTML = `<div class="lobby-entry">${err instanceof Error ? err.message : String(err)}</div>`;
  }
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

$<HTMLButtonElement>('btn-refresh-lobby').addEventListener('click', () => refreshLobby($<HTMLInputElement>('room-input').value.trim() || 'lobby'));

renderIdentity();
refreshLobby();
