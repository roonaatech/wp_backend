const db = require("../models");
const LeaveType = db.leave_types;

async function seedLeaveTypes() {
    const types = [
        {
            id: 1,
            name: "Sick Leave",
            description: "For medical reasons",
            days_allowed: 14,
            status: true,
            gender_restriction: ["Male", "Female", "Transgender"]
        },
        {
            id: 2,
            name: "Casual Leave",
            description: "For personal matters",
            days_allowed: 12,
            status: true,
            gender_restriction: ["Male", "Female", "Transgender"]
        },
        {
            id: 3,
            name: "Earned Leave",
            description: "Privilege leave based on work days",
            days_allowed: 15,
            status: true,
            gender_restriction: ["Male", "Female", "Transgender"]
        },
        {
            id: 4,
            name: "Loss of Pay",
            description: "Unpaid leave",
            days_allowed: 0,
            status: true,
            gender_restriction: ["Male", "Female", "Transgender"]
        },
        {
            id: 5,
            name: "Maternity Leave",
            description: "For expecting mothers",
            days_allowed: 185,
            status: true,
            gender_restriction: ["Female"]
        },
        {
            id: 6,
            name: "Paternity Leave",
            description: "For new fathers",
            days_allowed: 5,
            status: true,
            gender_restriction: ["Male"]
        }
    ];

    for (const t of types) {
        const [type, created] = await LeaveType.findOrCreate({
            where: { id: t.id },
            defaults: t
        });

        if (!created) {
            console.log(`Leave type already exists: ${t.name}`);
        } else {
            console.log(`Created leave type: ${t.name}`);
        }
    }
}

module.exports = seedLeaveTypes;
