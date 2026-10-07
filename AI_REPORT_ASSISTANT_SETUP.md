# AI Report Assistant – setup

1. Put your key in `backend/.env`:  GEMINI_API_KEY=...  (free key from https://aistudio.google.com/apikey)
2. Install new packages:
   cd backend && npm install
   (frontend needs no new packages)
3. Run (3 terminals):
   cd backend  && npm run server      # http://localhost:4000
   cd frontend && npm install && npm run dev   # http://localhost:5173
   cd admin    && npm install && npm run dev   # optional
4. Log in as a patient -> click "REPORT AI" in the navbar (/report-assistant).
5. Make sure at least one doctor is added in the admin panel and marked Available,
   otherwise there are no doctors to recommend.

New/changed files
  backend/models/reportChatModel.js        chat history (per user, MongoDB)
  backend/services/reportPrompt.js         prompt, JSON schema, language rules
  backend/services/reportAssistant.js      Gemini API call (free tier)
  backend/controllers/reportController.js  GET / POST / DELETE /api/user/report-chat
  backend/middleware/reportUpload.js       in-memory upload (4 MB x 3 files)
  backend/routes/userRoute.js              3 new routes + rate limit (30 msgs/hour/user)
  backend/package.json                     + express-rate-limit
  frontend/src/pages/ReportAssistant.jsx   chat page
  frontend/src/i18n/reportAssistant.js     English / Hindi / Kannada UI text
  frontend/src/App.jsx, components/Navbar.jsx, index.css   route, nav link, fonts
