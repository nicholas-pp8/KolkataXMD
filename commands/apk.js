const axios = require('axios');
const cheerio = require('cheerio');

module.exports = {
    name: 'apk_search',
    description: 'Searches for an app on APKMirror and returns the link to its page (!apk [app name])',
    command: '!apk ', // The prefix for this command
    execute: async (sock, message, senderId, messageText) => {
        // Extract the app name from the message
        const appName = messageText.substring(messageText.indexOf(module.exports.command) + module.exports.command.length).trim();

        if (!appName) {
            await sock.sendMessage(senderId, { text: 'Please provide an app name to search for (e.g., `!apk WhatsApp`).' });
            return;
        }

        await sock.sendMessage(senderId, { text: `Searching for "${appName}" on APKMirror. Please wait...` });
        console.log(`Searching for APK: ${appName}`);

        try {
            // Construct the search URL for APKMirror
            const searchUrl = `https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${encodeURIComponent(appName)}`;

            // Fetch the HTML content of the search results page
            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' // Mimic a browser
                }
            });
            const $ = cheerio.load(response.data); // Load the HTML into Cheerio for parsing

            // Find the first relevant app link. This part is crucial and fragile to website changes.
            // APKMirror's structure often uses 'div.appRow' for individual app listings and 'a.fontBlack' for the main link.
            const firstAppLinkElement = $('div.appRow a.fontBlack:first');

            let appLink = '';
            let appTitle = '';

            if (firstAppLinkElement.length > 0) {
                appLink = 'https://www.apkmirror.com' + firstAppLinkElement.attr('href');
                appTitle = firstAppLinkElement.text().trim();
            }

            if (appLink && appTitle) {
                const responseMessage = `Found "${appTitle}" on APKMirror:\n🔗 ${appLink}\n\n*Note: This is a link to the app's page on APKMirror. Download APKs at your own risk.*`;
                await sock.sendMessage(senderId, { text: responseMessage });
                console.log(`Sent APKMirror link for ${appTitle}: ${appLink}`);
            } else {
                await sock.sendMessage(senderId, { text: `Sorry, I couldn't find any relevant app results for "${appName}" on APKMirror.` });
                console.log(`No relevant app results found for APK: ${appName}`);
            }

        } catch (error) {
            console.error('Error during APK search:', error.message);
            await sock.sendMessage(senderId, { text: `Sorry, I encountered an error while searching for "${appName}". The website might be down or its structure changed. (${error.message.substring(0, 50)}...)` });
        }
    },
};
