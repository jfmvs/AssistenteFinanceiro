const TelegramBot = require('node-telegram-bot-api');
const OpenAi = require('openai');
const dotenv = require('dotenv');
const { postLinkSheet, writeOnSheet } = require('./sheetsUtils');
const {
  defaultChatDefinition,
  chatStoreCashFlowDefinition,
} = require('./constants');
const { generateChart } = require('./chartUtils');

dotenv.config();
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

const openai = new OpenAi({ apiKey: process.env.OPENAI_API_KEY || '' });

const userState = {};

bot.setMyCommands([
  { command: 'store', description: 'Guardar seu fluxo de caixa' },
  { command: 'link', description: 'Adicionar link da planilha' },
  { command: 'talk', description: 'Fale com o bot sobre suas finaças' },
  {
    command: 'chart',
    description: 'Crie gráficos com base nas suas finanças',
  },
  { command: 'help', description: 'Para ver todos os comandos' },
  { command: 'sheet', description: 'Adicionar o fluxo na sua planilha' },
]);

async function showOptions(chatId) {
  const commands = await bot.getMyCommands();

  const commandsList = commands
    .map((cmd) => `/${cmd.command} - ${cmd.description}`)
    .join('\n');

  bot.sendMessage(
    chatId,
    'Caso você não tenha escolhido nenhum ele está no estado de /store'
  );
  bot.sendMessage(
    chatId,
    `Aqui estão os comandos disponíveis:\n\n${commandsList}`
  );
}

bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  showOptions(chatId);
});

bot.onText(/\/link/, async (msg) => {
  const chatId = msg.chat.id;

  if (!userState[chatId]?.sheetLink) {
    userState[chatId].state = 'link';

    bot.sendMessage(
      chatId,
      'Por favor, envie o link de uma planilha do Google Sheets com permissão para edição.'
    );
  } else {
    bot.sendMessage(
      chatId,
      `Você já possui um link de planilha cadastrado: ${userState[chatId].sheetLink}`,
      { disable_web_page_preview: true }
    );
  }
});

bot.onText(/\/store/, async (msg) => {
  const chatId = msg.chat.id;

  userState[chatId].state = 'store';

  bot.sendMessage(chatId, 'Digite seu fluxo de caixa');
});

bot.onText(/\/sheet/, async (msg) => {
  const chatId = msg.chat.id;
  const transactions = userState[chatId].transactions;

  if (!transactions || transactions?.length === 0) {
    bot.sendMessage(
      chatId,
      'Você não tem nenhum fluxo de caixa guardado. Digite /store para guardar'
    );
    return;
  }

  if (userState[chatId]?.sheetLink) {
    bot.sendMessage(
      chatId,
      'Você não tem link cadastrado. Digite /link para cadastrar'
    );
    return;
  }

  writeOnSheet(
    userState[chatId].transactions,
    userState[chatId].spreadsheetId,
    bot,
    chatId
  );
});

bot.onText(/\/chart/, async (msg) => {
  const chatId = msg.chat.id;
  const transactions = userState[chatId].transactions;

  if (!transactions || transactions?.length === 0) {
    bot.sendMessage(
      chatId,
      'Você não tem nenhum fluxo de caixa guardado. Digite /store para guardar'
    );
    return;
  }

  await generateChart(transactions);
  const imageBuffer = await generateChart(transactions);

  bot.sendPhoto(chatId, imageBuffer);
});

bot.onText(/\/talk/, async (msg) => {
  const chatId = msg.chat.id;
  userState[chatId].state = 'talk';
  bot.sendMessage(chatId, 'Pode tirar suas dúvidas');
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userMessage = msg.text;

  if (!userState[chatId]) {
    userState[chatId] = {
      state: 'store',
      transactions: [],
    };
  }

  if (!userMessage || userMessage.startsWith('/')) return;

  try {
    if (userState[chatId]?.state === 'store') {
      const intentResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: chatStoreCashFlowDefinition },
          { role: 'user', content: userMessage },
        ],
        response_format: { type: 'json_object' },
      });

      const jsonParsed = JSON.parse(
        intentResponse.choices[0]?.message?.content
      );

      const transactions = jsonParsed.transacoes;

      userState[chatId].transactions.push(...transactions);
    }

    if (userState[chatId]?.state === 'link') {
      postLinkSheet(userState, msg, bot);
      userState[chatId].state = '';
      return;
    }

    if (userState[chatId]?.state === 'talk') {
      const intentResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: defaultChatDefinition },
          { role: 'user', content: userMessage },
        ],
      });

      bot.sendMessage(chatId, intentResponse.choices[0]?.message?.content);
      bot.sendMessage(chatId, 'Você tem mais alguma duvida?');
    }
  } catch (error) {
    console.log(error);
    bot.sendMessage(chatId, 'Ocorreu um erro ao processar sua solicitação.');
  }
});
