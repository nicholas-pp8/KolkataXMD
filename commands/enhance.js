// --- Modules for Image Enhancement Feature ---
const cloudinary = require('cloudinary').v2;
const axios = require('axios');
const fs = require('fs');
const path = require('path'); // Needed for temporary file path if you save/delete

// Configure Cloudinary using the URL from your .env file
// The .env file is loaded in index.js, so process.env.CLOUDINARY_URL will be available here.
cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL,
    secure: true
});

// Helper to download image message (Baileys specific)
async function downloadMediaMessage(message) {
    // You need to figure out how to get the correct message type from the passed 'message' object
    // For simplicity, assuming message.message.imageMessage is the target
    if (message.message?.imageMessage) {
        const stream = await (require('@whiskeysockets/baileys')).downloadMediaMessage(
            message.message.imageMessage,
            'buffer' // Request a buffer directly
        );
        return Buffer.from(stream);
    }
    throw new Error('Message is not an image.');
}

module.exports = {
    name: 'enhance',
    description: 'Enhances a photo using AI (!enhance - reply to an image)',
    command: '!enhance', // The prefix for this command
    execute: async (sock, message, senderId, messageText) => {
        // Check if the message is a reply to an image, or if it's an image message itself
        const isReplyToImage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
        const isDirectImage = message.message?.imageMessage;

        if (isReplyToImage || isDirectImage) {
            await sock.sendMessage(senderId, { text: 'Got your photo! Attempting to enhance it with AI, please wait...' });
            try {
                let imageBuffer;
                if (isDirectImage) {
                    imageBuffer = await downloadMediaMessage(message);
                } else if (isReplyToImage) {
                    // For a quoted message, you need to download the quoted message's media
                    // This requires more complex Baileys handling to get the full quoted message object
                    // For simplicity in this example, we'll assume a direct image for now or simplify reply handling.
                    // A more robust solution would re-fetch the quoted message by ID.
                    await sock.sendMessage(senderId, { text: 'Sorry, replying to images is more complex. Please send the image directly with !enhance as caption.' });
                    return;
                    // Example (complex):
                    // const quotedMessage = await sock.loadMessage(message.key.remoteJid, message.message.extendedTextMessage.contextInfo.stanzaId);
                    // imageBuffer = await downloadMediaMessage(quotedMessage);
                }

                if (!imageBuffer) {
                    await sock.sendMessage(senderId, { text: 'Could not download the image. Make sure it is a valid image message.' });
                    return;
                }


                // 1. Upload to Cloudinary for enhancement
                const uploadResult = await new Promise((resolve, reject) => {
                    cloudinary.uploader.upload_stream({ folder: "whatsapp_bot_enhancements" }, (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }).end(imageBuffer);
                });

                if (!uploadResult || !uploadResult.public_id) {
                    throw new Error('Cloudinary upload failed or returned no public_id.');
                }

                console.log('Image uploaded to Cloudinary:', uploadResult.public_id);

                // 2. Apply enhancement transformations (Example: auto-color, auto-quality, adjust contrast/brightness)
                const enhancedImageUrl = cloudinary.url(uploadResult.public_id, {
                    transformation: [
                        { effect: "auto_color" },
                        { quality: "auto" },
                        { effect: "sharpen" }
                        // Add more Cloudinary transformations here for specific effects if desired
                        // e.g., { effect: "improve", quality: "auto" }
                    ],
                    secure: true
                });

                console.log('Generated enhanced image URL:', enhancedImageUrl);

                // 3. Send the enhanced image back to WhatsApp
                const enhancedImageResponse = await axios.get(enhancedImageUrl, { responseType: 'arraybuffer' });
                const enhancedImageBuffer = Buffer.from(enhancedImageResponse.data);

                await sock.sendMessage(senderId, { image: enhancedImageBuffer, caption: '✨ Here is your enhanced photo!' });
                console.log('Enhanced photo sent successfully.');

                // Optional: Delete original image from Cloudinary after processing if not needed
                // await cloudinary.uploader.destroy(uploadResult.public_id);
                // console.log('Original image deleted from Cloudinary.');

            } catch (error) {
                console.error('Error in !enhance command:', error);
                await sock.sendMessage(senderId, { text: 'Sorry, I failed to enhance your photo. Error: ' + error.message });
            }
        } else {
            await sock.sendMessage(senderId, { text: 'Please send an image directly with `!enhance` as the caption to enhance it.' });
        }
    },
};
