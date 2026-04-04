# Telegram Teacher AI Bot

A Node.js based Telegram bot that acts like a human mathematics teacher. It handles user registration and leverages OpenAI's API to construct friendly and helpful answers based on a predefined teacher persona.

## Features
- **User Registration**: First-time interactors will be prompted to provide their name, phone number, and gender.
- **Teacher Persona**: Acts as Mr. Ahmed Hassan, a Mathematics teacher with 10 years of experience.
- **AI-Powered Answers**: Uses OpenAI's GPT models to provide responses.
- **State Management**: Simple state machine utilizing a `users.json` file for storage.
- **Webhook Integration**: Uses Telegram Webhook making it optimized for serverless/PaaS deployments like Railway.

## Local Setup

### Prerequisites
- Node.js installed on your machine
- Telegram Bot Token (from [@BotFather](https://t.me/botfather) on Telegram)
- OpenAI API Key

### Installation

1. Open a terminal in this directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in your keys:
   ```bash
   cp .env.example .env
   ```
   **Note**: If running locally, you might want to use a tool like [ngrok](https://ngrok.com/) to expose your local port 3000 to the internet so Telegram can hit your webhook, or you can temporarily switch to long-polling (not covered in this webhook-first setup).

4. Run the development server:
   ```bash
   npm start
   ```

## Deployment to Railway

This bot is fully prepared for deployment on [Railway.app](https://railway.app/).

1. Push this folder to a GitHub repository.
2. In Railway, click **New Project** and select **Deploy from GitHub repo**.
3. Select your repository. Railway will automatically detect Node.js and run `npm start`.
4. Go to the project's **Variables** tab in Railway and add the following:
   - `OPENAI_API_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `WEBHOOK_URL` (Wait until Railway gives you a public domain for your app, then paste `https://<your-railway-app-url>` here. NO trailing slash.)
5. Once your app is deployed and your `WEBHOOK_URL` is configured, visit the setup endpoint to tell Telegram where to send messages:
   ```
   https://<your-railway-app-url>/set-webhook
   ```
   If successful, you will see a JSON response stating `"Webhook was set"`.
6. Start chatting with your bot on Telegram!

## File Structure
- `index.js`: Main bot logic and Express server.
- `package.json`: Project metadata and dependencies.
- `users.json`: Simple file-based mock database for registering users and keeping chat history.
- `.env.example`: Template for environment variables.
