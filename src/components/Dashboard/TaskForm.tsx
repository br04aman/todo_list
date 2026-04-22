'use client';

import { useState } from 'react';
import { Task } from '@/components/Dashboard/TaskItem';

interface TaskFormProps {
  onAdd: (text: string) => Promise<void>;
}

export default function TaskForm({ onAdd }: TaskFormProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || loading) return;

    try {
      setLoading(true);
      await onAdd(text.trim());
      setText('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="input-group animate-fade-in">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What do you need to get done today?"
        className="input-main"
        disabled={loading}
        autoFocus
      />
      <button 
        type="submit" 
        className="btn btn-primary"
        disabled={!text.trim() || loading}
      >
        {loading ? (
          <span className="spinner">...</span>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        )}
      </button>
    </form>
  );
}
