import Database from './Database.js';
import { Figura } from './Figura.js';
import { Nivel } from './Nivel.js';
import { ValidarResultado } from './ValidarResultado.js';

const normalizeRotationQuarterTurns = (rotationRadians) => {
	const twoPi = Math.PI * 2;
	let r = Number(rotationRadians) || 0;
	r = ((r % twoPi) + twoPi) % twoPi;
	const quarterTurn = Math.round(r / (Math.PI / 2)) % 4;
	return quarterTurn;
};

const getFiguraNumber = (figura) => {
	try {
		const raw =
			figura?.originalTexturePath ||
			figura?.texture?.baseTexture?.resource?.url ||
			figura?.texture?.baseTexture?.resource?.src ||
			'';
		const match = String(raw).match(/bloque(\d+)\.png/i);
		const n = match ? Number(match[1]) : NaN;
		return Number.isInteger(n) && n > 0 ? n : null;
	} catch (_) {
		return null;
	}
};

const getLoggedUserId = () => {
	try {
		const raw = localStorage.getItem('userProfile');
		if (!raw) return null;
		const profile = JSON.parse(raw);
		if (!profile || profile.skipped) return null;
		const id = Number(profile.id_usuari);
		return Number.isInteger(id) && id > 0 ? id : null;
	} catch (_) {
		return null;
	}
};

const state = {
	initialized: false,
	currentLevel: null,
	currentPartidaId: null,
	levelCounters: new Map(),
	queue: Promise.resolve(),
	lastSnapshotHash: null,
	observerTimer: null,
	eventHandler: null,
	preservePartidaOnNextLoadLevel: null,
};

const EMPTY_FLAGS = {
	reset: 0,
	repetir: 0,
	salir: 0,
	avanzar: 0,
	continuar: 0,
	superado: 0,
	semi_superado: 0,
	volver_menu: 0,
};

const normalizeFlags = (flags = {}) => ({
	reset: flags.reset ? 1 : 0,
	repetir: flags.repetir ? 1 : 0,
	salir: flags.salir ? 1 : 0,
	avanzar: flags.avanzar ? 1 : 0,
	continuar: flags.continuar ? 1 : 0,
	superado: flags.superado ? 1 : 0,
	semi_superado: flags.semi_superado ? 1 : 0,
	volver_menu: flags.volver_menu ? 1 : 0,
});

const buildSnapshot = () => {
	const centered = Array.isArray(Figura.selectedStack) ? Figura.selectedStack.slice() : [];
	const ordered = centered.sort((a, b) => (a?.zIndex || 0) - (b?.zIndex || 0)).slice(0, 5);
	const snapshot = {};
	for (let i = 0; i < 5; i++) {
		const fig = ordered[i] || null;
		const num = fig ? getFiguraNumber(fig) : null;
		snapshot[`figura_${i + 1}`] = num;
		snapshot[`rotacion_figura_${i + 1}`] = fig && num ? normalizeRotationQuarterTurns(fig.rotation || 0) : null;
	}
	return snapshot;
};

const hasAnimatingSelectedFigura = () => {
	const centered = Array.isArray(Figura.selectedStack) ? Figura.selectedStack : [];
	for (let i = 0; i < centered.length; i++) {
		if (centered[i]?._isAnimatingRotation) return true;
	}
	return false;
};

const stableSnapshotHash = () => {
	if (hasAnimatingSelectedFigura()) return null;
	return JSON.stringify(buildSnapshot());
};

const enqueueLog = ({ validated, flags, force }) => {
	const userId = getLoggedUserId();
	const levelId = Number(state.currentLevel);
	if (!userId || !Number.isInteger(levelId) || levelId <= 0) return;

	const eventFlags = normalizeFlags(flags || EMPTY_FLAGS);
	const snapshot = buildSnapshot();
	if (force) {
		const hash = stableSnapshotHash();
		if (hash != null) state.lastSnapshotHash = hash;
	}
	const current = Number(state.levelCounters.get(levelId) || 0) + 1;
	state.levelCounters.set(levelId, current);

	const payload = {
		id_partida: state.currentPartidaId,
		id_usuari: userId,
		id_num_estado_partida: current,
		id_nivel: levelId,
		...snapshot,
		validado: validated ? 1 : 0,
		...eventFlags,
		tiempo_partida: new Date().toISOString(),
	};

	state.queue = state.queue
		.then(() => Database.savePartidaState(payload))
		.then((res) => {
			if (Number(state.currentLevel) !== levelId) return;
			const id = Number(res?.id_partida);
			if (Number.isInteger(id) && id > 0) {
				state.currentPartidaId = id;
			}
			const serverStateNum = Number(res?.id_num_estado_partida);
			if (Number.isInteger(serverStateNum) && serverStateNum > 0) {
				state.levelCounters.set(levelId, serverStateNum);
			}
		})
		.catch((err) => {
			console.error('Partida log failed', err);
		});
};

const patchLevelTracking = () => {
	if (!Nivel || typeof Nivel.loadLevel !== 'function') return;
	if (Nivel.__logsLoadLevelPatched) return;

	const originalLoadLevel = Nivel.loadLevel;
	Nivel.loadLevel = async function patchedLoadLevel(levelNumber, selectorModule) {
		const levelId = Number(levelNumber);
		if (Number.isInteger(levelId) && levelId > 0) {
			state.currentLevel = levelId;
			const keepPartida = state.preservePartidaOnNextLoadLevel === levelId;
			if (!keepPartida) {
				state.currentPartidaId = null;
				state.levelCounters.set(levelId, 0);
			} else {
				state.preservePartidaOnNextLoadLevel = null;
			}
			state.lastSnapshotHash = JSON.stringify({
				figura_1: null,
				rotacion_figura_1: null,
				figura_2: null,
				rotacion_figura_2: null,
				figura_3: null,
				rotacion_figura_3: null,
				figura_4: null,
				rotacion_figura_4: null,
				figura_5: null,
				rotacion_figura_5: null,
			});
		}
		return originalLoadLevel.call(this, levelNumber, selectorModule);
	};
	Nivel.__logsLoadLevelPatched = true;
};

const startSnapshotObserver = () => {
	if (state.observerTimer) return;
	state.observerTimer = setInterval(() => {
		try {
			const userId = getLoggedUserId();
			const levelId = Number(state.currentLevel);
			if (!userId || !Number.isInteger(levelId) || levelId <= 0) return;
			const hash = stableSnapshotHash();
			if (hash == null) return;
			if (state.lastSnapshotHash == null) {
				state.lastSnapshotHash = hash;
				return;
			}
			if (hash !== state.lastSnapshotHash) {
				state.lastSnapshotHash = hash;
				enqueueLog({ validated: false });
			}
		} catch (_) {}
	}, 120);
};

const patchValidation = () => {
	if (!ValidarResultado || typeof ValidarResultado.validateAgainstFinal !== 'function') return;
	if (ValidarResultado.__logsValidatePatched) return;

	const originalValidate = ValidarResultado.validateAgainstFinal;
	ValidarResultado.validateAgainstFinal = function patchedValidate(figuraClass, ...rest) {
		let loggedByValidationCallback = false;
		const originalOnValidation = figuraClass?.onValidation;
		try {
			if (figuraClass) {
				figuraClass.onValidation = function patchedOnValidation(success, ...cbArgs) {
					try {
						if (success) {
							const finalCount = Array.isArray(figuraClass.figura_final) ? Math.floor(figuraClass.figura_final.length / 2) : 0;
							const selectedCount = Array.isArray(figuraClass.selectedStack) ? figuraClass.selectedStack.length : 0;
							const usedExtras = (selectedCount - finalCount) > 0;
							enqueueLog({
								validated: true,
								flags: {
									superado: !usedExtras,
									semi_superado: !!usedExtras,
								},
								force: true,
							});
						} else {
							enqueueLog({ validated: true, flags: EMPTY_FLAGS, force: true });
						}
						loggedByValidationCallback = true;
					} catch (_) {}
					if (typeof originalOnValidation === 'function') {
						return originalOnValidation.call(this, success, ...cbArgs);
					}
					return undefined;
				};
			}
			return originalValidate.call(this, figuraClass, ...rest);
		} finally {
			if (figuraClass) figuraClass.onValidation = originalOnValidation;
			if (!loggedByValidationCallback) {
				try { enqueueLog({ validated: true, flags: EMPTY_FLAGS, force: true }); } catch (_) {}
			}
		}
	};
	ValidarResultado.__logsValidatePatched = true;
};

const startEventHooks = () => {
	if (state.eventHandler) return;
	state.eventHandler = (evt) => {
		try {
			const detail = evt?.detail || {};
			if (detail.repetir) {
				const levelId = Number(state.currentLevel);
				state.currentPartidaId = null;
				if (Number.isInteger(levelId) && levelId > 0) {
					state.levelCounters.set(levelId, 0);
					state.preservePartidaOnNextLoadLevel = levelId;
				}
			}
			enqueueLog({ validated: false, flags: detail, force: true });
			if (detail.volver_menu || detail.salir) {
				state.currentLevel = null;
			}
		} catch (_) {}
	};
	window.addEventListener('partida:event', state.eventHandler);
};

export const Logs = {
	init() {
		if (state.initialized) return;
		patchLevelTracking();
		startSnapshotObserver();
		patchValidation();
		startEventHooks();
		state.initialized = true;
	},
};

export default Logs;
