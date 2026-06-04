// FILE: Frontend/src/routes/enter.tsx
// KAAM: Add Work Status + Today's Entries — blue/dark theme

import React, { useState, useEffect, useCallback } from 'react';
import { useAppState } from '../lib/app-state';
import { API_BASE_URL } from '../lib/api';
import { Send, Trash2, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProjectOption { id: number; name: string; }
interface TaskOption    { id: number; task_name: string; }
interface TimesheetLog {
  id?: string;
  employee_id?: string;
  employee_name?: string;
  entry_date?: string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  module_name?: string;
  task_name?: string;
  task_description?: string;
  project_name?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getLocalDateStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const fmt12 = (t: string | undefined) => {
  if (!t) return '—';
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr, 10);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2,'0')}:${mStr} ${ap}`;
};

const MAX_DESC = 300;

// ─── Component ────────────────────────────────────────────────────────────────
export const EnterStatus: React.FC = () => {
  const { token } = useAppState();

  // Form state
  const [projects,           setProjects]           = useState<ProjectOption[]>([]);
  const [selectedProjectId,  setSelectedProjectId]  = useState<number | null>(null);
  const [selectedProjectName,setSelectedProjectName]= useState('');
  const [tasks,              setTasks]              = useState<TaskOption[]>([]);
  const [selectedTaskName,   setSelectedTaskName]   = useState('');
  const [tasksLoading,       setTasksLoading]       = useState(false);
  const [startTime,          setStartTime]          = useState('09:00');
  const [endTime,            setEndTime]            = useState('11:00');
  const [description,        setDescription]        = useState('');
  const [submitError,        setSubmitError]        = useState('');
  const [submitSuccess,      setSubmitSuccess]      = useState(false);
  const [loading,            setLoading]            = useState(false);

  // Right-panel state
  const [todaysLogs, setTodaysLogs] = useState<TimesheetLog[]>([]);
  const [deletingId,  setDeletingId] = useState<string | null>(null);
  const [logsError,  setLogsError]  = useState('');

  // ── Duration validation ──────────────────────────────────────────────────
  const durationMins = (() => {
    if (!startTime || !endTime) return 0;
    const diff = toMinutes(endTime) - toMinutes(startTime);
    return diff > 0 ? diff : 0;           // negative = end < start → invalid
  })();
  const durationHours = Number((durationMins / 60).toFixed(2));
  const endBeforeStart = startTime && endTime && toMinutes(endTime) <= toMinutes(startTime);
  const overTwoHours   = durationMins > 120;
  const zeroDuration   = durationMins === 0;
  const timeError = endBeforeStart
    ? 'End time must be after start time.'
    : overTwoHours
    ? `Duration ${durationHours}h exceeds the 2-hour limit. Please split into shorter slots.`
    : zeroDuration && startTime && endTime
    ? 'Duration must be greater than 0.'
    : '';

  const taskRequired  = tasks.length > 0 && !selectedTaskName;
  const canSubmit     = !loading
    && !!selectedProjectId
    && !taskRequired
    && !timeError
    && durationMins > 0
    && description.trim().length > 0;

  // ── Fetch projects on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE_URL}/api/timesheet/projects`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setProjects(d.projects || []))
      .catch(console.error);
  }, [token]);

  // ── Fetch tasks when project changes ────────────────────────────────────
  useEffect(() => {
    setTasks([]);
    setSelectedTaskName('');
    if (selectedProjectId === null) return;
    setTasksLoading(true);
    fetch(`${API_BASE_URL}/api/timesheet/projects/${selectedProjectId}/tasks`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setTasks(d.tasks || []))
      .catch(console.error)
      .finally(() => setTasksLoading(false));
  }, [selectedProjectId]);

  // ── Fetch today's logs ─────────────────────────────────────────────────
  const fetchTodaysLogs = useCallback(async () => {
    if (!token) return;
    setLogsError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/timesheet/admin/all-logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      const allLogs: TimesheetLog[] = data.telemetry_logs || [];
      const today = getLocalDateStr();
      const filtered = allLogs
        .filter(l => l.entry_date === today)
        .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
      setTodaysLogs(filtered);
    } catch {
      setLogsError('Could not load today\'s entries.');
    }
  }, [token]);

  useEffect(() => { fetchTodaysLogs(); }, [fetchTodaysLogs]);

  // ── Delete entry ────────────────────────────────────────────────────────
  const handleDelete = async (id: string | undefined) => {
    if (!id || !token) return;
    if (!window.confirm('Delete this entry?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/timesheet/delete/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      fetchTodaysLogs();
    } catch {
      setLogsError('Failed to delete entry.');
    } finally {
      setDeletingId(null);
    }
  };

  // ── Submit ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitSuccess(false);
    if (!canSubmit) return;

    setLoading(true);
    const payload: Record<string, unknown> = {
      entry_date:       getLocalDateStr(),
      start_time:       startTime,
      end_time:         endTime,
      duration_hours:   durationHours,
      task_description: description,
      project_name:     selectedProjectName,
    };
    if (selectedTaskName) payload.task_name = selectedTaskName;

    try {
      const res = await fetch(`${API_BASE_URL}/api/timesheet/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message || 'Submit failed.');
      }
      // Reset form
      setSelectedProjectId(null);
      setSelectedProjectName('');
      setTasks([]);
      setSelectedTaskName('');
      setStartTime('09:00');
      setEndTime('11:00');
      setDescription('');
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
      fetchTodaysLogs();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Unexpected error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Totals ──────────────────────────────────────────────────────────────
  const totalMinsToday = todaysLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0);
  const totalHrsToday  = (totalMinsToday / 60).toFixed(1);

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 p-4 lg:p-6">

      {/* ── Page header ── */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            KEYSS INFRASTRUCTURE PANEL
          </span>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Daily Status Logging Studio</h1>
      </div>

      {/* ── Two-column layout ── */}
      <div className="flex flex-col xl:flex-row gap-5 items-start">

        {/* ════════════════════ LEFT — Add Work Status ════════════════════ */}
        <div className="w-full xl:w-[440px] shrink-0 bg-[#020617] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-6 pt-5 pb-3 border-b border-slate-800/60">
            <h2 className="text-base font-bold text-white">Add Work Status</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Log what you worked on, when, and on which project.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

            {/* Project */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Project <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={selectedProjectId ?? ''}
                onChange={e => {
                  const id = e.target.value ? Number(e.target.value) : null;
                  const name = id
                    ? (projects.find(p => p.id === id)?.name ?? '')
                    : '';
                  setSelectedProjectId(id);
                  setSelectedProjectName(name);
                }}
                className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
              >
                <option value="">Select a project…</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Task */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                Task
                {tasks.length > 0 && <span className="text-red-400">*</span>}
                {tasksLoading && (
                  <span className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block" />
                )}
              </label>
              <select
                value={selectedTaskName}
                onChange={e => setSelectedTaskName(e.target.value)}
                disabled={!selectedProjectId || tasksLoading}
                required={tasks.length > 0}
                className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {!selectedProjectId ? (
                  <option value="">Select a project first</option>
                ) : tasks.length === 0 && !tasksLoading ? (
                  <option value="">No tasks for this project</option>
                ) : (
                  <>
                    <option value="">Select a task…</option>
                    {tasks.map(t => (
                      <option key={t.id} value={t.task_name}>{t.task_name}</option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {/* Start / End time */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Time Range <span className="text-red-400">*</span>
              </label>
              <div className="flex items-center gap-3">
                <div className="flex-1 space-y-1">
                  <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Start</span>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={e => { setStartTime(e.target.value); setSubmitError(''); }}
                    className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-600 [color-scheme:dark]"
                  />
                </div>

                {/* Duration badge */}
                <div className="shrink-0 mt-4">
                  <span className={`text-[11px] font-black px-2.5 py-1 rounded-full border ${
                    timeError
                      ? 'bg-red-950/40 border-red-800/50 text-red-400'
                      : durationMins > 0
                      ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400'
                      : 'bg-slate-800/40 border-slate-700 text-slate-500'
                  }`}>
                    {durationMins > 0 ? `${durationHours}h` : '—'}
                  </span>
                </div>

                <div className="flex-1 space-y-1">
                  <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">End</span>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={e => { setEndTime(e.target.value); setSubmitError(''); }}
                    className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-600 [color-scheme:dark]"
                  />
                </div>
              </div>

              {timeError && (
                <div className="flex items-center gap-1.5 text-[10px] text-red-400 font-semibold mt-1">
                  <AlertTriangle size={11} className="shrink-0" />
                  {timeError}
                </div>
              )}
            </div>

            {/* Description + char counter */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Task Description <span className="text-red-400">*</span>
                </label>
                <span className={`text-[10px] font-semibold ${description.length > MAX_DESC ? 'text-red-400' : 'text-slate-500'}`}>
                  {description.length}/{MAX_DESC}
                </span>
              </div>
              <textarea
                required
                rows={4}
                maxLength={MAX_DESC}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe the specific work you did — features built, bugs fixed, tasks completed…"
                className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-2.5 text-xs leading-relaxed text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-600 resize-none placeholder:text-slate-600"
              />
            </div>

            {/* Feedback messages */}
            {submitError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-950/30 border border-red-900/40 px-3 py-2 text-[11px] font-semibold text-red-300">
                <AlertTriangle size={12} className="shrink-0" />
                {submitError}
              </div>
            )}
            {submitSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-950/30 border border-emerald-900/40 px-3 py-2 text-[11px] font-semibold text-emerald-300">
                <CheckCircle2 size={12} className="shrink-0" />
                Entry saved successfully!
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!canSubmit}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-black uppercase tracking-wider transition-all duration-200 shadow-md ${
                canSubmit
                  ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:shadow-blue-900/30 hover:shadow-lg'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/40'
              }`}
            >
              {loading
                ? <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                : <Send size={13} />}
              {loading ? 'Committing…' : 'Commit Status Entry'}
            </button>
          </form>
        </div>

        {/* ════════════════════ RIGHT — Today's Entries ════════════════════ */}
        <div className="w-full flex-1 bg-[#020617] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-6 pt-5 pb-3 border-b border-slate-800/60 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Today's Entries</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Your status updates for today.</p>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-slate-500" />
              <span className="text-sm font-black text-blue-400 bg-blue-950/40 border border-blue-900/40 px-3 py-0.5 rounded-full">
                {totalHrsToday} hrs
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            {logsError ? (
              <div className="flex items-center gap-2 m-4 px-3 py-2.5 rounded-lg bg-red-950/30 border border-red-900/40 text-[11px] text-red-300 font-semibold">
                <AlertTriangle size={12} />
                {logsError}
              </div>
            ) : todaysLogs.length === 0 ? (
              <div className="text-center text-slate-500 text-xs py-16 italic font-medium">
                No entries logged yet for today.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800/60 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="text-left px-5 py-3">Project</th>
                    <th className="text-left px-3 py-3">Employee</th>
                    <th className="text-left px-3 py-3">Time</th>
                    <th className="text-center px-3 py-3">Hrs</th>
                    <th className="text-left px-3 py-3">Task</th>
                    <th className="text-center px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {todaysLogs.map((log, idx) => {
                    const hrs = log.duration_minutes
                      ? Number((log.duration_minutes / 60).toFixed(1))
                      : 0;
                    return (
                      <tr
                        key={log.id || idx}
                        className="hover:bg-[#0f172a]/60 transition-colors group"
                      >
                        {/* Project */}
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-slate-200 truncate max-w-[160px]">
                            {log.project_name || '—'}
                          </div>
                          {log.module_name && log.module_name !== 'GENERAL' && (
                            <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[160px]">
                              {log.module_name}
                            </div>
                          )}
                          {log.task_description && (
                            <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-2 max-w-[180px]">
                              {log.task_description}
                            </div>
                          )}
                        </td>

                        {/* Employee */}
                        <td className="px-3 py-3.5">
                          <span className="text-slate-300 font-medium whitespace-nowrap">
                            {log.employee_name || '—'}
                          </span>
                        </td>

                        {/* Time */}
                        <td className="px-3 py-3.5 whitespace-nowrap">
                          <span className="font-mono text-blue-400 font-bold text-[10px] bg-blue-950/20 border border-blue-900/30 px-2 py-0.5 rounded">
                            {fmt12(log.start_time)} – {fmt12(log.end_time)}
                          </span>
                        </td>

                        {/* Hrs */}
                        <td className="px-3 py-3.5 text-center">
                          <span className={`font-black text-[11px] ${hrs > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {hrs > 0 ? `${hrs}h` : '—'}
                          </span>
                        </td>

                        {/* Task */}
                        <td className="px-3 py-3.5">
                          {log.task_name ? (
                            <span className="text-slate-300 bg-slate-800/60 border border-slate-700/40 px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap">
                              {log.task_name}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-[10px]">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-3.5 text-center">
                          <button
                            type="button"
                            disabled={deletingId === log.id}
                            onClick={() => handleDelete(log.id)}
                            title="Delete entry"
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-950/25 transition-colors disabled:opacity-40"
                          >
                            {deletingId === log.id ? (
                              <span className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Trash2 size={13} />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};