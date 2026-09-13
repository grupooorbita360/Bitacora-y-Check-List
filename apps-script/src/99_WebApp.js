/**
 * Entry point del Web App (HTML Service). El HTML vive en apps-script/html/
 * — Apps Script no tiene módulos, así que Index.html se arma incluyendo los
 * demás archivos vía el helper include() en tiempo de render (scriptlets
 * `<?!= include(nombreDeArchivo); ?>`, ver Index.html), igual que
 * cualquier proyecto Apps Script multi-archivo.
 */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Plataforma Operativa — Executive Services')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
