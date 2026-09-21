Kasa Ilaya Resort - Railway deployment

What is already prepared:
- Dockerfile builds the Vite frontend and serves it with PHP/Apache.
- /api is copied into the container and served at https://your-domain/api.
- api/config.php reads Railway MySQL variables automatically:
  MYSQLHOST, MYSQLPORT, MYSQLDATABASE, MYSQLUSER, MYSQLPASSWORD
- KASA_API_PATH is set to /api in the Docker image.

Deploy from this folder:
1. Login:
   npx -y @railway/cli login

2. Deploy a new Railway service:
   npx -y @railway/cli up --detach -y --name Kasa-Ilaya-Resort

3. In Railway, add a MySQL service to the same project.

4. Import the database dump into Railway MySQL:
   kasa_ilaya_resort_updated.sql

5. Set optional production variables if needed:
   KASA_MAIL_ENABLED=true
   KASA_SMTP_HOST=...
   KASA_SMTP_USER=...
   KASA_SMTP_PASS=...
   KASA_SMS_ENABLED=true
   SEMAPHORE_API_KEY=...
   KASA_GOOGLE_CLIENT_ID=...

After deploy:
- Open the Railway public URL.
- Check https://your-domain/api/health.php if available.
- If the frontend loads but API calls fail, confirm the MySQL service variables are attached to the web service.
