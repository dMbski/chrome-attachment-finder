chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'download-files' && Array.isArray(msg.urls)) {
    msg.urls.forEach(url => {
      try {
        chrome.downloads.download({ url });
      } catch (e) {
        console.error('Download error for', url, e);
      }
    });
    sendResponse({ ok: true });
    return true;
  }
});
