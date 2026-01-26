-- Migration: Add cc_manager column to email_templates table
-- Date: 2026-01-25

ALTER TABLE email_templates 
ADD COLUMN cc_manager TINYINT(1) DEFAULT 0 
COMMENT 'Whether to CC the manager on this email type';
