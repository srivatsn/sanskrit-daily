# Sanskrit Daily (PWA + Azure Foundry)

A mobile-first Sanskrit learning app with:
- `Discover`: gets a fresh Sanskrit sentence from an LLM, with increasing difficulty.
- `Analyze`: sends any Sanskrit sentence to the LLM for word-by-word breakdown and explanation.
- PWA support: install on phone from browser (no app store account needed).

## Architecture
- Frontend: static files in `public/`.
- Backend: TypeScript Express server in `src/server.ts`.
- LLM: Azure OpenAI / Azure AI Foundry chat completion endpoint.

## Local Run

1. Install Node.js 20+.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env` from `.env.example` and fill your Azure values.
4. Start dev server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

- `AZURE_OPENAI_ENDPOINT` - e.g. `https://<resource>.openai.azure.com`
- `AZURE_OPENAI_API_KEY` - API key
- `AZURE_OPENAI_DEPLOYMENT` - deployment/model name
- `AZURE_OPENAI_API_VERSION` - default `2024-10-21`
- `PORT` - optional, defaults to `3000`

Compatibility aliases are also accepted:
- `AZURE_FOUNDRY_ENDPOINT`
- `AZURE_FOUNDRY_API_KEY`
- `AZURE_FOUNDRY_DEPLOYMENT`

## Build & Start

```bash
npm run build
npm start
```

## Deploy to Azure Web App (Linux)

**Note**: These instructions use Linux App Service, which is more cost-effective than Windows (~30% cheaper for Node.js apps).

### Option 1: Azure Portal (No CLI Required)

**Quick Steps:**
1. Build your app: `npm run build`
2. Create a ZIP: Compress all files except `node_modules`, `dist`, `.env`, `.git`
3. Go to [Azure Portal](https://portal.azure.com) → Create a resource → Web App
   - **Runtime**: Node 20 LTS
   - **OS**: Linux
   - **Pricing**: B1 Basic (~$13/month)
4. After creation, go to **Configuration** → Add application settings:
   ```
   AZURE_OPENAI_ENDPOINT=https://YOUR-RESOURCE.openai.azure.com
   AZURE_OPENAI_API_KEY=your-key
   AZURE_OPENAI_DEPLOYMENT=gpt-4.1-mini
   AZURE_OPENAI_API_VERSION=2024-10-21
   SCM_DO_BUILD_DURING_DEPLOYMENT=true
   ```
5. Deploy: **Advanced Tools** → **Go** → **Tools** → **Zip Push Deploy** → Drag your ZIP

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed step-by-step instructions with screenshots.

### Option 2: Using Azure CLI

### Option 2: Using Azure CLI

1. **Build locally first (optional but recommended)**:
   ```bash
   npm run build
   ```

2. **Create Azure resources** (one-time setup):
   ```bash
   # If resource group doesn't exist yet, create it
   az group create --name rg-sanskrit-daily --location eastus
   
   # Create App Service plan
   az appservice plan create --name asp-sanskrit-daily --resource-group rg-sanskrit-daily --is-linux --sku B1
   
   # Create Web App
   az webapp create --resource-group rg-sanskrit-daily --plan asp-sanskrit-daily --name <unique-app-name> --runtime "NODE|20-lts"
   ```
   
   **Note**: If you already have the resource group `rg-sanskrit-daily`, skip the first command.

3. **Configure environment variables**:
   ```bash
   az webapp config appsettings set \
     --resource-group rg-sanskrit-daily \
     --name <unique-app-name> \
     --settings \
       AZURE_OPENAI_ENDPOINT="https://<resource>.openai.azure.com" \
       AZURE_OPENAI_API_KEY="<your-api-key>" \
       AZURE_OPENAI_DEPLOYMENT="<deployment-name>" \
       AZURE_OPENAI_API_VERSION="2024-10-21" \
       SCM_DO_BUILD_DURING_DEPLOYMENT=true
   ```

4. **Deploy using ZIP**:
   ```bash
   # Exclude unnecessary files
   zip -r deploy.zip . -x "*.git*" "node_modules/*" "dist/*" ".env" ".DS_Store"
   
   az webapp deploy \
     --resource-group rg-sanskrit-daily \
     --name <unique-app-name> \
     --src-path deploy.zip \
     --type zip
   ```

5. **Configure startup command** (if not auto-detected):
   ```bash
   az webapp config set \
     --resource-group rg-sanskrit-daily \
     --name <unique-app-name> \
     --startup-file "npm start"
   ```

6. Visit: `https://<unique-app-name>.azurewebsites.net`

### Option 3: Using VS Code Azure Extension

1. Install **Azure App Service** extension in VS Code
2. Sign in to Azure
3. Right-click on the `App Services` section and select **Create New Web App**
4. Follow the prompts to create the web app
5. Right-click on your new web app and select **Deploy to Web App**
6. Add environment variables in the Azure Portal under **Configuration > Application settings**

For detailed instructions with all options, see **[DEPLOYMENT.md](DEPLOYMENT.md)**.

## Install as PWA on Phone

- Open the site URL in Chrome/Edge on Android.
- Tap browser menu -> `Install app` / `Add to Home screen`.
- Launch from home screen as a standalone app.

## Notes

- Discover difficulty increases daily and with each tap on `New Sentence`.
- API keys stay server-side; frontend never exposes Azure credentials.
- `src/client.ts` is the typed frontend source; `public/app.js` is the runtime client script.
