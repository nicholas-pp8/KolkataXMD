const qrCodeDiv = document.getElementById('qrCode');
const pairingCodeDisplay = document.getElementById('pairingCodeDisplay');
const statusDiv = document.getElementById('status');
const phoneInputContainer = document.getElementById('phoneInputContainer');
const phoneInput = document.getElementById('phoneInput');
const submitPhoneButton = document.getElementById('submitPhone');

let qrcode = new QRCode(qrCodeDiv, { width: 256, height: 256, correctLevel: QRCode.CorrectLevel.H });

// Connect to the WebSocket server
// Use secure WebSocket (wss) if deploying to HTTPS (recommended for Render/Heroku)
// For local Termux testing, use ws://
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(protocol + '//' + window.location.host);

ws.onopen = () => {
    statusDiv.textContent = 'Connected to server. Waiting for bot status...';
    console.log('WebSocket connected.');
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Received from server:', data.type, data);

    if (data.type === 'qr') {
        qrCodeDiv.style.display = 'block'; // Show QR div
        phoneInputContainer.style.display = 'none'; // Hide phone input
        qrcode.makeCode(data.qr); // Update QR code
        statusDiv.textContent = 'Scan this QR code with your WhatsApp app.';
        pairingCodeDisplay.textContent = ''; // Clear pairing code if QR appears
    } else if (data.type === 'pairingCode') {
        qrCodeDiv.style.display = 'none'; // Hide QR div
        phoneInputContainer.style.display = 'none'; // Hide phone input
        // qrcode.clear(); // Clear QR code display if any
        pairingCodeDisplay.textContent = `Your pairing code: ${data.code}`;
        statusDiv.textContent = 'Use this code to link your WhatsApp.';
    } else if (data.type === 'status') {
        statusDiv.textContent = data.message;
    } else if (data.type === 'askPhone') { // Server asks for phone number
        statusDiv.textContent = 'Please enter your WhatsApp number to get the pairing code:';
        phoneInputContainer.style.display = 'block'; // Show phone input
        qrCodeDiv.style.display = 'none'; // Hide QR div
        pairingCodeDisplay.textContent = ''; // Clear any previous code
    } else if (data.type === 'connected') {
        statusDiv.textContent = 'Bot is connected to WhatsApp!';
        qrCodeDiv.style.display = 'none'; // Hide QR div
        phoneInputContainer.style.display = 'none'; // Hide phone input
        pairingCodeDisplay.textContent = 'Successfully linked! You can close this page.';
        console.log('Bot connected to WhatsApp!');
        // Simple alert for successful connection - might be annoying, remove for prod
        // alert('Bot is connected to WhatsApp!'); 
    } else if (data.type === 'loggedOut') {
        statusDiv.textContent = 'Bot logged out. Please refresh the page and relink.';
        qrCodeDiv.style.display = 'none';
        phoneInputContainer.style.display = 'block'; // Show phone input again to restart
        pairingCodeDisplay.textContent = '';
        console.log('Bot logged out.');
    } else if (data.type === 'error') {
        statusDiv.textContent = `Error: ${data.message}. Please refresh the page.`;
        qrCodeDiv.style.display = 'none';
        phoneInputContainer.style.display = 'none'; // Hide input on error
        pairingCodeDisplay.textContent = '';
        console.error('Server error:', data.message);
    }
};

ws.onclose = () => {
    statusDiv.textContent = 'Disconnected from server. Please refresh the page.';
    console.log('WebSocket disconnected.');
    qrCodeDiv.style.display = 'none';
    phoneInputContainer.style.display = 'none';
    pairingCodeDisplay.textContent = '';
};

ws.onerror = (error) => {
    statusDiv.textContent = 'Connection error. Please refresh the page.';
    console.error('WebSocket error:', error);
};

submitPhoneButton.onclick = () => {
    const phoneNumber = phoneInput.value.trim();
    if (phoneNumber) {
        ws.send(JSON.stringify({ type: 'phoneNumberInput', number: phoneNumber }));
        statusDiv.textContent = 'Submitting number...';
        phoneInputContainer.style.display = 'none'; // Hide input after submission
    } else {
        alert('Please enter a phone number.');
    }
};

// Allow pressing Enter in the phone input to submit
phoneInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        submitPhoneButton.click();
    }
});
