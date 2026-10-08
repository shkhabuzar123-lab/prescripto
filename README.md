# Prescripto

Doctor appointment booking app built with the MERN stack.

- `backend`: Express + MongoDB API (port 4000)
- `frontend`: patient website (React + Vite)
- `admin`: admin and doctor panel (React + Vite)

## Requirements
- Node.js 18 or newer
- A MongoDB database (local, or a free MongoDB Atlas cluster)
- A free Cloudinary account (for doctor and report images)

## Setup

1. In each of `backend`, `frontend` and `admin`, copy `.env.example` to `.env` and fill in the values.
   The MongoDB and Cloudinary values in `backend` are required. Payment and Gemini keys are optional.

2. Install packages in each of the three folders:

       cd backend && npm install
       cd frontend && npm install
       cd admin && npm install

3. Run each one in its own terminal:

       backend:   npm run server
       frontend:  npm run dev
       admin:     npm run dev

The frontend and admin addresses are printed in the terminal by Vite.

## Admin login
Use the `ADMIN_EMAIL` and `ADMIN_PASSWORD` you set in `backend/.env`.