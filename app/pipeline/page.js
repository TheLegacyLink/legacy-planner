'use client';

import { useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';

const stageSeed = [
  { key: 'new', label: 'New Leads', value: 42 },
  { key: 'contacted', label: 'Contacted', value: 28 },
  { key: 'appt', label: 'Appointments Booked', value: 14 },
  { key: 'submitted', label: 'Apps Submitted', value: 9 },
  { key: 'issued', label: 'Issued', value: 4 }
];

export default function PipelinePage() {
  const [stages, setStages] = useState(stageSeed);

  const total = useMemo(() => stages.reduce((sum, s) => sum + s.value, 0), [stages]);

  const updateStage = (key, value) => {
    setStages((prev) => prev.map((stage) => (stage.key === key ? { ...stage, value: Number(value || 0) } : stage)));
  };

  return (
    <AppShell title="Pipeline">
      <div className="grid4">
        <div className="card">
          <p>Total Pipeline Touchpoints</p>
          <h2>{total}</h2>
          <span className="pill onpace">Live Tracking</span>
        </div>
      </div>

      <div className="panel">
        <div className="panelRow">
          <h3>Pipeline Stages</h3>
          <span className="muted">Adjust counts to match daily sheet / CRM snapshots</span>
        </div>

        <div className="kanbanGrid">
          {stages.map((stage) => (
            <div className="kanbanCol" key={stage.key}>
              <h4>{stage.label}</h4>
              <p className="kanbanCount">{stage.value}</p>
              <input
                type="number"
                min="0"
                value={stage.value}
                onChange={(e) => updateStage(stage.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
