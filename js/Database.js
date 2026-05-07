// Lightweight client for server-side database API
// Reads config from Vite envs: VITE_API_BASE_URL, VITE_API_USERNAME, VITE_API_PASSWORD
// Do NOT hardcode credentials in code; use .env instead.

const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL)
	? import.meta.env.VITE_API_BASE_URL
	: '/api';

const API_USERNAME = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.VITE_API_USERNAME : undefined;
const API_PASSWORD = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.VITE_API_PASSWORD : undefined;

const buildHeaders = (extra = {}) => {
	const headers = {
		'Content-Type': 'application/json',
		...extra,
	};
	if (API_USERNAME && API_PASSWORD) {
		const token = btoa(`${API_USERNAME}:${API_PASSWORD}`);
		headers['Authorization'] = `Basic ${token}`;
	}
	return headers;
};

const handleResponse = async (res) => {
	const contentType = res.headers.get('content-type') || '';
	const isJson = contentType.includes('application/json');
	const data = isJson ? await res.json() : await res.text();
	if (!res.ok) {
		const message = typeof data === 'string' ? data : (data && data.message) || 'Request failed';
		const err = new Error(message);
		err.status = res.status;
		err.data = data;
		throw err;
	}
	return data;
};

export const api = {
	baseUrl: API_BASE_URL,

	async get(path) {
		const url = `${API_BASE_URL}${path}`;
		const res = await fetch(url, {
			method: 'GET',
			headers: buildHeaders(),
			credentials: 'include',
		});
		return handleResponse(res);
	},

	async post(path, body) {
		const url = `${API_BASE_URL}${path}`;
		const res = await fetch(url, {
			method: 'POST',
			headers: buildHeaders(),
			body: JSON.stringify(body ?? {}),
			credentials: 'include',
		});
		return handleResponse(res);
	},

	async put(path, body) {
		const url = `${API_BASE_URL}${path}`;
		const res = await fetch(url, {
			method: 'PUT',
			headers: buildHeaders(),
			body: JSON.stringify(body ?? {}),
			credentials: 'include',
		});
		return handleResponse(res);
	},

	async del(path) {
		const url = `${API_BASE_URL}${path}`;
		const res = await fetch(url, {
			method: 'DELETE',
			headers: buildHeaders(),
			credentials: 'include',
		});
		return handleResponse(res);
	},
};

// Example higher-level helpers (adapt as your API is defined)
export const Database = {
	// Load tutorial text/content from API
	async getTutorial() {
		return api.get('/tutorial');
	},
	// List levels metadata
	async listLevels() {
		return api.get('/levels');
	},
	// Save a user's progress/result
	async saveResult(payload) {
		// payload: { userId, levelId, result, timestamp }
		return api.post('/results', payload);
	},
	// Fetch stored results for a user
	async getResults(userId) {
		return api.get(`/results?userId=${encodeURIComponent(userId)}`);
	},

	// Create a new user (Usuari)
	async createUsuari({ edat, genere, ma_habil }) {
		const body = { edat, genere, ma_habil };
		return api.post('/usuari', body);
	},

	// Get user by id
	async getUsuari(id) {
		return api.get(`/usuari/${encodeURIComponent(id)}`);
	},

	// Save one game action state in Partida
	async savePartidaState(payload) {
		return api.post('/partida', payload);
	},
};

export default Database;
