-- Enable booking for the free plan
UPDATE subscription_plans SET has_booking = TRUE WHERE slug = 'free';
