const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  keyFile: 'teste-planilha-451403-ffc67c9268ee.json', // Arquivo JSON das credenciais da Service Account
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Função para criar a aba "Controle Financeiro"
async function createSheetTab(spreadsheetId) {
  try {
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetInfo = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    const sheetExists = spreadsheetInfo.data.sheets.some(
      (sheet) => sheet.properties.title === 'Controle Financeiro'
    );

    if (!sheetExists) {
      response = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: 'Controle Financeiro', // Nome da nova aba
                },
              },
            },
          ],
        },
      });

      let sheetId = response.data.replies[0].addSheet.properties.sheetId;

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "'Controle Financeiro'!A1:D1", // Definindo o intervalo de células para o cabeçalho
        valueInputOption: 'RAW', // Para valores não formatados
        requestBody: {
          values: [
            ['Data', 'Categoria', 'Entrada/Saída', 'Valor'], // Cabeçalhos do controle financeiro
          ],
        },
      });

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: sheetId, // Aba recém-criada, você pode precisar confirmar o ID da planilha
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: 4,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.3, green: 0.6, blue: 0.3 }, // Cor de fundo verde claro
                    textFormat: {
                      bold: true, // Texto em negrito
                      foregroundColor: { red: 1, green: 1, blue: 1 }, // Cor do texto branca
                      fontSize: 12,
                      italic: false,
                    },
                    horizontalAlignment: 'CENTER', // Alinhamento centralizado
                    verticalAlignment: 'MIDDLE', // Alinhamento vertical centralizado
                  },
                },
                fields:
                  'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)', // Aplicar a formatação
              },
            },
          ],
        },
      });

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: sheetId, // Aba recém-criada, você pode precisar confirmar o ID da planilha
                  startRowIndex: 1, // Começa a partir da segunda linha (linha 1)
                  endRowIndex: 1000, // Aplica até a linha 1000, ajustando conforme necessário
                  startColumnIndex: 0, // Coluna A
                  endColumnIndex: 4, // Coluna D (4 é a coluna E, então 4 não inclui E)
                },
                cell: {
                  userEnteredFormat: {
                    horizontalAlignment: 'CENTER', // Alinhamento horizontal centralizado
                    verticalAlignment: 'MIDDLE', // Alinhamento vertical centralizado
                  },
                },
                fields:
                  'userEnteredFormat(horizontalAlignment,verticalAlignment)', // Aplica apenas o alinhamento
              },
            },
          ],
        },
      });

      console.log(
        "Aba 'Controle Financeiro' criada e cabeçalhos atualizados com sucesso."
      );
    } else {
      console.log("A aba 'Controle Financeiro' já existe.");
    }
  } catch (error) {
    if (error.response) {
      throw new Error(
        `${error.response.data.error.message} (Código: ${error.response.status})`
      );
    } else {
      throw new Error(`Erro inesperado: ${error.message}`);
    }
  }
}

// Add to line sheet
async function addRowToSheet(spreadsheetId, data) {
  try {
    if (!data.categoria || !data.fluxo || !data.valor) {
      throw new Error(
        "Dados inválidos. Certifique-se de que 'categoria', 'fluxo' e 'valor' estão presentes."
      );
    } else {
      const sheets = google.sheets({ version: 'v4', auth });
      // Calculando a data atual
      const currentDate = new Date();
      const formattedDate = currentDate.toLocaleDateString('pt-BR'); // Ex: "19/02/2025"

      // Preparando os dados para inserir
      const row = [
        formattedDate, // Data
        data.categoria, // Categoria
        data.fluxo, // Entrada/Saída
        data.valor, // Valor
      ];
      console.log('Dados a serem adicionados:', row);

      // Encontrar a última linha disponível
      const getRowsResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "'Controle Financeiro'!A:A", // Obtendo a coluna A para verificar a última linha preenchida
      });

      const numRows = getRowsResponse.data.values
        ? getRowsResponse.data.values.length
        : 0;
      const nextRow = numRows + 1; // A próxima linha a ser inserida

      // Inserindo os dados na próxima linha
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'Controle Financeiro'!A${nextRow}:D${nextRow}`,
        valueInputOption: 'RAW', // Para valores não formatados
        requestBody: {
          values: [row],
        },
      });

      console.log('Dados adicionados com sucesso!');
    }
  } catch (error) {
    console.error('Erro ao adicionar dados na planilha:', error);
  }
}

// Add link
async function postLinkSheet(userState, msg, bot) {
  const chatId = msg.chat.id;
  const userMessage = msg.text;

  if (!userState[chatId]?.sheetLink) {
    const sheetLinkPattern =
      /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;

    const match = userMessage.match(sheetLinkPattern);

    if (match) {
      const spreadsheetId = match[1];
      userState[chatId] = {
        sheetLink: userMessage,
        spreadsheetId,
        ...userState[chatId],
      };

      try {
        await createSheetTab(spreadsheetId);
        bot.sendMessage(
          chatId,
          'Link da planilha recebido com sucesso! Para começar a guardar suas transações digite /store. Ou se ja quiser exportar para planilha digite /sheet'
        );
      } catch (error) {
        bot.sendMessage(
          chatId,
          `Ocorreu um erro durante o processo: ${error.message}`
        );
      }
    } else {
      bot.sendMessage(
        chatId,
        'Por favor, envie o link de uma planilha do Google Sheets com permissão para edição.'
      );
    }
    return;
  }
}

async function writeOnSheet(cashflow, spreadsheetId, bot, chatId) {
  for (const entry of cashflow) {
    await addRowToSheet(spreadsheetId, entry);
  }
  bot.sendMessage(
    chatId,
    'Todas as informações foram cadastradas. Como mais posso ajudar?'
  );
}

module.exports = { createSheetTab, addRowToSheet, postLinkSheet, writeOnSheet };
