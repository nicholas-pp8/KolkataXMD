# NicholasXMD WhatsApp Bot 🤖

Welcome to the NicholasXMD WhatsApp Bot! This is a simple yet powerful bot built with Node.js that runs on WhatsApp using the Baileys library. It's designed to respond to basic commands and can even download and send audio from YouTube videos directly as WhatsApp voice messages.

---

## ✨ Features

* **Basic Chat Responses:** Responds to commands like `hello`, `how are you?`, `!ping`.
* **Automated Session Confirmation:** Sends a message to the linked WhatsApp number upon successful connection: `NicholasXMD~ Bot Session Active! 🎉`.
* **YouTube Song Download (`.play` command):**
    * Accepts a YouTube video URL.
    * Downloads the audio stream.
    * Converts the audio to MP3 format with reduced quality (96kbps mono) to fit WhatsApp voice message limits.
    * Sends the converted audio as a voice message.
    * Informs the user if the song is still too large for a voice message (over ~16 MB).

---

## 🚀 Technologies Used

* **Node.js:** JavaScript runtime.
* **Baileys (`@whiskeysockets/baileys`):** Unofficial WhatsApp Web API library for Node.js.
* **`ytdl-core`:** For downloading YouTube content.
* **`fluent-ffmpeg`:** Node.js wrapper for FFmpeg.
* **`ffmpeg`:** (Installed system-wide via `pkg` on Termux) A powerful command-line tool for multimedia handling.
* **`pino`:** Fast Node.js logger.

---

## ⚙️ Local Setup (Using Termux on Android)

This bot is designed to run efficiently on a Termux environment on an Android device for personal use.

**Prerequisites:**
* Android device with Termux installed.
* `Node.js` and `npm` installed in Termux (`pkg install nodejs`).
* `ffmpeg` installed in Termux (`pkg install ffmpeg`).
* `git` installed in Termux (`pkg install git`).
* A stable internet connection.

**Steps:**

1.  **Clone the Repository (if starting fresh) or navigate to your existing project:**
    ```bash
    git clone [https://github.com/nicholas-pp8/kolkataXMD.git](https://github.com/nicholas-pp8/kolkataXMD.git) # Use your actual repo URL
    cd kolkataXMD # Or 'cd whatsapp-baileys-bot' if you renamed locally
    ```
    *If you already have the project, just `cd whatsapp-baileys-bot`.*

2.  **Install Node.js dependencies:**
    ```bash
    npm install
    ```

3.  **Configure your WhatsApp Number:**
    Open `index.js` and ensure `MY_WHATSAPP_NUMBER` is set to your phone number with country code, without `+` (e.g., `'918100601505'`).
    ```bash
    nano index.js
    # Look for: const MY_WHATSAPP_NUMBER = '918100601505';
    # Save and exit (Ctrl+X, y, Enter)
    ```

4.  **Delete old session data (important for fresh login/pairing code):**
    ```bash
    rm -rf baileys_auth_info
    ```

5.  **Run the bot:**
    ```bash
    node index.js
    ```
    * You will see an 8-character pairing code in the Termux console.
    * On your phone, open WhatsApp, go to `Settings` > `Linked Devices` > `Link a Device` > "Link with phone number".
    * Enter the 8-character code from Termux.
    * Once connected, you will receive a confirmation message in your personal chat.

---

## ☁️ Cloud Deployment (e.g., Render, Railway)

For 24/7 uptime and reliability, deploying to a cloud platform is highly recommended.

**Key Considerations:**

* **Persistent Storage:** Baileys requires persistent storage for `baileys_auth_info` (session data). Ensure your chosen platform offers this (e.g., Render Disks, Railway Volumes). Without it, you'll need to re-authenticate on every restart.
* **Environment Variables:** Do **not** hardcode your phone number in `index.js` for cloud deployment. Use environment variables.
    * Change `const MY_WHATSAPP_NUMBER = '918100601505';` to `const MY_WHATSAPP_NUMBER = process.env.PHONE_NUMBER;`.
    * On your platform (Render/Railway), add an environment variable `PHONE_NUMBER` with your number as its value.
* **Long-Running Process:** Deploy as a "Web Service" or "Service" that runs continuously, not a serverless function.
* **Resource Limits:** Free tiers often have limited CPU and RAM. The song download feature can be resource-intensive and might hit limits or timeouts on free plans. A paid plan might be necessary for reliable song downloads.

**General Steps:**

1.  **Push Code to GitHub:** (You've already done this!)
    Ensure your local changes are pushed to `main` branch.
    ```bash
    git add .
    git commit -m "Update README and final code"
    git push -u origin main
    ```
2.  **Choose a Platform:** Sign up for [Render.com](https://render.com/) or [Railway.app](https://railway.app/).
3.  **Create New Service:** Connect your GitHub repo, select your `kolkataXMD` repo.
4.  **Configure:** Set `Node` runtime, `npm install` build command, `node index.js` start command.
5.  **Add Environment Variables** (e.g., `PHONE_NUMBER`).
6.  **Configure Persistent Disk** (e.g., Render Disks mounted to `/opt/render/project/src/baileys_auth_info`).
7.  **Deploy!**
8.  **Authenticate (First Time):** Check the deployment logs for the 8-character pairing code to link your WhatsApp account.

---

## 📞 Usage

Interact with the bot by sending messages to its linked WhatsApp number:

* `hello` - Basic greeting.
* `how are you?` - Checks bot's status.
* `!ping` - Replies with "pong!".
* `.play [YouTube URL]` - Downloads the audio from the provided YouTube link and sends it as a WhatsApp voice message.
    * Example: `.play https://www.youtube.com/watch?v=dQw4w9WgXcQ`

---

## ⚠️ Important Notes & Warnings

* **WhatsApp Account Safety:** Using unofficial libraries like Baileys carries a small risk of your WhatsApp account being temporarily or permanently banned if detected by WhatsApp. Use responsibly.
* **Resource Usage:** The `.play` command (downloading and converting audio) is very CPU and memory intensive. Running it frequently or with large files on free hosting tiers may lead to performance issues, timeouts, or service suspension.
* **File Size Limits:** WhatsApp voice messages have an approximate 16 MB limit. Longer songs, even with quality reduction, might exceed this limit and will not be sent as voice messages.
* **Copyright & Legality:** Downloading and distributing copyrighted music without proper authorization is illegal. This bot's `.play` feature is provided for educational purposes on how to handle multimedia streams; use it responsibly and in accordance with copyright laws.

---

## 👤 Author

Nicholas

---

_This bot is for personal/educational use and comes with no guarantees._
