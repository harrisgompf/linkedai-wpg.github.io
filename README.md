# Receipt Tracker Prototype

This is a static web app prototype for extracting receipt details and matching them against a bank statement.

## Features
- Upload receipt images and extract:
  - business name
  - receipt total
  - GST and PST
  - total tax
  - card last 4 digits
  - receipt date
- Upload a bank statement CSV and parse transaction rows
- Match receipts to transactions using amount, last4, and business description
- Export receipt data and match results as CSV files

## How to use
1. Open `index.html` in a browser.
2. Upload receipt images in the first section.
3. Click `Scan Receipts` and wait for OCR to finish.
4. Upload a bank statement CSV in the second section.
5. Click `Load Bank File`.
6. Click `Match Receipts to Bank` to compute match status.
- Use `Export Receipt CSV` and `Export Receipt Excel` to download receipt data.
- Use `Export Match Results` and `Export Match Excel` to download matched results.

## Notes
- OCR runs in the browser using Tesseract.js.
- For best results, use clear receipt photos.
- Bank CSV header names should include common labels such as `Date`, `Description`, `Amount`, or `Card`.
- To use the OneDrive importer, replace `ONEDRIVE_CLIENT_ID` in `app.js` with a valid Azure app registration client ID and run the app from a served URL.
- The OneDrive picker can select folders and recursively import supported receipt files from within the selected folder.
- The Excel export writes preview links into the spreadsheet so you can open the receipt preview from the file if the URL remains accessible.
