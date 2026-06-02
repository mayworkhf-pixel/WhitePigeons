# Render Backend Persistent Deployment Guide

The backend for the White Pigeons Portal is currently running on Render at `https://whitepigeons.onrender.com`. Because Render's Free tier uses **ephemeral containers** and restarts or goes to sleep after 15 minutes of inactivity, any changes saved to the local file database (`db.json`) will be **erased** on every restart. 

To prevent data loss (losing registered players, admin settings, and Discord bot keys), you **must connect the backend to Firestore** by setting up environment variables on Render.

---

## 🛠️ Required Environment Variables on Render

Go to your **Render Dashboard** -> Select your **Web Service** (`whitepigeons`) -> **Settings** -> **Environment Variables**, and add the following:

| Key | Value | Description |
| :--- | :--- | :--- |
| `USE_FIRESTORE` | `true` | Tells the backend to save data persistently to Firestore instead of local JSON. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | `{"type": "service_account", ...}` | The entire contents of your Firebase Service Account private key JSON file (obtained from Firebase Console). |
| `SESSION_SECRET` | `your-secure-32-character-secret-key-here` | A secure, random string (at least 32 characters long) used to encrypt and decrypt sensitive fields (like your Discord Bot token) in Firestore. |
| `ADMIN_PASSCODE` | `Grand2026` | Enforces `Grand2026` as your master admin console passcode. |
| `NODE_ENV` | `production` | Tells the server to run in production mode. |

---

## ⏳ Understanding Render Cold Starts (Free Tier)
If you are using the **Render Free Tier**:
1. After 15 minutes of inactivity, the backend container goes to sleep.
2. When a user opens the webpage after it went to sleep, the frontend will show `GATEWAY DISCONNECTED` and `BOT STANDBY`.
3. It takes **30 to 50 seconds** for Render to wake up the container. 
4. Once Render wakes up, the gateway status will change to **Connected** and the bot status will load (online/standby). This is normal behavior for Render Free Tier. To remove this delay, you can upgrade the Render Web Service to a paid instance.

---

## 🤖 Connecting Your Discord Bot
Once your environment variables are configured on Render and the database is persistent:
1. Log in to the portal as an Admin using your passcode (`Grand2026`).
2. Go to the **Admin Console** tab.
3. Open **Discord Configuration** and enter:
   - **Discord Bot Token**
   - **Guild ID** (Server ID)
   - **Client ID** / **Client Secret**
   - **Webhook URLs** for your logging channels.
4. Click **Save Configuration**. The backend will automatically decrypt the token and log your Discord Bot online!
