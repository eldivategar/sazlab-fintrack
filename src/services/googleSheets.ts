export class GoogleApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'GoogleApiError';
  }
}

/**
 * Searches the user's Google Drive for a spreadsheet named 'SiPaling Hemat Data'.
 * @param token Google OAuth2 Access Token
 * @returns The spreadsheet ID if found, otherwise null.
 */
export async function searchSpreadsheet(token: string): Promise<string | null> {
  try {
    const query = encodeURIComponent("name = 'SiPaling Hemat Data' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new GoogleApiError('UNAUTHORIZED', 401);
      }
      const errText = await response.text();
      throw new GoogleApiError(`Failed to search spreadsheet: ${errText}`, response.status);
    }

    const data = await response.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  } catch (error) {
    console.error('Error in searchSpreadsheet:', error);
    throw error;
  }
}

/**
 * Creates a new spreadsheet named 'SiPaling Hemat Data' with a 'Transaksi' sheet.
 * @param token Google OAuth2 Access Token
 * @returns The spreadsheet ID of the newly created spreadsheet.
 */
export async function createSpreadsheet(token: string): Promise<string> {
  try {
    const url = 'https://sheets.googleapis.com/v4/spreadsheets';
    const body = {
      properties: {
        title: 'SiPaling Hemat Data',
      },
      sheets: [
        {
          properties: {
            sheetId: 0,
            title: 'Transaksi',
          },
        },
      ],
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new GoogleApiError('UNAUTHORIZED', 401);
      }
      const errText = await response.text();
      throw new GoogleApiError(`Failed to create spreadsheet: ${errText}`, response.status);
    }

    const data = await response.json();
    return data.spreadsheetId;
  } catch (error) {
    console.error('Error in createSpreadsheet:', error);
    throw error;
  }
}

/**
 * Initializes the header columns in the 'Transaksi' sheet.
 * Header: Tanggal | Kategori | Keterangan/Item | Nominal | Pembayaran | Catatan | Sumber Input
 * @param token Google OAuth2 Access Token
 * @param spreadsheetId Google Spreadsheet ID
 */
export async function initializeHeaders(token: string, spreadsheetId: string): Promise<void> {
  try {
    const range = 'Transaksi!A1:G7';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
    const body = {
      values: [
        ['Tanggal', 'Kategori', 'Keterangan / Item', 'Nominal', 'Pembayaran', 'Catatan', 'Sumber Input'],
        ['', '', 'Total Budget Cash', 0, '', 'Jangan diubah (Budget Bulanan Cash)', ''],
        ['', '', 'Total Budget Paylater', 0, '', 'Jangan diubah (Budget Bulanan Paylater)', ''],
        ['', '', 'Sisa Saldo Cash', '=D2-SUMIF(E8:E;"Cash";D8:D)', '', 'Rumus Otomatis (Sisa Saldo Cash = Total Budget Cash - Pengeluaran Cash)', ''],
        ['', '', 'Sisa Saldo Paylater', '=D3-SUMIF(E8:E;"Paylater";D8:D)', '', 'Rumus Otomatis (Sisa Saldo Paylater = Total Budget Paylater - Pengeluaran Paylater)', ''],
        ['', '', 'Total Sisa Saldo', '=D4+D5', '', 'Rumus Otomatis (Total Sisa Saldo = Sisa Saldo Cash + Sisa Saldo Paylater)', ''],
        ['', '', '', '', '', '', '']
      ],
    };

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new GoogleApiError('UNAUTHORIZED', 401);
      }
      const errText = await response.text();
      throw new GoogleApiError(`Failed to initialize headers: ${errText}`, response.status);
    }

    // Add protection for metadata/header rows (A1:G7) with warning only
    const protectUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    const protectBody = {
      requests: [
        {
          addProtectedRange: {
            protectedRange: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 7,
                startColumnIndex: 0,
                endColumnIndex: 7,
              },
              description: 'Proteksi Metadata & Formula SiPaling Hemat (Jangan diubah)',
              warningOnly: true,
            },
          },
        },
      ],
    };

    try {
      const protectResponse = await fetch(protectUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(protectBody),
      });

      if (!protectResponse.ok) {
        console.warn('Failed to add protected range warning:', await protectResponse.text());
      }
    } catch (protectErr) {
      console.warn('Network error setting spreadsheet protection:', protectErr);
    }
  } catch (error) {
    console.error('Error in initializeHeaders:', error);
    throw error;
  }
}

/**
 * Appends a new transaction row to the 'Transaksi' sheet.
 * @param token Google OAuth2 Access Token
 * @param spreadsheetId Google Spreadsheet ID
 * @param row Array of values to append: [Tanggal, Kategori, Keterangan, Nominal, Pembayaran, Catatan, SumberInput]
 */
export async function appendTransactionRow(
  token: string,
  spreadsheetId: string,
  row: any[],
  range: string = 'Transaksi!A2'
): Promise<void> {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;
    const body = {
      values: [row],
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new GoogleApiError('UNAUTHORIZED', 401);
      }
      const errText = await response.text();
      throw new GoogleApiError(`Failed to append transaction row: ${errText}`, response.status);
    }
  } catch (error) {
    console.error('Error in appendTransactionRow:', error);
    throw error;
  }
}

/**
 * Fetches all transaction rows from the 'Transaksi' sheet.
 * @param token Google OAuth2 Access Token
 * @param spreadsheetId Google Spreadsheet ID
 * @returns Array of rows (arrays of cell values).
 */
export async function getTransactionRows(token: string, spreadsheetId: string): Promise<any[][]> {
  try {
    const range = 'Transaksi!A2:G';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new GoogleApiError('UNAUTHORIZED', 401);
      }
      const errText = await response.text();
      throw new GoogleApiError(`Failed to fetch transactions: ${errText}`, response.status);
    }

    const data = await response.json();
    return data.values || [];
  } catch (error) {
    console.error('Error in getTransactionRows:', error);
    throw error;
  }
}

/**
 * Updates the budget values in the 'Transaksi' sheet.
 * @param token Google OAuth2 Access Token
 * @param spreadsheetId Google Spreadsheet ID
 * @param cashBudget The new cash budget
 * @param paylaterBudget The new paylater budget
 */
export async function updateBudgets(
  token: string,
  spreadsheetId: string,
  cashBudget: number,
  paylaterBudget: number
): Promise<void> {
  try {
    const range = 'Transaksi!D2:D3';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
    const body = {
      values: [
        [cashBudget],
        [paylaterBudget],
      ],
    };

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new GoogleApiError('UNAUTHORIZED', 401);
      }
      const errText = await response.text();
      throw new GoogleApiError(`Failed to update budgets: ${errText}`, response.status);
    }
  } catch (error) {
    console.error('Error in updateBudgets:', error);
    throw error;
  }
}

/**
 * Deletes a row in Google Sheets by its 0-indexed row number.
 * Uses batchUpdate dimension deletion.
 * @param token Google OAuth2 Access Token
 * @param spreadsheetId Google Spreadsheet ID
 * @param sheetRowIndex 0-indexed row number to delete
 */
export async function deleteTransactionRow(
  token: string,
  spreadsheetId: string,
  sheetRowIndex: number
): Promise<void> {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    const body = {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: 0, // guaranteed to be 0 for default Transaksi sheet
              dimension: 'ROWS',
              startIndex: sheetRowIndex - 1,
              endIndex: sheetRowIndex,
            },
          },
        },
      ],
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new GoogleApiError('UNAUTHORIZED', 401);
      }
      const errText = await response.text();
      throw new GoogleApiError(`Failed to delete row: ${errText}`, response.status);
    }
  } catch (error) {
    console.error('Error in deleteTransactionRow:', error);
    throw error;
  }
}

/**
 * Clears all transaction data and resets the budget to 0.
 * @param token Google OAuth2 Access Token
 * @param spreadsheetId Google Spreadsheet ID
 * @param isNewTemplate Boolean indicating if it's the new template structure
 */
export async function clearAllTransactions(
  token: string,
  spreadsheetId: string,
  isNewTemplate: boolean
): Promise<void> {
  try {
    const startRow = isNewTemplate ? 8 : 7;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`;
    const body = {
      ranges: [`Transaksi!A${startRow}:G`, 'Transaksi!D2:D3'],
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new GoogleApiError('UNAUTHORIZED', 401);
      }
      const errText = await response.text();
      throw new GoogleApiError(`Failed to clear transactions: ${errText}`, response.status);
    }
    
    // Also reset budget cells to 0
    await updateBudgets(token, spreadsheetId, 0, 0);
  } catch (error) {
    console.error('Error in clearAllTransactions:', error);
    throw error;
  }
}
