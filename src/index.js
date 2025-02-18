const TelegramBot =  require("node-telegram-bot-api");
const OpenAi = require("openai");
const dotenv = require("dotenv");

dotenv.config();
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

const openai = new OpenAi({ apiKey: process.env.OPENAI_API_KEY || ""})

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userMessage = msg.text;

  if (!userMessage) return;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
          { 
              role: "system", 
              content: "Você é um assistente financeiro especializado em ajudar usuários a gerenciar seus gastos. Você recebe relatórios de despesas, fornece resumos mensais, identifica padrões de consumo e sugere maneiras de economizar e alcançar objetivos financeiros. Responda de forma clara, objetiva e com insights úteis." 
          },
          { role: "user", content: userMessage }
      ],
    });

    const botReply = response.choices[0]?.message?.content || "Não consegui entender.";

    bot.sendMessage(chatId, botReply);
  } catch (error) {
    console.error("Erro:", error);
    bot.sendMessage(chatId, "Ocorreu um erro ao processar sua solicitação.");
  }
});