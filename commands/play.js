const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

module.exports = {
    name: 'play',
    description: 'Downloads audio from a YouTube link and sends as a voice message (.play [YouTube URL])',
    command: '.play', // The prefix for this command
    execute: async (sock, message, senderId, messageText) => {
        const youtubeLink = messageText.substring(messageText.indexOf(module.exports.command) + module.exports.command.length).trim();

        if (ytdl.validateURL(youtubeLink)) {
            await sock.sendMessage(senderId, { text: 'Got your request! Attempting to download and convert the song (quality reduced for voice message format), please wait...' });
            try {
                const info = await ytdl.getInfo(youtubeLink);
                const title = info.videoDetails.title.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 50);
                const outputFilePath = path.join(__dirname, '..', `${title}.mp3`); // Go up one directory to save in main folder

                console.log(`Downloading: "${title}" from ${youtubeLink}`);

                ytdl(youtubeLink, { filter: 'audioonly', quality: 'highestaudio' })
                    .pipe(ffmpeg({ format: 'mp3' })
                        .audioBitrate('96k')
                        .audioChannels(1)
                        .output(outputFilePath)
                    )
                    .on('end', async () => {
                        console.log(`Finished downloading and converting: ${outputFilePath}`);
                        try {
                            const audioBuffer = fs.readFileSync(outputFilePath);
                            const fileSizeInBytes = fs.statSync(outputFilePath).size;
                            const fileSizeInMB = fileSizeInBytes / (1024 * 1024);

                            console.log(`Processed file size: ${fileSizeInMB.toFixed(2)} MB`);

                            if (fileInMB > 16) {
                                await sock.sendMessage(senderId, { text: `Sorry, "${title}.mp3" is still too large (${fileSizeInMB.toFixed(2)} MB) to be sent as a voice message, even with quality reduction. WhatsApp's limit for voice messages is about 16 MB.` });
                                console.log('File too large for voice message after degradation, informed user.');
                            } else {
                                await sock.sendMessage(senderId, {
                                    audio: audioBuffer,
                                    mimetype: 'audio/mp4',
                                    ptt: true
                                });
                                await sock.sendMessage(senderId, { text: `Downloaded "${title}.mp3" (Size: ${fileInMB.toFixed(2)} MB) and sent as voice message.` });
                                console.log('Song sent successfully as voice message with reduced quality.');
                            }
                        } catch (sendError) {
                            console.error('Error sending song (likely due to size or format not fully compatible):', sendError);
                            await sock.sendMessage(senderId, { text: 'Sorry, I failed to send the song as a voice message. It might still be too large or an incompatible format after conversion.' });
                        } finally {
                            if (fs.existsSync(outputFilePath)) {
                                fs.unlinkSync(outputFilePath);
                                console.log('Temporary file deleted.');
                            }
                        }
                    })
                    .on('error', async (err) => {
                        console.error('Error during download/conversion:', err);
                        await sock.sendMessage(senderId, { text: 'Sorry, I encountered an error downloading or converting that song.' });
                    });

            } catch (error) {
                console.error('Error fetching YouTube info or initiating download:', error);
                await sock.sendMessage(senderId, { text: 'Sorry, I could not find that YouTube video or something went wrong.' });
            }
        } else {
            await sock.sendMessage(senderId, { text: 'Please send a valid YouTube video link after `.play ` (e.g., `.play https://www.youtube.com/watch?v=dQw4w9WgXcQ`).' });
        }
    },
};
