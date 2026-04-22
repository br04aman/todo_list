import { Router } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { prisma } from '../lib/db';
import { AuthRequest, authenticateJWT } from '../middleware/auth';
import { invalidateCache } from '../lib/redis';

const router = Router();
router.use(authenticateJWT);

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const PREMIUM_AMOUNT = 49900; // ₹499 in paise

let razorpay: Razorpay | null = null;
if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });
  console.log('[Razorpay] Initialized (test mode)');
} else {
  console.warn('[Razorpay] Credentials not set — payment routes will fail');
}

// Create a Razorpay order
router.post('/create-order', async (req: any, res: any) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  if (!razorpay) return res.status(503).json({ error: 'Razorpay is not configured on the server. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to your environment variables.' });

  try {
    // Check if already premium
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user?.isPremium) {
      return res.status(400).json({ error: 'Already premium' });
    }

    const order = await razorpay.orders.create({
      amount: PREMIUM_AMOUNT,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}_${req.user.id.substring(0, 5)}`,
      notes: {
        userId: req.user.id,
        purpose: 'premium_upgrade',
      },
    });

    const orderId = order.id;

    // Record in DB
    await prisma.payment.create({
      data: {
        userId: req.user.id,
        razorpayOrderId: orderId,
        amount: PREMIUM_AMOUNT,
        currency: 'INR',
        status: 'created',
      },
    });

    res.json({
      orderId: orderId,
      amount: PREMIUM_AMOUNT,
      currency: 'INR',
      keyId: RAZORPAY_KEY_ID,
    });
  } catch (error: any) {
    console.error('[Payments] Create order error:', error);
    res.status(500).json({ error: 'Failed to create Razorpay order' });
  }
});

// Verify payment after Razorpay checkout
router.post('/verify', async (req: any, res: any) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment verification data' });
  }

  if (!RAZORPAY_KEY_SECRET) {
    return res.status(503).json({ error: 'Razorpay is not configured on the server.' });
  }

  try {
    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      // Mark payment as failed
      await prisma.payment.updateMany({
        where: { razorpayOrderId: razorpay_order_id },
        data: { status: 'failed' },
      });
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Success — update payment record + make user premium
    await prisma.payment.updateMany({
      where: { razorpayOrderId: razorpay_order_id },
      data: {
        razorpayPaymentId: razorpay_payment_id,
        status: 'paid',
      },
    });

    await prisma.user.update({
      where: { id: req.user.id },
      data: { isPremium: true },
    });

    // Invalidate cached user session
    await invalidateCache(`session:${req.user.id}`);

    res.json({ success: true, message: 'Payment verified. You are now Premium!' });
  } catch (error: any) {
    console.error('[Payments] Verify error:', error);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

// Get premium status
router.get('/status', async (req: any, res: any) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { isPremium: true },
  });

  res.json({ isPremium: user?.isPremium || false });
});

export default router;
