# NEXUS Attendance Prototype

A classroom attendance prototype using the same broad stack as NEXUS: **Next.js 14, React, TypeScript, Tailwind CSS, FastAPI, SQLAlchemy and SQLite**. It uses the computer's webcam for class attendance. Students use a responsive phone page to submit a correction notice.

## What it does

- Enroll a student with first name, surname, class/group and email. The system generates the student code and one-time PIN and emails both directly to the student. The instructor never sees the PIN.
- Require students to replace the one-time PIN at first sign-in with a password of at least 12 characters, including uppercase and lowercase letters, a number, and a symbol. Store only a salted password hash.
- Guide enrollment through seven face views: front, left at two angles, right at two angles, slightly up and slightly down.
- Detect and align faces with the YuNet model already used in NEXUS. Create local face embeddings with OpenCV Zoo SFace. The database stores embeddings and student details. It does not store the captured enrollment images or attendance video.
- Run a short classroom attendance session. The computer camera opens at session start, recognizes enrolled faces, and closes when everyone is accounted for or the first minute ends.
- Apply the demo timing: **0–29 seconds: present if recognized; 30–59 seconds: late if not yet recognized; 60 seconds onward: absent.**
- Authenticate a student's phone notice with their student code and password. A notice wakes the classroom camera for up to 25 seconds and limits matching to that student's enrolled profile. A confirmed match applies the student's claimed on-time or late arrival status and closes the request.
- Keep an attendance audit trail recording each status transition, the previous and new status, who or what made it (time rule, camera, phone rescan, or instructor), when it happened, and why. Instructor corrections require a reason and are not overwritten by later automatic scans.

## Setup

Use Python 3.11+ and Node.js 18+.

### Backend

```powershell
cd C:\Users\idris\Desktop\Nexus-Attendance\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The SQLite database is created automatically at `backend/attendance.db`.

### Instructor access

Instructor pages and their backing APIs require an authenticated instructor session. Copy `backend/.env.example` to `backend/.env`, set a unique `INSTRUCTOR_USERNAME` and a strong `INSTRUCTOR_PASSWORD` (at least 12 characters with uppercase and lowercase letters, a number, and a symbol), then restart the backend. Startup creates the initial admin account and keeps that bootstrap account synchronized with these `.env` values; changing them resets the admin login and revokes its old sessions. Instructor sessions use an HttpOnly cookie and expire after the configured `INSTRUCTOR_SESSION_HOURS` (12 by default). Student phone sign-in, password reset, and correction requests remain separate student endpoints. Set `COOKIE_SECURE=true` when serving the app over HTTPS.

### Email delivery

Copy `backend/.env.example` to `backend/.env` and fill in SMTP credentials from an email provider. For Gmail, use an app password rather than your normal account password. Set `STUDENT_LOGIN_URL` to the computer's reachable phone-page URL (for example, `http://<computer-lan-ip>:3000/student`) so the email can include an **Open student sign-in** button. Set `STUDENT_RESET_URL` to the matching `/student/reset` page. Keep `backend/.env` private; it is excluded from version control. Student creation is blocked when credentials cannot be emailed, so the instructor is not shown a temporary PIN as a fallback.

The credential email is defined in `backend/templates/student_credentials.html` with a plain-text fallback at `backend/templates/student_credentials.txt`.

Forgotten passwords can be reset from the student phone sign-in page. Reset emails use `backend/templates/password_reset.html` and `.txt`; links expire after 30 minutes, can be used once, and only the token hash is stored. The request page always gives a generic response and limits each account to five reset emails per 15 minutes.

### Frontend

In another terminal:

```powershell
cd C:\Users\idris\Desktop\Nexus-Attendance\frontend
npm install
npm run dev
```

Open `http://localhost:3000`. The browser will ask for webcam access when an attendance session starts or enrollment begins.

### Student phone

Connect the phone and computer to the same Wi-Fi network. Keep the instructor attendance page open on the classroom computer because that browser owns the webcam and listens for targeted rescan requests. Find the computer's LAN IPv4 address with `ipconfig`, then open `http://<computer-ip>:3000/student` on the phone. Allow the computer's firewall to accept local network connections to ports 3000 and 8000 if prompted. The phone page does not need camera access; it sends a notice to the local backend.

For a standalone Android/iOS student app with sign-in, profile photo, password changes, attendance status, and targeted rescan requests, see [`mobile/README.md`](mobile/README.md). The app stores its API token in the phone's secure storage and expects a trusted HTTPS backend endpoint before it will send student credentials or profile data.

### Start attendance from an instructor's phone browser

Open `http://<computer-wi-fi-ip>:3000/remote` on the phone and sign in with instructor access. Choose a group and tap **Start attendance on classroom computer**. Keep the instructor dashboard open and signed in on the classroom computer; it polls for the remote start and opens that computer's camera for the attendance window. The phone sends only the start/end command and does not stream camera video. Both devices must be on the same Wi-Fi, and local-network firewall access to ports 3000 and 8000 must be allowed. On the classroom computer, use `http://localhost:3000` so its browser permits camera access.

## Demo flow

1. Configure SMTP, open **Enroll student**, and add a test profile with the student's email address. The generated student code and one-time PIN are sent to the student, never displayed to the instructor.
2. The student signs in on the phone page and must set a strong password before continuing.
3. Follow all seven camera prompts. Keep one face in the frame, well lit and close enough for the face box to be at least 100 pixels wide/high.
4. Return to **Attendance**, set the same class/group name, and start the session.
5. The camera marks recognized students. Watch the 30-second and 60-second transitions.
6. From a phone, open `/student`, sign in with the student code and chosen password, select the claimed arrival timing, and send a notice. The attendance computer targets that student's face for a short rescan.

## Recognition and attendance limits

- SFace cosine similarity uses OpenCV Zoo's published 0.363 LFW threshold as a starting point. Classroom lighting, camera placement, enrollment angles and a real class roster require their own validation. Similarity is not a calibrated probability.
- The phone notice captures a student's stated arrival timing. Matching their face proves they are in front of the camera during the rescan, but does not independently prove when they entered the room. Instructors can correct a status with a reason; changes are kept in the session review history.
- The local demo emails temporary credentials and reset links through configured SMTP and hashes passwords. Instructor-only pages and APIs require an instructor session, but the prototype has no multi-instructor account management, global request throttling, or SQLite encryption at rest. Instructor review entries include the signed-in username. The phone page uses HTTP on the local network; use HTTPS before sending real credentials in a deployed system. Use test participants with permission. Do not treat this as an official attendance record or safety system.
- A request that does not match within 25 seconds expires and the camera turns off again. The student can submit another notice.
- The camera is opened only for enrollment, the first attendance scan window, or a requested targeted rescan. Raw camera frames are processed by the local API and are not retained.

## Model sources

- YuNet face detector: [OpenCV Zoo model](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet). The detector file is reused from the NEXUS project.
- SFace recognition model: [OpenCV Zoo model and license](https://github.com/opencv/opencv_zoo/tree/main/models/face_recognition_sface). The Zoo documents model scores and its cosine threshold. Those benchmark values do not validate this classroom setup.

The prototype is under active development and is intended for a supervised demonstration.

#   A t t e n d a n c e - N e x u s  
 