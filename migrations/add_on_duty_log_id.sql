-- Migration to add new columns for approval system with on-duty and manager hierarchy support

-- Add on_duty_log_id to approvals table if it doesn't exist
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS on_duty_log_id INT NULL AFTER attendance_log_id;

-- Add approving_manager_id to tblstaff table if it doesn't exist  
ALTER TABLE tblstaff ADD COLUMN IF NOT EXISTS approving_manager_id INT NULL;

-- Show the updated table structures
DESCRIBE approvals;
DESCRIBE tblstaff;
