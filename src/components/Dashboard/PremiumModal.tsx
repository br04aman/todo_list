'use client';

import { useState } from 'react';
import { Crown, Check, X, Shield, Zap } from 'lucide-react';
import { createPaymentOrder, verifyPayment } from '@/lib/api';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgraded: () => void;
  userEmail: string;
}

export default function PremiumModal({ isOpen, onClose, onUpgraded, userEmail }: PremiumModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleUpgrade = async () => {
    try {
      setLoading(true);
      setError('');

      const order = await createPaymentOrder();

      const rzpKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';

      if (!rzpKey) {
        throw new Error('Razorpay Key ID is not configured. Please add NEXT_PUBLIC_RAZORPAY_KEY_ID to your environment.');
      }

      const options = {
        key: rzpKey,
        amount: order.amount,
        currency: order.currency,
        name: 'Enterprise Todo',
        description: 'Lifetime Premium Upgrade',
        order_id: order.orderId,
        handler: async function (response: any) {
          try {
            await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            onUpgraded();
            onClose();
          } catch (err: any) {
            setError(err.error || err.message || 'Payment verification failed');
          }
        },
        prefill: { email: userEmail },
        theme: { color: '#3b82f6' }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        setError(response.error.description || 'Payment failed');
      });
      rzp.open();
    } catch (err: any) {
      setError(err.error || err.message || 'Failed to initialize payment gateway');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: <Check size={18} className="text-success" />, text: 'Unlimited tasks (Bypass 5 limit)' },
    { icon: <Shield size={18} color="#3b82f6" />, text: 'Enterprise ChaCha20 encryption' },
    { icon: <Zap size={18} color="#f59e0b" />, text: 'Redis-cached rapid performance' },
    { icon: <Crown size={18} color="#ec4899" />, text: 'Priority customer support' },
  ];

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ position: 'relative', overflow: 'hidden', maxWidth: '420px', padding: 0 }}>

        {/* Banner */}
        <div style={{ background: 'linear-gradient(135deg, var(--primary), #4f46e5)', padding: '2rem', textAlign: 'center', color: 'white' }}>
          <button onClick={onClose} style={{ position: 'absolute', right: '1rem', top: '1rem', background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '50%', padding: '4px', cursor: 'pointer' }}>
            <X size={20} />
          </button>
          <Crown size={48} style={{ margin: '0 auto 1rem', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.2))' }} color="#fbbf24" />
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>Upgrade to Premium</h2>
          <p style={{ opacity: 0.9, marginTop: '0.25rem', fontSize: '0.95rem' }}>Unlock the full power of Enterprise Todo</p>
        </div>

        {/* Content */}
        <div style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--foreground)', marginBottom: '1.5rem', textAlign: 'center' }}>
            ₹49<span className="subtitle" style={{ fontSize: '1rem' }}>/lifetime</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
            {features.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.95rem', fontWeight: 500 }}>
                {f.icon} {f.text}
              </div>
            ))}
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid var(--error)', padding: '0.75rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
              <p style={{ color: 'var(--error)', fontSize: '0.85rem', textAlign: 'center', fontWeight: 500 }}>{error}</p>
            </div>
          )}

          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', fontSize: '1rem', padding: '1rem' }}
          >
            {loading ? 'Processing...' : 'Upgrade Now'}
          </button>

          <p className="subtitle" style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.8rem' }}>
            Powered by Razorpay &bull; Test Mode
          </p>
        </div>

      </div>
    </div>
  );
}
