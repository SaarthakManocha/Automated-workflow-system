const FIREBASE_PROJECT_ID = "your-project-id";
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// 🔐 Securely load your service account from script properties
const SERVICE_ACCOUNT = JSON.parse(PropertiesService.getScriptProperties().getProperty("SERVICE_ACCOUNT_JSON"));

function getAccessToken() {
  const jwtHeader = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const jwtClaim = {
    iss: SERVICE_ACCOUNT.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };

  const encodedHeader = Utilities.base64EncodeWebSafe(JSON.stringify(jwtHeader));
  const encodedClaim = Utilities.base64EncodeWebSafe(JSON.stringify(jwtClaim));
  const signature = Utilities.computeRsaSha256Signature(
    `${encodedHeader}.${encodedClaim}`,
    SERVICE_ACCOUNT.private_key.replace(/\\n/g, '\n')
  );
  const jwt = `${encodedHeader}.${encodedClaim}.${Utilities.base64EncodeWebSafe(signature)}`;

  const tokenResponse = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
    method: "post",
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    }
  });

  return JSON.parse(tokenResponse.getContentText()).access_token;
}

// 🟢 One-time setter to paste your actual service account JSON string
function setServiceAccountJson() {
  const json = `PASTE_YOUR_JSON_HERE`;
  PropertiesService.getScriptProperties().setProperty("SERVICE_ACCOUNT_JSON", json);
}

function getCurrentWeekNumber() {
  const startDate = new Date("2025-07-24");
  const today = new Date();
  const diffDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
  return "week" + (Math.floor(diffDays / 7) + 1);
}

function getCurrentWeekDateRange() {
  const startDate = new Date("2025-07-24");
  const today = new Date();
  const currentWeek = Math.floor((today - startDate) / (1000 * 60 * 60 * 24 * 7));
  const weekStart = new Date(startDate);
  weekStart.setDate(startDate.getDate() + currentWeek * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const format = d => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${format(weekStart)}–${format(weekEnd)}`;
}

// 🔄 Push sheet data to Firestore
function pushSheetDataToFirestore() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet1");
  const data = sheet.getDataRange().getValues();
  const accessToken = getAccessToken();

  for (let i = 1; i < data.length; i++) {
    const [supervisorName, email, batch, roll, studentName] = data[i];
    if (!supervisorName || !email || !batch || !roll || !studentName) continue;

    const url = `${FIRESTORE_BASE_URL}/supervisors/${encodeURIComponent(email)}/students/${encodeURIComponent(roll)}`;
    const payload = {
      fields: {
        name: { stringValue: studentName },
        roll: { stringValue: roll.toString() },
        batch: { stringValue: batch.toString() }
      }
    };

    const options = {
      method: "patch",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      headers: { Authorization: `Bearer ${accessToken}` },
      muteHttpExceptions: true
    };

    UrlFetchApp.fetch(url, options);
  }
  Logger.log("✅ Firestore updated.");
}

// 🔁 Pull attendance from Firestore to Sheet
function pullAttendanceToSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet1");
  const data = sheet.getDataRange().getValues();
  const accessToken = getAccessToken();
  const currentWeek = getCurrentWeekNumber();

  let headers = data[0];
  let weekColIndex = headers.indexOf(currentWeek);
  let dateColIndex = headers.indexOf(currentWeek + "_date");

  if (weekColIndex === -1) {
    weekColIndex = headers.length;
    sheet.getRange(1, weekColIndex + 1).setValue(currentWeek);
    headers.push(currentWeek);
  }

  if (dateColIndex === -1) {
    dateColIndex = headers.length;
    sheet.getRange(1, dateColIndex + 1).setValue(currentWeek + "_date");
    headers.push(currentWeek + "_date");
  }

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const email = row[1];
    const roll = row[3];
    if (!email || !roll) continue;

    const docUrl = `${FIRESTORE_BASE_URL}/supervisors/${encodeURIComponent(email)}/students/${encodeURIComponent(roll)}/attendance/${currentWeek}`;
    const response = UrlFetchApp.fetch(docUrl, {
      method: "get",
      headers: { Authorization: `Bearer ${accessToken}` },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      const doc = JSON.parse(response.getContentText());
      const status = doc.fields?.status?.stringValue || "";
      const timestamp = doc.fields?.timestamp?.timestampValue || "";
      sheet.getRange(i + 1, weekColIndex + 1).setValue(status);
      if (timestamp) {
        sheet.getRange(i + 1, dateColIndex + 1).setValue(new Date(timestamp));
      }
    }
  }
}

// 📩 Email weekly attendance forms
function sendAttendanceEmails() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet1");
  const data = sheet.getDataRange().getValues();
  const webAppUrl = "YOUR_DEPLOYED_WEB_APP_URL"; // change this
  const weekRange = getCurrentWeekDateRange();
  const supervisorMap = {};

  for (let i = 1; i < data.length; i++) {
    const [supervisorName, email, batch, roll, studentName] = data[i];
    if (!email || !roll || !studentName) continue;
    if (!supervisorMap[email]) supervisorMap[email] = { supervisorName, students: [] };
    supervisorMap[email].students.push({ roll, name: studentName, batch });
  }

  for (const email in supervisorMap) {
    const { supervisorName, students } = supervisorMap[email];
    const batchGroups = {};
    students.forEach(s => {
      if (!batchGroups[s.batch]) batchGroups[s.batch] = [];
      batchGroups[s.batch].push(s);
    });

    let htmlBody = `<div style="font-family:Segoe UI, sans-serif; color:#333; max-width:700px; margin:auto;"> ...`;

    for (const batch in batchGroups) {
      const presentBatchLink = `${webAppUrl}?email=${encodeURIComponent(email)}&batch=${encodeURIComponent(batch)}&status=Present&type=batch&name=${encodeURIComponent(batch)}`;
      const absentBatchLink = `${webAppUrl}?email=${encodeURIComponent(email)}&batch=${encodeURIComponent(batch)}&status=Absent&type=batch&name=${encodeURIComponent(batch)}`;

      htmlBody += `<h3>Batch: ${batch}</h3> <a href="${presentBatchLink}">Present</a> <a href="${absentBatchLink}">Absent</a> <ul>`;
      batchGroups[batch].forEach(student => {
        const presentLink = `${webAppUrl}?email=${encodeURIComponent(email)}&roll=${student.roll}&status=Present&type=student&name=${encodeURIComponent(student.roll)}`;
        const absentLink = `${webAppUrl}?email=${encodeURIComponent(email)}&roll=${student.roll}&status=Absent&type=student&name=${encodeURIComponent(student.roll)}`;
        htmlBody += `<li>${student.roll} <a href="${presentLink}">✅</a> <a href="${absentLink}">❌</a></li>`;
      });
      htmlBody += `</ul>`;
    }

    MailApp.sendEmail({
      to: email,
      subject: `📋 Weekly Attendance (${weekRange})`,
      htmlBody
    });
  }
}

// 🌐 Webhook for marking attendance
function doGet(e) {
  const email = e.parameter.email;
  const roll = e.parameter.roll;
  const batch = e.parameter.batch;
  const status = e.parameter.status;
  const name = e.parameter.name || roll || batch;
  const type = e.parameter.type || (roll ? "student" : "batch");
  const weekId = getCurrentWeekNumber();

  if (!email || !status || (!roll && !batch)) {
    return HtmlService.createHtmlOutput("❌ Missing parameters.");
  }

  const accessToken = getAccessToken();
  let alreadyMarked = false;

  if (roll) {
    const docUrl = `${FIRESTORE_BASE_URL}/supervisors/${encodeURIComponent(email)}/students/${encodeURIComponent(roll)}/attendance/${weekId}`;
    try {
      const res = UrlFetchApp.fetch(docUrl, {
        method: "get",
        headers: { Authorization: `Bearer ${accessToken}` },
        muteHttpExceptions: true
      });

      if (res.getResponseCode() === 200) {
        alreadyMarked = true;
      } else {
        const payload = {
          fields: {
            status: { stringValue: status },
            timestamp: { timestampValue: new Date().toISOString() }
          }
        };
        UrlFetchApp.fetch(docUrl, {
          method: "patch",
          contentType: "application/json",
          payload: JSON.stringify(payload),
          headers: { Authorization: `Bearer ${accessToken}` },
          muteHttpExceptions: true
        });
      }
    } catch (e) {
      Logger.log("Error: " + e);
    }

    const template = HtmlService.createTemplateFromFile(alreadyMarked ? "already_marked" : "marked");
    template.name = name;
    template.type = type;
    template.status = status;
    return template.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // Batch marking
  if (batch) {
    try {
      const studentsUrl = `${FIRESTORE_BASE_URL}/supervisors/${encodeURIComponent(email)}/students`;
      const response = UrlFetchApp.fetch(studentsUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        muteHttpExceptions: true
      });

      const students = JSON.parse(response.getContentText()).documents || [];
      for (const student of students) {
        const fields = student.fields;
        if (fields && fields.batch.stringValue === batch) {
          const rollNum = fields.roll.stringValue;
          const docUrl = `${FIRESTORE_BASE_URL}/supervisors/${encodeURIComponent(email)}/students/${encodeURIComponent(rollNum)}/attendance/${weekId}`;
          const check = UrlFetchApp.fetch(docUrl, { headers: { Authorization: `Bearer ${accessToken}` }, muteHttpExceptions: true });
          if (check.getResponseCode() === 200) {
            alreadyMarked = true;
            break;
          }
        }
      }

      if (!alreadyMarked) {
        for (const student of students) {
          const fields = student.fields;
          if (fields.batch.stringValue === batch) {
            const rollNum = fields.roll.stringValue;
            const docUrl = `${FIRESTORE_BASE_URL}/supervisors/${encodeURIComponent(email)}/students/${encodeURIComponent(rollNum)}/attendance/${weekId}`;
            const payload = {
              fields: {
                status: { stringValue: status },
                timestamp: { timestampValue: new Date().toISOString() }
              }
            };
            UrlFetchApp.fetch(docUrl, {
              method: "patch",
              contentType: "application/json",
              payload: JSON.stringify(payload),
              headers: { Authorization: `Bearer ${accessToken}` },
              muteHttpExceptions: true
            });
          }
        }
      }

    } catch (e) {
      Logger.log("❌ Batch error: " + e);
    }

    const template = HtmlService.createTemplateFromFile(alreadyMarked ? "already_marked" : "marked");
    template.name = name;
    template.type = type;
    template.status = status;
    return template.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}
