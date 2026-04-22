'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Trash, CheckSquare, Loader2, Crown, Shield, Settings } from 'lucide-react';
import TaskForm from '@/components/Dashboard/TaskForm';
import TaskList from '@/components/Dashboard/TaskList';
import EditTaskModal from '@/components/Dashboard/EditTaskModal';
import PremiumModal from '@/components/Dashboard/PremiumModal';
import MfaSetup from '@/components/Dashboard/MfaSetup';
import { Task } from '@/components/Dashboard/TaskItem';
import {
  isAuthenticated, getMe, logout,
  getTasks, createTask, toggleTask as apiToggleTask,
  updateTaskText, deleteTask as apiDeleteTask,
  clearAllTasks, clearCompletedTasks,
} from '@/lib/api';

interface UserProfile {
  id: string;
  email: string;
  isPremium: boolean;
  mfaEnabled: boolean;
  oauthProvider: string | null;
}

export default function DashboardContent() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showPremium, setShowPremium] = useState(false);
  const [showMfa, setShowMfa] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const data = await getTasks();
      // Map backend format to frontend Task interface
      setTasks(data.map((t: any) => ({
        id: t.id,
        text: t.text,
        completed: t.completed,
        created_at: t.createdAt,
        completed_at: t.completedAt,
      })));
    } catch (err) {
      console.error('Error fetching tasks:', err);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      if (!isAuthenticated()) {
        router.push('/login');
        return;
      }
      try {
        const { user: profile } = await getMe();
        setUser(profile);
        await fetchTasks();
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router, fetchTasks]);

  const handleSignOut = async () => {
    await logout();
    router.push('/login');
  };

  const addTask = async (text: string) => {
    try {
      const task = await createTask(text);
      setTasks([{
        id: task.id,
        text: task.text,
        completed: task.completed,
        created_at: task.createdAt,
        completed_at: task.completedAt,
      }, ...tasks]);
    } catch (err: any) {
      if (err.code === 'PREMIUM_REQUIRED') {
        setShowPremium(true);
      } else {
        console.error('Error adding task:', err);
      }
      throw err;
    }
  };

  const handleToggleTask = async (id: string, completed: boolean) => {
    try {
      await apiToggleTask(id, !completed);
      setTasks(tasks.map(t => t.id === id
        ? { ...t, completed: !completed, completed_at: !completed ? new Date().toISOString() : null }
        : t
      ));
    } catch (err) {
      console.error('Error toggling task:', err);
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await apiDeleteTask(id);
      setTasks(tasks.filter(t => t.id !== id));
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  const handleUpdateTask = async (id: string, newText: string) => {
    try {
      await updateTaskText(id, newText);
      setTasks(tasks.map(t => t.id === id ? { ...t, text: newText } : t));
    } catch (err) {
      console.error('Error updating task:', err);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear all tasks?')) return;
    try {
      await clearAllTasks();
      setTasks([]);
    } catch (err) {
      console.error('Error clearing tasks:', err);
    }
  };

  const handleClearCompleted = async () => {
    try {
      await clearCompletedTasks();
      setTasks(tasks.filter(t => !t.completed));
    } catch (err) {
      console.error('Error clearing completed:', err);
    }
  };

  if (loading) {
    return (
      <div className="auth-container">
        <Loader2 className="w-12 h-12 text-muted animate-spin" />
      </div>
    );
  }

  const completedCount = tasks.filter(t => t.completed).length;

  return (
    <div className="container">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 animate-fade-in">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="title">My Tasks</h1>
            {user?.isPremium && (
              <span className="premium-badge">
                <Crown size={14} /> PRO
              </span>
            )}
          </div>
          <p className="subtitle mt-1">
            {tasks.length > 0 
              ? `You have ${tasks.length} tasks and ${completedCount} are completed` 
              : 'Let\'s get productive today!'}
          </p>
          {!user?.isPremium && tasks.length >= 3 && (
            <p className="text-muted mt-4" style={{display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', color: '#f59e0b'}}>
              <Crown size={14} /> 
              {5 - tasks.length <= 0 
                ? 'Free limit reached!' 
                : `${5 - tasks.length} free tasks remaining`}
              <button 
                onClick={() => setShowPremium(true)} 
                style={{background: 'none', border: 'none', color: '#f59e0b', textDecoration: 'underline', cursor: 'pointer', fontWeight: 600, marginLeft: '4px'}}>
                Upgrade
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Account Profile Section */}
      <div className="card animate-fade-in mb-8 flex items-center justify-between" style={{padding: '1.5rem', borderLeft: '4px solid var(--primary)'}}>
        <div className="flex items-center gap-4">
          <div style={{width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), #4f46e5)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700}}>
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div>
            <h2 style={{fontSize: '1.25rem', fontWeight: 800, color: 'var(--foreground)'}}>
              {user?.email?.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'User'}
            </h2>
            <p className="text-muted" style={{fontSize: '0.9rem', marginBottom: '0.5rem'}}>{user?.email}</p>
            
            <div className="flex items-center gap-2">
              {user?.isPremium ? (
                <span style={{fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '12px', background: '#fef3c7', color: '#d97706', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px'}}><Crown size={12} /> Premium</span>
              ) : (
                <button onClick={() => setShowPremium(true)} style={{fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '12px', background: '#dbeafe', color: '#2563eb', border: 'none', cursor: 'pointer', fontWeight: 600}}>Upgrade to Premium</button>
              )}
              
              {user?.mfaEnabled ? (
                <span style={{fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '12px', background: '#d1fae5', color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px'}}><Shield size={12} /> MFA Secured</span>
              ) : (
                <button onClick={() => setShowMfa(true)} style={{fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '12px', background: '#f3f4f6', color: '#4b5563', border: 'none', cursor: 'pointer', fontWeight: 600}}>Setup MFA</button>
              )}
            </div>
          </div>
        </div>
        
        <button
          onClick={handleSignOut}
          className="btn btn-secondary flex items-center gap-2 transition-transform hover:scale-105"
          style={{padding: '0.6rem 1.25rem', borderColor: 'var(--error)', color: 'var(--error)', background: '#fef2f2'}}
        >
          <LogOut size={18} /> <span className="font-semibold">Logout</span>
        </button>
      </div>

      {/* Main Panel */}
      <div className="card animate-fade-in" style={{animationDelay: '0.1s'}}>
        <TaskForm onAdd={addTask} />

        {/* Action Bar */}
        {tasks.length > 0 && (
          <div className="flex gap-3 mb-4">
            <button onClick={handleClearAll} className="btn btn-secondary" style={{fontSize: '13px', padding: '0.5rem 1rem'}}>
              <Trash size={14} /> Clear All
            </button>
            <button 
              onClick={handleClearCompleted} 
              disabled={completedCount === 0}
              className="btn btn-secondary" 
              style={{fontSize: '13px', padding: '0.5rem 1rem', opacity: completedCount === 0 ? 0.5 : 1}}
            >
              <CheckSquare size={14} /> Clear Completed
            </button>
          </div>
        )}

        <TaskList
          tasks={tasks}
          onToggle={handleToggleTask}
          onDelete={handleDeleteTask}
          onEdit={setEditingTask}
        />
      </div>

      {/* Modals */}
      <EditTaskModal
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleUpdateTask}
      />

      <PremiumModal
        isOpen={showPremium}
        onClose={() => setShowPremium(false)}
        onUpgraded={() => {
          if (user) setUser({ ...user, isPremium: true });
        }}
        userEmail={user?.email || ''}
      />

      <MfaSetup
        isOpen={showMfa}
        onClose={() => setShowMfa(false)}
        onEnabled={() => {
          if (user) setUser({ ...user, mfaEnabled: true });
        }}
      />

      {/* Click outside to close settings */}
      {showSettings && (
        <div style={{position: 'fixed', inset: 0, zIndex: 40}} onClick={() => setShowSettings(false)} />
      )}

      <footer className="text-center mt-8 pt-8 border-t border-surface-border subtitle animate-fade-in" style={{animationDelay: '0.2s'}}>
        <p>Built with Next.js &amp; Express &bull; Encrypted &bull; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
