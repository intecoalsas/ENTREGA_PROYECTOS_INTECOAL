
import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { RadicacionForm } from './components/RadicacionForm';
import { RadicacionesList } from './components/RadicacionesList';
import { InformeRecibidoConformidad } from './components/InformeRecibidoConformidad';
import { Formato437C } from './components/Formato437C';
import { ReciboTecnico } from './components/ReciboTecnico';
import { CalendarioRevision } from './components/CalendarioRevision';
import { ManualUsuario } from './components/ManualUsuario';
import { EvaluacionRadicacion } from './components/EvaluacionRadicacion';
import { LoginForm } from './components/LoginForm';
import { ErrorBoundary } from './components/ErrorBoundary';

import { logoutM365User, ensureMsalInit, extractCompanyFromEmail, formatNameFromEmail, msalInstance, isRevisorAllowedEmail, REVISOR_DOMAIN_HINT } from './lib/msalConfig';
import { apiFetch, getToken, setToken as guardarToken, obtenerJwt } from './lib/api';

export default function App() {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return 'lista';
    return sessionStorage.getItem('active_tab') || 'lista';
  });
  
  const [filings, setFilings] = useState([]);
  const [ultimoGlobal, setUltimoGlobal] = useState(null);
  const [selectedFiling, setSelectedFiling] = useState(null);
  const [editingFiling, setEditingFiling] = useState(null);

  const [user, setUser] = useState(() => {
    const emptyUser = { isAuthenticated: false, name: '', email: '', role: 'interventor', company: '' };
    if (typeof window === 'undefined') return emptyUser;

    if (window.location.hash && (window.location.hash.includes('code=') || window.location.hash.includes('id_token=') || window.location.hash.includes('error='))) {
      return emptyUser;
    }

    try {
      const raw = sessionStorage.getItem('m365_user_session') || localStorage.getItem('m365_user_session');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.isAuthenticated && parsed.email) {
          return parsed;
        }
      }
    } catch (e) {  }

    return emptyUser;
  });

  const [msalAuthError, setMsalAuthError] = useState(null);

  const [isProcessingMsal, setIsProcessingMsal] = useState(() => {
    if (typeof window !== 'undefined' && window.location.hash && (window.location.hash.includes('code=') || window.location.hash.includes('id_token=') || window.location.hash.includes('error='))) {
      return true;
    }
    return false;
  });

  const [m365Config, setM365Config] = useState({
    azureClientId: import.meta.env.VITE_MSAL_CLIENT_ID || '',
    azureTenantId: '',
    sharepointSiteUrl: '',
    sharepointSiteId: '',
    sharepointListId: '',
    sharepointLibraryId: '',
    onedriveFolderRoot: '',
    senderEmail: '',
    isConnected: false
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && activeTab) {
      sessionStorage.setItem('active_tab', activeTab);
    }
  }, [activeTab]);

  useEffect(() => {
    fetch('/api/m365/status')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.config) {
          setM365Config(prev => ({
            ...prev,
            ...data.config
          }));
        }
      })
      .catch(() => {});
  }, []);

  const userFilings = React.useMemo(() => {
    if (user.role === 'contratista' && user.isAuthenticated) {
      const userEmailClean = (user.email || '').toLowerCase().trim();
      if (!userEmailClean) return [];

      return filings.filter(f => {
        const creatorEmailClean = (f.creadorEmail || f.metadata?.creadorEmail || '').toLowerCase().trim();

        return creatorEmailClean === userEmailClean;
      });
    }
    return filings;
  }, [filings, user]);

  useEffect(() => {
    if (user.role === 'contratista') {
      if (userFilings.length > 0) {
        if (!selectedFiling || !userFilings.some(f => f.id === selectedFiling.id)) {
          setSelectedFiling(userFilings[0]);
        }
      } else {
        setSelectedFiling(null);
      }
    } else {
      if (filings.length > 0 && !selectedFiling) {
        setSelectedFiling(filings[0]);
      }
    }
  }, [user.role, filings, userFilings, selectedFiling]);

  useEffect(() => {
    if (activeTab === 'nueva' && !editingFiling && filings.length > 0 && typeof window !== 'undefined') {
      const editId = sessionStorage.getItem('editing_filing_id');
      if (editId) {
        const f = filings.find(x => x.id === editId || x.numeroRadicado === editId);
        if (f) {
          cargarRadicacionCompleta(f).then(full => setEditingFiling(full));
        }
        else sessionStorage.removeItem('editing_filing_id');
      }
    }
  }, [activeTab, filings, editingFiling]);

  useEffect(() => {
    if (activeTab === 'manual') {
      setActiveTab('lista');
      return;
    }
    if (user.role === 'interventor' && activeTab === 'nueva') {
      setActiveTab('lista');
    }
    if (user.role === 'contratista' && activeTab === 'evaluacion') {
      setActiveTab('informe');
    }
    if (user.role === 'contratista' && (activeTab === 'recibo' || activeTab === 'formato437c' || activeTab === 'calendario')) {
      setActiveTab('lista');
    }
  }, [user.role, activeTab]);

  const [jwt, setJwt] = useState(() => getToken());

  const asegurarJwt = async (email, role) => {
    if (getToken()) return getToken();
    await obtenerJwt(email, role);
    setJwt(getToken());
  };

  useEffect(() => {
    fetchFilings();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user.isAuthenticated) {
        fetchFilings();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const urlHash = typeof window !== 'undefined' ? window.location.hash : '';
    const hasMsalHash = urlHash && (urlHash.includes('code=') || urlHash.includes('id_token=') || urlHash.includes('error='));

    ensureMsalInit().then((res) => {
      const redirectResponse = res?.redirectResponse;
      const msalError = res?.error;

      const wasAttemptingMsal = typeof window !== 'undefined' && (
        sessionStorage.getItem('is_msal_login_attempt') === 'true'
      );

      const savedRole = typeof window !== 'undefined' ? (
        sessionStorage.getItem('pending_msal_role')
      ) : null;

      const pendingEmail = typeof window !== 'undefined' ? (
        sessionStorage.getItem('pending_msal_email')
      ) : null;

      const cleanPendingMsalStorage = () => {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('pending_msal_role');
          localStorage.removeItem('pending_msal_role');
          sessionStorage.removeItem('is_msal_login_attempt');
          localStorage.removeItem('is_msal_login_attempt');
          sessionStorage.removeItem('pending_msal_email');
          localStorage.removeItem('pending_msal_email');
        }
      };

      if (hasMsalHash && typeof window !== 'undefined') {
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      }

      const isCompletedRedirect = Boolean(redirectResponse || (hasMsalHash && !urlHash.includes('error=')));

      if (isCompletedRedirect) {
        let account = redirectResponse?.account || res?.account;
        if (!account && msalInstance && typeof msalInstance.getAllAccounts === 'function') {
          try {
            const accounts = msalInstance.getAllAccounts();
            if (accounts && accounts.length > 0) {
              account = accounts[0];
            }
          } catch (e) {
            console.warn('Error reading accounts from msalInstance:', e);
          }
        }

        if (account) {
          const email = (account?.username || '').toLowerCase();
          const nameFormatted = formatNameFromEmail(email, account?.name);
          const company = extractCompanyFromEmail(email);

          const roleToAssign = savedRole || (isRevisorAllowedEmail(email) ? 'interventor' : 'contratista');

          if (roleToAssign === 'interventor' && !isRevisorAllowedEmail(email)) {
            cleanPendingMsalStorage();
            setMsalAuthError(`El Responsable de Revisión solo puede entrar con correo de INTECOAL (${REVISOR_DOMAIN_HINT}). El correo "${email}" no está autorizado para este rol.`);
            return;
          }

          const newUser = {
            isAuthenticated: true,
            name: nameFormatted,
            email: email,
            role: roleToAssign,
            company: company
          };

          cleanPendingMsalStorage();
          setUser(newUser);
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('m365_user_session', JSON.stringify(newUser));
            localStorage.setItem('m365_user_session', JSON.stringify(newUser));
          }
          setActiveTab('lista');
          asegurarJwt(newUser.email, newUser.role).catch((err) => {
            setMsalAuthError(err.message || 'No se pudo validar la sesión en el servidor.');
          });
        } else if (wasAttemptingMsal && pendingEmail) {
          const userEmailToUse = pendingEmail.toLowerCase();
          const company = extractCompanyFromEmail(userEmailToUse);
          const nameFormatted = formatNameFromEmail(userEmailToUse);

          const roleToAssign = savedRole || (isRevisorAllowedEmail(userEmailToUse) ? 'interventor' : 'contratista');

          if (roleToAssign === 'interventor' && !isRevisorAllowedEmail(userEmailToUse)) {
            cleanPendingMsalStorage();
            setMsalAuthError(`El Responsable de Revisión solo puede entrar con correo de INTECOAL (${REVISOR_DOMAIN_HINT}). El correo "${userEmailToUse}" no está autorizado para este rol.`);
            return;
          }

          const newUser = {
            isAuthenticated: true,
            name: nameFormatted,
            email: userEmailToUse,
            role: roleToAssign,
            company: company
          };

          cleanPendingMsalStorage();
          setUser(newUser);
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('m365_user_session', JSON.stringify(newUser));
            localStorage.setItem('m365_user_session', JSON.stringify(newUser));
          }
          setActiveTab('lista');
          asegurarJwt(newUser.email, newUser.role).catch((err) => {
            setMsalAuthError(err.message || 'No se pudo validar la sesión en el servidor.');
          });
        } else {
          cleanPendingMsalStorage();
        }
      } else {
        if (wasAttemptingMsal) {
          cleanPendingMsalStorage();
        }
        if (msalError && !wasAttemptingMsal) {
          setMsalAuthError(`Respuesta de Microsoft 365: ${msalError.message || msalError}`);
        }
      }

      setIsProcessingMsal(false);
    }).catch(err => {
      console.warn('MSAL redirect check warning:', err);
      setIsProcessingMsal(false);
    });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (user.isAuthenticated && user.email) {
      if (!getToken()) {
        asegurarJwt(user.email, user.role).then(() => fetchFilings()).catch(() => {});
      } else {
        fetchFilings();
      }
    }
  }, [user.isAuthenticated, user.email, jwt]);

  const fetchFilings = async (retryCount = 0) => {
    if (!user.isAuthenticated) return;
    try {
      const res = await apiFetch('/api/radicacion/lista');
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setFilings(json.data);
        }
        setUltimoGlobal(json.ultimoGlobal || null);
      } else if (res.status !== 401 && retryCount < 3) {
        await new Promise(r => setTimeout(r, 3000));
        fetchFilings(retryCount + 1);
      }
    } catch (err) {
      if (retryCount < 3) {
        await new Promise(r => setTimeout(r, 3000));
        fetchFilings(retryCount + 1);
      } else {
        console.warn('Backend no disponible después de reintentos', err);
      }
    }
  };

  const cargarRadicacionCompleta = async (record) => {
    const ref = record?.id || record?.numeroRadicado;
    if (!ref) return record;
    try {
      const res = await apiFetch(`/api/radicacion/${ref}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) return json.data;
      }
    } catch (e) { /* sin backend: se usa el registro de la lista */ }
    return record;
  };

  const handleLoginSuccess = (newUser, defaultTab = 'lista') => {
    setUser(newUser);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('m365_user_session', JSON.stringify(newUser));
    }
    setActiveTab(defaultTab);
    if (newUser?.email) {
      asegurarJwt(newUser.email, newUser.role).catch((err) => {
        setMsalAuthError(err.message || 'No se pudo validar la sesión en el servidor.');
      });
    }
  };

  const handleLogout = async () => {
    await logoutM365User();
    guardarToken('');
    setJwt('');
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('m365_user_session');
      sessionStorage.removeItem('pending_msal_role');
      sessionStorage.removeItem('active_tab');
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('m365_user_session');
    }
    setUser({
      isAuthenticated: false,
      name: '',
      email: '',
      role: 'interventor',
      company: ''
    });
  };

  const irNuevaRadicacion = () => {
    setEditingFiling(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('editing_filing_id');
    }
    setActiveTab('nueva');
  };

  const handleFilingCreated = (newRecord) => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('editing_filing_id');
    }
    if (editingFiling) {
      setFilings(prev => prev.map(f => f.id === newRecord.id ? newRecord : f));
      setEditingFiling(null);
      setSelectedFiling(newRecord);
      setActiveTab('informe');
    } else {
      setFilings([newRecord, ...filings]);
      setSelectedFiling(newRecord);
      setActiveTab('informe');
    }
    setUltimoGlobal({ id: newRecord.id, numeroRadicado: newRecord.numeroRadicado });
  };

  const handleSaveEvaluation = async (updatedFiling, opts = {}) => {
    setFilings(prev => prev.map(f => f.id === updatedFiling.id ? updatedFiling : f));
    setSelectedFiling(updatedFiling);

    if (updatedFiling.estado === 'Aprobado' && !updatedFiling.m365Synced) {
      setTimeout(async () => {
        try {
          const res = await apiFetch(`/api/radicacion/${updatedFiling.id}`);
          if (res.ok) {
            const json = await res.json();
            if (json.data) {
              setFilings(prev => prev.map(f => f.id === json.data.id ? json.data : f));
              setSelectedFiling(prev => (prev && prev.id === json.data.id ? json.data : prev));
            }
          }
        } catch (e) {  }
      }, 15000);
    }

    if (opts.skipSync) return;

    apiFetch(`/api/radicacion/${updatedFiling.id}/metadata`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata: updatedFiling.metadata })
    }).catch(e => console.warn('Could not sync metadata to backend:', e));
  };

  const handleUpdateFiling = async (updatedFiling) => {
    setSelectedFiling(updatedFiling);
    setFilings(prev => prev.map(f => f.id === updatedFiling.id ? updatedFiling : f));

    apiFetch(`/api/radicacion/${updatedFiling.id}/metadata`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata: updatedFiling.metadata })
    }).catch(e => console.warn('Could not sync metadata to backend:', e));
  };

  const [syncingId, setSyncingId] = useState(null);

  const [manualOpen, setManualOpen] = useState(false);

  const handleRetrySync = async (record) => {
    if (!record || syncingId) return;
    if (!confirm(`¿Reintentar la subida de ${record.numeroRadicado} a SharePoint? Puede tardar 1-3 minutos.`)) return;
    setSyncingId(record.id);
    try {
      const resp = await apiFetch(`/api/radicacion/${record.id}/sincronizar`, { method: 'POST' });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(data?.detail || `El servidor respondió ${resp.status}`);
      const updated = data.data;
      setFilings(prev => prev.map(f => f.id === updated.id ? updated : f));
      setSelectedFiling(prev => (prev && prev.id === updated.id ? updated : prev));
      alert(`Subida OK: ${record.numeroRadicado} quedó en SharePoint (fila + carpetas + archivos).`);
    } catch (err) {
      alert(`No se pudo subir a SharePoint: ${err.message}`);
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className={`bg-[#F2F2F2] font-sans text-gray-900 flex flex-col selection:bg-[#D9CF43] selection:text-[#0D0D0D] ${
      user.isAuthenticated ? 'h-screen overflow-hidden print:h-auto print:overflow-visible' : 'min-h-screen'
    }`}>
      
      {isProcessingMsal ? (
        <main className="flex-1 min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#1A1D24]">
          <div className="bg-[#212631] border border-gray-700/60 rounded-xl p-8 max-w-md w-full text-center shadow-xl">
            <div className="w-12 h-12 border-4 border-[#0078D4] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-xl font-bold text-white mb-2">Autenticando con Microsoft 365...</h2>
            <p className="text-sm text-gray-300">Verificando credenciales institucionales y redirigiendo al portal.</p>
          </div>
        </main>
      ) : !user.isAuthenticated ? (
        <main className="flex-1 h-screen overflow-hidden flex items-center justify-center p-3 sm:p-4 bg-[#1A1D24] sm:bg-[#EAEAEA]">
          <LoginForm onLoginSuccess={handleLoginSuccess} externalError={msalAuthError} />
        </main>
      ) : (
        <>
          
          <Header
            user={user}
            m365Config={m365Config}
            onOpenLogin={() => {}}
            onLogout={handleLogout}
            onOpenManual={() => setManualOpen(true)}
            filingCount={userFilings.length}
          />

          <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden print:h-auto print:overflow-visible">
            
            <Sidebar
              activeTab={activeTab}
              setActiveTab={(tab) => (tab === 'nueva' ? irNuevaRadicacion() : setActiveTab(tab))}
              filingCount={userFilings.length}
              userRole={user.role}
            />

          
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto print:p-0 print:overflow-visible print:h-auto">
            <ErrorBoundary>
              {activeTab === 'nueva' && (
                <RadicacionForm
                  filingToEdit={editingFiling}
                  onSuccess={handleFilingCreated}
                  onCancel={() => {
                    setEditingFiling(null);
                    if (typeof window !== 'undefined') {
                      sessionStorage.removeItem('editing_filing_id');
                    }
                    setActiveTab('lista');
                  }}
                  currentUser={user}
                />
              )}

              {activeTab === 'lista' && (
                <RadicacionesList
                  filings={userFilings}
                  allFilings={filings}
                  ultimoGlobal={ultimoGlobal}
                  onSelectFiling={(record) => {
                    cargarRadicacionCompleta(record).then((full) => {
                      setSelectedFiling(full);
                      setActiveTab('informe');
                    });
                  }}
                  onEvaluateFiling={(record) => {
                    cargarRadicacionCompleta(record).then((full) => {
                      setSelectedFiling(full);
                      setActiveTab('evaluacion');
                    });
                  }}
                  onNewFiling={irNuevaRadicacion}
                  onEditFiling={async (record) => {
                    const full = await cargarRadicacionCompleta(record);
                    setEditingFiling(full);
                    if (typeof window !== 'undefined') {
                      sessionStorage.setItem('editing_filing_id', full.id || full.numeroRadicado);
                    }
                    setActiveTab('nueva');
                  }}
                  onDeleteFiling={async (record) => {
                    if (!confirm(`¿Eliminar el radicado ${record.numeroRadicado}? Esta acción no se puede deshacer.`)) return;
                    try {
                      const resp = await apiFetch(`/api/radicacion/${record.id}`, { method: 'DELETE' });
                      const data = await resp.json();
                      if (!resp.ok) throw new Error(data.detail || 'Error al eliminar');
                      alert(data.mensaje || 'Radicado eliminado');
                      setFilings(filings.filter(f => f.id !== record.id));
                      fetchFilings();
                    } catch (err) {
                      alert('Error: ' + err.message);
                    }
                  }}
                  userRole={user.role}
                  currentUser={user}
                  onFormatoC={(record) => {
                    setSelectedFiling(record);
                    setActiveTab('formato437c');
                  }}
                  onReciboTecnico={(record) => {
                    setSelectedFiling(record);
                    setActiveTab('recibo');
                  }}
                  onRetrySync={handleRetrySync}
                  syncingId={syncingId}
                />
              )}

              {activeTab === 'evaluacion' && selectedFiling && (
                <EvaluacionRadicacion
                  key={selectedFiling.id || selectedFiling.numeroRadicado}
                  filing={selectedFiling}
                  onSaveEvaluation={handleSaveEvaluation}
                  onViewReport={(filing) => {
                    setSelectedFiling(filing);
                    setActiveTab('informe');
                  }}
                  onBack={() => setActiveTab('lista')}
                  currentUser={user}
                  userRole={user.role}
                />
              )}

              {activeTab === 'informe' && selectedFiling && (
                <InformeRecibidoConformidad
                  key={selectedFiling.id || selectedFiling.numeroRadicado}
                  filing={selectedFiling}
                  onBack={() => setActiveTab('lista')}
                  onEditEvaluation={(filing) => {
                    setSelectedFiling(filing);
                    setActiveTab('evaluacion');
                  }}
                  onFormatoC={(filing) => {
                    setSelectedFiling(filing);
                    setActiveTab('formato437c');
                  }}
                  onUpdateFiling={handleSaveEvaluation}
                  currentUser={user}
                  userRole={user.role}
                />
              )}

              {activeTab === 'formato437c' && selectedFiling && (
                <Formato437C
                  filing={selectedFiling}
                  allFilings={filings}
                  onSelectFiling={setSelectedFiling}
                  onBack={() => setActiveTab('lista')}
                  onUpdateFiling={handleUpdateFiling}
                />
              )}

              {activeTab === 'recibo' && user.role === 'interventor' && (
                <ReciboTecnico
                  key={selectedFiling?.id || selectedFiling?.numeroRadicado || 'sin-seleccion'}
                  filings={filings}
                  filing={selectedFiling}
                  onSelectFiling={setSelectedFiling}
                  onBack={() => setActiveTab('lista')}
                  onUpdateFiling={handleUpdateFiling}
                  currentUser={user}
                />
              )}

              {activeTab === 'calendario' && user.role === 'interventor' && (
                <CalendarioRevision
                  filings={filings}
                  onEvaluateFiling={(record) => {
                    setSelectedFiling(record);
                    setActiveTab('evaluacion');
                  }}
                  onSelectFiling={(record) => {
                    setSelectedFiling(record);
                    setActiveTab('informe');
                  }}
                  userRole={user.role}
                />
              )}

              
              {['evaluacion', 'informe', 'formato437c'].includes(activeTab) && !selectedFiling && (
                <div className="max-w-md mx-auto my-16 bg-white rounded-2xl border border-gray-200 shadow-md p-8 text-center space-y-4">
                  <div className="w-10 h-10 border-4 border-[#D9CF43] border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-sm font-bold text-gray-700">Cargando expediente...</p>
                  <button
                    onClick={() => setActiveTab('lista')}
                    className="bg-[#0D0D0D] hover:bg-gray-800 text-[#D9CF43] font-bold text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                  >
                    Volver a la Lista de Radicaciones
                  </button>
                </div>
              )}
            </ErrorBoundary>
          </main>
        </div>

        {manualOpen && (
          <ManualUsuario
            userRole={user.role}
            onClose={() => setManualOpen(false)}
          />
        )}
      </>
      )}
    </div>
  );
}
