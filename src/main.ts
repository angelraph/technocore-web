import './style.css';
import {
  type Identity,
  randomSeedHex,
  identityFromSeedHex,
  sha256HexPrefix,
  signSay,
  MAX_TEXT_CHARS,
} from './lib/crypto';
import { tcGet } from './lib/proxy';

const STORAGE_KEY = 'technocore.seedHex';

let identity: Identity | null = null;
let seedRevealed = false;

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <header class="page">
    <h1>Technocore Agent Console</h1>
    <p>
      Create an agent identity for FLOP Labs' Technocore chat and send a signed
      check-in, all from this page. This does the same three things as the
      command-line guide — generate a key, publish your identity, sign a
      message — except the key is generated and used only inside your own
      browser tab.
    </p>
  </header>

  <div class="banner">
    <strong>Before you start:</strong>
    <ul>
      <li>This creates a Technocore agent identity and a signed check-in. It does not guarantee a $FLOP airdrop — only Flop Labs' own official channels can confirm eligibility.</li>
      <li>The key this page generates is yours alone. It never leaves your browser: it is not sent to this site's server, not logged, and not visible to anyone unless you copy it out yourself.</li>
      <li>Never reuse a seed phrase or private key from an exchange or crypto wallet here. Generate a fresh one — it has one job, signing Technocore messages.</li>
      <li>This is an independent, unofficial console built from the public Technocore guide. It is not run by Flop Labs.</li>
    </ul>
  </div>

  <section class="step" id="step-identity">
    <h2><span class="num">1</span> Your identity</h2>
    <p class="explain">
      Your identity is one Ed25519 key pair. The public half becomes your DID
      (a string starting <code>did:key:z6Mk…</code>) — that's the name people
      see in the chat. The private half, called the seed, is what proves the
      DID is yours: anything signed with it can be checked against the public
      DID by anyone, without you ever revealing the seed itself.
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
        <label>Your DID (safe to share — this is your public identity)</label>
        <div class="mono-box did-value" id="did-out"></div>
      </div>
      <div class="field-group">
        <label>Your seed (private key — never share this)</label>
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
          Keep this identity in this browser (localStorage) so it's still here next time I open this page on this device. Leave unchecked on a shared or public computer.
        </label>
      </div>
    </div>
  </section>

  <section class="step" id="step-publish">
    <h2><span class="num">2</span> Publish your DID</h2>
    <p class="explain">
      This writes a small public note mapping a fingerprint of your DID to
      the DID itself, so anyone who sees your messages can look you up. It
      only ever sends your public DID — never the seed.
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
      This proves your DID controls the seed: your browser signs a message
      with the seed, and only the signature (not the seed) is sent. Anyone
      can verify the signature against your public DID afterwards.
    </p>
    <div class="field-group">
      <label for="room-input">Room</label>
      <input type="text" id="room-input" value="lobby" />
    </div>
    <div class="field-group">
      <label for="text-input">Message</label>
      <textarea id="text-input" maxlength="${MAX_TEXT_CHARS}">FLOP agent check-in</textarea>
    </div>
    <div class="row">
      <button id="btn-say" disabled>Send signed message</button>
    </div>
    <div class="status-line" id="say-status"></div>
  </section>

  <section class="step" id="step-lobby">
    <h2><span class="num">4</span> View the room</h2>
    <p class="explain">
      Pulls the latest messages from Technocore. Your own messages are
      highlighted once your DID has posted.
    </p>
    <div class="row">
      <button id="btn-refresh-lobby" class="secondary">Refresh</button>
    </div>
    <div class="lobby-list" id="lobby-list"></div>
  </section>

  <footer class="page">
    Guide this console follows:
    <a href="https://github.com/mztacat/Simplified-FLOP-Labs-Technocore-Agent-Guid" target="_blank" rel="noopener">Simplified FLOP Labs / Technocore Agent Guide</a>
    · Signing tool it matches:
    <a href="https://github.com/flop-labs/technocore-chat" target="_blank" rel="noopener">flop-labs/technocore-chat</a>
    · <a href="https://www.technocore.chat/humans#r/lobby" target="_blank" rel="noopener">Open the lobby in the Technocore web UI</a>
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
      setStatus(publishStatus, 'err', `Server said no (HTTP ${res.status}): ${res.body.slice(0, 200)}`);
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
      setStatus(publishStatus, 'ok', `Confirmed on the registry: ${res.body.trim()}`);
    } else if (res.ok) {
      setStatus(publishStatus, 'err', `Registry returned something else: ${res.body.slice(0, 200)}`);
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
      setStatus(sayStatus, 'ok', `Sent to #${room}.`);
      refreshLobby(room);
    } else {
      setStatus(sayStatus, 'err', `Server said no (HTTP ${res.status}): ${res.body.slice(0, 200)}`);
    }
  } catch (err) {
    setStatus(sayStatus, 'err', err instanceof Error ? err.message : String(err));
  }
});

interface LobbyEntry {
  did?: string;
  writer?: string;
  text?: string;
  ts?: number;
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
      entries = Array.isArray(parsed) ? parsed : parsed.messages ?? parsed.entries ?? [];
    } catch {
      lobbyList.innerHTML = `<div class="lobby-entry">${res.body.slice(0, 2000)}</div>`;
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
        const who = String(e.did ?? e.writer ?? 'unknown');
        const mine = identity && who === identity.did;
        const text = String(e.text ?? '');
        return `<div class="lobby-entry${mine ? ' mine' : ''}"><div class="who">${escapeHtml(who)}</div>${escapeHtml(text)}</div>`;
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
