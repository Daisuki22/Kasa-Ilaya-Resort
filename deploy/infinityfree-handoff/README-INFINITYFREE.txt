Kasa Ilaya Resort - InfinityFree deployment handoff

Upload target:
- Upload the contents of htdocs/ into the InfinityFree htdocs folder for the live domain.
- Do not upload the database/ folder into public htdocs.
- This account currently serves the deployed app from:
  http://kasailayaresort.gt.tc/
- The requested kasailayaresort.gt.tc hostname was still showing InfinityFree's
  "domain not found / not added to hosting account" page during verification.
  Fix that in the InfinityFree panel/DNS, then upload this same htdocs/ package
  to the web root for that hostname.

Database:
- Create a MySQL database in InfinityFree.
- Import database/kasa_ilaya_resort_updated.sql through phpMyAdmin.
- Edit htdocs/api/config.local.php and replace the YOUR_INFINITYFREE_* placeholders.

Email OTP:
- Replace the SMTP placeholders in htdocs/api/config.local.php before testing account creation.
- SMS OTP is disabled in this production config.

Build settings used:
- VITE_BASE_PATH=/
- VITE_API_BASE_URL=/api
