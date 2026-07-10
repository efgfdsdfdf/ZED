-- Subscription system tables for Paystack integration

-- User subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL, -- 'basic', 'premium', 'family'
  paystack_subscription_code TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'canceled', 'past_due'
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription attempts table (for tracking payment attempts)
CREATE TABLE IF NOT EXISTS subscription_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  paystack_reference TEXT UNIQUE NOT NULL,
  paystack_subscription_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription features access control
CREATE TABLE IF NOT EXISTS subscription_features (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id TEXT NOT NULL,
  feature_key TEXT NOT NULL, -- e.g., 'symptom_checker_unlimited', 'ai_chat_unlimited'
  feature_name TEXT NOT NULL,
  feature_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, feature_key)
);

-- Insert subscription features
INSERT INTO subscription_features (plan_id, feature_key, feature_name, feature_description) VALUES
-- Free tier (implicit)
('free', 'symptom_checker_basic', 'Basic Symptom Checker', '3 symptom checks per week'),
('free', 'ai_chat_limited', 'Limited AI Chat', '5 AI conversations per day'),
('free', 'vitals_basic', 'Basic Vitals Tracking', 'Manual vitals entry'),

-- Basic plan
('basic', 'symptom_checker_basic', 'Basic Symptom Checker', '3 symptom checks per week'),
('basic', 'ai_chat_limited', 'Limited AI Chat', '5 AI conversations per day'),
('basic', 'vitals_basic', 'Basic Vitals Tracking', 'Manual vitals entry'),
('basic', 'emergency_basic', 'Emergency Access', 'Standard emergency response'),

-- Premium plan
('premium', 'symptom_checker_unlimited', 'Unlimited Symptom Analysis', 'Unlimited detailed symptom analysis'),
('premium', 'ai_chat_unlimited', 'Unlimited AI Medical Assistant', 'Unlimited AI conversations with medical experts'),
('premium', 'vitals_advanced', 'Advanced Vitals Analytics', 'AI-powered vitals analysis and predictions'),
('premium', 'emergency_priority', 'Priority Emergency Response', 'Faster emergency response'),
('premium', 'health_coaching', 'Personalized Health Coaching', 'AI-generated personalized health plans'),
('premium', 'family_basic', 'Basic Family Management', 'Manage up to 2 family members'),

-- Family plan
('family', 'symptom_checker_unlimited', 'Unlimited Symptom Analysis', 'Unlimited detailed symptom analysis'),
('family', 'ai_chat_unlimited', 'Unlimited AI Medical Assistant', 'Unlimited AI conversations with medical experts'),
('family', 'vitals_advanced', 'Advanced Vitals Analytics', 'AI-powered vitals analysis and predictions'),
('family', 'emergency_priority', 'Priority Emergency Response', 'Faster emergency response'),
('family', 'health_coaching', 'Personalized Health Coaching', 'AI-generated personalized health plans'),
('family', 'family_full', 'Full Family Management', 'Manage up to 6 family members'),
('family', 'health_history', 'Family Health History', 'Complete family health history tracking'),
('family', 'bulk_booking', 'Bulk Appointment Booking', 'Book appointments for multiple family members');

-- Enable RLS
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_features ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own subscriptions" ON user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own subscription attempts" ON subscription_attempts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view subscription features" ON subscription_features
  FOR SELECT USING (true);

-- Indexes for performance
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_subscription_attempts_user_id ON subscription_attempts(user_id);
CREATE INDEX idx_subscription_attempts_reference ON subscription_attempts(paystack_reference);
CREATE INDEX idx_subscription_features_plan ON subscription_features(plan_id);