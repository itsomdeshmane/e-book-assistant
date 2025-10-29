# Azure App Service Deployment Guide

## 🚀 Fixing the 409 Conflict Error

The **409 Conflict error** during Azure App Service deployment typically occurs when:
1. A previous deployment is still in progress
2. Files are locked by the running application
3. The deployment process cannot overwrite existing files

## ✅ Solutions Implemented

### 1. Added `.deployment` File
Created `.deployment` file to configure Azure's build process:
```
[config]
SCM_DO_BUILD_DURING_DEPLOYMENT = true
```

This ensures Azure uses Oryx build system to properly install dependencies during deployment.

### 2. Updated GitHub Actions Workflow
Modified `.github/workflows/main_e-book-assistant-api.yml` to include:

```yaml
- name: 'Deploy to Azure Web App'
  uses: azure/webapps-deploy@v3
  id: deploy-to-webapp
  with:
    app-name: 'e-book-assistant-api'
    slot-name: 'Production'
    startup-command: 'bash startup.sh'
    clean: true          # ✨ Enables clean deployment
    restart: true        # ✨ Automatically restarts the app
```

**Key Changes:**
- `clean: true` - Removes old files before deploying new ones
- `restart: true` - Automatically restarts the app after deployment
- Added artifact verification step for debugging

### 3. Added `web.config`
Created `web.config` for proper Azure App Service configuration with:
- Proper httpPlatform handler
- Increased startup timeout (600 seconds)
- Retry count for better resilience
- Stdout logging enabled

### 4. Updated `requirements.txt`
- Added `gunicorn` as an alternative WSGI server for Azure
- Pinned `pinecone` version range: `>=5.0.0,<6.0.0`
- Added explicit `pinecone-client` dependency

## 🔧 Azure App Service Configuration

### Required Environment Variables

Set these in Azure Portal → App Service → Configuration → Application Settings:

```bash
# OpenAI (Required)
OPENAI_API_KEY=sk-...

# Pinecone (Required)
PINECONE_API_KEY=pc-...
PINECONE_INDEX_NAME=e-book-assistant-9eiz80o

# JWT (Required)
JWT_SECRET=<your-secret-key>
JWT_EXPIRE_MINUTES=120

# Azure AI Document Intelligence (Optional)
AZURE_DI_ENDPOINT=https://<resource>.cognitiveservices.azure.com
AZURE_DI_KEY=<your-key>
AZURE_DI_API_VERSION=2024-07-31

# Server Configuration
PORT=8000
ALLOW_ORIGINS=*

# Processing Configuration
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
MODEL_NAME=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small
PDF2IMAGE_DPI=150
MAX_PDF_PAGES=50
```

### Azure App Service Settings

**General Settings:**
- **Runtime Stack:** Python 3.13
- **Startup Command:** `bash startup.sh`
- **Always On:** Enabled (recommended for production)

**Configuration Settings:**
- `SCM_DO_BUILD_DURING_DEPLOYMENT` = `true`
- `WEBSITE_RUN_FROM_PACKAGE` = `0` (allow clean deployment)

## 🐛 Troubleshooting

### If 409 Error Still Occurs:

1. **Manual App Restart:**
   ```bash
   az webapp restart --name e-book-assistant-api --resource-group <your-rg>
   ```

2. **Stop Before Deployment:**
   Add this step before deployment in your workflow:
   ```yaml
   - name: Stop Azure Web App
     run: |
       az webapp stop --name e-book-assistant-api --resource-group <your-rg>
   ```

3. **Check Deployment Logs:**
   - Azure Portal → App Service → Deployment Center → Logs
   - Look for file lock errors or timeout issues

4. **Clear Deployment Cache:**
   ```bash
   az webapp deployment source delete --name e-book-assistant-api --resource-group <your-rg>
   ```

5. **Use Deployment Slots:**
   - Deploy to a staging slot first
   - Swap slots after successful deployment
   - Zero downtime and easier rollback

### Common Issues:

**Issue: Build timeout during pip install**
- Solution: Increase `WEBSITES_ENABLE_APP_SERVICE_STORAGE` = `true`
- Or split requirements.txt into base dependencies

**Issue: Missing dependencies**
- Solution: Ensure `SCM_DO_BUILD_DURING_DEPLOYMENT` = `true`
- Verify all dependencies are in requirements.txt

**Issue: Startup timeout**
- Solution: Increase timeout in web.config (currently 600s)
- Check for slow-starting dependencies

**Issue: Port binding errors**
- Solution: Ensure app listens on PORT environment variable
- Default Azure port is usually 8000 or 80

## 📊 Deployment Workflow

```
┌─────────────────────┐
│   Push to main      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Build Step        │
│ - Install deps      │
│ - Create artifact   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Download artifact │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Azure Login       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Deploy to Azure   │
│ - clean: true       │ ← Prevents 409 errors
│ - restart: true     │ ← Ensures app restarts
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   App Running ✓     │
└─────────────────────┘
```

## 🚦 Health Checks

The application includes a health endpoint:
```bash
GET /healthz
```

Response:
```json
{"status": "ok"}
```

Use this to verify deployment success:
```bash
curl https://e-book-assistant-api.azurewebsites.net/healthz
```

## 📝 Best Practices

1. **Use Deployment Slots** for zero-downtime deployments
2. **Enable Always On** to prevent cold starts
3. **Configure Auto-Scale** based on metrics
4. **Monitor Logs** in Application Insights
5. **Set up Alerts** for deployment failures
6. **Use Managed Identity** instead of API keys when possible
7. **Regular Backups** of SQLite database and uploads directory

## 🔐 Security Checklist

- [ ] JWT_SECRET is a strong random string (not default)
- [ ] ALLOW_ORIGINS is restricted in production (not *)
- [ ] API keys are stored in Azure Key Vault or App Settings
- [ ] HTTPS Only is enabled
- [ ] Minimum TLS version is 1.2
- [ ] Authentication is enabled for sensitive endpoints

## 📚 Additional Resources

- [Azure App Service Docs](https://docs.microsoft.com/azure/app-service/)
- [Python on Azure App Service](https://docs.microsoft.com/azure/app-service/configure-language-python)
- [GitHub Actions for Azure](https://github.com/Azure/actions)
- [Troubleshooting 409 Errors](https://docs.microsoft.com/azure/app-service/deploy-continuous-deployment#troubleshooting)

## 🎯 Next Steps

After deployment:
1. Verify health endpoint is responding
2. Test authentication endpoints
3. Upload a test PDF document
4. Query the RAG system
5. Monitor logs for any errors
6. Set up Application Insights for monitoring

---

**Need Help?** Check the deployment logs in Azure Portal or GitHub Actions.

