(function () {
    try {
        const extensionId = chrome.runtime.id;

        document.documentElement.setAttribute('data-clipnote-extension-id', extensionId);

        window.dispatchEvent(new CustomEvent('clipnote-extension-ready', {
            detail: { extensionId: extensionId }
        }));

        console.log("Clipnote Extension connected. ID:", extensionId);
    } catch (e) {
        console.error("Clipnote Extension handshake failed:", e);
    }
})();
