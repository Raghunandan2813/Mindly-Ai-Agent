'use client';

import React from 'react';

interface ActiveSessionRow {
  session_id: string;
  device_name: string;
  ip_address: string;
}

interface ApiTokenRow {
  id: string;
  name: string;
  scope: string;
  expires_at: string;
}

interface RedactionLogRow {
  id: string;
  session_id: string | null;
  redacted_type: string;
}

interface ConnectorRow {
  connector_name: string;
  enabled: boolean;
  last_error: string | null;
}

interface SecuritySettingsPanelsProps {
  subscriptionTier: string;
  activeSessions: ActiveSessionRow[];
  apiTokens: ApiTokenRow[];
  redactionLogs: RedactionLogRow[];
  connectors: ConnectorRow[];
  newTokenName: string;
  setNewTokenName: (v: string) => void;
  generatedToken: string;
  setGeneratedToken: (v: string) => void;
  connectorTokenInput: string;
  setConnectorTokenInput: (v: string) => void;
  onClose: () => void;
  fetchSecurityData: () => void;
  setSaveSuccess: (v: string) => void;
  setErrorMessage: (v: string) => void;
}

export default function SecuritySettingsPanels({
  subscriptionTier,
  activeSessions,
  apiTokens,
  redactionLogs,
  connectors,
  newTokenName,
  setNewTokenName,
  generatedToken,
  setGeneratedToken,
  connectorTokenInput,
  setConnectorTokenInput,
  onClose,
  fetchSecurityData,
  setSaveSuccess,
  setErrorMessage,
}: SecuritySettingsPanelsProps) {
  return (
    <>
      <div className="h-px bg-[var(--bg-secondary)]" />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-[var(--text-primary)]">Active Sessions</h4>
          <span className="text-[0.6rem] text-[var(--text-muted)] font-mono">
            {subscriptionTier === 'pro' ? 'Max 10' : 'Max 3'} • {subscriptionTier}
          </span>
        </div>
        {activeSessions.length === 0 ? (
          <p className="text-[0.65rem] text-[var(--text-muted)]">No registered device sessions.</p>
        ) : (
          <div className="space-y-2 max-h-36 overflow-y-auto">
            {activeSessions.map((s) => (
              <div
                key={s.session_id}
                className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[0.65rem]"
              >
                <div className="min-w-0">
                  <div className="font-bold text-[var(--text-primary)] truncate">{s.device_name || 'Device'}</div>
                  <div className="text-[var(--text-muted)] font-mono truncate">{s.ip_address}</div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await fetch(`/api/auth/sessions?sessionId=${s.session_id}`, { method: 'DELETE' });
                    if (localStorage.getItem('mindly_auth_session_id') === s.session_id) {
                      localStorage.removeItem('mindly_auth_session_id');
                    }
                    fetchSecurityData();
                  }}
                  className="px-2 py-1 rounded-lg bg-red-950/40 border border-red-900/50 text-red-300 text-[0.6rem] font-bold"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={async () => {
            await fetch('/api/auth/sessions', { method: 'PUT' });
            localStorage.removeItem('mindly_auth_session_id');
            setSaveSuccess('All sessions revoked globally.');
            fetchSecurityData();
          }}
          className="w-full py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-[0.65rem] font-bold text-[var(--text-primary)]"
        >
          Sign out all devices
        </button>
      </div>

      <div className="h-px bg-[var(--bg-secondary)]" />

      <div className="space-y-3">
        <h4 className="text-xs font-bold text-[var(--text-primary)]">CLI API Tokens</h4>
        <div className="flex gap-2">
          <input
            value={newTokenName}
            onChange={(e) => setNewTokenName(e.target.value)}
            placeholder="Token name"
            className="flex-1 p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-primary)]"
          />
          <button
            type="button"
            onClick={async () => {
              const res = await fetch('/api/auth/api-tokens', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newTokenName }),
              });
              const data = await res.json();
              if (data.token) {
                setGeneratedToken(data.token);
                setSaveSuccess('Token created — copy it now.');
                fetchSecurityData();
              } else {
                setErrorMessage(data.error || 'Failed to create token');
              }
            }}
            className="px-3 py-2 rounded-xl bg-white text-black text-xs font-bold"
          >
            Create
          </button>
        </div>
        {generatedToken && (
          <code className="block p-2 rounded-xl bg-[var(--bg-card)] border border-emerald-900/40 text-[0.6rem] text-emerald-300 break-all">
            {generatedToken}
          </code>
        )}
        {apiTokens.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[0.65rem]"
          >
            <div>
              <div className="font-bold text-[var(--text-primary)]">{t.name}</div>
              <div className="text-[var(--text-muted)] font-mono">
                {t.scope} • exp {new Date(t.expires_at).toLocaleDateString()}
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                await fetch(`/api/auth/api-tokens?tokenId=${t.id}`, { method: 'DELETE' });
                fetchSecurityData();
              }}
              className="text-red-400 text-[0.6rem] font-bold"
            >
              Revoke
            </button>
          </div>
        ))}
      </div>

      <div className="h-px bg-[var(--bg-secondary)]" />

      <div className="space-y-2">
        <h4 className="text-xs font-bold text-[var(--text-primary)]">Redaction Audit Log</h4>
        {redactionLogs.length === 0 ? (
          <p className="text-[0.65rem] text-[var(--text-muted)]">No redaction events yet.</p>
        ) : (
          <div className="max-h-32 overflow-y-auto space-y-1.5">
            {redactionLogs.slice(0, 20).map((log) => (
              <div
                key={log.id}
                className="p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-[0.6rem] flex justify-between gap-2"
              >
                <span className="text-[var(--text-secondary)]">{log.redacted_type}</span>
                {log.session_id ? (
                  <button
                    type="button"
                    className="text-indigo-400 font-mono hover:underline"
                    onClick={() => {
                      localStorage.setItem('mindly_last_session_id', log.session_id!);
                      onClose();
                      window.location.href = '/';
                    }}
                  >
                    chat …{log.session_id.slice(-6)}
                  </button>
                ) : (
                  <span className="text-[var(--text-muted)]">—</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="h-px bg-[var(--bg-secondary)]" />

      <div className="space-y-3">
        <h4 className="text-xs font-bold text-[var(--text-primary)]">Integrations</h4>
        <input
          type="password"
          value={connectorTokenInput}
          onChange={(e) => setConnectorTokenInput(e.target.value)}
          placeholder="OAuth access token (encrypted at rest)"
          className="w-full p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-xs text-[var(--text-primary)]"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={async () => {
              const res = await fetch('/api/auth/connectors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  connectorName: 'generic',
                  enabled: true,
                  accessToken: connectorTokenInput,
                }),
              });
              if (res.ok) {
                setConnectorTokenInput('');
                setSaveSuccess('Credentials encrypted and saved.');
                fetchSecurityData();
              }
            }}
            className="flex-1 py-2 rounded-xl bg-[var(--bg-secondary)] text-xs font-bold text-[var(--text-primary)]"
          >
            Save encrypted
          </button>
          <button
            type="button"
            onClick={async () => {
              const res = await fetch('/api/auth/connectors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ connectorName: 'generic', triggerSync: true }),
              });
              const data = await res.json();
              setSaveSuccess(data.message || data.error || 'Done');
              fetchSecurityData();
            }}
            className="flex-1 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-[var(--text-primary)]"
          >
            Sync now
          </button>
        </div>
        {connectors.map((c) => (
          <div
            key={c.connector_name}
            className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-[0.65rem]"
          >
            <div className="flex justify-between">
              <span className="font-bold text-[var(--text-primary)]">{c.connector_name}</span>
              <span className={c.enabled ? 'text-emerald-400' : 'text-[var(--text-muted)]'}>
                {c.enabled ? 'on' : 'off'}
              </span>
            </div>
            {c.last_error && <p className="text-red-400 mt-1">{c.last_error}</p>}
          </div>
        ))}
      </div>
    </>
  );
}
