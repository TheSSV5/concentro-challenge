import React, { useState } from 'react';
// Import PDF processing functions from our scraper utility
import {
  extractTextFromImagePDF,
  extractNameAndAddress,
  calculateTotalDeposits,
  calculateTotalATMWithdrawals,
  extractWalmartPurchases,
} from './pdfScraper';
import './App.css'; // Import styles

const PDFScraperComponent = () => {
  // State management for all extracted data and loading status
  const [name, setName] = useState(''); 
  const [address, setAddress] = useState(''); 
  const [totalDeposits, setTotalDeposits] = useState(0); 
  const [totalATMWithdrawals, setTotalATMWithdrawals] = useState(0); 
  const [walmartPurchases, setWalmartPurchases] = useState([]); 
  const [isLoading, setIsLoading] = useState(false); // Loading state flag

  // Handler for PDF file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return; // Exit if no file selected

    setIsLoading(true); // Activate loading state
    console.log('File selected:', file.name);

    // Set up file reader to process the PDF
    const reader = new FileReader();
    
    // Success callback when file is loaded
    reader.onload = async (e) => {
      try {
        // Convert file data to Uint8Array for PDF processing
        const pdfData = new Uint8Array(e.target.result);
        
        // Extract raw text from PDF (using OCR if needed)
        const extractedText = await extractTextFromImagePDF(pdfData);

        // Process extracted text to get specific data
        const { name, address } = extractNameAndAddress(extractedText);
        const deposits = calculateTotalDeposits(extractedText);
        const withdrawals = calculateTotalATMWithdrawals(extractedText);
        const purchases = extractWalmartPurchases(extractedText);

        // Update state with extracted data
        setName(name);
        setAddress(address);
        setTotalDeposits(deposits);
        setTotalATMWithdrawals(withdrawals);
        setWalmartPurchases(purchases);
      } catch (err) {
        console.error('Error processing PDF:', err);
      } finally {
        setIsLoading(false); 
      }
    };

    // Error callback for file reading
    reader.onerror = (err) => {
      console.error('Error reading file:', err);
      setIsLoading(false);
    };

    reader.readAsArrayBuffer(file);
  };

  // Component rendering
  return (
    <div className="container">
      <h1>Bank Statement PDF Scraper</h1>
      
      {/* File upload input */}
      <div className="file-upload">
        <input 
          type="file" 
          accept="application/pdf" 
          onChange={handleFileUpload} 
        />
      </div>

      {/* Conditional rendering based on loading state */}
      {isLoading ? (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Processing your bank statement...</p>
        </div>
      ) : (
        /* Show extracted data when not loading */
        <>
          {/* Personal information section */}
          {name && (
            <div className="info-card">
              <p><strong>Name:</strong> {name}</p>
              <p><strong>Address:</strong> {address}</p>
            </div>
          )}

          {/* Financial summary sections */}
          {totalDeposits > 0 && (
            <div className="info-card">
              <p><strong>Total Deposits:</strong> ${totalDeposits.toFixed(2)}</p>
            </div>
          )}

          {totalATMWithdrawals > 0 && (
            <div className="info-card">
              <p><strong>Total ATM Withdrawals:</strong> ${totalATMWithdrawals.toFixed(2)}</p>
            </div>
          )}

          {/* Walmart transactions section */}
          {walmartPurchases.length > 0 && (
            <div className="info-card">
              <h2>Walmart Purchases</h2>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th className="amount">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {walmartPurchases.map((purchase, index) => (
                    <tr key={index}>
                      <td>{purchase.date}</td>
                      <td>{purchase.description}</td>
                      <td className="amount">${purchase.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PDFScraperComponent;