window.addEventListener('DOMContentLoaded', () => {
    const iframe = document.getElementById('webview'); // Renamed from webview to iframe
    const addressBar = document.getElementById('addressBar');
    const backBtn = document.getElementById('backBtn');
    const forwardBtn = document.getElementById('forwardBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const goBtn = document.getElementById('goBtn');

    // Initial URL is now set directly in browser.html, so no need to parse here.
    // We just need to ensure addressBar reflects the initial URL.
    // The initialUrl is already set in browser.html's inline script.
    // Let's get it from the iframe's src if it was set.
    addressBar.value = iframe.src;


    // Event listeners for navigation buttons
    backBtn.addEventListener('click', () => {
        console.log('Back button clicked.');
        if (iframe.contentWindow && iframe.contentWindow.history.length > 1) {
            iframe.contentWindow.history.back();
        }
    });

    forwardBtn.addEventListener('click', () => {
        console.log('Forward button clicked.');
        if (iframe.contentWindow && iframe.contentWindow.history.length > 1) { // Simplified check
            iframe.contentWindow.history.forward();
        }
    });

    refreshBtn.addEventListener('click', () => {
        console.log('Refresh button clicked.');
        if (iframe.contentWindow) {
            iframe.contentWindow.location.reload();
        }
    });

    goBtn.addEventListener('click', () => {
        console.log('Go button clicked.');
        let url = addressBar.value;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'http://' + url; // Prepend http:// if protocol is missing
        }
        console.log('Navigating iframe to:', url);
        iframe.src = url; // Use iframe.src for navigation
    });

    addressBar.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            console.log('Enter key pressed in address bar.');
            goBtn.click();
        }
    });

    // Update address bar when iframe navigates
    iframe.addEventListener('load', () => {
        console.log('Iframe loaded. Current URL:', iframe.contentWindow.location.href);
        addressBar.value = iframe.contentWindow.location.href;
        // Update button states (simplified for iframe)
        backBtn.disabled = !iframe.contentWindow || iframe.contentWindow.history.length <= 1;
        forwardBtn.disabled = !iframe.contentWindow || iframe.contentWindow.history.length <= 1;
    });

    // Initial state for buttons
    backBtn.disabled = true;
    forwardBtn.disabled = true;
});