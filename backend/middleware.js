// General middleware for API routes
import { createClient } from '@supabase/supabase-js';

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.substring(7);
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    req.supabase = supabase;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

export const checkChatLimit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const supabase = req.supabase;

    // 1. Get user's subscription
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('plan_id, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    // 2. If Pro/Family plan, allow unlimited chat
    if (subscription && (subscription.plan_id === 'premium' || subscription.plan_id === 'family')) {
      return next();
    }

    // 3. Count messages in the last 24 hours
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    // Get all session IDs for this user
    const { data: sessions } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('user_id', userId);

    if (!sessions || sessions.length === 0) {
      return next();
    }

    const sessionIds = sessions.map(s => s.id);

    // Count user messages within those sessions from the last 24 hours
    const { count, error } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .in('session_id', sessionIds)
      .eq('role', 'user')
      .gt('created_at', yesterday.toISOString());

    if (error) {
      console.warn('Error counting messages:', error.message);
      return next(); // Fail open if we can't count
    }

    // Set limit to 5 messages per 24 hours for free users
    if (count >= 5) {
      return res.status(403).json({
        error: 'limit_reached',
        message: 'You have reached your daily limit of 5 AI messages. Upgrade to Pro for unlimited consultations.',
        limit: 5,
        current: count
      });
    }

    next();
  } catch (error) {
    console.error('Chat limit middleware error:', error);
    next(); // Fail open to avoid blocking users on server errors
  }
};