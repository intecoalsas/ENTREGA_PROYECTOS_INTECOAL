
const TOKEN_KEY = 'm365_jwt';

export function getToken() {
  try {
    return (
      sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || ''
    );
  } catch {
    return '';
  }
}

export function setToken(token) {
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
  }
}

function sesionExpirada() {
  const teniaToken = Boolean(getToken());
  try {
    sessionStorage.removeItem('m365_user_session');
    localStorage.removeItem('m365_user_session');
    sessionStorage.removeItem('pending_msal_role');
    sessionStorage.removeItem('active_tab');
  } catch {
  }
  setToken('');
  if (teniaToken && typeof window !== 'undefined') {
    window.location.reload();
  }
}

const API_DIRECTA = (import.meta.env.VITE_API_DIRECT_URL || 'https://radicados-intecoal-sas.onrender.com').replace(/\/+$/, '');
const SUBIDA_DIRECTA_DESDE = 4 * 1024 * 1024;

function bytesFormData(body) {
  if (!body || typeof FormData === 'undefined' || !(body instanceof FormData)) {
    return 0;
  }
  let total = 0;
  body.forEach((valor) => {
    if (valor && typeof valor === 'object' && typeof valor.size === 'number') {
      total += valor.size;
    }
  });
  return total;
}

export function urlDeApi(path, options, produccion = import.meta.env.PROD) {
  if (!produccion || !path.startsWith('/api/')) {
    return path;
  }
  if (bytesFormData(options.body) < SUBIDA_DIRECTA_DESDE) {
    return path;
  }
  return `${API_DIRECTA}${path}`;
}

export async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const resp = await fetch(urlDeApi(path, options), { ...options, headers });
  if (resp.status === 401) {
    sesionExpirada();
  }
  return resp;
}

export async function obtenerJwt(email, role) {
  const resp = await fetch('/api/auth/msal-verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: { username: (email || '').toLowerCase() }, role })
  });
  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new Error(data?.detail || `No se pudo validar la sesión (${resp.status})`);
  }
  if (data?.token) {
    setToken(data.token);
  }
  return data;
}
