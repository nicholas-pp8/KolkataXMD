module.exports = {
    name: 'help', // Name of the module (can remain 'help')
    description: 'Displays a list of available commands (!menu)', // Updated description
    command: '!menu', // <--- CHANGED THIS TO !menu
    execute: async (sock, message, senderId, messageText, commands) => {
        let helpMessage = '✨ NicholasXMD Bot Commands ✨\n\n';
        for (const name in commands) {
            const cmd = commands[name];
            if (cmd.command) { // If it has a specific command prefix
                helpMessage += `➡️ ${cmd.command} ${cmd.name === 'play' ? '[YouTube URL]' : ''}: ${cmd.description}\n`;
            } else { // For commands without a specific prefix (like 'hello', 'how are you?')
                helpMessage += `➡️ ${cmd.description}\n`;
            }
        }
        helpMessage += '\nEnjoy your chat with NicholasXMD!';
        await sock.sendMessage(senderId, { text: helpMessage });
    },
};
