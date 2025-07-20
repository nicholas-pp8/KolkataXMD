// --- Core Baileys and Node.js Modules ---
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const path = require('path');
const P = require('pino'); // For logging
const fs = require('fs'); // Node.js built-in file system module

// Load environment variables from .env file (for API keys like CLOUDINARY_URL)
require('dotenv').config();


// --- Helper Functions ---
const delay = ms => new Promise(res => setTimeout(res, ms));

// Your WhatsApp phone number (for sending self-messages later, from config.json)
// This variable is no longer used for the pairing input prompt in this setup.
const MY_WHATSAPP_NUMBER_FROM_CONFIG = require('./config.json').ownerNumber;


// --- Command/Plugin Loader ---
const commands = new Map();
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(__dirname, 'commands', file));
    commands.set(command.name, command);
    if (command.commands && Array.isArray(command.commands)) {
        command.commands.forEach(cmdName => commands.set(cmdName, command));
    } else if (command.command) {
        commands.set(command.command, command);
    }
}
console.log(`Loaded ${commandFiles.length} command files.`);


// --- Main Bot Logic Function - EXPORTED for server.js to use ---
// It now accepts the phone number for pairing and a callback function for status updates
module.exports = {
    connectToWhatsApp: async (phoneNumberForPairing, statusCallback) => { // <--- KEY CHANGE HERE: Accepts parameters

        // Authentication State Management
        const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'baileys_auth_info'));
        const logger = P({ level: 'silent' });

        // Initialize WhatsApp Socket
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false, // <--- KEY CHANGE: QR code always disabled in terminal for web pairing
            useMobile: true,
            logger: logger,
            browser: [require('./config.json').botName + ' (WebPair)', 'Chrome', '1.0.0'], // <--- Uses botName from config
        });

        // --- Pairing Code Logic (for first-time login) ---
        // This block runs if the bot is not yet registered with WhatsApp
        if (!sock.authState.creds.registered) {
            try {
                console.log(`Bot initiating pairing for: ${phoneNumberForPairing} (from web input)`);
                // Use the number passed from server.js for pairing
                const pairingCode = await sock.requestPairingCode(phoneNumberForPairing);

                if (statusCallback) { // Send pairing code to web client
                    statusCallback({ type: 'pairingCode', code: pairingCode });
                }
                console.log(`Pairing code generated: ${pairingCode}`);

            } catch (error) {
                console.error('Error requesting pairing code for web pairing:', error);
                if (statusCallback) {
                    statusCallback({ type: 'error', message: `Pairing failed: ${error.message}` });
                }
                // Re-throw the error so server.js knows the connection failed
                throw error;
            }
        } else {
            console.log("Bot already registered. Attempting to connect with saved credentials...");
            if (statusCallback) {
                statusCallback({ type: 'status', message: 'Connecting with saved credentials...' });
            }
        }

        // --- Event Listeners ---

        // Connection Updates (e.g., QR code display, connection status changes)
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                // Send QR to web client (even if printQRInTerminal is false, Baileys might generate it for fallback)
                if (statusCallback) {
                    statusCallback({ type: 'qr', qr: qr });
                }
                console.log('QR code received and sent to web client.');
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut);
                console.log('Connection closed due to ', lastDisconnect.error?.output?.payload?.message || lastDisconnect.error, ', reconnecting ', shouldReconnect);

                if (statusCallback) {
                    statusCallback({ type: 'status', message: 'Bot disconnected. Reconnecting...' });
                }

                if (botSettings.alwaysOnline && presenceInterval) {
                    clearInterval(presenceInterval);
                    presenceInterval = null;
                    console.log("Always Online feature deactivated due to disconnect.");
                }

                if (lastDisconnect.error?.output?.statusCode === DisconnectReason.loggedOut) {
                    console.log('Logged out. Please refresh the web page to relink.');
                    if (statusCallback) {
                        statusCallback({ type: 'loggedOut', message: 'Bot logged out. Please refresh and relink.' });
                    }
                } else if (shouldReconnect) {
                    await delay(5000);
                    // Reconnect with the original phone number for pairing and status callback
                    connectToWhatsApp(phoneNumberForPairing, statusCallback);
                }
            } else if (connection === 'open') {
                console.log('Client is ready! WhatsApp connection opened.');
                if (statusCallback) {
                    statusCallback({ type: 'connected', message: 'Bot is connected to WhatsApp!' });
                }

                let presenceInterval;
                if (botSettings.alwaysOnline) {
                    presenceInterval = setInterval(() => {
                        sock.sendPresenceUpdate('available');
                    }, 60 * 1000);
                    console.log("Always Online feature activated.");
                }

                // Send Session Confirmation Message to Owner's Chat
                const config = require('./config.json'); // Re-load config here to get ownerNumber
                const ownerJid = config.ownerNumber + '@s.whatsapp.net';
                setTimeout(async () => {
                    try {
                        const messageText = `${config.sessionIdPrefix} Bot Session Active! 🎉\n\nBot ID: ${sock.user.id}\nStatus: Online`;
                        await sock.sendMessage(ownerJid, { text: messageText });
                        console.log(`Session ID sent to owner's chat (${config.ownerNumber}).`);
                    } catch (error) {
                        console.error('Failed to send session ID to owner chat:', error);
                    }
                }, 3000);
            }
        });

        // Incoming Messages: Main logic for handling user commands
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type === 'notify') {
                for (const msg of messages) {
                    if (!msg.key.fromMe && msg.key.remoteJid !== 'status@broadcast') {
                        const senderId = msg.key.remoteJid;
                        const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

                        console.log(`[${senderId}] Received: ${messageText}`);

                        if (botSettings.autoTyping) {
                            await sock.sendPresenceUpdate('composing', senderId);
                        }

                        if (botSettings.autoReact) {
                            await sock.sendMessage(msg.key.remoteJid, {
                                react: {
                                    text: '👍',
                                    key: msg.key
                                }
                            });
                            console.log(`Auto-reacted to message from ${senderId}`);
                        }

                        // --- Command Dispatcher ---
                        const lowerCaseMessage = messageText.toLowerCase();

                        let commandFound = false;
                        const config = require('./config.json'); // Re-load config for commands

                        for (const [key, command] of commands.entries()) {
                            if (command.commands && Array.isArray(command.commands)) {
                                if (command.commands.includes(lowerCaseMessage.split(' ')[0])) {
                                    await command.execute(sock, msg, senderId, messageText, commands, botSettings, config);
                                    commandFound = true;
                                    break;
                                }
                            } else if (command.command) {
                                if (lowerCaseMessage.startsWith(command.command) || (msg.message?.imageMessage && lowerCaseMessage === command.command)) {
                                    await command.execute(sock, msg, senderId, messageText, commands, botSettings, config);
                                    commandFound = true;
                                    break;
                                }
                            }
                        }

                        if (!commandFound && commands.has('basic')) {
                            await commands.get('basic').execute(sock, msg, senderId, messageText, commands, botSettings, config);
                        }
                    }
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);

        // This function is no longer used for Baileys pairing within this connectToWhatsApp logic.
        // It's conceptually there if needed for other parts.
        async function promptForPhoneNumber() {
            return require('./config.json').ownerNumber;
        }
    }, // End of connectToWhatsApp function export
}; // End of module.exports

// NOTE: connectToWhatsApp() is NO LONGER CALLED HERE DIRECTLY.
// It will be called by server.js when a client connects and provides a number.
