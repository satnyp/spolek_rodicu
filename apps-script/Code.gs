function doPost(e) {
  var secret = PropertiesService.getScriptProperties().getProperty('APPS_SCRIPT_SECRET');
  var provided = e && e.parameter && e.parameter.secret;
  if (!provided) {
    try {
      var body = JSON.parse(e.postData.contents);
      provided = body.secret;
    } catch (err) {
      provided = '';
    }
  }
  if (provided !== secret) {
    return ContentService.createTextOutput('Unauthorized').setMimeType(ContentService.MimeType.TEXT);
  }
  var payload = JSON.parse(e.postData.contents || '{}');
  var recipients = (payload.recipients || []).join(',');
  GmailApp.sendEmail(recipients, payload.subject || 'Spolek rodičů', payload.text || '');
  return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
}
