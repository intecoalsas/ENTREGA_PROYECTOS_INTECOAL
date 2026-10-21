import { PublicClientApplication, LogLevel } from '@azure/msal-browser';

export const DEFAULT_AZURE_CONFIG = {
  clientId: import.meta.env.VITE_MSAL_CLIENT_ID || '',
  tenantId: import.meta.env.VITE_MSAL_TENANT_ID || 'common',
  redirectUri: import.meta.env.VITE_MSAL_REDIRECT_URI || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'),
  scopes: ['User.Read', 'openid', 'profile', 'email']
};

export function createMsalClient(clientId, tenantId, redirectUri) {
  const activeTenant = tenantId || DEFAULT_AZURE_CONFIG.tenantId || 'common';
  const activeRedirectUri = redirectUri || DEFAULT_AZURE_CONFIG.redirectUri;
  const config = {
    auth: {
      clientId: clientId || DEFAULT_AZURE_CONFIG.clientId,
      authority: `https://login.microsoftonline.com/${activeTenant}`,
      redirectUri: activeRedirectUri,
      postLogoutRedirectUri: activeRedirectUri,
      navigateToLoginRequestUrl: false,
    },
    cache: {
      cacheLocation: 'localStorage',
      storeAuthStateInCookie: true, 
    },
    system: {
      windowHashTimeout: 180000, 
      iframeHashTimeout: 10000,
      loadFrameTimeout: 10000,
      asyncPopups: true,
      loggerOptions: {
        loggerCallback: (level, message, containsPii) => {
          if (containsPii) return;
          if (level === LogLevel.Error) console.error('[MSAL Azure AD]:', message);
        },
        logLevel: LogLevel.Warning,
      },
    },
  };
  return new PublicClientApplication(config);
}

export const msalInstance = createMsalClient();

let msalInitPromises = new Map();

export async function ensureMsalInit(instance = msalInstance) {
  if (!msalInitPromises.has(instance)) {
    const promise = (async () => {
      try {
        await instance.initialize();
        const redirectResponse = await instance.handleRedirectPromise();
        const accounts = instance.getAllAccounts();
        const account = redirectResponse?.account || (accounts && accounts.length > 0 ? accounts[0] : null);
        return { redirectResponse, account, accounts, error: null };
      } catch (err) {
        console.warn('MSAL initialization warning/error:', err);
        return { redirectResponse: null, account: null, accounts: [], error: err };
      }
    })();
    msalInitPromises.set(instance, promise);
  }
  return msalInitPromises.get(instance);
}

const ALLOWED_REVISOR_DOMAINS = ['intecoalsas.com', 'intecoal.com.co'];
export const REVISOR_DOMAIN_HINT = 'Correo institucional de INTECOAL (@intecoalsas.com)';

export function isRevisorAllowedEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const domain = email.split('@')[1]?.toLowerCase().trim() || '';
  return ALLOWED_REVISOR_DOMAINS.includes(domain);
}

export function validateRoleEmail(role, email) {
  if (role === 'interventor') {
    return isRevisorAllowedEmail(email);
  }
  return true;
}

export function formatNameFromEmail(email, m365DisplayName = null) {
  if (m365DisplayName && typeof m365DisplayName === 'string' && m365DisplayName.trim() && !m365DisplayName.includes('@')) {
    const cleaned = m365DisplayName.replace(/\s*\(M365.*?\)\s*/gi, '').trim();
    if (cleaned) return cleaned;
  }

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return 'Usuario Portal';
  }

  let prefix = email.split('@')[0].trim();
  if (!prefix) return 'Usuario Portal';

  prefix = prefix.replace(/[\._\-+]/g, ' ');

  prefix = prefix.replace(/^(san)(pedro|juan|pablo|jose|diego|carlos|marcos|francisco|esteban|mateo)/i, '$1 $2');
  prefix = prefix.replace(/^(juan)(pablo|carlos|pedro|jose|diego|manuel|david|sebastian)/i, '$1 $2');
  prefix = prefix.replace(/^(maria)(jose|camila|fernanda|alejandra|paula|isabel|victoria)/i, '$1 $2');

  const words = prefix.split(/\s+/).filter(Boolean);
  const capitalized = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  const nombre = capitalized.join(' ');

  const empresa = extractCompanyFromEmail(email);
  if (empresa && empresa !== 'EMPRESA REGISTRADA') {
    return `${nombre} ${empresa}`;
  }
  return nombre;
}

export function extractCompanyFromEmail(email) {
  if (!email || !email.includes('@')) return 'EMPRESA REGISTRADA';
  const domain = email.split('@')[1]?.toLowerCase() || '';
  
  if (domain.includes('intecoal')) return 'INTECOAL SAS';
  if (domain.includes('electroingenieria')) return 'ELECTROINGENIERIA S.A.S.';
  if (domain.includes('ingenieria-energia')) return 'INGENIERIA Y ENERGIA S.A.S.';
  if (domain.includes('sena')) return 'SENA - Servicio Nacional de Aprendizaje';
  if (domain.includes('cali.gov') || domain.includes('alcaldia')) return 'ALCALDÍA MUNICIPAL';
  if (domain.includes('gobernacion')) return 'GOBERNACIÓN DE DEPARTAMENTO';
  
  const parts = domain.split('.').filter(p => !['com', 'co', 'edu', 'gov', 'org', 'net', 'io', 'es', 'us', 'uk'].includes(p));
  if (parts.length > 0) {
    const rawName = parts.map(p => p.toUpperCase()).join(' ');
    if (domain.includes('.edu')) {
      return `INSTITUCIÓN EDUCATIVA ${rawName}`;
    }
    if (domain.includes('.gov')) {
      return `ENTIDAD GUBERNAMENTAL ${rawName}`;
    }
    return `${rawName} S.A.S.`;
  }
  return `${domain.toUpperCase()} S.A.S.`;
}

export async function loginM365User(
  customRole = 'interventor',
  customEmail,
  customClientId,
  customTenantId,
  promptOption = 'select_account'
) {
  const activeMsal = (customClientId || customTenantId) 
    ? createMsalClient(customClientId, customTenantId) 
    : msalInstance;

  await ensureMsalInit(activeMsal);

  if (typeof window !== 'undefined' && window.location.hash && (window.location.hash.includes('code=') || window.location.hash.includes('error='))) {
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  }

  if (typeof window !== 'undefined') {
    sessionStorage.setItem('pending_msal_role', customRole);
    sessionStorage.setItem('is_msal_login_attempt', 'true');
    if (customEmail) {
      sessionStorage.setItem('pending_msal_email', customEmail);
    }
    try {
      localStorage.removeItem('pending_msal_role');
      localStorage.removeItem('pending_msal_email');
      localStorage.removeItem('is_msal_login_attempt');
    } catch (e) {  }
  }

  try {
    await activeMsal.loginRedirect({
      scopes: DEFAULT_AZURE_CONFIG.scopes,
      prompt: promptOption || 'select_account'
    });
    return { isRedirecting: true };
  } catch (error) {
    console.error('[MSAL Azure AD Error]:', error);
    let rawErrorStr = String(error?.errorMessage || error?.message || error || '');
    let errorMsg = rawErrorStr || 'Ocurrió un error al autenticar con Microsoft 365. Verifique la configuración de su cuenta o intente nuevamente.';
    throw new Error(errorMsg);
  }
}

export async function logoutM365User() {
  try {
    await ensureMsalInit(msalInstance);
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      msalInstance.setActiveAccount(null);
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('m365_user_session');
      sessionStorage.removeItem('pending_msal_role');
    }
    if (typeof localStorage !== 'undefined') {
      Object.keys(localStorage).forEach(key => {
        if (key.includes('msal') || key.includes('login.windows.net') || key.includes('authority')) {
          localStorage.removeItem(key);
        }
      });
    }
  } catch (e) {
    console.warn('Advertencia al limpiar caché MSAL:', e);
  }
}
