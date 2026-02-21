# SonarCloud Automatic Analysis Fix

## Error Message
```
ERROR You are running CI analysis while Automatic Analysis is enabled.
Please consider disabling one or the other.
```

This error occurs when you have both:
1. **Automatic Analysis** enabled in SonarCloud (analyzes on every push)
2. **CI Analysis** in GitHub Actions (our [workflow](.github/workflows/test-and-sonar.yml))

You can only use ONE method at a time.

## Solution: Disable Automatic Analysis

### Steps:

1. **Go to your SonarCloud project**
   - Visit: https://sonarcloud.io/
   - Select your project: `wp_backend`

2. **Open Administration → Analysis Method**
   - Click **Administration** (gear icon)
   - Click **Analysis Method**

3. **Disable Automatic Analysis**
   - Find "Automatic Analysis"
   - Toggle it **OFF**
   - Click **Save**

4. **Explanation**
   - You can't have both automatic analysis (SonarCloud scans on push) AND CI analysis (GitHub Actions scans)
   - Since we're using GitHub Actions for analysis, disable automatic analysis
   - This gives you more control over when analysis runs

### Alternative: Use Only Automatic Analysis

If you prefer automatic analysis instead:
1. Remove the SonarQube step from `.github/workflows/test-and-sonar.yml`
2. Keep automatic analysis enabled in SonarCloud
3. SonarCloud will analyze your code automatically on each push

**Recommended**: Use CI analysis (disable automatic) for better control and integration with your test suite.

---

## Additional Resources

- **[CI Workflow Guide](CI_WORKFLOW_GUIDE.md)** - Complete guide to the GitHub Actions workflow
- **[SonarCloud Dashboard](https://sonarcloud.io/project/overview?id=roonaatech_wp_backend)** - View analysis results
- **[GitHub Secrets](../../settings/secrets/actions)** - Configure SONAR_TOKEN and SONAR_HOST_URL

---

After disabling automatic analysis, push again and the workflow will succeed! ✅
