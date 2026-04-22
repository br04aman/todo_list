'use client';

import { useState } from 'react';
import { Task } from './TaskItem';

interface EditTaskModalProps {
  task: Task | null;
  onClose: () => void;
  onSave: (id: string, text: string) => Promise<void>;
}

export default function EditTaskModal({ task, onClose, onSave }: EditTaskModalProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  // Initialize text when task changes
  useState(() => {
    if (task) setText(task.text);
  });

  if (!task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || loading) return;

    try {
      setLoading(true);
      await onSave(task.id, text.trim());
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content">
        <h2 className="title" style={{fontSize: '1.5rem'}}>Edit Task</h2>
        <p className="subtitle mb-8">Update the details of your task.</p>
        
        <form onSubmit={handleSubmit}>
          <div className="input-group" style={{marginBottom: '1.5rem'}}>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="input-main"
              disabled={loading}
              autoFocus
            />
          </div>
          
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!text.trim() || loading}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
