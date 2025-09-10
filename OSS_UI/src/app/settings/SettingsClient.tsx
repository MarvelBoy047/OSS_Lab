// src/app/settings/SettingsClient.tsx
'use client';

import { useEffect, useState } from 'react';

type ProvidersMap = Record<
  string,
  Record<
    string,
    {
      name?: string;
      displayName?: string;
    }
  >
>;

export default function SettingsClient({ providers }: { providers: ProvidersMap }) {
  const [selectedChatModelProvider, setSelectedChatModelProvider] = useState<string>('');
  const [selectedChatModel, setSelectedChatModel] = useState<string>('');
  const [selectedEmbeddingModelProvider, setSelectedEmbeddingModelProvider] = useState<string>('');
  const [selectedEmbeddingModel, setSelectedEmbeddingModel] = useState<string>('');
  const [systemInstructions, setSystemInstructions] = useState<string>('');
  const [measureUnit, setMeasureUnit] = useState<'Imperial' | 'Metric'>('Metric');
  const [autoImg, setAutoImg] = useState(false);
  const [autoVid, setAutoVid] = useState(false);

  useEffect(() => {
    const savedProv = localStorage.getItem('chatModelProvider') || '';
    const savedModel = localStorage.getItem('chatModel') || '';
    const savedEmbProv = localStorage.getItem('embeddingModelProvider') || '';
    const savedEmb = localStorage.getItem('embeddingModel') || '';
    setSelectedChatModelProvider(savedProv);
    setSelectedChatModel(savedModel);
    setSelectedEmbeddingModelProvider(savedEmbProv);
    setSelectedEmbeddingModel(savedEmb);
    setSystemInstructions(localStorage.getItem('systemInstructions') || '');
    setMeasureUnit((localStorage.getItem('measureUnit') as any) || 'Metric');
    setAutoImg(localStorage.getItem('autoImageSearch') === 'true');
    setAutoVid(localStorage.getItem('autoVideoSearch') === 'true');
  }, []);

  const chatProviderKeys = Object.keys(providers || {});
  const chatModels = selectedChatModelProvider
    ? Object.keys(providers[selectedChatModelProvider] || {})
    : [];

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-medium mb-4">Settings</h1>

      {/* Preferences */}
      <div className="mb-6 space-y-3">
        <label className="block text-sm">Measurement Units</label>
        <select
          className="border rounded p-2"
          value={measureUnit}
          onChange={(e) => {
            const v = e.target.value as 'Imperial' | 'Metric';
            setMeasureUnit(v);
            localStorage.setItem('measureUnit', v);
          }}
        >
          <option value="Metric">Metric</option>
          <option value="Imperial">Imperial</option>
        </select>

        <div className="flex items-center gap-3">
          <label className="text-sm">Automatic Image Search</label>
          <input
            type="checkbox"
            checked={autoImg}
            onChange={(e) => {
              setAutoImg(e.target.checked);
              localStorage.setItem('autoImageSearch', String(e.target.checked));
            }}
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm">Automatic Video Search</label>
          <input
            type="checkbox"
            checked={autoVid}
            onChange={(e) => {
              setAutoVid(e.target.checked);
              localStorage.setItem('autoVideoSearch', String(e.target.checked));
            }}
          />
        </div>
      </div>

      {/* System Instructions */}
      <div className="mb-6">
        <label className="block text-sm mb-1">System Instructions</label>
        <textarea
          className="w-full border rounded p-2"
          rows={4}
          value={systemInstructions}
          onChange={(e) => setSystemInstructions(e.target.value)}
          onBlur={() => localStorage.setItem('systemInstructions', systemInstructions)}
        />
      </div>

      {/* Chat Model */}
      <div className="mb-6 space-y-3">
        <label className="block text-sm">Chat Model Provider</label>
        <select
          className="border rounded p-2 w-full"
          value={selectedChatModelProvider}
          onChange={(e) => {
            const provider = e.target.value; // string
            setSelectedChatModelProvider(provider); // string
            const available = Object.keys(providers?.[provider] || {}); // string[]
            const first = available.length > 0 ? available[0] : ''; // pick first model key or '' (string)
            setSelectedChatModel(first); // string
            localStorage.setItem('chatModelProvider', provider); // string
            localStorage.setItem('chatModel', first); // string
          }}
        >
          <option value="">Select provider</option>
          {chatProviderKeys.map((k) => (
            <option key={k} value={k}>
              {k.charAt(0).toUpperCase() + k.slice(1)}
            </option>
          ))}
        </select>

        <label className="block text-sm">Chat Model</label>
        <select
          className="border rounded p-2 w-full"
          value={selectedChatModel}
          onChange={(e) => {
            const v = e.target.value; // string
            setSelectedChatModel(v); // string
            localStorage.setItem('chatModel', v); // string
          }}
          disabled={!selectedChatModelProvider}
        >
          <option value="">Select model</option>
          {chatModels.map((m) => (
            <option key={m} value={m}>
              {providers[selectedChatModelProvider]?.[m]?.displayName || m}
            </option>
          ))}
        </select>
      </div>

      {/* Embedding Model (localStorage only) */}
      <div className="mb-6 space-y-3">
        <label className="block text-sm">Embedding Model Provider</label>
        <input
          className="border rounded p-2 w-full"
          placeholder="e.g., openai, ollama"
          value={selectedEmbeddingModelProvider}
          onChange={(e) => {
            setSelectedEmbeddingModelProvider(e.target.value);
            localStorage.setItem('embeddingModelProvider', e.target.value);
          }}
        />
        <label className="block text-sm">Embedding Model</label>
        <input
          className="border rounded p-2 w-full"
          placeholder="e.g., text-embedding-3-large"
          value={selectedEmbeddingModel}
          onChange={(e) => {
            setSelectedEmbeddingModel(e.target.value);
            localStorage.setItem('embeddingModel', e.target.value);
          }}
        />
      </div>

      <button
        className="bg-blue-600 text-white px-4 py-2 rounded"
        onClick={async () => {
          await fetch('/api/agent-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              providerKey: selectedChatModelProvider,
              modelKey: selectedChatModel,
              scope: 'all',
            }),
          });
          alert('Saved');
        }}
        disabled={!selectedChatModelProvider || !selectedChatModel}
      >
        Save
      </button>
    </div>
  );
}
