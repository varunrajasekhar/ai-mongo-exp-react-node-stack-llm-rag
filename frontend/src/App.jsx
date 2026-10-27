import React, { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { api } from './api';
function Protected({ admin = false }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace/>;
  if (admin && user.role !== 'admin') return <Navigate to="/study" replace/>;
  return <Outlet/>;
}
function AuthPage({ mode }) {
  const { user, authenticate } = useAuth();
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/study" replace/>;
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    const form = new FormData(event.currentTarget);
    try { await authenticate(mode, Object.fromEntries(form)); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <section className="auth"><p className="eyebrow">YOUR PERSONAL LEARNING SPACE</p><h1>{mode === 'login' ? 'Welcome back' : 'Start studying'}</h1><p>Ask questions. Build understanding. Practice what you learn.</p>
    <form onSubmit={submit}>{mode === 'register' && <label>Name<input name="name" autoComplete="name" required maxLength={100}/></label>}
      <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>
      <label>Password<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'register' ? 8 : 1}/></label>
      {mode === 'register' && <small>At least 8 characters, at most 72 UTF-8 bytes. New accounts are learners.</small>}
      <ErrorMessage error={error}/><button disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}</button>
    </form><p>{mode === 'login' ? 'New here?' : 'Already registered?'} <Link to={mode === 'login' ? '/register' : '/login'}>{mode === 'login' ? 'Create an account' : 'Log in'}</Link></p>
  </section>;
}
function ErrorMessage({ error }) { return error ? <p className="error" role="alert">{error}</p> : null; }
function Study() {
  const { user, token } = useAuth();
  const [question, setQuestion] = useState(''); const [practice, setPractice] = useState(false);
  const [result, setResult] = useState(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function ask(event, quiz = false) {
    event.preventDefault(); setError(''); setResult(null); setBusy(true);
    try { setResult(await api(quiz ? '/study/quiz' : '/study/ask', { method: 'POST', token, body: { question, includePractice: practice } })); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <><p className="eyebrow">AI STUDY</p><h1>What would you like to understand?</h1><p>{user.role === 'admin' ? 'Answers can draw on relevant passages from your private notes.' : 'Explore a topic with your AI study tutor.'}</p>
    <form onSubmit={ask}><label>Topic or question<textarea value={question} onChange={e => setQuestion(e.target.value)} required maxLength={2000} rows={4} placeholder="What is photosynthesis?"/></label>
      <label className="check"><input type="checkbox" checked={practice} onChange={e => setPractice(e.target.checked)}/> Include three practice questions</label>
      <div className="actions"><button disabled={busy}>{busy ? 'Thinking…' : 'Ask study assistant'}</button><button className="secondary" type="button" disabled={busy || !question.trim()} onClick={e => ask(e, true)}>Generate 3 Quiz Questions</button></div>
    </form><ErrorMessage error={error}/>{busy && <p role="status">Ollama is preparing your answer. The first request may take a few minutes.</p>}
    {result && <section className="result" aria-live="polite"><h2>Explanation</h2><p className="answer">{result.answer}</p>{result.practiceQuestions.length > 0 && <><h2>Practice questions</h2><ol>{result.practiceQuestions.map((q, i) => <li key={i}>{q}</li>)}</ol></>}
      <p className="source">{result.sources.length ? `Notes supplied as context: ${result.sources.map(s => s.title).join(', ')}` : 'General knowledge — no saved notes supplied.'}</p><small>AI responses may contain mistakes. Check important facts against your course materials.</small>
    </section>}
  </>;
}
function Notes() {
  const { token } = useAuth(); const [notes, setNotes] = useState(null); const [error, setError] = useState(''); const [retry, setRetry] = useState(0);
  useEffect(() => { let active = true; setError(''); setNotes(null); api('/notes', { token }).then(data => { if (active) setNotes(data); }).catch(err => { if (active) setError(err.message); }); return () => { active = false; }; }, [token, retry]);
  return <><p className="eyebrow">ADMIN WORKSPACE</p><h1>My Notes</h1><p>Only you can view these notes or use them as study context.</p><Link to="/notes/new">+ Add a note</Link><ErrorMessage error={error}/>{error && <button onClick={() => setRetry(n => n + 1)}>Retry</button>}
    {!notes && !error && <p role="status">Loading notes…</p>}{notes?.length === 0 && <p>No notes yet. Add your first study note to get started.</p>}
    {notes?.map(n => <article key={n._id}><small>{n.subject}</small><h2>{n.title}</h2><p className="answer">{n.content}</p></article>)}
  </>;
}
function AddNote() {
  const { token } = useAuth(); const navigate = useNavigate(); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function save(e) {
    e.preventDefault(); setBusy(true); setError(''); const body = Object.fromEntries(new FormData(e.currentTarget));
    try { await api('/notes', { method: 'POST', token, body }); navigate('/notes'); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <><p className="eyebrow">ADMIN WORKSPACE</p><h1>Add Note</h1><p>Save and index a private note for your next study session.</p><form onSubmit={save}>
    <label>Title<input name="title" maxLength={150} required/></label><label>Subject<input name="subject" maxLength={100} required/></label><label>Content<textarea name="content" rows={10} maxLength={12000} required/></label>
    <ErrorMessage error={error}/><button disabled={busy}>{busy ? 'Saving and indexing…' : 'Save note'}</button></form></>;
}
export default function App() {
  const { user, logout } = useAuth();
  return <><header><div className="brand">AI Study Assistant</div>{user && <nav aria-label="Main navigation"><NavLink to="/study">AI Study</NavLink>{user.role === 'admin' && <><NavLink to="/notes" end>My Notes</NavLink><NavLink to="/notes/new">Add Note</NavLink></>}<span>{user.name} · {user.role === 'admin' ? 'Admin' : 'Learner'}</span><button className="secondary" onClick={logout}>Logout</button></nav>}</header>
    <main><Routes><Route path="/login" element={<AuthPage key="login" mode="login"/>}/><Route path="/register" element={<AuthPage key="register" mode="register"/>}/><Route element={<Protected/>}><Route path="/study" element={<Study/>}/></Route><Route element={<Protected admin/>}><Route path="/notes" element={<Notes/>}/><Route path="/notes/new" element={<AddNote/>}/></Route><Route path="*" element={<Navigate to={user ? '/study' : '/login'} replace/>}/></Routes></main></>;
}
