'use client';

import { useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';

const draftSeed = [
  { id: 1, channel: 'Skool', title: 'Monday Discipline Post', status: 'Pending Approval' },
  { id: 2, channel: 'Instagram', title: 'Referral Leaderboard Reel', status: 'Pending Approval' },
  { id: 3, channel: 'Telegram', title: '9PM Closeout Prompt', status: 'Approved' }
];

export default function ContentOpsPage() {
  const [drafts, setDrafts] = useState(draftSeed);

  const pending = useMemo(() => drafts.filter((d) => d.status === 'Pending Approval').length, [drafts]);

  const setStatus = (id, status) => {
    setDrafts((prev) => prev.map((draft) => (draft.id === id ? { ...draft, status } : draft)));
  };

  return (
    <AppShell title="Content Ops">
      <div className="grid4">
        <div className="card">
          <p>Pending Approvals</p>
          <h2>{pending}</h2>
          <span className={`pill ${pending > 0 ? 'atrisk' : 'onpace'}`}>{pending > 0 ? 'Needs Review' : 'Clear'}</span>
        </div>
      </div>

      <div className="panel">
        <div className="panelRow">
          <h3>Draft Queue</h3>
          <span className="muted">Approval-first workflow preserved</span>
        </div>

        <table>
          <thead>
            <tr>
              <th>Channel</th>
              <th>Draft</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((draft) => (
              <tr key={draft.id}>
                <td>{draft.channel}</td>
                <td>{draft.title}</td>
                <td>
                  <span className={`pill ${draft.status === 'Approved' ? 'onpace' : 'atrisk'}`}>{draft.status}</span>
                </td>
                <td>
                  <div className="rowActions">
                    <button className="ghost" onClick={() => setStatus(draft.id, 'Approved')}>Approve</button>
                    <button className="ghost" onClick={() => setStatus(draft.id, 'Needs Revision')}>Revise</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
