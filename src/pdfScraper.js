import * as pdfjsLib from 'pdfjs-dist'; //good library for processing pdfs (text-only)
import { createWorker } from 'tesseract.js'; //library for Optical Character Recognition (OCR) to convert image in PDFs to text

// Set the worker source to a CDN
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js'; //worker for pdfjs based on version

console.log('Worker source set to:', pdfjsLib.GlobalWorkerOptions.workerSrc);

// Converts a PDF page to an image (canvas).
const renderPageToCanvas = async (page) => {
  const viewport = page.getViewport({ scale: 2.0 }); // Increase scale for better OCR accuracy (2.0 is optimal)
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.height = viewport.height; //sets height and width based on pdf viewport dimensions
  canvas.width = viewport.width;

  const renderContext = {
    canvasContext: context,
    viewport: viewport,
  }; // renders the pdf page to the canvas and then returns it for processing
  
  await page.render(renderContext).promise;
  return canvas;
};

// Extracts text from an image-based PDF using OCR.
export const extractTextFromImagePDF = async (pdfData) => {
  console.log('Starting OCR process...');
  const worker = await createWorker('eng'); // Initialize tesseract worker with English language

  try {
    // Loads the PDF document
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;
    console.log(`PDF document loaded successfully. Total pages: ${pdf.numPages}`);

    let extractedText = '';

    // Process each page
    for (let i = 1; i <= pdf.numPages; i++) {
      console.log(`Processing page ${i}...`);
      const page = await pdf.getPage(i);

      // Render the page to a canvas
      const canvas = await renderPageToCanvas(page);

      // Convert the canvas to an image (PNG)
      const imageData = canvas.toDataURL('image/png');

      // Perform OCR on the image and gets the text
      const { data: { text } } = await worker.recognize(imageData);
      console.log(`Extracted text from page ${i}:`, text);

      extractedText += text + ' ';
    }

    return extractedText.trim();
  } finally {
    // Terminate the worker to free up resources
    await worker.terminate();
  }
};

// Extracts the name and address from the extracted text.
export const extractNameAndAddress = (text) => {
  console.log('Extracting name and address from text...');

  // Split the text into lines
  const lines = text.split('\n');

  // Extract the name (assuming it's on a specific line)
  const nameLine = lines.find((line) => line.match(/^([A-Z]{2,}(?:\s+[A-Z]+\.?)*\s+[A-Z]{2,})$/));
  const nameMatch = nameLine ? nameLine.match(/^([A-Z]{2,}(?:\s+[A-Z]+\.?)*\s+[A-Z]{2,})$/) : null;

  // Extract the address (assuming it's on specific lines)
  const addressLine1 = lines.find((line) => line.match(/\d+\s[A-Z]+\s[A-Z]+/));
  const addressLine2 = lines.find((line) => line.match(/[A-Z\s]+,\s[A-Z]+\s\d{5}/));

  //checks if both addressline1 and addressline2 exist and if not, returns null
  const addressMatch = addressLine1 && addressLine2 ? `${addressLine1.trim()}, ${addressLine2.trim()}` : null;

  console.log('Name match:', nameMatch);
  console.log('Address match:', addressMatch);

  return {
    name: nameMatch ? nameMatch[1].trim() : 'Not found',
    address: addressMatch || 'Not found',
  };
};

// Normalizes amount strings ONLY when improperly formatted
const normalizeAmountIfNeeded = (amountStr) => {
  // If already properly formatted (e.g., "123.45"), return as-is
  if (/^\d+\.\d{2}$/.test(amountStr)) {
    return parseFloat(amountStr);
  }
  
  // Clean the string 
  const cleanStr = amountStr.replace(/,|\s/g, '');
  
  // Handle 3-digit special case (423 to 4.23)
  if (cleanStr.length === 3) {
    return parseFloat(`${cleanStr[0]}.${cleanStr.slice(1)}`);
  }
  
  // Handle other lengths (5000 to 50.00)
  if (cleanStr.length >= 2) {
    return parseFloat(`${cleanStr.slice(0, -2)}.${cleanStr.slice(-2)}`);
  }
  
  return parseFloat(amountStr); 
};

// Calculates the total sum of all deposits found in the text
export const calculateTotalDeposits = (text) => {
  console.log('Calculating total deposits...');
  let totalDeposits = 0; 
  const lines = text.split('\n'); 
  let inDepositsSection = false; // Flag to track if we're in deposits section

  // Process each line of the text
  for (const line of lines) {
    // When we find the deposits header, mark that we're in deposits section
    if (line.includes('Deposits and Other Credits')) {
      inDepositsSection = true;
      continue; 
    }

    // If we find withdrawals header while in deposits section, exit section
    if (inDepositsSection && line.includes('Withdrawals and Other Debits')) {
      inDepositsSection = false;
      break; 
    }

    // If we're in deposits section, look for amounts
    if (inDepositsSection) {
      
      const amountMatch = line.match(/(\d+\.\d{2}|\d{3,})$/);
      if (amountMatch) {
        // Normalize amount format and add to total
        const amount = normalizeAmountIfNeeded(amountMatch[0]);
        console.log(`Deposit line: ${line.trim()} → Amount: ${amount}`);
        totalDeposits += amount;
      }
    }
  }

  console.log('Total deposits:', totalDeposits);
  return totalDeposits;
};

// Calculates the total sum of all ATM withdrawals found in the text
export const calculateTotalATMWithdrawals = (text) => {
  console.log('Calculating total ATM withdrawals...');
  let totalATMWithdrawals = 0; 
  const lines = text.split('\n'); 
  let inWithdrawalsSection = false; // Flag for withdrawals section

  // Process each line of the text
  for (const line of lines) {
    // When we find withdrawals header, mark that we're in withdrawals section
    if (line.includes('Withdrawals and Other Debits')) {
      inWithdrawalsSection = true;
      continue; 
    }

    // If we find deposits header while in withdrawals section, exit section
    if (inWithdrawalsSection && line.includes('Deposits and Other Credits')) {
      inWithdrawalsSection = false;
      break; 
    }

    // If we're in withdrawals section and line contains ATM withdrawal
    if (inWithdrawalsSection && line.includes('ATM WITHDRAWAL')) {
      // Find amounts at end of line
      const amountMatch = line.match(/(\d+\.\d{2}|\d{3,})$/);
      if (amountMatch) {
        // Normalize amount format and add to total
        const amount = normalizeAmountIfNeeded(amountMatch[0]);
        console.log(`ATM line: ${line.trim()} → Amount: ${amount}`);
        totalATMWithdrawals += amount;
      }
    }
  }

  console.log('Total ATM withdrawals:', totalATMWithdrawals);
  return totalATMWithdrawals;
};

// Extracts all Walmart purchase transactions from the text
export const extractWalmartPurchases = (text) => {
  console.log('Extracting Walmart purchases...');
  const lines = text.split('\n'); 
  const walmartPurchases = []; // Array to store found purchases

  // Process each line of the text
  for (const line of lines) {
    // Skip lines that don't contain both WAL-MART and POS PURCHASE
    if (!line.includes('WAL-MART') || !line.includes('POS PURCHASE')) continue;

    // Find amount at end of line
    const amountMatch = line.match(/(\d+\.\d{2}|\d{3,})$/);
    if (!amountMatch) continue; 

    // Normalize the amount format
    const amount = normalizeAmountIfNeeded(amountMatch[0]);
    console.log(`Normalized Walmart amount: ${amountMatch[0]} → ${amount}`);

    // Add purchase to array with date, description, and amount
    walmartPurchases.push({
      date: line.substring(0, 5).trim(), // Extract first 5 chars as date
      description: 'POS PURCHASE',
      amount: normalizeAmountIfNeeded(amountMatch[0])
    });
  }

  console.log('Walmart purchases:', walmartPurchases);
  return walmartPurchases;
};

