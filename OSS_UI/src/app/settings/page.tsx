'use client';

import { Settings as SettingsIcon, ArrowLeft, Loader2, Save, Palette, Globe, Cpu, Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import ThemeSwitcher from '@/components/theme/Switcher';
import Link from 'next/link';

const Page = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form states
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [systemInstructions, setSystemInstructions] = useState('');
  const [measureUnit, setMeasureUnit] = useState<'Imperial' | 'Metric'>('Metric');
  const [automaticImageSearch, setAutomaticImageSearch] = useState(true);
  const [automaticVideoSearch, setAutomaticVideoSearch] = useState(false);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        
        const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';
        const res = await fetch(`${API_BASE}/api/settings`);
        if (res.ok) {
          const data = await res.json();
          setApiKey(data.api_key || '');
        }
        
        setSystemInstructions(localStorage.getItem('systemInstructions') || '');
        setMeasureUnit((localStorage.getItem('measureUnit') as 'Imperial' | 'Metric') || 'Metric');
        setAutomaticImageSearch(localStorage.getItem('autoImageSearch') !== 'false');
        setAutomaticVideoSearch(localStorage.getItem('autoVideoSearch') === 'true');
        
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSettings();
  }, []);

  const saveSettings = async () => {
    if (!apiKey.trim()) {
      alert('Please enter a valid API key');
      return;
    }

    setSaving(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${API_BASE}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey })
      });

      if (!res.ok) {
        throw new Error('Failed to save API key');
      }

      localStorage.setItem('systemInstructions', systemInstructions);
      localStorage.setItem('measureUnit', measureUnit);
      localStorage.setItem('autoImageSearch', String(automaticImageSearch));
      localStorage.setItem('autoVideoSearch', String(automaticVideoSearch));

      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const CustomToggle = ({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) => (
    <div 
      className={cn('settings-toggle', checked && 'active')}
      onClick={() => onChange(!checked)}
    />
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--bg-primary)]">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--cyan-accent)]" />
          <span className="text-[var(--text-secondary)]">Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    // FIX: Changed min-h-screen to h-full to fill the parent layout, allowing overflow-y-auto to work correctly.
    <div className="h-full overflow-y-auto bg-[var(--bg-primary)]">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/" className="lg:hidden">
            <ArrowLeft className="text-[var(--text-secondary)]" />
          </Link>
          <div className="flex items-center gap-3">
            <SettingsIcon size={32} className="text-[var(--text-primary)]" />
            <h1 className="text-4xl font-bold premium-white">Settings</h1>
          </div>
        </div>

        <div className="space-y-8 pb-8">
          {/* Appearance Section */}
          <div className="settings-card">
            <div className="flex items-center gap-3 mb-6">
              <Palette size={24} className="text-[var(--cyan-accent)]" />
              <h2 className="section-title">Appearance</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="field-label">Theme</label>
                <ThemeSwitcher />
                <p className="field-description">Switch between light and dark modes</p>
              </div>
              
              <div>
                <label className="field-label">Measurement Units</label>
                <select
                  value={measureUnit}
                  onChange={(e) => setMeasureUnit(e.target.value as 'Imperial' | 'Metric')}
                  className="settings-select"
                >
                  <option value="Metric">Metric</option>
                  <option value="Imperial">Imperial</option>
                </select>
                <p className="field-description">Units for weather and measurements</p>
              </div>
            </div>
          </div>

          {/* AI Features Section */}
          <div className="settings-card">
            <div className="flex items-center gap-3 mb-6">
              <Globe size={24} className="text-[var(--cyan-accent)]" />
              <h2 className="section-title">AI Features</h2>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--bg-tertiary)]">
                <div>
                  <h3 className="font-medium text-[var(--text-primary)]">Automatic Image Search</h3>
                  <p className="field-description">Automatically search for relevant images in chat responses</p>
                </div>
                <CustomToggle checked={automaticImageSearch} onChange={setAutomaticImageSearch} />
              </div>
              
              <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--bg-tertiary)]">
                <div>
                  <h3 className="font-medium text-[var(--text-primary)]">Automatic Video Search</h3>
                  <p className="field-description">Automatically search for relevant videos in chat responses</p>
                </div>
                <CustomToggle checked={automaticVideoSearch} onChange={setAutomaticVideoSearch} />
              </div>
            </div>
          </div>

          {/* Model Configuration Section */}
          <div className="settings-card">
            <div className="flex items-center gap-3 mb-6">
              <Cpu size={24} className="text-[var(--cyan-accent)]" />
              <h2 className="section-title">Model Configuration</h2>
            </div>
            
            <div className="space-y-6">
              {/* API Key Input with Show/Hide Toggle */}
              <div>
                <label htmlFor="apiKey" className="field-label">Groq API Key</label>
                <div className="relative">
                  <input
                    id="apiKey"
                    name="apiKey"
                    type={showApiKey ? 'text' : 'password'}
                    className="settings-input pr-16 font-mono text-sm"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="gsk_..."
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute inset-y-0 right-0 px-4 flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    title={showApiKey ? 'Hide API key' : 'Show API key'}
                  >
                    {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="field-description">Your Groq API key for accessing AI models</p>
              </div>

              {/* Locked Provider Dropdown */}
              <div className="opacity-50 pointer-events-none">
                <label htmlFor="provider" className="field-label text-[var(--text-muted)]">Chat Model Provider</label>
                <select
                  id="provider"
                  name="provider"
                  className="settings-select bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed"
                  disabled
                  value="Groq"
                >
                  <option>Groq</option>
                  <option>OpenAI</option>
                  <option>Anthropic</option>
                  <option>Other</option>
                </select>
                <p className="field-description">Provider is locked to Groq for optimal performance</p>
              </div>

              {/* Locked Model Dropdown */}
              <div className="opacity-50 pointer-events-none">
                <label htmlFor="model" className="field-label text-[var(--text-muted)]">Chat Model</label>
                <select
                  id="model"
                  name="model"
                  className="settings-select bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed"
                  disabled
                  value="openai/gpt-oss-120b"
                >
                  <option>openai/gpt-oss-120b</option>
                  <option>llama-3.2-120b</option>
                  <option>openai/gpt-4o</option>
                </select>
                <p className="field-description">Model is locked for consistent performance</p>
              </div>

              {/* System Instructions */}
              <div>
                <label htmlFor="systemInstructions" className="field-label">System Instructions</label>
                <textarea
                  id="systemInstructions"
                  name="systemInstructions"
                  value={systemInstructions}
                  onChange={(e) => setSystemInstructions(e.target.value)}
                  className="settings-textarea"
                  placeholder="Any special instructions for the AI assistant..."
                  rows={4}
                />
                <p className="field-description">Custom instructions that will be applied to all conversations</p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={saveSettings}
              disabled={saving || !apiKey.trim()}
              className={cn(
                "settings-button flex items-center gap-2",
                (saving || !apiKey.trim()) && "opacity-75 cursor-not-allowed"
              )}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Page;