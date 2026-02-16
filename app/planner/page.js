'use client';

import { useMemo, useState } from 'react';
import AppShell from '../../components/AppShell';

const initialTasks = [
  { id: 1, title: 'Morning power hour outreach', owner: 'Kimora', done: false },
  { id: 2, title: 'Inner Circle follow-up block', owner: 'Team', done: false },
  { id: 3, title: 'Referral push + sponsorship asks', owner: 'Leaders', done: false },
  { id: 4, title: 'End-of-day accountability check', owner: 'Ops', done: false }
];

const initialBlocks = [
  { time: '8:00 AM', focus: 'Leadership huddle + metrics review' },
  { time: '10:00 AM', focus: 'Prospecting sprint' },
  { time: '1:00 PM', focus: 'Follow-up and application push' },
  { time: '6:00 PM', focus: 'Family appointment + close block' }
];

export default function PlannerPage() {
  const [tasks, setTasks] = useState(initialTasks);
  const [newTask, setNewTask] = useState('');

  const completed = useMemo(() => tasks.filter((t) => t.done).length, [tasks]);

  const addTask = (event) => {
    event.preventDefault();
    if (!newTask.trim()) return;

    setTasks((prev) => [
      ...prev,
      {
        id: Date.now(),
        title: newTask.trim(),
        owner: 'Team',
        done: false
      }
    ]);
    setNewTask('');
  };

  const toggleTask = (id) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, done: !task.done } : task)));
  };

  return (
    <AppShell title="Planner">
      <div className="grid4">
        <div className="card">
          <p>Today Plan Completion</p>
          <h2>{completed}/{tasks.length}</h2>
          <span className={`pill ${completed === tasks.length ? 'onpace' : completed >= 1 ? 'atrisk' : 'offpace'}`}>
            {completed === tasks.length ? 'Locked In' : completed >= 1 ? 'In Progress' : 'Not Started'}
          </span>
        </div>
        <div className="card">
          <p>Priority Blocks</p>
          <h2>{initialBlocks.length}</h2>
          <span className="pill onpace">Execution Schedule</span>
        </div>
      </div>

      <div className="split">
        <div className="panel">
          <div className="panelRow">
            <h3>Daily Execution Checklist</h3>
            <span className="muted">Non-negotiables for production days</span>
          </div>

          <ul className="checklist">
            {tasks.map((task) => (
              <li key={task.id} className={task.done ? 'done' : ''}>
                <label>
                  <input type="checkbox" checked={task.done} onChange={() => toggleTask(task.id)} />
                  <span>{task.title}</span>
                </label>
                <small>{task.owner}</small>
              </li>
            ))}
          </ul>

          <form className="inlineForm" onSubmit={addTask}>
            <input
              placeholder="Add execution task"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
            />
            <button type="submit">Add</button>
          </form>
        </div>

        <div className="panel">
          <h3>Time Blocks</h3>
          <ul className="timeline">
            {initialBlocks.map((block) => (
              <li key={block.time}>
                <strong>{block.time}</strong>
                <span>{block.focus}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
