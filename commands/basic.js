module.exports = {
    name: 'basic',
    description: 'Basic chat commands (hello, how are you?, !ping)',
    execute: async (sock, message, senderId, messageText) => {
        if (messageText.toLowerCase() === 'hello') {
            await sock.sendMessage(senderId, { text: 'Hi there from your NicholasXMD bot!' });
        } else if (messageText.toLowerCase() === 'how are you?') {
            await sock.sendMessage(senderId, { text: 'I am a bot, feeling digital and running on your Android device!' });
        } else if (messageText.toLowerCase() === '!ping') {
            await sock.sendMessage(senderId, { text: 'pong!' });
        }
    },
};
