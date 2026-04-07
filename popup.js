document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');
  const resultsEl = document.getElementById('results');
  const filesListEl = document.getElementById('files-list');
  const scanBtn = document.getElementById('scan-btn');
  const extInput = document.getElementById('ext-input');
  const selectAllEl = document.getElementById('select-all');
  const downloadBtn = document.getElementById('download-selected');

  let currentFiles = [];

  function setStatus(text) {
    statusEl.textContent = text || '';
  }

  scanBtn.addEventListener('click', async () => {
    setStatus('Scanning page…');
    resultsEl.classList.add('hidden');
    filesListEl.innerHTML = '';
    currentFiles = [];

    const extRaw = extInput.value || '';
    const exts = extRaw
      .split(',')
      .map(e => e.trim().toLowerCase().replace(/^\./, ''))
      .filter(Boolean);

    if (!exts.length) {
      setStatus('Enter at least one file extension.');
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scanPageForAttachments,
        args: [exts]
      });

      currentFiles = result || [];
      if (!currentFiles.length) {
        setStatus('No files found for the specified extensions.');
        return;
      }

      renderFiles(currentFiles);
      setStatus(`Found ${currentFiles.length} file(s).`);
      resultsEl.classList.remove('hidden');
    } catch (e) {
      console.error(e);
      setStatus('Error while scanning the page (see extension console).');
    }
  });

  selectAllEl.addEventListener('change', () => {
    const checked = selectAllEl.checked;
    document.querySelectorAll('.file-row input[type="checkbox"]').forEach(cb => {
      cb.checked = checked;
    });
  });

  downloadBtn.addEventListener('click', async () => {
    const selectedUrls = [];
    document.querySelectorAll('.file-row input[type="checkbox"]').forEach(cb => {
      if (cb.checked) {
        selectedUrls.push(cb.dataset.url);
      }
    });

    if (!selectedUrls.length) {
      setStatus('No files selected.');
      return;
    }

    setStatus(`Starting download for ${selectedUrls.length} file(s)…`);

    try {
      await chrome.runtime.sendMessage({ type: 'download-files', urls: selectedUrls });
      setStatus(`Download initiated for ${selectedUrls.length} file(s).`);
    } catch (e) {
      console.error(e);
      setStatus('Error while initiating downloads.');
    }
  });

  function renderFiles(files) {
    filesListEl.innerHTML = '';
    selectAllEl.checked = true;

    files.forEach((url, idx) => {
      const row = document.createElement('div');
      row.className = 'file-row';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      cb.dataset.url = url;
      cb.id = 'file-' + idx;

      const label = document.createElement('label');
      label.setAttribute('for', cb.id);
      label.className = 'file-url';
      label.textContent = url;

      row.appendChild(cb);
      row.appendChild(label);

      filesListEl.appendChild(row);
    });
  }

  // executes in page context
  function scanPageForAttachments(exts) {
    const urls = new Set();

    const toAbs = (u) => {
      try {
        return new URL(u, document.baseURI).href;
      } catch (e) {
        return null;
      }
    };

    const hasWantedExt = (u) => {
      try {
        const url = new URL(u, document.baseURI);
        const path = url.pathname.toLowerCase();
        return exts.some(ext => path.endsWith('.' + ext));
      } catch (e) {
        return false;
      }
    };

    const addUrl = (u) => {
      if (!u) return;
      const abs = toAbs(u);
      if (!abs) return;
      if (!hasWantedExt(abs)) return;
      urls.add(abs);
    };

document.querySelectorAll('a[href], link[href], area[href], source[src], audio[src], video[src], img[src], iframe[src], script[src]')
.forEach(el => {
  const href = el.getAttribute('href') || el.getAttribute('src');
  addUrl(href);
});

    document.querySelectorAll('[data-url],[data-href],[data-src]').forEach(el => {
      ['data-url', 'data-href', 'data-src'].forEach(attr => {
        const v = el.getAttribute(attr);
        if (v) addUrl(v);
      });
    });

    const reUrl = /url\(["']?([^"')]+)["']?\)/gi;
    document.querySelectorAll('[style]').forEach(el => {
      const s = el.getAttribute('style') || '';
      let m;
      while ((m = reUrl.exec(s)) !== null) {
        addUrl(m[1]);
      }
    });

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const reText = /\bhttps?:\/\/[^\s"'<>]+/gi;
    let node;
    while ((node = walker.nextNode())) {
      const txt = node.nodeValue;
      if (!txt) continue;
      let m;
      while ((m = reText.exec(txt)) !== null) {
        addUrl(m[0]);
      }
    }

    return Array.from(urls);
  }
});
