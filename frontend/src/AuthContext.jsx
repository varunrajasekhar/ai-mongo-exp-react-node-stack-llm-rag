import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';
const Context = createContext(null);
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem('study_token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!token);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  function logout() { sessionStorage.removeItem('study_token'); setToken(null); setUser(null); setError(''); }
  useEffect(() => {
    window.addEventListener('session-expired', logout);
    return () => window.removeEventListener('session-expired', logout);
  }, []);
  useEffect(() => {
    let active = true;
    if (!token) { setLoading(false); return; }
    setLoading(true); setError('');
    api('/auth/me', { token }).then(data => { if (active) setUser(data.user); })
      .catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, retry]);
  async function authenticate(mode, body) {
    const data = await api(`/auth/${mode}`, { method: 'POST', body });
    sessionStorage.setItem('study_token', data.token); setUser(data.user); setToken(data.token);
  }
  return <Context.Provider value={{ user, token, logout, authenticate }}>
    {loading ? <p role="status">Checking your session…</p> : error && token ? <section role="alert"><p>{error}</p><button onClick={() => setRetry(n => n + 1)}>Retry</button> <button onClick={logout}>Sign out</button></section> : children}
  </Context.Provider>;
}
export const useAuth = () => useContext(Context);
