# Plain Web + Node App

This folder contains a plain web app with a Node.js backend and MongoDB-based authentication.

## Stack

- HTML
- CSS
- JavaScript
- Node.js
- MongoDB via official Node driver

## Authentication

- Login page: /login.html
- Register page: /register.html
- Dashboard and other pages require a valid auth token
- User accounts are stored in MongoDB (`users` collection)

## Run

1. Open terminal in this folder.
2. Create a local env file:

   Copy `.env.example` to `.env` and fill in your values.

3. Configure environment variables in `.env`:

   MONGODB_URI=<your mongodb connection string>
   AUTH_SECRET=<strong random secret>
   MONGODB_DB=airguard (optional)

4. Run:

   npm start

5. Open:

   http://localhost:3001

## Deploy To Vercel

This project is configured for Vercel with:

- Static pages served from `public/`
- API routes handled by `api/[...path].js`
- Friendly page URLs rewritten in `vercel.json` (for example `/dashboard` -> `/dashboard.html`)

### Steps

1. Push this project to a Git repository.
2. Import the repository in Vercel.
3. Keep framework preset as `Other`.
4. Deploy (no build command required).

### Vercel Environment Variables

Set these in Vercel Project Settings -> Environment Variables:

- `MONGODB_URI`
- `AUTH_SECRET`
- `MONGODB_DB` (optional, defaults to `airguard`)