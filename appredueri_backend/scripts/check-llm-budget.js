/**
 * LLM Budget Monitor Script
 * 
 * Checks if monthly LLM costs exceed a threshold and sends alert.
 * 
 * Usage:
 *   node scripts/check-llm-budget.js
 * 
 * Setup (run monthly via cron or GitHub Actions):
 *   0 0 1 * * cd /path/to/backend && node scripts/check-llm-budget.js
 */

require('dotenv').config();
const pool = require('../src/db');

// Configuration
const MONTHLY_BUDGET_USD = 10; // Alertă dacă > $10/lună
const WARNING_THRESHOLD = 0.8; // Alertă la 80% din buget

async function checkBudget() {
  console.log('🔍 Checking LLM budget...\n');
  
  try {
    // Get current month costs
    const result = await pool.query(`
      SELECT 
        TO_CHAR(NOW(), 'YYYY-MM') as current_month,
        COUNT(*) as summaries_count,
        SUM(tokens_used) as total_tokens,
        ROUND(
          SUM(tokens_used) * 0.00000025 + 
          SUM(tokens_used) * 0.00000125 * 0.3, 
          6
        ) as cost_usd
      FROM review_summaries
      WHERE generated_at >= DATE_TRUNC('month', CURRENT_DATE)
    `);
    
    const data = result.rows[0];
    const costUsd = parseFloat(data.cost_usd || 0);
    const percentUsed = (costUsd / MONTHLY_BUDGET_USD) * 100;
    
    console.log('📊 Current Month Stats:');
    console.log(`   Month: ${data.current_month}`);
    console.log(`   Summaries: ${data.summaries_count}`);
    console.log(`   Tokens: ${data.total_tokens}`);
    console.log(`   Cost: $${costUsd.toFixed(6)}`);
    console.log(`   Budget: $${MONTHLY_BUDGET_USD.toFixed(2)}`);
    console.log(`   Used: ${percentUsed.toFixed(1)}%\n`);
    
    // Check thresholds
    if (costUsd >= MONTHLY_BUDGET_USD) {
      console.log('🚨 ALERT: Monthly budget EXCEEDED!');
      console.log(`   Current: $${costUsd.toFixed(6)}`);
      console.log(`   Budget: $${MONTHLY_BUDGET_USD.toFixed(2)}`);
      console.log(`   Overage: $${(costUsd - MONTHLY_BUDGET_USD).toFixed(6)}\n`);
      
      await sendAlert('BUDGET_EXCEEDED', data);
      
    } else if (percentUsed >= WARNING_THRESHOLD * 100) {
      console.log('⚠️  WARNING: Approaching budget limit!');
      console.log(`   Current: $${costUsd.toFixed(6)} (${percentUsed.toFixed(1)}%)`);
      console.log(`   Remaining: $${(MONTHLY_BUDGET_USD - costUsd).toFixed(6)}\n`);
      
      await sendAlert('BUDGET_WARNING', data);
      
    } else {
      console.log('✅ Budget OK - costs within limits\n');
    }
    
    // Projection for rest of month
    const daysInMonth = new Date(
      new Date().getFullYear(), 
      new Date().getMonth() + 1, 
      0
    ).getDate();
    const currentDay = new Date().getDate();
    const daysRemaining = daysInMonth - currentDay;
    
    if (currentDay > 0) {
      const dailyAvg = costUsd / currentDay;
      const projectedTotal = dailyAvg * daysInMonth;
      
      console.log('📈 Projection:');
      console.log(`   Daily average: $${dailyAvg.toFixed(6)}`);
      console.log(`   Days remaining: ${daysRemaining}`);
      console.log(`   Projected month total: $${projectedTotal.toFixed(6)}`);
      
      if (projectedTotal > MONTHLY_BUDGET_USD) {
        console.log(`   ⚠️  Projected to exceed budget by $${(projectedTotal - MONTHLY_BUDGET_USD).toFixed(6)}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking budget:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

/**
 * Send alert (implement your notification method here)
 */
async function sendAlert(type, data) {
  console.log(`\n📧 Alert triggered: ${type}`);
  
  // TODO: Implement your alert method:
  // - Send email via Resend/SendGrid
  // - Post to Slack webhook
  // - Send push notification
  // - Log to Sentry
  
  const message = type === 'BUDGET_EXCEEDED' 
    ? `🚨 LLM Budget Exceeded!\n\nCurrent month cost: $${data.cost_usd}\nBudget: $${MONTHLY_BUDGET_USD}\n\nPlease review usage.`
    : `⚠️ LLM Budget Warning\n\nCurrent month cost: $${data.cost_usd} (${((data.cost_usd / MONTHLY_BUDGET_USD) * 100).toFixed(1)}%)\n\nApproaching budget limit.`;
  
  console.log(message);
  
  // Example: Send email via Resend (if configured)
  if (process.env.RESEND_API_KEY && process.env.FROM_EMAIL) {
    try {
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      await resend.emails.send({
        from: process.env.FROM_EMAIL,
        to: 'admin@yourdomain.com', // Change to your email
        subject: `[OFAI] LLM Budget ${type === 'BUDGET_EXCEEDED' ? 'Exceeded' : 'Warning'}`,
        text: message
      });
      
      console.log('✅ Alert email sent');
    } catch (err) {
      console.error('❌ Failed to send alert email:', err.message);
    }
  }
}

// Run
checkBudget();
