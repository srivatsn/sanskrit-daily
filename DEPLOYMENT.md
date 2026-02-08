# Azure Web App Deployment Guide (Linux)

This guide deploys your app to **Azure App Service on Linux**, which is more cost-effective than Windows.

## Why Linux?

- **Cheaper**: Linux plans are ~30-40% less expensive than Windows for the same tier
- **Better for Node.js**: Native support, faster startup
- **Open source stack**: No Windows licensing costs passed to you

## Cost Comparison (as of 2026):
- **Linux B1**: ~$13/month
- **Windows B1**: ~$18-20/month
- **Linux F1** (Free): Available with limitations
- **Windows F1** (Free): Also available but less performant for Node.js

## Deployment Options

Choose your preferred method:
- **[Option 1: Azure Portal (No CLI needed)](#option-1-azure-portal-recommended-for-beginners)** ← Start here if you don't have Azure CLI
- **[Option 2: Azure CLI](#option-2-azure-cli-for-automation)**

---

## Option 1: Azure Portal (Recommended for Beginners)

### Step 1: Build Your App Locally

```bash
npm install
npm run build
```

### Step 2: Create ZIP Package

Create a deployment package (excluding development files):

**On Linux/Mac:**
```bash
zip -r deploy.zip . -x "*.git*" "node_modules/*" "dist/*" ".env" ".DS_Store" "*.zip"
```

**On Windows (PowerShell):**
```powershell
Compress-Archive -Path * -DestinationPath deploy.zip -Force -Exclude @('*.git*', 'node_modules', 'dist', '.env', '.DS_Store', '*.zip')
```

Or manually: Select all files/folders EXCEPT `.git`, `node_modules`, `dist`, `.env` → right-click → Send to → Compressed folder

### Step 3: Create Web App in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Click **"Create a resource"** or the **+ Create** button
3. Search for **"Web App"** and click **Create**

**Configure Basic Settings:**
- **Resource Group**: Select `rg-sanskrit-daily` (existing)
- **Name**: Choose a unique name (e.g., `sanskrit-daily-yourname`)
  - This will be your URL: `https://yourname.azurewebsites.net`
- **Publish**: Code
- **Runtime stack**: Node 20 LTS
- **Operating System**: **Linux** ← Important!
- **Region**: East US (or your preferred region)

**Configure Pricing:**
- Click **"Change size"** under App Service Plan
- Select **B1 (Basic)** - ~$13/month
  - Or **F1 (Free)** for testing (has CPU time limits)
- Click **Apply**

Click **Review + Create**, then **Create**. Wait 1-2 minutes for deployment.

### Step 4: Configure Application Settings

After the web app is created:

1. Go to your Web App in the portal
2. In the left menu, under **Settings**, click **"Configuration"**
3. Click **"+ New application setting"** and add each of these:

| Name | Value |
|------|-------|
| `AZURE_OPENAI_ENDPOINT` | `https://YOUR-RESOURCE.openai.azure.com` |
| `AZURE_OPENAI_API_KEY` | Your API key |
| `AZURE_OPENAI_DEPLOYMENT` | Your deployment name (e.g., `gpt-4.1-mini`) |
| `AZURE_OPENAI_API_VERSION` | `2024-10-21` |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `true` |

4. Click **Save** at the top, then **Continue** when prompted

### Step 5: Deploy Your Code

**Method A: Deployment Center (Recommended)**

1. In your Web App, go to **Deployment** → **Deployment Center**
2. Select **"Local Git"** or **"External Git"** if using GitHub
3. Or select **"ZIP Deploy"** for manual uploads

**Method B: Advanced Tools (Kudu)**

1. In your Web App, go to **Development Tools** → **Advanced Tools**
2. Click **Go →** (opens Kudu console)
3. In the Kudu menu, click **Tools** → **Zip Push Deploy**
4. Drag and drop your `deploy.zip` file into the browser window
5. Wait for deployment to complete (~2-3 minutes)

**Method C: VS Code Azure Extension**

1. Install the **Azure App Service** extension in VS Code
2. Sign in to Azure (click Azure icon in sidebar)
3. Find your Web App under your subscription
4. Right-click → **Deploy to Web App**
5. Select your workspace folder

### Step 6: Verify Deployment

1. In Azure Portal, go to your Web App
2. Click **Browse** at the top to open your site
3. URL: `https://your-app-name.azurewebsites.net`

### Troubleshooting in Portal

**Check Logs:**
1. Go to **Monitoring** → **Log stream**
2. Wait for logs to appear
3. Look for startup errors or missing environment variables

**Common Issues:**
- **"Application Error"**: Check Configuration settings are correct
- **"Cannot GET /"**: Wait 2-3 minutes for deployment to complete
- **API errors**: Verify `AZURE_OPENAI_ENDPOINT` doesn't have `/openai/v1/` suffix

---

## Option 2: Azure CLI (For Automation)

### Prerequisites

- Azure CLI installed (`az --version` to check)
- Logged into Azure (`az login`)
- Your Azure OpenAI credentials ready

## Quick Deploy Steps

### 1. Choose a Unique App Name

Your app will be accessible at `https://<app-name>.azurewebsites.net`

```bash
export APP_NAME="sanskrit-daily-<your-initials>"
export RESOURCE_GROUP="rg-sanskrit-daily"
export LOCATION="eastus"
```

### 2. Create Azure Resources

```bash
# Check if resource group exists (skip creation if it does)
az group show --name $RESOURCE_GROUP 2>/dev/null || \
  az group create --name $RESOURCE_GROUP --location $LOCATION

# Create App Service plan (B1 tier - $13/month)
az appservice plan create \
  --name asp-sanskrit-daily \
  --resource-group $RESOURCE_GROUP \
  --is-linux \
  --sku B1

# Create Web App
az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan asp-sanskrit-daily \
  --name $APP_NAME \
  --runtime "NODE|20-lts"
```

**Note**: If the resource group already exists, the command will use it. If the App Service plan already exists, you'll get an error - either use a different name or use the existing one.

### 3. Configure Environment Variables

Replace the placeholders with your actual Azure OpenAI values:

```bash
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --settings \
    AZURE_OPENAI_ENDPOINT="https://YOUR-RESOURCE.openai.azure.com" \
    AZURE_OPENAI_API_KEY="YOUR-API-KEY-HERE" \
    AZURE_OPENAI_DEPLOYMENT="YOUR-DEPLOYMENT-NAME" \
    AZURE_OPENAI_API_VERSION="2024-10-21" \
    SCM_DO_BUILD_DURING_DEPLOYMENT=true \
    WEBSITE_NODE_DEFAULT_VERSION="~20"
```

### 4. Deploy the Application

```bash
# Create deployment zip (excludes node_modules, dist, .env)
zip -r deploy.zip . -x "*.git*" "node_modules/*" "dist/*" ".env" ".DS_Store" "*.zip"

# Deploy to Azure
az webapp deploy \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --src-path deploy.zip \
  --type zip

# Clean up
rm deploy.zip
```

### 5. Verify Deployment

```bash
# Open in browser
az webapp browse --resource-group $RESOURCE_GROUP --name $APP_NAME

# Check logs
az webapp log tail --resource-group $RESOURCE_GROUP --name $APP_NAME
```

Your app should now be live at `https://$APP_NAME.azurewebsites.net`!

## Troubleshooting

### Check Application Logs

```bash
# Enable logging
az webapp log config \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --application-logging filesystem \
  --level information

# Stream logs
az webapp log tail --resource-group $RESOURCE_GROUP --name $APP_NAME
```

### Common Issues

1. **App shows "Application Error"**
   - Check if environment variables are set correctly
   - Verify the build completed successfully in deployment logs
   - Check the startup command is set to `npm start`

2. **"Resource not found" API errors**
   - Verify `AZURE_OPENAI_ENDPOINT` doesn't have `/openai/v1/` suffix
   - Should be: `https://your-resource.openai.azure.com` (no trailing path)

3. **Build fails during deployment**
   - Ensure `SCM_DO_BUILD_DURING_DEPLOYMENT=true` is set
   - Check that Node.js 20 is being used

### Manual Startup Command (if needed)

```bash
az webapp config set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --startup-file "npm start"
```

## Update Existing Deployment

To deploy updates after making code changes:

```bash
# Build locally first (optional)
npm run build

# Create new deployment package
zip -r deploy.zip . -x "*.git*" "node_modules/*" "dist/*" ".env" ".DS_Store" "*.zip"

# Deploy
az webapp deploy \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --src-path deploy.zip \
  --type zip

rm deploy.zip
```

## Cost Optimization

- **B1 Basic tier (Linux)**: ~$13/month, suitable for personal projects
- **F1 Free tier (Linux)**: Available but has limitations (60 min/day CPU time)
- To use Free tier:
  ```bash
  az appservice plan create \
    --name asp-sanskrit-daily-free \
    --resource-group $RESOURCE_GROUP \
    --is-linux \
    --sku F1
  ```

### Want to use Windows instead?

If you need Windows for some reason (not recommended for Node.js):
- Remove `--is-linux` flag from the App Service Plan creation
- Add `web.config` file (not needed for Linux)
- Expect ~30-40% higher costs for the same tier
- Runtime would be `"node|20-lts"` (same syntax)

## Cleanup Resources

To remove all Azure resources and stop billing:

```bash
az group delete --name $RESOURCE_GROUP --yes --no-wait
```

## Quick Reference: Update Existing Deployment

### Via Portal:
1. Create new `deploy.zip` 
2. Go to Web App → **Advanced Tools** → **Go**
3. **Tools** → **Zip Push Deploy**
4. Drag and drop new ZIP

### Via CLI:
```bash
zip -r deploy.zip . -x "*.git*" "node_modules/*" "dist/*" ".env" ".DS_Store" "*.zip"
az webapp deploy --resource-group $RESOURCE_GROUP --name $APP_NAME --src-path deploy.zip --type zip
rm deploy.zip
```

## Summary

- ✅ **Portal method** is easiest for beginners
- ✅ Use **Linux** hosting for best Node.js performance and cost
- ✅ **B1 Basic tier** (~$13/month) is ideal for personal projects
- ✅ Keep environment variables in Azure Portal, never commit `.env` to git
