require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const OpenAI = require('openai');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL; // Required for Telegram webhook setup (e.g., your Railway app URL)
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://railway.app", // Optional
    "X-Title": "Teacher AI Bot", // Optional
  }
});

// Load Users Database (Simple JSON file for this example)
const USERS_FILE = './users.json';
let users = {};

if (fs.existsSync(USERS_FILE)) {
  const data = fs.readFileSync(USERS_FILE);
  users = JSON.parse(data);
}

function saveUsers() {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Teacher Configuration
const SYSTEM_PROMPT = `
You are Mr. Ahmed Hassan, a friendly Mathematics teacher with 10 years of experience.
Your teaching style is friendly, simple, and you use examples to explain concepts.
Your Schedule:
- Sunday: 6 PM - 9 PM
- Tuesday: 6 PM - 9 PM
- Thursday: 6 PM - 9 PM

Rules:
1. Be polite and friendly.
2. Answer like a human teacher, not a robot.
3. If a question is "خارج المنهج" (out of scope), politely guide the student back to math, but do not give wrong information.
4. Keep answers concise for a chat interface.
`.trim();

// Setup Webhook Route
app.post('/webhook', async (req, res) => {
  // Acknowledge Telegram immediately to prevent retries
  res.sendStatus(200);

  const message = req.body.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const text = message.text;

  try {
    await handleIncomingMessage(chatId, text);
  } catch (error) {
    console.error('Error handling message:', error);
  }
});

async function handleIncomingMessage(chatId, text) {
  // Check if user exists
  if (!users[chatId]) {
    users[chatId] = {
      state: 'WAITING_FOR_NAME',
      history: []
    };
    saveUsers();
    await sendMessage(chatId, "Welcome! I am Mr. Ahmed Hassan, your Mathematics teacher. 👋\nBefore we start, could you please tell me your name?");
    return;
  }

  const user = users[chatId];

  // State Machine for Registration
  if (user.state === 'WAITING_FOR_NAME') {
    user.name = text;
    user.state = 'WAITING_FOR_PHONE';
    saveUsers();
    await sendMessage(chatId, `Nice to meet you, ${user.name}! Could you please share your phone number?`);
    return;
  }

  if (user.state === 'WAITING_FOR_PHONE') {
    user.phone = text;
    user.state = 'WAITING_FOR_GENDER';
    saveUsers();
    await sendMessage(chatId, "Great! Almost done. Are you Male or Female? (M/F)");
    return;
  }

  if (user.state === 'WAITING_FOR_GENDER') {
    user.gender = text;
    user.state = 'REGISTERED';
    saveUsers();
    await sendMessage(chatId, `Thank you for registering, ${user.name}! Registration complete.\nHow can I help you with Mathematics today?`);
    return;
  }

  // Registered state: Forward to AI
  if (user.state === 'REGISTERED') {
    // Add user message to history
    user.history.push({ role: 'user', content: text });

    // Limit history to last 10 messages to save tokens
    if (user.history.length > 20) {
      user.history.shift();
      user.history.shift(); // Keep pairs (user, assistant) synced approximately if possible
    }

    saveUsers();

    // Send to OpenAI
    const aiResponseText = await getOpenAIResponse(user.name, user.history);

    // Save AI response to history
    user.history.push({ role: 'assistant', content: aiResponseText });
    saveUsers();

    // Send back to student
    await sendMessage(chatId, aiResponseText);
  }
}

async function getOpenAIResponse(studentName, history) {
  const messages = [
    { role: 'system', content: `${SYSTEM_PROMPT}\nThe student's name is ${studentName}.` },
    ...history
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "meta-llama/llama-3-8b-instruct:free", // Using a free high-quality OpenRouter model
      messages: messages,
      temperature: 0.7,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error("OpenAI API Error:", error);
    return "أعتذر يا بني، أواجه مشكلة بسيطة في التركيز الآن. هل يمكنك إعادة سؤالك لاحقًا؟";
  }
}

async function sendMessage(chatId, text) {
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: text,
    });
  } catch (error) {
    console.error("Telegram API Error:", error.response ? error.response.data : error.message);
  }
}

// Helper Endpoint check status
app.get('/', (req, res) => {
  res.send('Teacher Bot is running!');
});

// Endpoint to manually set the webhook
app.get('/set-webhook', async (req, res) => {
  try {
    const response = await axios.post(`${TELEGRAM_API}/setWebhook`, {
      url: `${WEBHOOK_URL}/webhook`,
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Teacher Bot Server running on port ${PORT}`);
  console.log(`Make sure TELEGRAM_BOT_TOKEN and OPENROUTER_API_KEY are matched in .env`);
});
