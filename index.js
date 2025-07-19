const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const path = require('path');
const P = require('pino');

// Helper to add a delay
const delay = ms => new Promise(res => setTimeout(res, ms));

async function connectToWhatsApp() {
    // Authenticate and save credentials
    const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'baileys_auth_info'));

    const logger = P({ level: 'silent' }); // 'silent' or 'error' for less verbose output

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // Keep this true for now, it's harmless
        // No pairingCode: undefined here. We will request it explicitly later.
        useMobile: true,        // ESSENTIAL for mobile pairing code flow
        logger: logger,
        browser: ['Termux (Linux)', 'Chrome', '1.0.0'], // Custom browser info
        // autoReconnect: DisconnectReason.connectionClosed, // Allow reconnection on connection close
        // provide
        // version: [2, 2413, 51], // You can try a specific Baileys version here if issues persist (find current from Baileys GH)
    });

    // Event handler for connection updates
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            // If a QR code is generated, display it (ignore if using pairing code)
            qrcode.generate(qr, { small: true });
            console.log('QR code displayed above. Please try the pairing code below first.');
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut);
            console.log('Connection closed due to ', lastDisconnect.error?.output?.payload?.message || lastDisconnect.error, ', reconnecting ', shouldReconnect);
            // If logged out, prompt for new login
            if (lastDisconnect.error?.output?.statusCode === DisconnectReason.loggedOut) {
                console.log('Logged out. Please delete baileys_auth_info and restart.');
                // Optionally, you can call process.exit(1) here to force a manual restart
            } else if (shouldReconnect) {
                await delay(5000); // Wait 5 seconds before attempting to reconnect
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('Client is ready! WhatsApp connection opened.');

            // Only request pairing code if not already registered (first login)
            // This logic runs AFTER the connection is open
            if (!sock.authState.creds.registered) {
                try {
                    console.log('Attempting to request pairing code...');
                    const phoneNumber = await promptForPhoneNumber();
                    // Make sure the number is pure digits.
                    const cleanedPhoneNumber = phoneNumber.replace(/\D/g, ''); // Remove non-digits

                    // Use requestPairingCode directly, without the usePairingCode wrapper
                    const pairingCode = await sock.requestPairingCode(cleanedPhoneNumber);
                    console.log('\n======================================');
                    console.log('YOUR WHATSAPP PAIRING CODE IS:');
                    console.log(`  ${pairingCode}`); // Display the pairing code prominently
                    console.log('======================================');
                    console.log('Open WhatsApp on your phone, go to Linked Devices, then "Link with phone number" and enter this code.');
                } catch (error) {
                    console.error('Error requesting pairing code:', error);
                    console.log('Falling back to QR code if displayed or ensure correct phone number/WhatsApp version.');
                }
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify') {
            for (const msg of messages) {
                if (!msg.key.fromMe && msg.key.remoteJid !== 'status@broadcast') {
                    const senderId = msg.key.remoteJid;
                    const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

                    console.log(`[${senderId}] Received: ${messageText}`);

                    if (messageText.toLowerCase() === 'hello') {
                        await sock.sendMessage(senderId, { text: 'Hi there from your Termux Baileys bot!' });
                    } else if (messageText.toLowerCase() === 'how are you?') {
                        await sock.sendMessage(senderId, { text: 'I am a bot, feeling digital and running on your Android device!' });
                    } else if (messageText.toLowerCase() === '!ping') {
                        await sock.sendMessage(senderId, { text: 'pong!' });
                    }
                }
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // --- Helper function for phone number ---
    async function promptForPhoneNumber() {
        // Your phone number (provided previously):
        const myPhoneNumber = '918100601505'; // THIS IS YOUR HARDCODED PHONE NUMBER

        if (!myPhoneNumber || myPhoneNumber.includes('YOUR_PHONE_NUMBER')) {
            console.log('\n!!! ERROR !!!');
            console.log('Phone number not set correctly in promptForPhoneNumber function.');
            console.log('Exiting...');
            process.exit(1);
        }
        return myPhoneNumber;
    }
}

connectToWhatsApp();
