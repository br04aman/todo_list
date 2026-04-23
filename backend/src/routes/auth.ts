import { Router } from 'express';
import passport from 'passport';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/db';
import { generateTokens, AuthRequest, authenticateJWT } from '../middleware/auth';
import { z } from 'zod';
import { setCache, invalidateCache } from '../lib/redis';
import { encrypt, decrypt } from '../lib/crypto';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';

const router = Router();
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');


const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  mfaToken: z.string().optional(),
});

// ——— Email/Password Registration ———
router.post('/register', async (req: any, res: any) => {
  try {
    const { email, password } = registerSchema.parse(req.body);
    
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

    const tokens = generateTokens(user);

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    
    res.json({
      accessToken: tokens.accessToken,
      user: {
        id: user.id,
        email: user.email,
        isPremium: user.isPremium,
        mfaEnabled: user.mfaEnabled,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('[Auth] Register error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ——— Email/Password Login ———
router.post('/login', async (req: any, res: any) => {
  try {
    const { email, password, mfaToken } = loginSchema.parse(req.body);
    
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // MFA check
    if (user.mfaEnabled) {
      if (!mfaToken) {
        // Tell client MFA is required
        return res.json({ requireMfa: true, userId: user.id });
      }
      // Verify MFA token
      if (!user.mfaSecret) {
        return res.status(500).json({ error: 'MFA configuration error' });
      }
      const secret = decrypt(user.mfaSecret);
      const isValidMfa = authenticator.verify({ token: mfaToken, secret });
      if (!isValidMfa) {
        return res.status(401).json({ error: 'Invalid MFA code' });
      }
    }

    const tokens = generateTokens(user);
    
    // Cache session in Redis
    await setCache(`session:${user.id}`, { token: tokens.accessToken }, 7 * 24 * 60 * 60);

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      accessToken: tokens.accessToken,
      user: {
        id: user.id,
        email: user.email,
        isPremium: user.isPremium,
        mfaEnabled: user.mfaEnabled,
      },
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ——— Token Refresh ———
router.post('/refresh', async (req: any, res: any) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token' });
  }

  try {
    const jwt = await import('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-development-only';
    const payload = jwt.default.verify(refreshToken, JWT_SECRET) as { id: string };

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const tokens = generateTokens(user);

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ accessToken: tokens.accessToken });
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// ——— Get Current User Profile ———
router.get('/me', authenticateJWT, async (req: any, res: any) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      isPremium: true,
      mfaEnabled: true,
      oauthProvider: true,
      createdAt: true,
    },
  });

  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// ——— Logout ———
router.post('/logout', authenticateJWT, async (req: any, res: any) => {
  if (req.user) {
    await invalidateCache(`session:${req.user.id}`);
  }
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out' });
});

// ——— MFA Setup ——— (ChaCha20 encrypted secret storage)
router.post('/mfa/setup', authenticateJWT, async (req: any, res: any) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.mfaEnabled) return res.status(400).json({ error: 'MFA already enabled' });

  const secret = authenticator.generateSecret();
  // Encrypt secret with ChaCha20-Poly1305 before storing
  const encryptedSecret = encrypt(secret);

  await prisma.user.update({
    where: { id: user.id },
    data: { mfaSecret: encryptedSecret },
  });

  const otpauth = authenticator.keyuri(user.email, 'EnterpriseTodo', secret);
  const qrCodeUrl = await qrcode.toDataURL(otpauth);

  res.json({ qrCodeUrl, secret });
});

// ——— MFA Verify (Enable) ———
router.post('/mfa/verify', authenticateJWT, async (req: any, res: any) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { token } = req.body;
  
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user || !user.mfaSecret) return res.status(400).json({ error: 'MFA not set up' });

  // Decrypt secret from DB
  const secret = decrypt(user.mfaSecret);
  
  const isValid = authenticator.verify({ token, secret });
  if (!isValid) return res.status(400).json({ error: 'Invalid MFA code' });

  await prisma.user.update({
    where: { id: user.id },
    data: { mfaEnabled: true },
  });

  res.json({ message: 'MFA enabled successfully' });
});

// ——— MFA Disable ———
router.post('/mfa/disable', authenticateJWT, async (req: any, res: any) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { token } = req.body;

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user || !user.mfaEnabled || !user.mfaSecret) {
    return res.status(400).json({ error: 'MFA is not enabled' });
  }

  const secret = decrypt(user.mfaSecret);
  const isValid = authenticator.verify({ token, secret });
  if (!isValid) return res.status(400).json({ error: 'Invalid MFA code' });

  await prisma.user.update({
    where: { id: user.id },
    data: { mfaEnabled: false, mfaSecret: null },
  });

  res.json({ message: 'MFA disabled successfully' });
});

// ——— Google OAuth Routes ———
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: `${FRONTEND_URL}/auth?error=oauth_failed`, session: false }),
  async (req: any, res: any) => {
    const user = req.user as any;
    const tokens = generateTokens(user);
    await setCache(`session:${user.id}`, { token: tokens.accessToken }, 7 * 24 * 60 * 60);
    // Redirect to frontend with token in URL param (frontend will extract and store it)
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`);
  }
);

// ——— GitHub OAuth Routes ———
router.get('/github', passport.authenticate('github', { scope: ['user:email'], session: false }));

router.get(
  '/github/callback',
  passport.authenticate('github', { failureRedirect: `${FRONTEND_URL}/auth?error=oauth_failed`, session: false }),
  async (req: any, res: any) => {
    const user = req.user as any;
    const tokens = generateTokens(user);
    await setCache(`session:${user.id}`, { token: tokens.accessToken }, 7 * 24 * 60 * 60);
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`);
  }
);

export default router;
