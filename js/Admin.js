const KEY_TOKEN = 'admin_token';

const els = {
	loginSection: document.getElementById('loginSection'),
	adminSection: document.getElementById('adminSection'),
	username: document.getElementById('username'),
	password: document.getElementById('password'),
	loginBtn: document.getElementById('loginBtn'),
	logoutBtn: document.getElementById('logoutBtn'),
	loginStatus: document.getElementById('loginStatus'),
	dataStatus: document.getElementById('dataStatus'),
	tabData: document.getElementById('tabData'),
	tabSecond: document.getElementById('tabSecond'),
	panelData: document.getElementById('panelData'),
	panelSecond: document.getElementById('panelSecond'),
	tableSelect: document.getElementById('tableSelect'),
	filtersPartida: document.getElementById('filtersPartida'),
	filtersUsuari: document.getElementById('filtersUsuari'),
	applyFiltersBtn: document.getElementById('applyFiltersBtn'),
	clearFiltersBtn: document.getElementById('clearFiltersBtn'),
	downloadCsvBtn: document.getElementById('downloadCsvBtn'),
	dataTable: document.getElementById('dataTable'),
	playbackPartidaId: document.getElementById('playbackPartidaId'),
	loadPlaybackBtn: document.getElementById('loadPlaybackBtn'),
	prevStepBtn: document.getElementById('prevStepBtn'),
	nextStepBtn: document.getElementById('nextStepBtn'),
	playPauseBtn: document.getElementById('playPauseBtn'),
	playbackStatus: document.getElementById('playbackStatus'),
	playbackStepList: document.getElementById('playbackStepList'),
	playbackSummary: document.getElementById('playbackSummary'),
	playbackStepDetails: document.getElementById('playbackStepDetails'),
	playbackFigures: document.getElementById('playbackFigures'),
	playbackGameFrame: document.getElementById('playbackGameFrame'),
};

let currentRows = [];
let currentTable = 'partida';
let playbackSteps = [];
let playbackSummary = null;
let playbackIndex = -1;
let playbackTimer = null;

const partidaFilters = [
	{ name: 'id_partida', label: 'Id Partida', type: 'number' },
	{ name: 'id_usuari', label: 'Id Usuari', type: 'number' },
	{ name: 'id_nivel', label: 'Id Nivell', type: 'number' },
	{
		name: 'validado',
		label: 'Validat',
		type: 'select',
		options: [
			{ value: '', text: 'Qualsevol' },
			{ value: '0', text: 'No' },
			{ value: '1', text: 'Sí' },
		],
	},
	{ name: 'date_from', label: 'Data des de', type: 'datetime-local' },
	{ name: 'date_to', label: 'Data fins a', type: 'datetime-local' },
];

const usuariFilters = [
	{ name: 'id_usuari', label: 'Id Usuari', type: 'number' },
	{
		name: 'genere',
		label: 'Genere',
		type: 'select',
		options: [
			{ value: '', text: 'Qualsevol' },
			{ value: 'home', text: 'home' },
			{ value: 'dona', text: 'dona' },
			{ value: 'altre', text: 'altre' },
		],
	},
	{
		name: 'ma_habil',
		label: 'Ma habil',
		type: 'select',
		options: [
			{ value: '', text: 'Qualsevol' },
			{ value: 'esquerra', text: 'esquerra' },
			{ value: 'dreta', text: 'dreta' },
		],
	},
	{ name: 'edat_min', label: 'Edat Min', type: 'number' },
	{ name: 'edat_max', label: 'Edat Max', type: 'number' },
];

function getToken() {
	return localStorage.getItem(KEY_TOKEN) || '';
}

function setToken(token) {
	localStorage.setItem(KEY_TOKEN, token);
}

function clearToken() {
	localStorage.removeItem(KEY_TOKEN);
}

function setStatus(node, message, kind) {
	node.textContent = message || '';
	node.className = 'status';
	if (kind) node.classList.add(kind);
}

function createFilterControls(container, specs) {
	container.innerHTML = '';
	for (const spec of specs) {
		const wrap = document.createElement('div');
		const label = document.createElement('label');
		label.textContent = spec.label;
		label.setAttribute('for', `f_${spec.name}`);

		let input;
		if (spec.type === 'select') {
			input = document.createElement('select');
			for (const opt of spec.options) {
				const o = document.createElement('option');
				o.value = opt.value;
				o.textContent = opt.text;
				input.appendChild(o);
			}
		} else {
			input = document.createElement('input');
			input.type = spec.type;
		}
		input.id = `f_${spec.name}`;
		input.name = spec.name;

		wrap.appendChild(label);
		wrap.appendChild(input);
		container.appendChild(wrap);
	}
}

function getFilterValues() {
	const container = currentTable === 'partida' ? els.filtersPartida : els.filtersUsuari;
	const out = new URLSearchParams();
	const fields = Array.from(container.querySelectorAll('input, select'));
	for (const field of fields) {
		const value = field.value.trim();
		if (value !== '') out.set(field.name, value);
	}
	return out;
}

function clearFilters() {
	const container = currentTable === 'partida' ? els.filtersPartida : els.filtersUsuari;
	const fields = Array.from(container.querySelectorAll('input, select'));
	for (const field of fields) {
		field.value = '';
	}
}

function renderTable(rows) {
	currentRows = Array.isArray(rows) ? rows : [];

	if (!currentRows.length) {
		els.dataTable.innerHTML = '<thead><tr><th>Sense dades</th></tr></thead><tbody><tr><td>0 files</td></tr></tbody>';
		return;
	}

	const columns = Object.keys(currentRows[0]);
	const head = `<thead><tr>${columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>`;
	const bodyRows = currentRows
		.map((row) => `<tr>${columns.map((c) => `<td>${escapeHtml(stringifyCell(row[c]))}</td>`).join('')}</tr>`)
		.join('');
	const body = `<tbody>${bodyRows}</tbody>`;

	els.dataTable.innerHTML = head + body;
}

function stringifyCell(value) {
	if (value == null) return '';
	if (typeof value === 'object') return JSON.stringify(value);
	return String(value);
}

function escapeHtml(input) {
	return input
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

async function adminGet(pathWithQuery) {
	const token = getToken();
	const res = await fetch(pathWithQuery, {
		method: 'GET',
		headers: {
			'x-admin-token': token,
		},
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		const err = new Error(data.message || 'La petició ha fallat');
		err.status = res.status;
		throw err;
	}
	return data;
}

async function loadData() {
	try {
		const query = getFilterValues();
		const endpoint = currentTable === 'partida' ? '/admin/data/partida' : '/admin/data/usuari';
		const url = query.toString() ? `${endpoint}?${query.toString()}` : endpoint;

		setStatus(els.dataStatus, 'Carregant dades...', '');
		const rows = await adminGet(url);
		renderTable(rows);
		setStatus(els.dataStatus, `${rows.length} fila(es) carregada(es)`, 'ok');
	} catch (e) {
		if (e.status === 401) {
			setLoggedOutState();
			setStatus(els.loginStatus, 'La sessió ha caducat. Torna a iniciar sessió.', 'error');
			return;
		}
		setStatus(els.dataStatus, e.message || 'No s\'han pogut carregar les dades', 'error');
	}
}

function downloadCsv() {
	if (!currentRows.length) {
		setStatus(els.dataStatus, 'No hi ha dades per descarregar.', 'error');
		return;
	}

	const cols = Object.keys(currentRows[0]);
	const esc = (value) => {
		const s = stringifyCell(value).replaceAll('"', '""');
		return `"${s}"`;
	};
	const lines = [
		cols.map(esc).join(','),
		...currentRows.map((row) => cols.map((c) => esc(row[c])).join(',')),
	];

	const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	const stamp = new Date().toISOString().replaceAll(':', '-');
	a.href = url;
	a.download = `${currentTable}_${stamp}.csv`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}

function showPanelData() {
	els.panelData.classList.add('active');
	els.panelSecond.classList.remove('active');
}

function showPanelSecond() {
	els.panelSecond.classList.add('active');
	els.panelData.classList.remove('active');
}

function stopPlaybackTimer() {
	if (playbackTimer) {
		clearInterval(playbackTimer);
		playbackTimer = null;
	}
	if (els.playPauseBtn) els.playPauseBtn.textContent = 'Reprodueix';
}

function fmtTs(value) {
	if (!value) return '-';
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return String(value);
	return d.toLocaleString('ca-ES');
}

function boolLabel(value) {
	return Number(value) === 1 ? 'Sí' : 'No';
}

function formatRelativeTime(startTs, currentTs) {
	const a = new Date(startTs || 0).getTime();
	const b = new Date(currentTs || 0).getTime();
	if (!Number.isFinite(a) || !Number.isFinite(b)) return 't+00:00';
	const ms = Math.max(0, b - a);
	const totalSec = Math.floor(ms / 1000);
	const mm = Math.floor(totalSec / 60).toString().padStart(2, '0');
	const ss = (totalSec % 60).toString().padStart(2, '0');
	return `t+${mm}:${ss}`;
}

function renderKvGrid(target, items) {
	target.innerHTML = items
		.map((it) => `<div class="kv"><strong>${escapeHtml(it.k)}:</strong><br>${escapeHtml(it.v)}</div>`)
		.join('');
}

function postToReplayFrame(message) {
	const frame = els.playbackGameFrame;
	if (!frame || !frame.contentWindow) return;
	const targetOrigin = new URL(frame.src, window.location.href).origin;
	frame.contentWindow.postMessage(message, targetOrigin);
}

function ensureReplayFrameSrc() {
	const frame = els.playbackGameFrame;
	if (!frame) return;
	const desired = '/admin/replay';
	if (frame.getAttribute('src') !== desired) {
		frame.setAttribute('src', desired);
	}
}

function clearReplayFrame() {
	postToReplayFrame({ type: 'admin-replay-clear' });
}

function syncReplayFrame() {
	if (!playbackSteps.length) return;
	postToReplayFrame({
		type: 'admin-replay-init',
		payload: {
			partida: playbackSummary,
			steps: playbackSteps,
		},
	});
	if (playbackIndex >= 0) {
		postToReplayFrame({
			type: 'admin-replay-step',
			payload: { index: playbackIndex },
		});
	}
}

function renderPlaybackStepList() {
	if (!els.playbackStepList) return;
	if (!playbackSteps.length) {
		els.playbackStepList.innerHTML = '<div class="step-item">Sense passos</div>';
		return;
	}

	els.playbackStepList.innerHTML = playbackSteps
		.map((step, idx) => {
			const cls = idx === playbackIndex ? 'step-item active' : 'step-item';
			return `<div class="${cls}" data-step-idx="${idx}">#${idx + 1} · Estat ${escapeHtml(String(step.id_num_estado_partida))} · ${escapeHtml(fmtTs(step.tiempo_partida))}</div>`;
		})
		.join('');

	for (const row of els.playbackStepList.querySelectorAll('[data-step-idx]')) {
		row.addEventListener('click', () => {
			const idx = Number(row.getAttribute('data-step-idx'));
			if (Number.isInteger(idx)) showPlaybackStep(idx);
		});
	}
}

function getPlaybackSummaryMeta(steps) {
	const list = Array.isArray(steps) ? steps : [];
	let validationCount = 0;
	let leftLevel = false;
	let semiSuperat = false;
	let superat = false;

	for (const step of list) {
		if (Number(step?.validado) === 1) validationCount += 1;
		if (Number(step?.salir) === 1) leftLevel = true;
		if (Number(step?.semi_superado) === 1) semiSuperat = true;
		if (Number(step?.superado) === 1) superat = true;
	}

	const lastOutcomeStep = list
		.slice()
		.reverse()
		.find((step) => Number(step?.superado) === 1 || Number(step?.semi_superado) === 1 || Number(step?.salir) === 1);

	let finishLabel = 'Sense finalització explícita';
	if (lastOutcomeStep) {
		const labels = [];
		if (Number(lastOutcomeStep.superado) === 1) {
			labels.push('Superat');
		} else if (Number(lastOutcomeStep.semi_superado) === 1) {
			labels.push('Semi-superat');
		}
		if (Number(lastOutcomeStep.salir) === 1) labels.push('Ha sortit del nivell');
		if (labels.length) finishLabel = labels.join(' + ');
	}

	return {
		validationCount,
		leftLevel,
		semiSuperat,
		superat,
		finishLabel,
	};
}

function renderPlaybackSummary() {
	if (!els.playbackSummary) return;
	if (!playbackSummary) {
		els.playbackSummary.innerHTML = '';
		return;
	}

	const meta = getPlaybackSummaryMeta(playbackSteps);

	renderKvGrid(els.playbackSummary, [
		{ k: 'id_partida', v: String(playbackSummary.id_partida ?? '-') },
		{ k: 'id_usuari', v: String(playbackSummary.id_usuari ?? '-') },
		{ k: 'id_nivel', v: String(playbackSummary.id_nivel ?? '-') },
		{ k: 'Passos', v: String(playbackSummary.passos ?? 0) },
		{ k: 'Inici', v: fmtTs(playbackSummary.inici) },
		{ k: 'Fi', v: fmtTs(playbackSummary.fi) },
		{ k: 'Finalització', v: meta.finishLabel },
		{ k: 'Ha sortit del nivell', v: meta.leftLevel ? 'Sí' : 'No' },
		{ k: 'Superat', v: meta.superat ? 'Sí' : 'No' },
		{ k: 'Semi-superat', v: meta.semiSuperat ? 'Sí' : 'No' },
		{ k: 'Validacions', v: String(meta.validationCount) },
	]);
}

function renderPlaybackStep(step) {
	if (!els.playbackStepDetails || !els.playbackFigures) return;
	if (!step) {
		els.playbackStepDetails.innerHTML = '';
		els.playbackFigures.innerHTML = '';
		clearReplayFrame();
		return;
	}

	renderKvGrid(els.playbackStepDetails, [
		{ k: 'Pas actual', v: `${playbackIndex + 1} / ${playbackSteps.length}` },
		{ k: 'id_num_estado_partida', v: String(step.id_num_estado_partida ?? '-') },
		{ k: 'Data/hora', v: fmtTs(step.tiempo_partida) },
		{ k: 'Temps relatiu', v: formatRelativeTime(playbackSteps[0]?.tiempo_partida, step.tiempo_partida) },
		{ k: 'Validat', v: boolLabel(step.validado) },
		{ k: 'Reset', v: boolLabel(step.reset) },
		{ k: 'Repetir', v: boolLabel(step.repetir) },
		{ k: 'Sortir', v: boolLabel(step.salir) },
		{ k: 'Avançar', v: boolLabel(step.avanzar) },
		{ k: 'Continuar', v: boolLabel(step.continuar) },
		{ k: 'Superat', v: boolLabel(step.superado) },
		{ k: 'Semi-superat', v: boolLabel(step.semi_superado) },
		{ k: 'Tornar menú', v: boolLabel(step.volver_menu) },
	]);

	const cells = [];
	for (let i = 1; i <= 5; i++) {
		const figura = step[`figura_${i}`];
		const rot = step[`rotacion_figura_${i}`];
		cells.push(`<div class="fig-cell"><strong>Figura ${i}</strong><br>id: ${escapeHtml(stringifyCell(figura || '-'))}<br>rot: ${escapeHtml(stringifyCell(rot ?? '-'))}</div>`);
	}
	els.playbackFigures.innerHTML = cells.join('');
	postToReplayFrame({
		type: 'admin-replay-step',
		payload: { index: playbackIndex },
	});
}

function showPlaybackStep(idx) {
	if (!playbackSteps.length) return;
	const clamped = Math.max(0, Math.min(playbackSteps.length - 1, idx));
	playbackIndex = clamped;
	renderPlaybackStep(playbackSteps[playbackIndex]);
	renderPlaybackStepList();
	setStatus(els.playbackStatus, `Mostrant pas ${playbackIndex + 1} de ${playbackSteps.length}.`, 'ok');
}

async function loadPlayback() {
	try {
		stopPlaybackTimer();
		const idPartida = Number(els.playbackPartidaId.value);
		if (!Number.isInteger(idPartida) || idPartida <= 0) {
			setStatus(els.playbackStatus, 'Introdueix un id_partida vàlid.', 'error');
			return;
		}

		setStatus(els.playbackStatus, 'Carregant passos de la partida...', '');
		const rows = await adminGet(`/admin/data/partida?id_partida=${idPartida}`);
		const sorted = Array.isArray(rows)
			? rows.slice().sort((a, b) => {
				const sa = Number(a?.id_num_estado_partida || 0);
				const sb = Number(b?.id_num_estado_partida || 0);
				if (sa !== sb) return sa - sb;
				const ta = new Date(a?.tiempo_partida || 0).getTime();
				const tb = new Date(b?.tiempo_partida || 0).getTime();
				return ta - tb;
			})
			: [];
		const first = sorted[0] || null;
		const last = sorted[sorted.length - 1] || null;
		const data = {
			partida: first
				? {
					id_partida: idPartida,
					id_usuari: first.id_usuari,
					id_nivel: first.id_nivel,
					passos: sorted.length,
					inici: first.tiempo_partida,
					fi: last ? last.tiempo_partida : first.tiempo_partida,
				}
				: { id_partida: idPartida, passos: 0 },
			steps: sorted,
		};

		playbackSummary = data.partida || null;
		playbackSteps = Array.isArray(data.steps) ? data.steps : [];
		syncReplayFrame();

		renderPlaybackSummary();
		if (!playbackSteps.length) {
			playbackIndex = -1;
			renderPlaybackStepList();
			renderPlaybackStep(null);
			setStatus(els.playbackStatus, 'Aquesta partida no té passos.', 'error');
			return;
		}

		showPlaybackStep(0);
	} catch (e) {
		if (e.status === 401) {
			setLoggedOutState();
			setStatus(els.loginStatus, 'La sessió ha caducat. Torna a iniciar sessió.', 'error');
			return;
		}
		setStatus(els.playbackStatus, e.message || 'No s\'ha pogut carregar la partida.', 'error');
	}
}

function goPrevStep() {
	if (!playbackSteps.length) return;
	showPlaybackStep(playbackIndex - 1);
}

function goNextStep() {
	if (!playbackSteps.length) return;
	if (playbackIndex >= playbackSteps.length - 1) {
		stopPlaybackTimer();
		return;
	}
	showPlaybackStep(playbackIndex + 1);
}

function togglePlayback() {
	if (!playbackSteps.length) {
		setStatus(els.playbackStatus, 'Primer carrega una partida.', 'error');
		return;
	}
	if (playbackTimer) {
		stopPlaybackTimer();
		return;
	}
	playbackTimer = setInterval(() => {
		if (playbackIndex >= playbackSteps.length - 1) {
			stopPlaybackTimer();
			return;
		}
		goNextStep();
	}, 1000);
	els.playPauseBtn.textContent = 'Pausa';
}

function updateFilterVisibility() {
	currentTable = els.tableSelect.value;
	els.filtersPartida.style.display = currentTable === 'partida' ? 'grid' : 'none';
	els.filtersUsuari.style.display = currentTable === 'usuari' ? 'grid' : 'none';
}

function setLoggedInState() {
	els.loginSection.style.display = 'none';
	els.adminSection.style.display = 'block';
	els.logoutBtn.style.display = 'inline-block';
}

function setLoggedOutState() {
	clearToken();
	els.loginSection.style.display = 'block';
	els.adminSection.style.display = 'none';
	els.logoutBtn.style.display = 'none';
}

async function login() {
	try {
		setStatus(els.loginStatus, 'Iniciant sessió...', '');
		const res = await fetch('/admin/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				username: els.username.value.trim(),
				password: els.password.value,
			}),
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok || !data.token) {
			throw new Error(data.message || 'Credencials no vàlides');
		}

		setToken(data.token);
		setLoggedInState();
		setStatus(els.loginStatus, '', '');
		setStatus(els.dataStatus, 'Sessió iniciada correctament.', 'ok');
		await loadData();
	} catch (e) {
		setStatus(els.loginStatus, e.message || 'L\'inici de sessió ha fallat', 'error');
	}
}

async function logout() {
	try {
		const token = getToken();
		await fetch('/admin/logout', {
			method: 'POST',
			headers: { 'x-admin-token': token },
		});
	} catch {
		// Ignore logout request failures and clear local session anyway.
	}
	setLoggedOutState();
	setStatus(els.loginStatus, 'Sessió tancada.', 'ok');
}

function wireEvents() {
	els.loginBtn.addEventListener('click', login);
	els.password.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') login();
	});
	els.logoutBtn.addEventListener('click', logout);

	els.tabData.addEventListener('click', showPanelData);
	els.tabSecond.addEventListener('click', showPanelSecond);

	els.tableSelect.addEventListener('change', () => {
		updateFilterVisibility();
		setStatus(els.dataStatus, 'La taula ha canviat. Aplica filtres per actualitzar les dades.', '');
	});
	els.applyFiltersBtn.addEventListener('click', loadData);
	els.clearFiltersBtn.addEventListener('click', () => {
		clearFilters();
		void loadData();
	});
	els.downloadCsvBtn.addEventListener('click', downloadCsv);

	if (els.loadPlaybackBtn) els.loadPlaybackBtn.addEventListener('click', loadPlayback);
	if (els.playbackPartidaId) {
		els.playbackPartidaId.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') loadPlayback();
		});
	}
	if (els.prevStepBtn) els.prevStepBtn.addEventListener('click', goPrevStep);
	if (els.nextStepBtn) els.nextStepBtn.addEventListener('click', goNextStep);
	if (els.playPauseBtn) els.playPauseBtn.addEventListener('click', togglePlayback);
	if (els.playbackGameFrame) {
		els.playbackGameFrame.addEventListener('load', () => {
			syncReplayFrame();
		});
	}
}

function init() {
	createFilterControls(els.filtersPartida, partidaFilters);
	createFilterControls(els.filtersUsuari, usuariFilters);
	updateFilterVisibility();
	ensureReplayFrameSrc();
	wireEvents();
	clearReplayFrame();

	if (getToken()) {
		setLoggedInState();
		void loadData();
	} else {
		setLoggedOutState();
	}
}

init();
