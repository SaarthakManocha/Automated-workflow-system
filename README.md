# Automated Workflow System – Firebase Attendance Bot

This project is a fully automated *weekly attendance collection bot* built using Google Apps Script and Firebase Firestore. It sends Gmail emails to supervisors, collects attendance via embedded Present/Absent buttons, and logs data back to Google Sheets and Firestore with batch and student-level tracking.

---

## 🔧 Features

- ✅ *One-click attendance emails* for each supervisor
- ✅ *Batch-level or student-level* marking
- ✅ *Secure Firestore write* via service account
- ✅ *Dynamic week tracking* (Week 1, 2, ...)
- ✅ *Modern UI confirmation pages* (hosted via GitHub Pages)
- ✅ *Logs data back* to Google Sheet
- ✅ *100% cloud-hosted* (no local server or billing needed)

---

## Project Structure

<pre>
automated-workflow-system/
├── apps-script/                     # Google Apps Script source files
│   ├── Code.gs                      # Main script: sends emails, handles clicks, updates Firestore & Sheet
│   ├── marked.html                  # ✅ Confirmation page when attendance is newly marked
│   ├── already_marked.html          # ⚠ Confirmation page when attendance is already marked
│   └── README.md                    # Script-specific usage or deployment notes (optional)
│
├── config/                          # Sensitive credentials (DO NOT COMMIT service-account.json)
│   ├── sample.service_account.json  # Template to guide setup
│   └── service-account.json         # 🔒 Actual Firebase credentials (listed in .gitignore)
│
├── .gitignore                       # Ensures secrets/configs aren't uploaded
├── README.md                        # Project overview, setup instructions, and documentation
</pre>

---

## 🚀 How It Works

1. Supervisor info (email, batch, roll, etc.) is stored in *Google Sheets*.
2. Gmail sends *automated weekly emails* with buttons for Present/Absent.
3. Each button click opens a *confirmation page* (hosted via GitHub Pages).
4. Firebase stores attendance (status, timestamp) in *Firestore*.
5. Google Sheets pulls this data back every week via script.

---

## 🛠 Setup Instructions

1. *Create your own Firebase project* and enable Firestore.
2. Download a Firebase service account key and place it in config/service-account.json.
3. Make sure config/service-account.json is listed in .gitignore.
4. Deploy the Code.gs and HTML files into *Google Apps Script Editor*.
5. Update your Sheet with:

Supervisor Name | Email | Batch | Roll No | Student Name

6. Run the functions:
- pushSheetDataToFirestore() → Sync students to Firestore
- sendAttendanceEmails() → Send weekly attendance
- pullAttendanceToSheet() → Pull responses back

---

## Confirmation Pages (Inclusive in Google Scripts)

Just create seperate html files alongside the code.gs file in the apps script and paste the codes in their respective places.

---

## 📄 License

This project is licensed under the *MIT License*. You are free to use, share, and modify with credit.

---

## 🙌 Credits

Built by Saarthak Manocha. Powered by:

- Google Apps Script
- Firebase Firestore
- Gmail + Google Sheets
- GitHub Pages

---

> ⭐ Star this repo if you find it helpful. Pull requests welcome!