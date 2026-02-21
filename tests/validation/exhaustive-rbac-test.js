const fs = require('fs');
const path = require('path');
const axios = require('axios');
const db = require('../../models');
const { ROLES } = require('./role-catalog');
const { ENDPOINTS } = require('./endpoint-catalog');
const { getCustomToken } = require('../helpers/auth-helper');

// Re-use existing token generation logic or provide our own
const jwtSecret = process.env.JWT_SECRET || 'workpulse_secret_key_2024';
const jwt = require('jsonwebtoken');

const PERMISSIONS = [
    // Hierarchical Permissions
    { field: 'can_approve_leave', display: 'Approve Leave Requests', type: 'hierarchical' },
    { field: 'can_approve_onduty', display: 'Approve On-Duty Requests', type: 'hierarchical' },
    { field: 'can_approve_timeoff', display: 'Approve Time-Off Requests', type: 'hierarchical' },
    { field: 'can_manage_users', display: 'Manage Users', type: 'hierarchical' },
    { field: 'can_view_users', display: 'View Users (Read Only)', type: 'hierarchical' },
    { field: 'can_view_reports', display: 'View Reports', type: 'hierarchical' },
    { field: 'can_manage_active_onduty', display: 'View Active On-Duty', type: 'hierarchical' },
    { field: 'can_manage_schedule', display: 'View Schedule', type: 'hierarchical' },
    { field: 'can_view_activities', display: 'View Activities', type: 'hierarchical' },
    // Global Permissions
    { field: 'can_access_webapp', display: 'Access Web Application', type: 'global' },
    { field: 'can_manage_leave_types', display: 'Manage Leave Types', type: 'global' },
    { field: 'can_manage_roles', display: 'Manage Roles', type: 'global' },
    { field: 'can_manage_email_settings', display: 'Manage Email Settings', type: 'global' },
    { field: 'can_manage_system_settings', display: 'Manage System Settings', type: 'enum_none_all' },
];

async function generateToken(userId) {
    return jwt.sign({ id: userId }, jwtSecret, { expiresIn: 86400 }); // 24 hours
}

function getExpectedAccess(role, endpoint) {
    if (endpoint.path.startsWith('/api/debug')) return 'DENIED';

    const mws = endpoint.middleware;
    if (mws.length === 0) return 'ALLOWED'; // Public route

    for (const mw of mws) {
        if (mw === 'authJwt.isAdmin') {
            if (role.can_manage_users !== 'all') return 'DENIED';
        } else if (mw === 'authJwt.isManagerOrAdmin') {
            if (role.can_approve_leave === 'none' &&
                role.can_approve_onduty === 'none' &&
                role.can_approve_timeoff === 'none' &&
                role.can_manage_users === 'none') {
                return 'DENIED';
            }
        } else if (mw === 'authJwt.canAccessWebApp') {
            if (!role.can_access_webapp &&
                role.can_approve_leave === 'none' &&
                role.can_approve_onduty === 'none' &&
                role.can_approve_timeoff === 'none' &&
                role.can_manage_users === 'none' &&
                role.can_manage_leave_types !== true &&
                role.can_view_reports === 'none') {
                return 'DENIED';
            }
        } else if (mw === 'authJwt.canManageUsers') {
            if (role.can_manage_users !== 'all' && role.can_manage_users !== 'subordinates') return 'DENIED';
        } else if (mw === 'authJwt.canViewUsers') {
            if ((role.can_view_users !== 'all' && role.can_view_users !== 'subordinates') &&
                (role.can_manage_users !== 'all' && role.can_manage_users !== 'subordinates')) return 'DENIED';
        } else if (mw === 'authJwt.canViewReports') {
            if (role.can_view_reports !== 'all' && role.can_view_reports !== 'subordinates') return 'DENIED';
        } else if (mw === 'authJwt.canManageSchedule') {
            if (role.can_manage_schedule !== 'all' && role.can_manage_schedule !== 'subordinates') return 'DENIED';
        } else if (mw === 'authJwt.canManageActiveOnDuty') {
            if (role.can_manage_active_onduty !== 'all' && role.can_manage_active_onduty !== 'subordinates') return 'DENIED';
        } else if (mw === 'authJwt.canManageRoles') {
            if (role.can_manage_roles !== true) return 'DENIED';
        } else if (mw === 'authJwt.canViewActivities') {
            if (!role.can_view_activities || role.can_view_activities === 'none') return 'DENIED';
        } else if (mw === 'authJwt.canManageEmailSettings') {
            if (role.can_manage_email_settings !== true) return 'DENIED';
        } else if (mw === 'authJwt.canManageSystemSettings') {
            if (role.can_manage_system_settings !== 'all') return 'DENIED';
        } else if (mw === 'authJwt.canManageLeaveTypes') {
            if (role.can_manage_leave_types !== true) return 'DENIED';
        } else if (mw === 'authJwt.canApproveTimeOff') {
            if (role.can_approve_timeoff !== 'all' && role.can_approve_timeoff !== 'subordinates') return 'DENIED';
        }
    }
    return 'ALLOWED';
}

async function runExhaustiveTest() {
    console.log('🚀 Starting Exhuastive RBAC Matrix Check... (This will test 10,000+ combinations!)');
    const results = [];

    // 1. Setup global exhaustive tester
    const tempUser = await db.user.create({
        firstname: 'Exhaustive',
        lastname: 'Tester',
        email: `exhaust_${Date.now()}@test.com`,
        password: 'dummy_password',
        active: 1
    });

    const token = await generateToken(tempUser.staffid);

    try {
        // 2. Iterate through all Base Roles to preserve their fundamental properties (hierarchy_level)
        for (const roleDef of ROLES) {
            console.log(`\n======================================`);
            console.log(`Checking Base Context: ${roleDef.display_name}`);
            console.log(`======================================`);

            const realRole = await db.roles.findOne({ where: { name: roleDef.name } });
            if (!realRole) continue;

            // We will clone the role to safely manipulate it
            const cloneData = { ...realRole.toJSON() };
            delete cloneData.id;
            delete cloneData.createdAt;
            delete cloneData.updatedAt;
            cloneData.name = `exhaust_temp_${roleDef.name}_${Date.now()}`;
            cloneData.display_name = `${roleDef.display_name} (Testing Sandbox)`;

            const tempRole = await db.roles.create(cloneData);

            // Assign the test user to this sandbox role
            await tempUser.update({ role: tempRole.id });

            // 3. Loop through every checkbox/permission defined
            for (const perm of PERMISSIONS) {
                process.stdout.write(`  -> Verifying Checkbox [${perm.display}] `);

                const originalVal = cloneData[perm.field];

                // Define all values the "checkbox" can take
                const toggleValues = perm.type === 'hierarchical'
                    ? ['none', 'subordinates', 'all'] // Unchecked, Checked (Subordinates), Checked (All)
                    : (perm.type === 'enum_none_all' ? ['none', 'all'] : [false, true]); // Enum strings vs boolean

                // 4. Set the role to specifically ONE state to test
                for (const testVal of toggleValues) {
                    process.stdout.write('.');

                    const updatePayload = {};
                    updatePayload[perm.field] = testVal;
                    await tempRole.update(updatePayload);

                    // Test against every endpoint dynamically
                    for (const endpoint of ENDPOINTS.filter(e => e.method === 'GET')) {
                        // Skip debug endpoints just to eliminate noise from non-production paths
                        if (endpoint.path.startsWith('/api/debug')) continue;

                        let statusCategory = 'ALLOWED';
                        const req = { userId: tempUser.staffid };

                        try {
                            for (const mw of endpoint.middleware) {
                                const authJwt = require('../../middleware/authJwt');
                                const mwName = mw.split('.')[1];
                                if (!authJwt[mwName]) continue;

                                let mwPassed = false;
                                let mwStatus = null;
                                const res = {
                                    status: (code) => { mwStatus = code; return { send: () => { } }; },
                                    send: () => { }
                                };
                                const next = () => { mwPassed = true; };

                                await authJwt[mwName](req, res, next);

                                if (!mwPassed) {
                                    statusCategory = mwStatus === 403 ? 'DENIED' : `ERROR (${mwStatus})`;
                                    break;
                                }
                            }
                        } catch (err) {
                            statusCategory = 'ERROR (Middleware Crash)';
                        }

                        const expected = getExpectedAccess(await tempRole.toJSON(), endpoint);
                        const testStatus = (statusCategory === expected || statusCategory.startsWith('ALLOWED (Ownership')) ? 'PASS' : 'FAIL';

                        results.push({
                            BaseRole: roleDef.display_name,
                            PermissionChecked: perm.display, // Human readable
                            OptionSelected: testVal === false ? 'Unchecked' : (testVal === true ? 'Checked' : testVal),
                            HTTPOperation: endpoint.method,
                            APIRoute: endpoint.path,
                            MiddlewareEnforcements: endpoint.middleware.join(', '),
                            HTTPStatusReturned: statusCategory === 'ALLOWED' ? 200 : 403,
                            AuthorizationOutcome: statusCategory,
                            ExpectedOutcome: expected,
                            TestStatus: testStatus
                        });
                    }
                }

                // Restore perm back to original before isolating the next checkbox
                const revertPayload = {};
                revertPayload[perm.field] = originalVal;
                await tempRole.update(revertPayload);

                process.stdout.write(' Done\n');
            }

            // Purge the clone
            await tempRole.destroy();
        }
    } finally {
        // Purge the tester
        await tempUser.destroy();
    }

    // 5. Build Comprehensive CSV
    console.log('\n📊 Collating matrix data... converting to CSV format');
    const headers = [
        'Base Role',
        'Permission Checkbox Tested',
        'Checkbox State (Selection)',
        'Endpoint Method',
        'Endpoint Path',
        'Middlware Constraints',
        'Actual API Output Code',
        'Final Permission Outcome',
        'Expected Outcome',
        'Test Status'
    ];

    const csvRows = results.map(r =>
        `"${r.BaseRole}","${r.PermissionChecked}","${r.OptionSelected}","${r.HTTPOperation}","${r.APIRoute}","${r.MiddlewareEnforcements}","${r.HTTPStatusReturned}","${r.AuthorizationOutcome}","${r.ExpectedOutcome}","${r.TestStatus}"`
    );

    const csvContent = headers.join(',') + '\n' + csvRows.join('\n');

    const outPath = path.join(process.cwd(), 'tests', 'exhaustive-permissions-matrix.csv');
    fs.writeFileSync(outPath, csvContent);

    console.log(`\n🎉 Exhaustive Permissions Check Complete! Matrix Saved to:`);
    console.log(`   --> ${outPath}`);

    const totalTests = results.length;
    const passedTests = results.filter(r => r.TestStatus === 'PASS').length;
    const failedTests = totalTests - passedTests;

    // Save JSON results to test-results folder
    const testResultsDir = path.join(process.cwd(), 'test-results');
    if (!fs.existsSync(testResultsDir)) {
        fs.mkdirSync(testResultsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonSummary = {
        timestamp: new Date().toISOString(),
        testType: 'exhaustive-rbac',
        success: failedTests === 0,
        summary: {
            totalCombinations: totalTests,
            passed: passedTests,
            failed: failedTests,
            passRate: ((passedTests / totalTests) * 100).toFixed(2) + '%'
        },
        results: results,
        csvReport: outPath
    };

    const jsonResultFile = path.join(testResultsDir, `exhaustive-test-${timestamp}.json`);
    fs.writeFileSync(jsonResultFile, JSON.stringify(jsonSummary, null, 2));

    const latestFile = path.join(testResultsDir, 'exhaustive-latest.json');
    fs.writeFileSync(latestFile, JSON.stringify(jsonSummary, null, 2));

    console.log('\n======================================');
    console.log('   📊 EXECUTIVE SUMMARY REPORT');
    console.log('======================================');
    console.log(`   Total Combinations Tested : ${totalTests}`);
    console.log(`   ✅ PASS                   : ${passedTests}`);
    console.log(`   ❌ FAIL                   : ${failedTests}`);
    console.log('======================================');
    console.log(`\n✓ JSON results saved to: ${jsonResultFile}`);
    console.log(`✓ Latest results available at: ${latestFile}\n`);

    process.exit(0);
}

runExhaustiveTest().catch(err => {
    console.error('Fatal Failure during Execution:', err);
    process.exit(1);
});
