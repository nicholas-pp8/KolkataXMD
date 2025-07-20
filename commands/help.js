module.exports = {
    name: 'menu', // <--- Changed from 'help' to 'menu'
    description: 'Displays a list of available commands (!menu)',
    command: '!menu',
    execute: async (sock, message, senderId, messageText, commands, botSettings, config) => { // Added 'config' parameter
        let helpMessage = `✨ ${config.botName} Commands ✨\n\n`; // Use botName from config

        // Sort commands alphabetically by their primary command prefix for a cleaner list
        const sortedCommands = Array.from(commands.values())
            .filter(cmd => cmd.command && commands.get(cmd.command) === cmd) // Filter to only primary command entries
            .sort((a, b) => a.command.localeCompare(b.command)); // Sort by command prefix

        for (const cmd of sortedCommands) {
            let usage = cmd.command; // Start with the command prefix

            // Add specific usage examples based on command name
            if (cmd.name === 'play') {
                usage += '[YouTube URL]';
            } else if (cmd.name === 'apk_search') {
                usage += '[App Name]';
            } else if (cmd.name === 'settings') { // This module handles multiple commands like !alwaysonline, !autotyping, !autoreact
                usage = `!alwaysonline on/off\n➡️ !autotyping on/off\n➡️ !autoreact on/off`;
                // Add a specific description for the general settings module, as its description is broad
                helpMessage += `➡️ ${usage}: Manage bot presence & reactions.\n`;
                continue; // Skip the default append for this entry
            }

            helpMessage += `➡️ ${usage}: ${cmd.description}\n`;
        }
        
        // Explicitly add basic commands description as they don't have a specific prefix but are important
        if (commands.has('basic')) {
            helpMessage += `➡️ ${commands.get('basic').description}\n`;
        }

        helpMessage += `\nEnjoy your chat with ${config.botName}!`; // Use botName from config
        await sock.sendMessage(senderId, { text: helpMessage });
    },
};
