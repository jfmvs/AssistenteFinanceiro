const TelegramBot =  require("node-telegram-bot-api");
const OpenAi = require("openai");
const dotenv = require("dotenv");
const { createSheetTab, addRowToSheet } = require("./sheetsUtils");

dotenv.config();
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

const openai = new OpenAi({ apiKey: process.env.OPENAI_API_KEY || ""})

const userState = {};


bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userMessage = msg.text;

  if (!userMessage) return;

  if (!userState[chatId]?.sheetLink) {
    // Verifica se a mensagem é um link válido do Google Sheets
    const sheetLinkPattern = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
    const match = userMessage.match(sheetLinkPattern);

    if (match) {
      const spreadsheetId = match[1]; // Extrai o ID da planilha do link
      userState[chatId] = { sheetLink: userMessage, spreadsheetId };

      // Cria a aba "Controle Financeiro"
      try {
        // Tenta criar a aba e armazena o retorno
        await createSheetTab(spreadsheetId);
      
        // Se chegou aqui, a aba foi criada com sucesso (nenhum erro foi lançado)
        bot.sendMessage(
          chatId,
          "Link da planilha recebido com sucesso! A aba 'Controle Financeiro' foi criada. Como posso ajudar você com ela?"
        );
      } catch (error) {
        // Caso ocorra um erro, ele será tratado aqui
        console.error("Erro ao criar a aba:", error.message);
        bot.sendMessage(chatId, `Ocorreu um erro durante o processo: ${error.message}`);
      }

    } else {
      bot.sendMessage(chatId, "Por favor, envie o link de uma planilha do Google Sheets com permissão para edição.");
    }
    return;
  }

  try {
    const intentResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
          { 
              role: "system", 
              content:
              `Você é um assistente financeiro especializado em guardar informações organizadas em uma planilha. Se o usuário quiser mudar o link da planilha retorne APENAS 'renovar', se o usuário quer adicionar um valor de entrada (lucro) ou saída (despesa) retorne APENAS com um
              um dicionario com os campos bem definidos, sem acentos e categoria ampla {CATEGORIA, fluxo (entrada ou saida), valor}. Se o usuário estiver pedindo o link da planilha, responda apenas com 'link', se 
              não tiver nenhuma dessas correspondências responda normalmente.`,
            },
          { role: "user", content: userMessage }
      ],
    });

    let intent = intentResponse.choices[0]?.message?.content?.trim().toLowerCase();
    console.log("Intent:", intent);

    if (intent === "link") {
      bot.sendMessage(chatId, `Aqui está o link da sua planilha: ${userState[chatId].sheetLink}`);
      return;
    } else if (intent === "renovar") {
      delete userState[chatId];
      bot.sendMessage(chatId, "Por favor, envie o link de uma planilha do Google Sheets com permissão para edição.");
      return;
    }

    intent = intent.replace(/'/g, '"');
  
    let parsedIntent;
    try {
      parsedIntent = JSON.parse(intent); // Tenta interpretar como JSON

      if (Array.isArray(parsedIntent)) {
        // Caso o intent seja uma lista de objetos
        for (const entry of parsedIntent) {
          await addRowToSheet(userState[chatId].spreadsheetId, entry); // Adiciona cada item da lista
        }
        bot.sendMessage(chatId, "Todas as informações foram cadastradas. Como mais posso ajudar?");
      } else {
        // Caso o intent seja um único objeto
        await addRowToSheet(userState[chatId].spreadsheetId, parsedIntent);
        bot.sendMessage(chatId, "Informação cadastrada. Como mais posso ajudar?");
      }
    } catch (error) {
      // Caso não seja JSON, responde normalmente
      bot.sendMessage(chatId, intent); // Envia a resposta normal da LLM para o usuário
      return;
    }

  } catch (error) {
    console.error("Erro:", error);
    bot.sendMessage(chatId, "Ocorreu um erro ao processar sua solicitação.");
  }
});