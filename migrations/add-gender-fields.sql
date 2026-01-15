-- Add gender column to tblstaff table
ALTER TABLE `tblstaff` ADD COLUMN `gender` ENUM('Male', 'Female', 'Transgender') NULL;

-- Add gender_restriction column to leave_types table
ALTER TABLE `leave_types` ADD COLUMN `gender_restriction` JSON NULL;
