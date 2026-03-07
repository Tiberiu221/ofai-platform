-- Migration 048: User report system for offers and businesses
-- Allows users to flag inappropriate/fake content for admin review

CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('offer', 'business')),
    target_id INTEGER NOT NULL,
    reason VARCHAR(50) NOT NULL CHECK (reason IN (
        'fake_offer', 'misleading_price', 'closed_business',
        'inappropriate_content', 'spam', 'other'
    )),
    details TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
    admin_notes TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- One report per user per target
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_unique_per_user
    ON reports(reporter_id, target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type, target_id);
