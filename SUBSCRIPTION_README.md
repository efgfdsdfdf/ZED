# Zed Subscription System with Paystack

This guide explains how to set up and use the subscription system integrated with Paystack for monetizing Zed's premium features.

## 🚀 Features Added

### Subscription Plans
- **Basic Plan** (₦999/month): Limited symptom checks, basic AI chat, vitals tracking
- **Premium Plan** (₦1,499/month): Unlimited features, priority support, advanced analytics
- **Family Plan** (₦2,999/month): Multi-user management, family health tracking

### Premium Features
- Unlimited symptom analysis with AI correlation
- Unlimited AI medical assistant conversations
- Advanced vitals analytics and predictions
- Priority emergency response
- Personalized health coaching
- Family health management (up to 6 members)

## 📋 Setup Instructions

### 1. Paystack Configuration

1. **Create Paystack Account**: Sign up at [paystack.com](https://paystack.com)
2. **Get API Keys**:
   - Go to Settings → API Keys & Webhooks
   - Copy your **Secret Key** and **Public Key**
3. **Create Subscription Plans**:
   - Go to Subscriptions → Plans
   - Create three plans with these details:

     **Basic Plan:**
     - Name: "Basic Health"
     - Amount: ₦999.00
     - Interval: Monthly
     - Description: "Essential health features"

     **Premium Plan:**
     - Name: "Premium Health"
     - Amount: ₦1,499.00
     - Interval: Monthly
     - Description: "Advanced AI health assistant"

     **Family Plan:**
     - Name: "Family Health Hub"
     - Amount: ₦2,999.00
     - Interval: Monthly
     - Description: "Complete family health management"

4. **Copy Plan Codes**: After creating plans, note their plan codes (e.g., PLN_xxxxxxxxxx)

### 2. Environment Variables

Update your `.env` file with Paystack credentials:

```env
# Paystack Configuration
PAYSTACK_SECRET_KEY=sk_test_your_actual_secret_key
PAYSTACK_PUBLIC_KEY=pk_test_your_actual_public_key
PAYSTACK_BASIC_PLAN_CODE=PLN_your_basic_plan_code
PAYSTACK_PREMIUM_PLAN_CODE=PLN_your_premium_plan_code
PAYSTACK_FAMILY_PLAN_CODE=PLN_your_family_plan_code

# Frontend URL for callbacks
FRONTEND_URL=https://yourdomain.com
```

### 3. Database Setup

Run the subscription schema in your Supabase SQL editor:

```sql
-- Copy and paste the contents of subscription-schema.sql
```

### 4. Webhook Configuration

1. In Paystack Dashboard → Settings → Webhooks
2. Add webhook URL: `https://yourdomain.com/api/subscription/webhook`
3. Select these events:
   - `subscription.create`
   - `subscription.disable`
   - `invoice.payment_succeeded`

### 5. Deploy and Test

1. **Deploy to Vercel**:
   ```bash
   vercel --prod
   ```

2. **Set Environment Variables in Vercel**:
   ```bash
   vercel env add PAYSTACK_SECRET_KEY
   vercel env add PAYSTACK_PUBLIC_KEY
   vercel env add PAYSTACK_BASIC_PLAN_CODE
   vercel env add PAYSTACK_PREMIUM_PLAN_CODE
   vercel env add PAYSTACK_FAMILY_PLAN_CODE
   vercel env add FRONTEND_URL
   ```

## 🎯 Usage Examples

### Check Feature Access
```javascript
// Check if user can use unlimited symptom analysis
const hasAccess = await ZedSubscription.hasFeature('symptom_checker_unlimited');

if (!hasAccess) {
  // Show upgrade prompt
  ZedSubscription.showUpgradePrompt('symptom_checker_unlimited');
}
```

### Feature Gating in Components
```javascript
// Before allowing unlimited AI chat
if (!(await ZedSubscription.checkFeatureAccess('ai_chat_unlimited'))) {
  return; // Function will show upgrade prompt automatically
}

// Proceed with premium feature
```

### Track Feature Usage
```javascript
// Track when premium features are used
await ZedSubscription.trackUsage('vitals_advanced');
```

## 📊 Subscription Analytics

The system automatically tracks:
- Subscription signups and cancellations
- Feature usage by plan type
- Payment success/failure rates
- User engagement with premium features

## 🔧 Files Modified/Added

### Backend
- `api/subscription.service.js` - Paystack integration
- `api/subscription.routes.js` - API endpoints
- `server.js` - Added subscription routes
- `subscription-schema.sql` - Database schema

### Frontend
- `public/subscription.html` - Subscription management page
- `public/subscription-success.html` - Success page
- `public/zed-core.js` - Added subscription checking and feature gating

### Configuration
- `.env` - Added Paystack environment variables
- `vercel.json` - Updated for deployment

## 💰 Revenue Optimization

### Pricing Strategy
- **Freemium**: Basic features free, premium features behind paywall
- **Value-based**: Price reflects the medical value provided
- **Competitive**: Research similar health apps for pricing

### Conversion Optimization
- **Onboarding**: Highlight premium benefits during signup
- **Feature Teasers**: Show premium features with upgrade prompts
- **Usage Limits**: Gentle nudges when free limits are reached
- **Social Proof**: Show testimonials from premium users

### Retention Strategies
- **Value Delivery**: Ensure premium features provide real value
- **Customer Support**: Priority support for premium users
- **Regular Updates**: Add new premium features regularly
- **Flexible Billing**: Easy upgrade/downgrade options

## 🆘 Troubleshooting

### Common Issues

1. **Payments not processing**:
   - Check Paystack API keys are correct
   - Verify plan codes match Paystack dashboard
   - Check webhook URL is accessible

2. **Features not unlocking**:
   - Verify database schema is applied
   - Check user subscription status in database
   - Clear browser cache and reload

3. **Webhook not receiving events**:
   - Ensure webhook URL is publicly accessible
   - Check Paystack webhook secret matches
   - Verify HTTPS is enabled

### Testing
- Use Paystack test keys for development
- Test with small amounts (₦100) during development
- Verify all subscription states work correctly

## 📞 Support

For Paystack integration issues:
- Paystack Documentation: https://paystack.com/docs
- Paystack Support: https://paystack.com/contact

For Zed-specific issues:
- Check server logs for API errors
- Verify database connections
- Test with different browsers

---

**Ready to monetize your healthcare platform!** 🚀