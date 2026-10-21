// Where the leaderboard gets its data.
//   "sheet"    -> the published Google Sheet below (entries are typed in the spreadsheet)
//   "firebase" -> Firestore + admin login (see firebase-config.js)
export const DATA_SOURCE = "sheet";

// Google Sheet > File > Share > Publish to web > Sheet1 > CSV  (this is that link)
export const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRFdO4QW_iQ-ZUnN0gg0pmFc8qOLqFTWxpA8aD2KidVOIoETVnK9CF6zAsdc8CsopTmSn0kAKWXfDoV/pub?output=csv";

// Optional: the sheet's normal "edit" link, so the admin page can show an "Open spreadsheet" button.
export const SHEET_EDIT_URL = "";

// How often the leaderboard re-reads the sheet.
export const REFRESH_SECONDS = 15;
