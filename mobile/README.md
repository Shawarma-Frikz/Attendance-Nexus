# NEXUS Student phone app

This is a native Android/iOS app built with Expo and React Native. It gives students a private sign-in, profile, password controls, and attendance correction flow.

## Features

- Sign in using the student code and password. On first sign-in, it accepts the temporary PIN and requires a strong new password.
- Keeps the session token in Expo SecureStore on the phone; the API stores only a hash of each token.
- Shows the student name, class/group, student code, email, and current attendance state.
- Lets the student take or choose a profile photo, replace it, or delete it.
- Lets the student change their password. Changing it revokes other phone sessions.
- Lets the student tell the classroom computer they are present or late and request a targeted face rescan.

Names, class/group, student code, and email are instructor-managed. The profile picture is stored on the local NEXUS backend in `backend/profile_photos/` and is only available through the signed-in student endpoints.

## Run it on a phone

1. Start the NEXUS backend and frontend as described in the project README.
2. Set up LAN-only HTTPS with mkcert using the instructions below. The Android app includes the public local CA certificate and trusts it only for the configured backend host.
3. Install Node.js 22.13 or newer, then run:

   ```powershell
   cd C:\Users\idris\Desktop\Nexus-Attendance\mobile
   npm install
   npx expo install --fix
   npm start
   ```

4. Build and install the Android APK using the EAS preview profile below. EAS provides an install link and QR code after the build finishes.
5. Sign in with the student code and temporary PIN from the credential email. The app immediately asks for a strong password the first time.

The app uses Expo SDK 58 and requires HTTPS. The custom Android certificate trust is added by a config plugin, so use the built APK rather than Expo Go. Cleartext traffic remains disabled.

## Build a downloadable Android app

The repository includes [`eas.json`](eas.json) with an internal `preview` profile that produces an installable APK. From this directory:

```powershell
npm install
npx expo install --fix
npx eas-cli login
npx eas-cli init
npx eas-cli env:set --name EXPO_PUBLIC_API_BASE --value https://YOUR_HTTPS_BACKEND_HOST --environment preview --visibility plaintext
npx eas-cli build --platform android --profile preview
```

Use the LAN HTTPS backend address in the environment command. It is compiled into the app and is not a secret. After the cloud build completes, open its EAS build page and select Install to show the QR code. Students scan it, download the APK, and approve installation when Android asks. The app works without Expo Go or a development server while the backend is reachable on the same Wi-Fi network.

For a public Google Play release, use the `production` profile instead; it creates the store-oriented Android App Bundle. For iOS, distribution requires Apple signing/provisioning and usually TestFlight or registered test devices, so Android APK is the simplest class demo path.

To show the download QR directly on the instructor dashboard, add the install-page URL from EAS to frontend/.env.local:

~~~text
NEXT_PUBLIC_STUDENT_APP_INSTALL_URL=https://your-eas-install-page
~~~

Restart the frontend after changing the value. The dashboard's Student app download panel will then show a scannable QR and link.

## LAN-only HTTPS setup

The Windows computer and each student phone must be on the same Wi-Fi. Check the computer's current Wi-Fi IPv4 using ipconfig; the address used in the example below is 192.168.1.140.

Run in PowerShell from the backend folder:

~~~powershell
.\setup-local-https.ps1 -LanIp 192.168.1.140
~~~

The setup script creates backend/certs/server.pem and server-key.pem, then copies mkcert's public rootCA.pem into mobile/certs/rootCA.pem. The backend TLS folder is git-ignored. Never copy or share mkcert's rootCA-key.pem or backend/certs/server-key.pem.

Start the HTTPS API in another terminal:

~~~powershell
.\run-https.ps1
~~~

For local development, copy mobile/.env.example to mobile/.env and set EXPO_PUBLIC_API_BASE to https://192.168.1.140:8443. For an installable APK, set the same value in the EAS preview environment and run the preview build command above. If the LAN IP or mkcert CA changes, regenerate the certificate and rebuild the APK. Do not forward port 8443 from the router to the public internet.

## Privacy and demo limits

Profile photos are optional and distinct from the face templates used for attendance. They are resized on the backend and stored locally; the app provides a delete-photo action. This prototype does not provide encrypted file storage, remote hosting, push notifications, or app-store builds. Use consenting test participants and HTTPS before using real student accounts over a network.
