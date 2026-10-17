# Mr Bowen N Virtual Platform — frontend starter

This is a **login/front-page starter**, not a complete conversion of the original PHP site. Student/trainer dashboards, quizzes, lesson management, guest access, progress, materials, and the remaining original features still need to be migrated and tested.

## Publish to GitHub Pages
1. In your GitHub repository `mr-bowen-virtual-platform`, choose **Add file → Upload files**.
2. Upload `index.html`, `styles.css`, `config.js`, and `app.js` to the repository root.
3. Commit the changes.
4. Open **Settings → Pages**.
5. Under **Build and deployment**, select **Deploy from a branch**.
6. Choose branch `main`, folder `/ (root)`, then click **Save**.
7. Wait for GitHub Pages to provide the site URL.

## Configure the API
Edit `config.js` and replace `https://REPLACE-WITH-YOUR-BACKEND-URL` with the HTTPS URL of your deployed backend. The backend must allow the exact GitHub Pages origin via `FRONTEND_ORIGIN` and configure cross-site cookies/CSRF protection correctly before production use.

## Security
Never commit `.env`, database dumps, password hashes, Supabase service-role keys, or database connection strings. Only server-side backend environment variables may contain database credentials. Use a private repository during development.

## Current limitations
- The login UI expects `POST /api/auth/login` and `credentials: include`.
- A successful login displays a confirmation only; it does not redirect to an unfinished dashboard.
- Backend/frontend cross-site session cookies must be configured and tested for the actual deployment hostnames.
- This starter does not yet implement every feature of the original PHP/MySQL website.
