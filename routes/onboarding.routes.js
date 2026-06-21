const controller = require("../controllers/onboarding.controller");
const { authJwt } = require("../middleware");
const multer = require("multer");
const fs = require("fs");

module.exports = function (app) {
    app.use((req, res, next) => {
        res.header("Access-Control-Allow-Headers", "x-access-token, Origin, Content-Type, Accept");
        next();
    });

    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = "uploads/employee_documents";
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            cb(null, `emp-doc-${Date.now()}-${file.originalname}`);
        }
    });
    const upload = multer({ 
        storage, 
        limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
    });

    // Onboard Employee (Admin/HR only)
    app.post(
        "/api/onboarding/employee", 
        [authJwt.verifyToken, authJwt.canManageOnboarding, upload.any()], 
        controller.onboardEmployee
    );
    
    // Get full employee extended profile (Admin/HR/Manager)
    app.get(
        "/api/onboarding/employee/:id", 
        [authJwt.verifyToken, authJwt.canViewUsers], 
        controller.getEmployeeExtendedProfile
    );
    
    // Update employee extended profile (Admin/HR only)
    app.put(
        "/api/onboarding/employee/:id", 
        [authJwt.verifyToken, authJwt.canManageOnboarding, upload.any()], 
        controller.updateEmployeeExtendedProfile
    );
    
    // Secure download of candidate uploaded files (Admin/HR/Manager/Self)
    app.get(
        "/api/onboarding/employee/:id/document/:docId", 
        [authJwt.verifyToken], 
        controller.downloadEmployeeDocument
    );

    // Get logged in user's own joining profile (Self-service, token protected)
    app.get(
        "/api/onboarding/my-profile",
        [authJwt.verifyToken],
        controller.getMyProfile
    );

    // Save user password change, consent check, and signature drawing (Self-service, token protected)
    app.post(
        "/api/onboarding/employee/complete-declaration",
        [authJwt.verifyToken],
        controller.completeEmployeeDeclaration
    );

    // Invite candidate for self-service onboarding (Admin/HR only)
    app.post(
        "/api/onboarding/invite-candidate",
        [authJwt.verifyToken, authJwt.canManageOnboarding],
        controller.inviteCandidate
    );

    // Get candidate profile by secure token (Public)
    app.get(
        "/api/onboarding/candidate/:token",
        controller.getCandidateByToken
    );

    // Submit candidate self-service form (Public)
    app.post(
        "/api/onboarding/candidate/:token/submit",
        [upload.any()],
        controller.submitCandidateForm
    );

    // Approve candidate onboarding (Admin/HR only)
    app.post(
        "/api/onboarding/employee/:id/approve",
        [authJwt.verifyToken, authJwt.canManageOnboarding],
        controller.approveCandidateOnboarding
    );

    // Resend welcome onboarding email (Admin/HR only)
    app.post(
        "/api/onboarding/employee/:id/resend-welcome",
        [authJwt.verifyToken, authJwt.canManageOnboarding],
        controller.resendWelcomeEmail
    );
};
