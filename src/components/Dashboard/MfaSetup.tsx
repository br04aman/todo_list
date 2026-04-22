'use client';

import { useState } from 'react';
import { Shield, X, Copy, Check } from 'lucide-react';
import { setupMfa, verifyMfa, disableMfa } from '@/lib/api';
import Image from 'next/image';

interface MfaSetupProps {
  isOpen: boolean;
  onClose: () => void;
  onEnabled: () => void;
}

export default function MfaSetup({ isOpen, onClose, onEnabled }: MfaSetupProps) {
  const [step, setStep] = useState<'info' | 'setup' | 'verify' | 'disable'>('info');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleStartSetup = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await setupMfa();
      setQrCode(data.qrCodeUrl || data.qrCode);
      setSecret(data.secret);
      setStep('setup');
    } catch (err: any) {
      setError(err.message || 'Failed to initialize MFA');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      await verifyMfa(token);
      onEnabled();
      setStep('info'); // Reset for next time
      onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid token');
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{position: 'relative', overflow: 'hidden', padding: 0}}>
        
        {/* Banner */}
        <div style={{background: 'var(--surface-hover)', padding: '2rem', textAlign: 'center', borderBottom: '1px solid var(--surface-border)'}}>
          <button onClick={onClose} style={{position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'var(--surface)', border: '1px solid var(--surface-border)', borderRadius: '50%', padding: '6px', cursor: 'pointer', display: 'grid', placeContent: 'center'}}>
            <X size={18} className="text-muted" />
          </button>
          <div style={{background: 'white', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: 'var(--shadow-md)'}}>
            <Shield size={32} color="#10b981" />
          </div>
          <h2 style={{fontSize: '1.5rem', fontWeight: 800, color: 'var(--foreground)'}}>Two-Factor Authentication</h2>
          <p className="subtitle" style={{marginTop: '0.25rem'}}>Secure your account with ChaCha20 encrypted TOTP</p>
        </div>

        {/* Content */}
        <div style={{padding: '2rem'}}>
          {error && (
            <div style={{background: '#fef2f2', border: '1px solid var(--error)', padding: '0.75rem', borderRadius: '12px', marginBottom: '1.5rem'}}>
              <p style={{color: 'var(--error)', fontSize: '0.85rem', textAlign: 'center', fontWeight: 500}}>{error}</p>
            </div>
          )}

          {step === 'info' && (
            <div style={{textAlign: 'center'}}>
              <p style={{marginBottom: '2rem', color: 'var(--text-muted)', lineHeight: 1.6, fontSize: '0.95rem'}}>
                Protect your Todo List against unauthorized access by requiring a second authentication method in addition to your password.
              </p>
              <button 
                onClick={handleStartSetup} 
                disabled={loading}
                className="btn btn-primary"
                style={{width: '100%'}}
              >
                {loading ? 'Initializing...' : 'Set Up MFA'}
              </button>
            </div>
          )}

          {step === 'setup' && (
            <div>
              <p className="subtitle" style={{textAlign: 'center', marginBottom: '1.5rem'}}>
                Scan this QR code with an authenticator app (like Google Authenticator or Authy).
              </p>
              
              <div style={{background: 'white', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'inline-block', margin: '0 auto 1.5rem', border: '1px solid var(--surface-border)', width: '100%', textAlign: 'center'}}>
                {qrCode && <Image src={qrCode} alt="MFA QR Code" width={180} height={180} style={{margin: '0 auto', display: 'block'}} />}
              </div>
              
              <div style={{background: 'var(--surface-hover)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem'}}>
                <code style={{fontSize: '0.85rem', color: 'var(--foreground)', fontWeight: 600, letterSpacing: '1px'}}>{secret}</code>
                <button onClick={copySecret} style={{background: 'white', border: '1px solid var(--surface-border)', borderRadius: '6px', padding: '0.25rem 0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--foreground)'}}>
                  {copied ? <><Check size={12} color="var(--success)"/> Copied</> : <><Copy size={12}/> Copy</>}
                </button>
              </div>

              <button 
                onClick={() => setStep('verify')}
                className="btn btn-primary"
                style={{width: '100%'}}
              >
                Next Step
              </button>
            </div>
          )}

          {step === 'verify' && (
            <form onSubmit={handleVerify}>
              <p className="subtitle" style={{textAlign: 'center', marginBottom: '1.5rem'}}>
                Enter the 6-digit code from your authenticator app to verify setup.
              </p>
              
              <div style={{marginBottom: '2rem'}}>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="input-main"
                  maxLength={6}
                  style={{textAlign: 'center', letterSpacing: '0.5rem', fontSize: '1.5rem', fontWeight: 800}}
                  autoFocus
                />
              </div>

              <div style={{display: 'flex', gap: '1rem'}}>
                <button 
                  type="button" 
                  onClick={() => setStep('setup')} 
                  className="btn btn-secondary"
                  style={{flex: 1}}
                >
                  Back
                </button>
                <button 
                  type="submit" 
                  disabled={loading || token.length !== 6}
                  className="btn btn-primary"
                  style={{flex: 2}}
                >
                  {loading ? 'Verifying...' : 'Verify & Enable'}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
