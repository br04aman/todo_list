import { Router } from 'express';
import { prisma } from '../lib/db';
import { AuthRequest, authenticateJWT } from '../middleware/auth';
import { encrypt, decrypt } from '../lib/crypto';
import {
  getCache, setCache, invalidatePattern,
  indexTask, removeTaskIndex, clearTaskIndex,
} from '../lib/redis';
import { z } from 'zod';

const router = Router();
router.use(authenticateJWT);

const taskSchema = z.object({
  text: z.string().min(1).max(500),
});

// GET all tasks (with Redis caching + ChaCha20 decryption)
router.get('/', async (req: any, res: any) => {
  const userId = req.user!.id;
  const cacheKey = `tasks:${userId}`;

  // 1. Try Redis Cache
  const cached = await getCache<any[]>(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  // 2. Fetch from DB
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { tasks: { orderBy: { createdAt: 'desc' } } }
  });

  if (!user) return res.status(404).json({ error: 'User not found' });

  // 3. Decrypt Task Text
  const decryptedTasks = user.tasks.map((task: any) => {
    try {
      return {
        ...task,
        text: decrypt(task.text)
      };
    } catch {
      return { ...task, text: '[Decryption failed]' };
    }
  });

  // 4. Set Cache
  await setCache(cacheKey, decryptedTasks);

  res.json(decryptedTasks);
});

// POST new task (Encrypts text with ChaCha20 before writing to DB)
router.post('/', async (req: any, res: any) => {
  try {
    const { text } = taskSchema.parse(req.body);
    const userId = req.user!.id;

    // Check Premium limit (free users max 5 tasks)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { _count: { select: { tasks: true } } }
    });

    if (!user?.isPremium && user?._count.tasks! >= 5) {
      return res.status(403).json({
        error: 'Free tier limit reached (5 tasks). Upgrade to Premium for unlimited tasks!',
        code: 'PREMIUM_REQUIRED',
      });
    }

    // Encrypt text with ChaCha20-Poly1305
    const encryptedText = encrypt(text);

    const task = await prisma.task.create({
      data: {
        text: encryptedText,
        userId: userId,
      }
    });

    // Update Redis index
    await indexTask(userId, task.id, task.createdAt);

    // Invalidate task list cache
    await invalidatePattern(`tasks:${userId}`);

    // Return decrypted version to client
    res.json({ ...task, text });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('[Tasks] Create error:', error);
    res.status(400).json({ error: 'Invalid input' });
  }
});

// PUT toggle task completion status
router.put('/:id', async (req: any, res: any) => {
  const { completed } = req.body;
  const userId = req.user!.id;

  const task = await prisma.task.findFirst({ where: { id: req.params.id, userId } });
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const updated = await prisma.task.update({
    where: { id: task.id },
    data: { 
      completed,
      completedAt: completed ? new Date() : null 
    }
  });

  await invalidatePattern(`tasks:${userId}`);
  res.json({ ...updated, text: decrypt(updated.text) });
});

// PUT update task text (re-encrypt)
router.put('/:id/text', async (req: any, res: any) => {
  try {
    const { text } = taskSchema.parse(req.body);
    const userId = req.user!.id;

    const task = await prisma.task.findFirst({ where: { id: req.params.id, userId } });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Re-encrypt with new nonce
    const encryptedText = encrypt(text);

    const updated = await prisma.task.update({
      where: { id: task.id },
      data: { text: encryptedText },
    });

    await invalidatePattern(`tasks:${userId}`);
    res.json({ ...updated, text });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(400).json({ error: 'Invalid input' });
  }
});

// DELETE single task
router.delete('/:id', async (req: any, res: any) => {
  const userId = req.user!.id;

  const task = await prisma.task.findFirst({ where: { id: req.params.id, userId } });
  if (!task) return res.status(404).json({ error: 'Task not found' });

  await prisma.task.delete({ where: { id: task.id } });

  // Remove from Redis index
  await removeTaskIndex(userId, task.id);
  await invalidatePattern(`tasks:${userId}`);

  res.json({ message: 'Task deleted' });
});

// DELETE clear all tasks
router.delete('/', async (req: any, res: any) => {
  const userId = req.user!.id;
  const { completed } = req.query; // ?completed=true to clear only completed

  if (completed === 'true') {
    await prisma.task.deleteMany({ where: { userId, completed: true } });
  } else {
    await prisma.task.deleteMany({ where: { userId } });
  }

  // Clear Redis index + cache
  await clearTaskIndex(userId);
  await invalidatePattern(`tasks:${userId}`);

  res.json({ message: completed === 'true' ? 'Completed tasks cleared' : 'All tasks cleared' });
});

export default router;
