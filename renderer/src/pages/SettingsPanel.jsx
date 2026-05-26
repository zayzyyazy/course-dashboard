import React, { useState } from 'react';

export default function SettingsPanel({ state, update, onClose }) {
  const [apiKey, setApiKey] = useState(state.apiKey || '');
  const [model, setModel] = useState(state.generationModel || 'gpt-4o');
  const [vaultPath, setVaultPath] = useState(state.vaultPath || '');

  async function save() {
    await update('apiKey', apiKey);
    await update('generationModel', model);
    await update('vaultPath', vaultPath);
    onClose();
  }

  return (
    <div className="h-full overflow-y-auto no-drag">
      <div className="h-8 drag-region" />
      <div className="max-w-lg mx-auto px-8 py-8">
        <button type="button" onClick={onClose} className="text-xs text-text-muted hover:text-accent mb-4">
          ← Back
        </button>
        <h1 className="text-xl font-bold text-text-primary mb-6">Settings</h1>

        <label className="block mb-4">
          <span className="text-xs text-text-muted uppercase tracking-wide">OpenAI API key</span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="mt-1 w-full bg-bg-tertiary border border-border-DEFAULT rounded-lg px-3 py-2 text-sm"
          />
        </label>

        <label className="block mb-4">
          <span className="text-xs text-text-muted uppercase tracking-wide">Model</span>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mt-1 w-full bg-bg-tertiary border border-border-DEFAULT rounded-lg px-3 py-2 text-sm"
          />
        </label>

        <label className="block mb-6">
          <span className="text-xs text-text-muted uppercase tracking-wide">Vault folder</span>
          <input
            value={vaultPath}
            onChange={(e) => setVaultPath(e.target.value)}
            className="mt-1 w-full bg-bg-tertiary border border-border-DEFAULT rounded-lg px-3 py-2 text-sm font-mono text-xs"
          />
        </label>

        <button
          type="button"
          onClick={save}
          className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium"
        >
          Save
        </button>
      </div>
    </div>
  );
}
