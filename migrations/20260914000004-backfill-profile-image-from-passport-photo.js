'use strict';

module.exports = {
    up: async (queryInterface) => {
        // 1. Update existing employee_profiles where image_path is null or empty,
        // and a 'photo' document exists in employee_documents
        await queryInterface.sequelize.query(`
            UPDATE employee_profiles ep
            JOIN (
                SELECT staff_id, file_path
                FROM (
                    SELECT staff_id, file_path,
                           ROW_NUMBER() OVER (PARTITION BY staff_id ORDER BY id DESC) as rn
                    FROM employee_documents
                    WHERE document_type = 'photo'
                ) latest_photos
                WHERE rn = 1
            ) ed ON ep.staff_id = ed.staff_id
            SET ep.image_path = ed.file_path
            WHERE ep.image_path IS NULL OR ep.image_path = '';
        `);

        // 2. For users who have a 'photo' document but no employee_profiles row,
        // insert a profile row linking staff_id and image_path
        await queryInterface.sequelize.query(`
            INSERT INTO employee_profiles (staff_id, image_path, createdAt, updatedAt)
            SELECT ed.staff_id, ed.file_path, NOW(), NOW()
            FROM (
                SELECT staff_id, file_path,
                       ROW_NUMBER() OVER (PARTITION BY staff_id ORDER BY id DESC) as rn
                FROM employee_documents
                WHERE document_type = 'photo'
            ) ed
            LEFT JOIN employee_profiles ep ON ed.staff_id = ep.staff_id
            WHERE ed.rn = 1 AND ep.id IS NULL;
        `);
    },

    down: async (queryInterface) => {
        // Data backfill migration - no rollback required
    }
};
