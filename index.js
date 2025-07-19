// --- Core Baileys and Node.js Modules ---
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const path = require('path');
const P = require('pino'); // For logging
const fs = require('fs'); // Node.js built-in file system module

// --- Modules for Song Download Feature ---
const ytdl = require('ytdl-core'); // For downloading YouTube videos
const ffmpeg = require('fluent-ffmpeg'); // Wrapper for ffmpeg commands
// NOTE: ffmpeg-static is NOT required here as you installed ffmpeg globally via Termux's pkg.
// fluent-ffmpeg will automatically detect the system-installed ffmpeg.


// --- Helper Functions ---
const delay = ms => new Promise(res => setTimeout(res, ms));

// Your WhatsApp phone number (for pairing code and sending self-messages)
// IMPORTANT: This is already set to your number (918100601505).
// Do NOT change this unless your phone number changes.
const MY_WHATSAPP_NUMBER = '918100601505';


// --- Command/Plugin Loader ---
const commands = new Map(); // Store commands in a Map
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(__dirname, 'commands', file));
    commands.set(command.name, command); // Store command by its name (e.g., 'play', 'help', 'basic')
    if (command.command) { // If command has a specific prefix (e.g., '.play', '!menu')
        commands.set(command.command, command); // Also store by its command prefix for quick lookup
    }
}
console.log(`Loaded ${commandFiles.length} command files.`);


// --- Main Bot Logic Function ---
async function connectToWhatsApp() {
    // Authentication State Management: Stores session data locally
    const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'baileys_auth_info'));

    // Logger setup for Baileys: Set to 'silent' for minimal output in console
    const logger = P({ level: 'silent' });

    // Initialize WhatsApp Socket: Connects to WhatsApp servers
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // Will still print QR, but pairingCode takes precedence
        useMobile: true,         // ESSENTIAL for pairing code and mobile login style
        logger: logger,
        browser: ['Termux (Linux)', 'Chrome', '1.0.0'], // Custom browser info for WhatsApp Web/Linked Devices
    });

    // --- Pairing Code Logic (for first-time login or after deleting session) ---
    // This block runs if the bot is not yet registered with WhatsApp
    if (!sock.authState.creds.registered) {
        try {
            console.log('Attempting to request pairing code...');
            const cleanedPhoneNumber = MY_WHATSAPP_NUMBER.replace(/\D/g, ''); // Ensure only digits for the phone number
            const pairingCode = await sock.requestPairingCode(cleanedPhoneNumber); // Request the 8-digit pairing code

            console.log('\n======================================');
            console.log('YOUR WHATSAPP PAIRING CODE IS:');
            console.log(`  ${pairingCode}`); // Display the pairing code prominently
            console.log('======================================');
            console.log('Open WhatsApp on your phone, go to Linked Devices, then "Link with phone number" and enter this code.');
            // Reminder: The QR code might still show above this. Focus on the 8-digit code.
        } catch (error) {
            console.error('Error requesting pairing code:', error);
            console.log('Falling back to QR code if displayed or ensure correct phone number/WhatsApp version.');
        }
    }

    // --- Event Listeners ---

    // Connection Updates (e.g., QR code display, connection status changes)
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            // Display QR code (might still show even when pairing code is preferred)
            qrcode.generate(qr, { small: true });
            console.log('QR code displayed above. Please try the pairing code below first.');
        }

        if (connection === 'close') {
            // Handle disconnection and attempt to reconnect
            const shouldReconnect = (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut);
            console.log('Connection closed due to ', lastDisconnect.error?.output?.payload?.message || lastDisconnect.error, ', reconnecting ', shouldReconnect);

            if (lastDisconnect.error?.output?.statusCode === DisconnectReason.loggedOut) {
                console.log('Logged out. Please delete baileys_auth_info and restart the bot to log in again.');
            } else if (shouldReconnect) {
                await delay(5000); // Wait 5 seconds before attempting to reconnect
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            // Successful Connection: Bot is online and ready
            console.log('Client is ready! WhatsApp connection opened.');

            // --- Send Session Confirmation Message to Personal Chat ---
            const myJid = MY_WHATSAPP_NUMBER + '@s.whatsapp.net'; // Construct your WhatsApp JID

            // Add a small delay to ensure the chat is fully ready to receive messages
            setTimeout(async () => {
                try {
                    // Bot's name changed to NicholasXMD~ here
                    const messageText = `NicholasXMD~ Bot Session Active! 🎉\n\nBot ID: ${sock.user.id}\nStatus: Online`;
                    await sock.sendMessage(myJid, { text: messageText });
                    console.log(`Session ID sent to your personal chat (${MY_WHATSAPP_NUMBER}).`);
                } catch (error) {
                    console.error('Failed to send session ID to personal chat:', error);
                }
            }, 3000); // 3-second delay
        }
    });

    // Incoming Messages: Main logic for handling user commands
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify') { // 'notify' indicates new incoming messages
            for (const msg of messages) {
                // Ignore messages sent by the bot itself and status updates
                if (!msg.key.fromMe && msg.key.remoteJid !== 'status@broadcast') {
                    const senderId = msg.key.remoteJid; // The JID (WhatsApp ID) of the sender
                    const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

                    console.log(`[${senderId}] Received: ${messageText}`);

                    // --- Command Dispatcher ---
                    const lowerCaseMessage = messageText.toLowerCase();

                    let commandFound = false;

                    // Check for specific prefixed commands first (like .play or !menu)
                    // Iterate over all loaded commands to find a match
                    for (const [key, command] of commands.entries()) {
                        if (command.command && lowerCaseMessage.startsWith(command.command)) {
                            // Execute the command, passing the 'commands' map itself for the help command
                            await command.execute(sock, msg, senderId, messageText, commands);
                            commandFound = true;
                            break; // Stop after finding the first matching command
                        }
                    }

                    // If no specific prefixed command was found, check for basic text commands
                    // This handles "hello", "how are you?", "!ping" from commands/basic.js
                    if (!commandFound && commands.has('basic')) {
                        // The 'basic' module handles multiple non-prefixed commands internally
                        await commands.get('basic').execute(sock, msg, senderId, messageText);
                    }
                }
            }
        }
    });

    // Credential Updates: Save authentication state periodically
    sock.ev.on('creds.update', saveCreds);

    // --- Function to provide phone number (for internal use by Baileys) ---
    async function promptForPhoneNumber() {
        return MY_WHATSAPP_NUMBER;
    }
}

// --- Start the Bot Connection Process ---
connectToWhatsApp();
