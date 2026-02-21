# SonarQube Configuration Required

## ⚠️ Action Required

You need to update `sonar-project.properties` with your SonarCloud details.

## Steps:

### 1. Get Your SonarCloud Organization Key

1. Go to https://sonarcloud.io/
2. Sign in with GitHub
3. Click your profile → **My Organizations**
4. Copy your organization key (e.g., `your-github-username`)

### 2. Update sonar-project.properties

Edit `wp_backend/sonar-project.properties`:

```properties
# Update these lines with YOUR values:
sonar.projectKey=your-org_workpulse-backend
sonar.organization=your-github-username  # ← Your organization key here
```

### 3. Set GitHub Secrets

In your GitHub repository:

**Settings → Secrets and variables → Actions → New repository secret**

Add:
```
Name: SONAR_TOKEN
Value: [your SonarCloud token]

Name: SONAR_HOST_URL
Value: https://sonarcloud.io
```

## Example Configuration

If your GitHub username is `johndoe`:

```properties
sonar.projectKey=johndoe_workpulse-backend
sonar.organization=johndoe
sonar.projectName=WorkPulse Backend
```

## Quick Fix

```bash
# Edit the file
nano wp_backend/sonar-project.properties

# Update these two lines:
sonar.projectKey=YOUR-ORG_workpulse-backend
sonar.organization=YOUR-ORG

# Commit and push
git add wp_backend/sonar-project.properties
git commit -m "Configure SonarCloud organization"
git push
```

That's it! The workflow will run successfully after this.
