'use client';

import { useEffect, useMemo, useState } from 'react';

function clean(v = '') { return String(v || '').trim(); }

export default function UplineInboxPage() {
  const [viewerName, setViewerName] = useState('');
  const [viewerEmail, setViewerEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState('');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const name = clean(params.get('name') || '');
    const email = clean(params.get('email') || '').toLowerCase();
    setViewerName(name);
    setViewerEmail(email);
  }, []);

  async function loadInbox(nameArg = viewerName, emailArg = viewerEmail) {
    const name = clean(nameArg);
    const email = clean(emailArg).toLowerCase();
    if (!name && !email) {
      setError('Enter name/email to load inbox.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ mode: 'inbox', name, email, profileType: 'licensed' });
      const res = await fetch(`/api/upline-support?${qs.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError('Could not load inbox.');
        return;
      }
      const nextThreads = Array.isArray(data?.threads) ? data.threads : [];
      setThreads(nextThreads);
      if (!selectedThread && nextThreads.length) setSelectedThread(clean(nextThreads[0]?.threadKey || ''));
    } catch {
      setError('Could not load inbox.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!viewerEmail && !viewerName) return;
    loadInbox(viewerName, viewerEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerEmail, viewerName]);

  const activeThread = useMemo(
    () => (threads || []).find((t) => clean(t?.threadKey) === clean(selectedThread)) || null,
    [threads, selectedThread]
  );

  async function sendReply() {
    const threadKey = clean(selectedThread);
    const message = clean(reply);
    if (!threadKey) {
      setNotice('Select a thread first.');
      return;
    }
    if (!message) {
      setNotice('Type a reply first.');
      return;
    }

    setSending(true);
    setNotice('');
    try {
      const res = await fetch('/api/upline-support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upline_reply',
          threadKey,
          viewerName,
          viewerEmail,
          profileType: 'licensed',
          message
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setNotice('Could not send reply right now.');
        return;
      }
      setReply('');
      setNotice('Reply sent.');
      await loadInbox(viewerName, viewerEmail);
    } catch {
      setNotice('Could not send reply right now.');
    } finally {
      setSending(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#070b14', color: '#E5E7EB', padding: 20 }}>
      <section style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gap: 12 }}>
        <header style={{ border: '1px solid #2A3142', borderRadius: 12, background: '#0F172A', padding: 14 }}>
          <h2 style={{ margin: 0 }}>Upline Messages</h2>
          <p style={{ color: '#9CA3AF', marginBottom: 8 }}>Leader inbox for agent support threads.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
            <input value={viewerName} onChange={(e) => setViewerName(e.target.value)} placeholder="Your name" style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', background: '#020617', color: '#fff' }} />
            <input value={viewerEmail} onChange={(e) => setViewerEmail(e.target.value)} placeholder="Your email" style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #334155', background: '#020617', color: '#fff' }} />
            <button type="button" onClick={() => loadInbox(viewerName, viewerEmail)} style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#B91C1C', color: '#fff', fontWeight: 800 }}>Refresh</button>
          </div>
          {error ? <div style={{ color: '#FCA5A5', marginTop: 8 }}>{error}</div> : null}
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 10 }}>
          <div style={{ border: '1px solid #334155', borderRadius: 10, background: '#0F172A', maxHeight: 520, overflow: 'auto' }}>
            {loading ? <div style={{ color: '#9CA3AF', padding: 12 }}>Loading…</div> : null}
            {!loading && !(threads || []).length ? <div style={{ color: '#9CA3AF', padding: 12 }}>No threads.</div> : null}
            {(threads || []).map((t, idx) => {
              const active = clean(t?.threadKey) === clean(selectedThread);
              return (
                <button
                  key={t?.threadKey || `t-${idx}`}
                  type="button"
                  onClick={() => setSelectedThread(clean(t?.threadKey || ''))}
                  style={{ width: '100%', textAlign: 'left', border: 0, borderBottom: '1px solid #1F2937', padding: 10, background: active ? '#13203A' : 'transparent', color: '#E5E7EB' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong>{clean(t?.agentName || 'Agent')}</strong>
                    {Number(t?.unread || 0) > 0 ? <span style={{ border: '1px solid #FCA5A5', borderRadius: 999, padding: '2px 7px', background: '#7F1D1D' }}>{Number(t.unread)}</span> : null}
                  </div>
                  <div style={{ color: '#9CA3AF', fontSize: 12, marginTop: 4 }}>{clean(t?.latest?.createdAt) ? new Date(t.latest.createdAt).toLocaleString() : '—'}</div>
                </button>
              );
            })}
          </div>

          <div style={{ border: '1px solid #334155', borderRadius: 10, background: '#0F172A', padding: 12, display: 'grid', gap: 8 }}>
            {!activeThread ? (
              <div style={{ color: '#9CA3AF' }}>Select a thread.</div>
            ) : (
              <>
                <div style={{ maxHeight: 320, overflow: 'auto', display: 'grid', gap: 8 }}>
                  {(activeThread.rows || []).slice(-40).map((msg, idx) => {
                    const mine = clean(msg?.fromRole) === 'upline';
                    return (
                      <div key={msg?.id || `${idx}-${msg?.createdAt || 'na'}`} style={{ border: mine ? '1px solid #60A5FA' : '1px solid #334155', borderRadius: 8, padding: 8, background: mine ? '#1E3A8A' : '#111827' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          <strong>{mine ? 'You' : clean(msg?.fromName || 'Agent')}</strong>
                          <span style={{ color: '#9CA3AF', fontSize: 12 }}>{clean(msg?.createdAt) ? new Date(msg.createdAt).toLocaleString() : '—'}</span>
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{clean(msg?.body || '')}</div>
                      </div>
                    );
                  })}
                </div>
                <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={4} placeholder="Type your reply..." style={{ width: '100%', borderRadius: 8, border: '1px solid #334155', background: '#020617', color: '#fff', padding: '10px 12px' }} />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button type="button" onClick={sendReply} disabled={sending} style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#2563EB', color: '#fff', fontWeight: 800 }}>{sending ? 'Sending…' : 'Send Reply'}</button>
                  {notice ? <span style={{ color: notice.toLowerCase().includes('could not') ? '#FCA5A5' : '#86EFAC' }}>{notice}</span> : null}
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
