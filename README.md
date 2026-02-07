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

1. Create resources (once):
   ```bash
   az group create --name rg-sanskrit-daily --location eastus
   az appservice plan create --name asp-sanskrit-daily --resource-group rg-sanskrit-daily --is-linux --sku B1
   az webapp create --resource-group rg-sanskrit-daily --plan asp-sanskrit-daily --name <unique-app-name> --runtime "NODE|20-lts"
   ```

2. Set app settings (environment vars):
   ```bash
   az webapp config appsettings set \
     --resource-group rg-sanskrit-daily \
     --name <unique-app-name> \
     --settings \
       AZURE_OPENAI_ENDPOINT="https://<resource>.openai.azure.com" \
       AZURE_OPENAI_API_KEY="<key>" \
       AZURE_OPENAI_DEPLOYMENT="<deployment>" \
       AZURE_OPENAI_API_VERSION="2024-10-21" \
       SCM_DO_BUILD_DURING_DEPLOYMENT=true
   ```

3. Deploy code (from project root):
   ```bash
   zip -r app.zip .
   az webapp deploy --resource-group rg-sanskrit-daily --name <unique-app-name> --src-path app.zip --type zip
   ```

4. Set startup command in Azure Web App:
   - Startup command: `npm start`

## Install as PWA on Phone

- Open the site URL in Chrome/Edge on Android.
- Tap browser menu -> `Install app` / `Add to Home screen`.
- Launch from home screen as a standalone app.

## Notes

- Discover difficulty increases daily and with each tap on `New Sentence`.
- API keys stay server-side; frontend never exposes Azure credentials.
- `src/client.ts` is the typed frontend source; `public/app.js` is the runtime client script.
