function doPost(e) {
  const secret = PropertiesService.getScriptProperties().getProperty('SR_SECRET');
  const headerSecret = e?.postData?.type ? e.parameter?.secret : null;
  const body = JSON.parse(e.postData.contents || '{}');

  if (!secret) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Missing SR_SECRET' })).setMimeType(ContentService.MimeType.JSON);
  }

  // Apps Script Web Apps do not expose custom headers directly, use body fallback.
  if (body.secret !== secret && headerSecret !== secret) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Unauthorized' })).setMimeType(ContentService.MimeType.JSON);
  }

  const recipients = body.recipients || [];
  const subject = `SR info (${body.monthKey || 'bez měsíce'})`;
  const text = `Byly aktualizovány žádosti: ${(body.requestIds || []).join(', ')}`;
  recipients.forEach((recipient) => GmailApp.sendEmail(recipient, subject, text));

  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}
