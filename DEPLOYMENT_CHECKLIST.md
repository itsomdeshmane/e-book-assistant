# 🚀 Azure Deployment Checklist

## Pre-Deployment

- [ ] All environment variables configured in Azure Portal
  - [ ] `OPENAI_API_KEY`
  - [ ] `PINECONE_API_KEY`
  - [ ] `PINECONE_INDEX_NAME`
  - [ ] `JWT_SECRET` (not default value)
  - [ ] `AZURE_DI_ENDPOINT` (optional)
  - [ ] `AZURE_DI_KEY` (optional)
  
- [ ] Azure App Service settings verified:
  - [ ] `SCM_DO_BUILD_DURING_DEPLOYMENT` = `true`
  - [ ] Runtime Stack: Python 3.13
  - [ ] Startup Command: `bash startup.sh`
  - [ ] Always On: Enabled

- [ ] GitHub Secrets configured:
  - [ ] `AZUREAPPSERVICE_CLIENTID_*`
  - [ ] `AZUREAPPSERVICE_TENANTID_*`
  - [ ] `AZUREAPPSERVICE_SUBSCRIPTIONID_*`

## Files Added/Modified to Fix 409 Error

✅ **Created:**
- `.deployment` - Azure build configuration
- `web.config` - IIS/httpPlatform configuration  
- `AZURE_DEPLOYMENT_GUIDE.md` - Comprehensive guide
- `DEPLOYMENT_CHECKLIST.md` - This file

✅ **Modified:**
- `.github/workflows/main_e-book-assistant-api.yml` - Added `clean: true` and `restart: true`
- `requirements.txt` - Added gunicorn, pinned pinecone versions

## Deployment Process

1. **Commit and push changes:**
   ```bash
   git add .
   git commit -m "Fix: Azure deployment 409 conflict - add clean deployment"
   git push origin main
   ```

2. **Monitor GitHub Actions:**
   - Go to repository → Actions
   - Watch the workflow execution
   - Check build and deploy steps

3. **Verify deployment:**
   ```bash
   curl https://e-book-assistant-api.azurewebsites.net/healthz
   ```

4. **Check logs if issues occur:**
   - Azure Portal → App Service → Log stream
   - GitHub Actions → Failed step logs

## If 409 Error Persists

### Option 1: Manual App Restart
```bash
az webapp restart --name e-book-assistant-api --resource-group <your-rg>
```

### Option 2: Stop Before Deploy
Add to workflow before deployment:
```yaml
- name: Stop Web App
  run: az webapp stop --name e-book-assistant-api --resource-group <your-rg>
```

### Option 3: Clear Deployment History
```bash
az webapp deployment source delete \
  --name e-book-assistant-api \
  --resource-group <your-rg>
```

### Option 4: Use Staging Slot
```bash
# Create staging slot
az webapp deployment slot create \
  --name e-book-assistant-api \
  --resource-group <your-rg> \
  --slot staging

# Deploy to staging, then swap
az webapp deployment slot swap \
  --name e-book-assistant-api \
  --resource-group <your-rg> \
  --slot staging
```

## Post-Deployment Verification

- [ ] Health endpoint responds: `/healthz`
- [ ] Can register new user: `POST /auth/register`
- [ ] Can login: `POST /auth/login`
- [ ] Can upload PDF: `POST /docs/upload`
- [ ] Can query documents: `POST /rag/query`
- [ ] Logs show no errors
- [ ] All environment variables loaded correctly

## Troubleshooting Commands

**View deployment logs:**
```bash
az webapp log tail --name e-book-assistant-api --resource-group <your-rg>
```

**Download deployment logs:**
```bash
az webapp log download --name e-book-assistant-api --resource-group <your-rg>
```

**Check app settings:**
```bash
az webapp config appsettings list --name e-book-assistant-api --resource-group <your-rg>
```

**SSH into container:**
```bash
az webapp ssh --name e-book-assistant-api --resource-group <your-rg>
```

## Success Criteria

✅ GitHub Actions workflow completes successfully  
✅ No 409 errors in deployment logs  
✅ Application starts without errors  
✅ Health endpoint returns `{"status": "ok"}`  
✅ Can perform end-to-end test (upload → query)  

## Quick Test After Deployment

```bash
# Set your app URL
APP_URL="https://e-book-assistant-api.azurewebsites.net"

# 1. Health check
curl $APP_URL/healthz

# 2. Register user
curl -X POST $APP_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"Test123!"}'

# 3. Login
TOKEN=$(curl -X POST $APP_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"Test123!"}' \
  | jq -r '.access_token')

# 4. Upload document (requires file)
curl -X POST $APP_URL/docs/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.pdf"

# 5. Query
curl -X POST $APP_URL/rag/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"What is this document about?"}'
```

---

**Last Updated:** 2025-10-29  
**Status:** Ready for deployment ✅

