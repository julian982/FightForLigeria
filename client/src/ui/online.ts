// Les parties en ligne : pseudo, liste des parties publiques, création d'une partie, salon d'attente (joueurs, réglages, prêt, discussion).
// La connexion elle-même est dans net/online.ts ; quand l'hôte lance, main.ts prend la main pour la partie.
import { MAPS } from '@ffl/shared';
import { THUMBS } from './thumbs';
import * as N from '../net/online';

const $ = (id: string): any => document.getElementById(id);
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** tout ce qui vient des autres joueurs (pseudos, noms de partie, messages) passe par ici avant d'entrer dans le HTML */
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ESC[c]);
const MAP_IDS = Object.keys(MAPS);
const mapName = (id: string) => MAPS[id] ? MAPS[id].name : '?';
const go = (v: string) => { if (location.hash.slice(1) !== v) location.hash = v; else (window as any).__showView?.(v) };
const press = (box: any, v: string) => { for (const b of box.children) if (b.dataset.v != null) b.setAttribute('aria-pressed', String(b.dataset.v === v)) };
function msg(id: string, text: string, kind = '') { const el = $(id); el.textContent = text; el.classList.toggle('warn', kind === 'warn') }

export function initOnline() {
  let view = '', rooms: any[] | null = [], listErr = '', selected = '', filter = 'all', hideFull = false;
  let salon: any = null, chat: any[] = [], afterPseudo: (() => void) | null = null;
  const cr = { vis: 'pub', map: 'amboise', stock: 'normal', speed: '1' };
  try { const m = localStorage.getItem('ffl.map'); if (m && MAPS[m]) cr.map = m } catch (e) {}

  // ---------- pseudo ----------
  const dlg = $('pseudoDlg'), pin = $('pseudoIn');
  function renderChip() { const p = N.getPseudo(); $('pseudoChip').hidden = !p; $('pseudoName').textContent = p }
  function askPseudo(then: (() => void) | null = null) {
    afterPseudo = then; pin.value = N.getPseudo(); $('pseudoHelp').classList.remove('warn');
    if (!dlg.open) dlg.showModal(); pin.focus(); pin.select();
  }
  $('pseudoForm').addEventListener('submit', (e: Event) => {
    e.preventDefault();
    if (!N.pseudoOk(pin.value)) { $('pseudoHelp').classList.add('warn'); pin.focus(); return }
    const p = N.setPseudo(pin.value); renderChip();
    if (!$('crName').value.trim()) $('crName').value = `Partie de ${p}`;
    dlg.close('ok'); const f = afterPseudo; afterPseudo = null; f && f();
  });
  $('pseudoCancel').addEventListener('click', () => dlg.close('cancel'));
  dlg.addEventListener('close', () => { if (dlg.returnValue !== 'ok') { afterPseudo = null; if (!N.getPseudo() && (view === 'en-ligne' || view === 'creer')) go('jouer') } });
  $('pseudoChip').addEventListener('click', () => askPseudo());
  renderChip();
  const withPseudo = (f: () => void) => N.getPseudo() ? f() : askPseudo(f);

  // ---------- navigation entre les écrans ----------
  function onView(v: string) {
    const prev = view; view = v;
    // quitter l'écran du salon, c'est quitter le salon
    if (prev === 'salon' && v !== 'salon' && N.netState() === 'salon') { N.leaveGame(); salon = null }
    if ((v === 'en-ligne' || v === 'creer') && !N.getPseudo()) askPseudo();
    if (v === 'en-ligne') { N.browse(); renderList() } else N.stopBrowse();
    if (v === 'creer') renderCreate();
    if (v === 'salon') { if (N.netState() !== 'salon' || !salon) { go('en-ligne'); return } renderSalon() }
  }
  addEventListener('ffl:view', (e: any) => onView(e.detail));
  addEventListener('ffl:thumbs', () => { if (view === 'en-ligne') renderList(); if (view === 'creer') renderCreate(); if (view === 'salon') renderSalon() });

  // ---------- le serveur ----------
  N.setLobbyHandlers({
    rooms(list, err) { rooms = list; listErr = err || ''; if (view === 'en-ligne') renderList() },
    salon(s) { salon = s; if (view !== 'salon') go('salon'); else renderSalon() },
    chat(m) { chat.push(m); if (chat.length > 80) chat.shift(); renderChat() },
    chatLog(l) { chat = [...l]; renderChat() },
    refused(text) { chat.push({ text, warn: true }); renderChat() },
    left(reason) { salon = null; chat = []; go('en-ligne'); msg('olMsg', reason, 'warn') },
    status(text, kind) { msg(view === 'creer' ? 'crMsg' : 'olMsg', text, kind) },
  });

  // ---------- liste des parties ----------
  function roomView(r: any) {
    const m = r.metadata || {}, playing = !!m.playing || !!r.locked;
    return { id: r.roomId, name: m.name || r.roomId, host: m.host || '?', map: m.map, mode: m.mode || '1v1', players: `${r.clients}/${r.maxClients}`,
      full: playing || r.clients >= r.maxClients, playing, rich: !!m.rich, speed: +m.speed || 1 };
  }
  function renderList() {
    const box = $('olRows'), det = $('olDetail');
    if (rooms === null) {
      box.innerHTML = `<div class="ol-empty"><p>${esc(listErr)}</p><button class="go ghost" type="button" data-retry>Réessayer</button></div>`;
      det.innerHTML = '<p class="muted">La liste des parties est indisponible. Vérifie l\'adresse du serveur en bas de la page.</p>'; return;
    }
    const list = rooms.map(roomView).filter(r => (filter === 'all' || r.mode === filter) && !(hideFull && r.full))
      .sort((a, b) => Number(a.full) - Number(b.full) || a.name.localeCompare(b.name));
    if (!list.length) {
      box.innerHTML = `<div class="ol-empty"><p>Aucune partie ouverte pour l'instant.</p><a class="go" href="#creer">Créer la tienne</a></div>`;
      det.innerHTML = '<p class="muted">Crée une partie : elle apparaîtra ici pour tous les joueurs. Pour jouer entre amis sans être dérangé, choisis « Privée » et envoie-leur le code.</p>'; return;
    }
    if (!list.some(r => r.id === selected)) selected = (list.find(r => !r.full) || list[0]).id;
    box.innerHTML = list.map(r => `<div class="ol-row${r.id === selected ? ' sel' : ''}${r.full ? ' full' : ''}">
      <button type="button" class="ol-pick" data-pick="${esc(r.id)}" aria-pressed="${r.id === selected}">${esc(r.name)}</button>
      <span class="muted">${esc(r.host)}</span><span>${esc(mapName(r.map))}</span><span class="muted">${esc(r.mode)}</span><span class="ol-num">${esc(r.players)}</span>
      ${r.full ? `<span class="ol-state">${r.playing ? 'En cours' : 'Complète'}</span>` : `<button type="button" class="go" data-join="${esc(r.id)}">Rejoindre</button>`}</div>`).join('');
    const r = list.find(x => x.id === selected)!;
    det.innerHTML = `${THUMBS[r.map] ? `<img src="${THUMBS[r.map]}" alt="Carte ${esc(mapName(r.map))}">` : ''}<h3>${esc(r.name)}</h3>
      <div class="kv"><div><span>Hôte</span><b>${esc(r.host)}</b></div><div><span>Carte</span><b>${esc(mapName(r.map))}</b></div><div><span>Mode</span><b>${esc(r.mode)} · non classée</b></div>
      <div><span>Stock de départ</span><b>${r.rich ? 'Généreux' : 'Normal'}</b></div><div><span>Vitesse</span><b>${r.speed > 1 ? 'Rapide' : 'Normale'}</b></div><div><span>Joueurs</span><b>${esc(r.players)}</b></div></div>
      <div class="grow"></div>${r.full ? `<p class="ol-state" style="justify-self:center;text-align:center">${r.playing ? 'Partie en cours' : 'Salon complet'}</p>` : `<button class="go" type="button" data-join="${esc(r.id)}">Rejoindre le salon</button>`}`;
  }
  function join(code: string) { withPseudo(() => { chat = []; msg('olMsg', ''); N.joinRoom(code) }) }
  const onListClick = (e: any) => {
    const t = e.target.closest('[data-pick],[data-join],[data-retry]'); if (!t) return;
    if (t.dataset.pick != null) { selected = t.dataset.pick; renderList() }
    else if (t.dataset.join != null) join(t.dataset.join);
    else { rooms = []; renderList(); N.browse() }
  };
  $('olRows').addEventListener('click', onListClick); $('olDetail').addEventListener('click', onListClick);
  for (const b of $('olMode').children) b.addEventListener('click', () => { if (b.disabled) return; filter = b.dataset.v; press($('olMode'), filter); renderList() });
  $('olHideFull').addEventListener('change', (e: any) => { hideFull = e.target.checked; renderList() });
  $('joinForm').addEventListener('submit', (e: Event) => {
    e.preventDefault(); const c = $('joinCode').value.trim().toUpperCase();
    if (!c) { msg('olMsg', 'Entre le code que ton ami t\'a envoyé, par exemple LOIRE-AB12.', 'warn'); $('joinCode').focus(); return }
    join(c);
  });
  $('srvUrl').value = N.serverUrl();
  $('srvApply').addEventListener('click', () => { N.setServerUrl($('srvUrl').value); $('srvUrl').value = N.serverUrl(); N.stopBrowse(); rooms = []; renderList(); N.browse() });

  // ---------- créer une partie ----------
  function renderCreate() {
    if (!$('crName').value.trim() && N.getPseudo()) $('crName').value = `Partie de ${N.getPseudo()}`;
    $('crMaps').innerHTML = MAP_IDS.map(id => `<button type="button" class="mapcard" role="radio" aria-checked="${id === cr.map}" data-map="${id}">
      ${THUMBS[id] ? `<img src="${THUMBS[id]}" alt="">` : ''}<span class="mc-txt"><span class="mc-name">${esc(mapName(id))} <span class="pill">Choisie</span></span><span class="mc-desc">${esc(MAPS[id].desc)}</span></span></button>`).join('');
    press($('crVis'), cr.vis); press($('crStock'), cr.stock); press($('crSpeed'), cr.speed);
    $('crVisHelp').textContent = cr.vis === 'priv'
      ? 'Privée : la partie n\'apparaît pas dans la liste. Tu reçois un code à envoyer à tes amis.'
      : 'Publique : la partie apparaît dans la liste des parties en ligne, tout le monde peut la rejoindre.';
  }
  $('crMaps').addEventListener('click', (e: any) => { const b = e.target.closest('[data-map]'); if (b) { cr.map = b.dataset.map; renderCreate() } });
  for (const [box, key] of [['crVis', 'vis'], ['crStock', 'stock'], ['crSpeed', 'speed']] as const)
    for (const b of $(box).children) b.addEventListener('click', () => { if (b.dataset.v == null) return; (cr as any)[key] = b.dataset.v; renderCreate() });
  $('createForm').addEventListener('submit', (e: Event) => {
    e.preventDefault();
    withPseudo(async () => {
      chat = []; $('crGo').disabled = true;
      await N.createRoom({ name: $('crName').value, priv: cr.vis === 'priv', map: cr.map, rich: cr.stock === 'riche', speed: +cr.speed });
      $('crGo').disabled = false;
    });
  });

  // ---------- salon ----------
  const realm = () => { const cs = getComputedStyle(document.documentElement); return [cs.getPropertyValue('--me').trim() || '#3f6fd8', cs.getPropertyValue('--foe').trim() || '#c9402e'] };
  function renderSalon() {
    if (!salon) return;
    const s = salon, me = s.players.find((p: any) => p.id === s.you) || { team: 0, ready: false }, isHost = s.host === s.you;
    const full = s.players.length >= s.max, allReady = full && s.players.every((p: any) => p.ready);
    $('saT').textContent = s.name; $('saVis').textContent = s.priv ? 'Privée' : 'Publique'; $('saCode').textContent = s.code;
    $('saCount').textContent = `Joueurs · ${s.players.length}/${s.max}`;
    const [cMe, cFoe] = realm();
    const teams = [me.team, 1 - me.team].map((t, i) => {
      const p = s.players.find((x: any) => x.team === t);
      const card = p ? `<div class="sa-p${p.id === s.you ? ' mine' : ''}"><div class="who"><b>${esc(p.pseudo)}${p.host ? '<small>· hôte</small>' : ''}</b><span>${p.id === s.you ? 'C\'est toi' : 'Adversaire'}</span></div>
          <div class="side"><span class="rdy${p.ready ? ' on' : ''}">${p.ready ? 'Prêt' : 'Pas prêt'}</span>${isHost && p.id !== s.you ? `<button class="kick" type="button" data-kick="${esc(p.id)}" aria-label="Exclure ${esc(p.pseudo)}" title="Exclure du salon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>` : ''}</div></div>`
        : `<div class="sa-p empty"><div class="who"><b>Place libre</b><span>${s.priv ? 'Envoie le code à un ami' : 'En attente d\'un adversaire…'}</span></div></div>`;
      return `<div class="sa-team"><h4><i style="background:${i === 0 ? cMe : cFoe}"></i>${i === 0 ? 'Ton royaume' : 'Royaume adverse'}</h4>${card}</div>`;
    });
    $('saPlayers').innerHTML = teams.join('');
    $('saPlayersNote').textContent = isHost ? 'Tu es l\'hôte : tu choisis la carte et les réglages, et tu lances la partie.' : 'L\'hôte choisit la carte et les réglages, et lance la partie.';
    $('saThumb').src = THUMBS[s.map] || ''; $('saThumb').alt = `Carte ${mapName(s.map)}`; $('saThumb').hidden = !THUMBS[s.map];
    $('saMap').textContent = mapName(s.map);
    $('saMaps').innerHTML = MAP_IDS.map(id => `<button type="button" data-v="${id}" aria-pressed="${id === s.map}">${esc(mapName(id).replace(/^(Rives d'|Confluence du |Forêt de )/, ''))}</button>`).join('');
    press($('saStock'), s.rich ? 'riche' : 'normal'); press($('saSpeed'), s.speed > 1 ? '1.5' : '1');
    for (const id of ['saMaps', 'saStock', 'saSpeed']) { $(id).classList.toggle('ro', !isHost); for (const b of $(id).children) b.setAttribute('aria-disabled', String(!isHost)) }
    $('saSetNote').textContent = isHost ? 'Changer la carte ou un réglage remet tout le monde « pas prêt ».' : 'Seul l\'hôte peut changer la carte et les réglages.';
    $('saReady').textContent = me.ready ? 'Je ne suis plus prêt' : 'Je suis prêt';
    $('saReady').classList.toggle('ghost', !!me.ready);
    $('saLaunch').hidden = !isHost; $('saLaunch').disabled = !allReady;
    const others = s.players.filter((p: any) => !p.ready && p.id !== s.you).map((p: any) => p.pseudo), meWaits = !me.ready;
    $('saStatus').textContent = !full ? (s.priv ? `En attente d'un adversaire : envoie-lui le code ${s.code}.` : 'En attente d\'un adversaire…')
      : meWaits && others.length ? 'Personne n\'est prêt pour l\'instant.'
      : meWaits ? 'Ton adversaire est prêt : à toi de cliquer sur « Je suis prêt ».'
      : others.length ? `En attente : ${others.join(', ')} n'est pas prêt.`
      : isHost ? 'Tout le monde est prêt : lance la partie !' : 'Tout le monde est prêt : l\'hôte va lancer la partie.';
    renderChat();
  }
  function renderChat() {
    if (view !== 'salon' || !salon) return;
    const log = $('chatLog'), atEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
    const myTeam = (salon.players.find((p: any) => p.id === salon.you) || { team: 0 }).team;
    const [cMe, cFoe] = realm();
    log.innerHTML = chat.map(m => m.sys ? `<p class="sys">${esc(m.text)}</p>` : m.warn ? `<p class="warn">${esc(m.text)}</p>`
      : `<p><b style="color:color-mix(in srgb, ${m.team === myTeam ? cMe : cFoe} 55%, white)">${esc(m.who)}</b> ${esc(m.text)}</p>`).join('');
    if (atEnd || chat.length < 12) log.scrollTop = log.scrollHeight;
  }
  const hostSet = (o: any) => { if (salon && salon.host === salon.you) N.setSettings(o) };
  $('saMaps').addEventListener('click', (e: any) => { const b = e.target.closest('[data-v]'); if (b) hostSet({ map: b.dataset.v }) });
  for (const b of $('saStock').children) b.addEventListener('click', () => hostSet({ rich: b.dataset.v === 'riche' }));
  for (const b of $('saSpeed').children) b.addEventListener('click', () => hostSet({ speed: +b.dataset.v }));
  $('saReady').addEventListener('click', () => { if (!salon) return; const me = salon.players.find((p: any) => p.id === salon.you); N.setReady(!(me && me.ready)) });
  $('saLaunch').addEventListener('click', () => N.launch());
  $('saPlayers').addEventListener('click', (e: any) => { const b = e.target.closest('[data-kick]'); if (b) N.kick(b.dataset.kick) });
  $('saQuit').addEventListener('click', () => { N.leaveGame(); salon = null; chat = []; go('en-ligne') });
  $('saCopy').addEventListener('click', () => {
    const b = $('saCopy'), done = () => { b.textContent = 'Copié'; setTimeout(() => b.textContent = 'Copier', 1500) };
    try { navigator.clipboard.writeText($('saCode').textContent).then(done, () => getSelection()!.selectAllChildren($('saCode'))) } catch (e) { getSelection()!.selectAllChildren($('saCode')) }
  });
  $('chatForm').addEventListener('submit', (e: Event) => {
    e.preventDefault(); const t = $('chatIn').value.trim(); if (!t) return;
    N.sendChat(t); $('chatIn').value = '';
  });
  // la page a pu s'ouvrir directement sur un de ces écrans (lien #en-ligne, rechargement) avant que ce module soit prêt
  onView((window as any).__homeView || location.hash.slice(1) || 'jouer');
}
