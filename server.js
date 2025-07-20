const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Load bot logic from index.js
const { connectToWhatsApp } = require('./index.js'); // This line is the fix

// Load config (optional, if server.js needs config values)
const config = require('./config.json');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

let currentPhoneNumber = null; // To store the number submitted by web
let currentQr = null; // Store QR code if generated before a client connects
let currentPairingCode = null; // Store pairing code
let botConnectionState = 'disconnected'; // 'disconnected', 'asking_phone', 'connecting', 'connected'

wss.on('connection', ws => {
    console.log('Client connected to WebSocket.');

    // Send current status to newly connected client
    if (botConnectionState === 'connected') {
        ws.send(JSON.stringify({ type: 'connected' }));
    } else if (currentQr) {
        ws.send(JSON.stringify({ type: 'qr', qr: currentQr }));
    } else if (currentPairingCode) {
        ws.send(JSON.stringify({ type: 'pairingCode', code: currentPairingCode }));
    } else if (botConnectionState === 'disconnected') { // Not yet started or logged out
        ws.send(JSON.stringify({ type: 'askPhone' })); // Ask for phone number
        botConnectionState = 'asking_phone';
    } else if (botConnectionState === 'asking_phone') {
        ws.send(JSON.stringify({ type: 'askPhone' })); // Re-ask if multiple clients connect
    } else if (botConnectionState === 'connecting') {
        ws.send(JSON.stringify({ type: 'status', message: 'Bot is connecting...' }));
    }

    ws.on('message', message => {
        const data = JSON.parse(message);
        if (data.type === 'phoneNumberInput') {
            const phoneNumber = data.number;
            if (!phoneNumber || !/^\d+$/.test(phoneNumber)) {
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid phone number format.' }));
                return;
            }
            currentPhoneNumber = phoneNumber; // Store the number
            console.log(`Received phone number from web client: ${currentPhoneNumber}`);

            // Initiate bot connection with this number
            if (botConnectionState === 'asking_phone' || botConnectionState === 'disconnected') {
                initiateBotConnection();
            } else {
                ws.send(JSON.stringify({ type: 'status', message: 'Bot is already connecting or connected.' }));
            }
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected from WebSocket.');
    });

    ws.on('error', error => {
        console.error('WebSocket error:', error);
    });
});

async function initiateBotConnection() {
    if (!currentPhoneNumber) {
        console.error("Attempted to initiate bot without a phone number.");
        broadcast({ type: 'error', message: 'Please provide a phone number to start.' });
        botConnectionState = 'asking_phone';
        return;
    }

    botConnectionState = 'connecting';
    currentQr = null; // Clear previous state
    currentPairingCode = null;
    broadcast({ type: 'status', message: `Starting bot with number ${currentPhoneNumber}...` });

    // Clear existing session data before starting, to ensure clean slate for web pairing.
    const authInfoPath = path.join(__dirname, 'baileys_auth_info');
    if (fs.existsSync(authInfoPath)) {
        fs.rmSync(authInfoPath, { recursive: true, force: true });
        console.log("Cleared existing baileys_auth_info for web pairing.");
    }

    try {
        await connectToWhatsApp(currentPhoneNumber, (data) => {
            // This callback is from the bot logic (index.js)
            if (data.type === 'qr') currentQr = data.qr;
            else if (data.type === 'pairingCode') currentPairingCode = data.code;

            // Broadcast all updates from the bot to all connected web clients
            broadcast(data);

            if (data.type === 'connected') botConnectionState = 'connected';
            else if (data.type === 'loggedOut') {
                botConnectionState = 'disconnected';
                currentPhoneNumber = null; // Reset phone number on logout
                currentQr = null;
                currentPairingCode = null;
            }
        });
        console.log("Bot connection process initiated.");

    } catch (error) {
        console.error("Error initiating bot connection:", error);
        broadcast({ type: 'error', message: `Bot initiation failed: ${error.message}` });
        botConnectionState = 'disconnected';
        currentPhoneNumber = null;
        currentQr = null;
        currentPairingCode = null;
    }
}


// Helper to broadcast messages to all connected WebSocket clients
function broadcast(data) {
    clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        }
    });
}

// Start the HTTP server
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Open your browser to http://localhost:${PORT}`);
    console.log("Waiting for web client to provide phone number...");
});


// --- Handle unhandled promise rejections (important for robustness) ---
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    broadcast({ type: 'error', message: `Server error: ${reason.message || 'Unknown error'}` });
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    broadcast({ type: 'error', message: `Critical server error: ${error.message || 'Unknown error'}` });
    process.exit(1);
});
