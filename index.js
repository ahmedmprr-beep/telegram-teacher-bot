require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL; // Required for Telegram webhook setup (e.g., your Railway app URL)
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

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
أنت الآن تعمل كسكرتير مساعد (Teacher Assistant) لمستر أحمد حسن، مدرس الرياضيات.
دورك هو مساعدة الطلاب، الرد على أسئلتهم البسيطة، تنظيم المواعيد، وتوجيههم، ولست المدرس نفسه.

معلومات مستر أحمد حسن (أستاذ المادة):
- المادة: رياضيات
- الخبرة: 10 سنين
- أسلوب الشرح: بسيط وبيشرح بالراحة

مواعيد الحصص المتاحة:
- الأحد: 6 مساءً - 9 مساءً
- الثلاثاء: 6 مساءً - 9 مساءً
- الخميس: 6 مساءً - 9 مساءً

قواعد هامة جداً (يجب الالتزام بها حرفياً):
1. الرد دائمًا باللغة العربية (عامية مصرية) فقط. ممنوع تماماً التحدث باللغة الإنجليزية أو الفصحى المعقدة.
2. كن ودوداً، لطيفاً، طبيعياً جداً كأنك إنسان حقيقي مش روبوت.
3. لا تقفز للإجابة مباشرة. إذا بدأ الطالب بسلام (مثل: السلام عليكم، إزيك) رد عليه التحية بشكل ودود واطلب منه كيف يمكنك مساعدته (مثال: "وعليكم السلام، أهلاً بيك يا بطل 😊 اقدر اساعدك إزاي؟").
4. إذا سأل الطالب عن المواعيد → اذكر له الأيام والأوقات المتاحة.
5. إذا سأل سؤالاً رياضياً → حاول مساعدته ببساطة وبطريقة سهلة زي المدرس.
6. إذا كان السؤال غير واضح → اطلب منه توضيح سؤاله.
7. إذا كان السؤال "خارج المنهج" → قوله بشكل لطيف إن ده مش ضمن المنهج أو الشرح وحاول ترجعه للمادة.
8. استخدم اسم الطالب لو متاح لكسر الحاجز بينكم.
9. خلي إجاباتك قصيرة ومناسبة للمحادثات (Chat).
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
    await sendMessage(chatId, "أهلاً بيك! معاك سكرتارية مستر أحمد حسن، مدرس الرياضيات. 👋\nعشان أقدر أساعدك، ممكن تقولي اسمك إيه؟");
    return;
  }

  const user = users[chatId];

  // State Machine for Registration
  if (user.state === 'WAITING_FOR_NAME') {
    user.name = text;
    user.state = 'WAITING_FOR_PHONE';
    saveUsers();
    await sendMessage(chatId, `طبعاً يا ${user.name}، فرصة سعيدة! ممكن تكتب لي رقم تليفونك؟`);
    return;
  }

  if (user.state === 'WAITING_FOR_PHONE') {
    user.phone = text;
    user.state = 'WAITING_FOR_GENDER';
    saveUsers();
    await sendMessage(chatId, "عاش جداً! آخر حاجة عشان نسجلك صح.. أنت طالب ولا طالبة؟ (ولد/بنت)");
    return;
  }

  if (user.state === 'WAITING_FOR_GENDER') {
    user.gender = text;
    user.state = 'REGISTERED';
    saveUsers();
    await sendMessage(chatId, `تم التسجيل بنجاح يا ${user.name}! نورتنا. 😊\nأقدر أساعدك إزاي النهاردة؟`);
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
    const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
      model: "meta-llama/llama-3-8b-instruct:free",
      messages: messages,
      temperature: 0.7,
    }, {
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://railway.app",
        "X-Title": "Teacher AI Bot",
        "Content-Type": "application/json"
      }
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("OpenRouter API Error:", error.response ? JSON.stringify(error.response.data) : error.message);
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

