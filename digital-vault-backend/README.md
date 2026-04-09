# Digital Vault Backend

Node.js + Express OTP authentication backend using PostgreSQL and Fast2SMS.

## Folder structure

```text
digital-vault-backend/
|-- server.js
|-- package.json
|-- .env.example
`-- src/
    |-- app.js
    |-- config/
    |   |-- db.js
    |   `-- migrations/
    |       |-- 001_mobile_otp_auth.sql
    |       `-- 002_fast2sms_otp_auth.sql
    |-- controllers/
    |   `-- authController.js
    |-- middleware/
    |   `-- authMiddleware.js
    |-- models/
    |   `-- authModel.js
    |-- routes/
    |   `-- authRoutes.js
    `-- services/
        `-- fast2smsService.js
```

## Environment variables

Copy `.env.example` to `.env` and set:

```env
PORT=5050
DATABASE_URL=postgresql://postgres:password@localhost:5432/digital_vault
JWT_SECRET=replace-with-a-long-secret
FAST2SMS_API_KEY=replace-with-your-fast2sms-api-key
```

## Install and run

```bash
npm install
npm run dev
```

## Database

Run the migration in `src/config/migrations/002_fast2sms_otp_auth.sql`.

```sql
CREATE TABLE otp_codes (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  otp VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## API endpoints

Both prefixes work:

- `POST /auth/send-otp`
- `POST /auth/verify-otp`
- `POST /auth/resend-otp`
- `POST /api/auth/send-otp`
- `POST /api/auth/verify-otp`
- `POST /api/auth/resend-otp`

### Send OTP

Request:

```json
{
  "phone": "9876543210"
}
```

Success:

```json
{
  "success": true,
  "message": "OTP sent successfully",
  "expires_in": "5 minutes"
}
```

Cooldown:

```json
{
  "success": false,
  "message": "Please wait before requesting another OTP",
  "retry_after": 42
}
```

### Verify OTP

Request:

```json
{
  "phone": "9876543210",
  "otp": "123456"
}
```

Success:

```json
{
  "success": true,
  "message": "OTP verified successfully",
  "token": "jwt-token",
  "user": {
    "id": "uuid",
    "phone": "9876543210",
    "role": "user"
  }
}
```

### Resend OTP

Request:

```json
{
  "phone": "9876543210"
}
```

Success:

```json
{
  "success": true,
  "message": "OTP resent successfully",
  "expires_in": "5 minutes"
}
```

## Postman testing examples

### Send OTP

- Method: `POST`
- URL: `http://localhost:5050/auth/send-otp`
- Header: `Content-Type: application/json`
- Body:

```json
{
  "phone": "9876543210"
}
```

### Verify OTP

- Method: `POST`
- URL: `http://localhost:5050/auth/verify-otp`
- Header: `Content-Type: application/json`
- Body:

```json
{
  "phone": "9876543210",
  "otp": "123456"
}
```

### Resend OTP

- Method: `POST`
- URL: `http://localhost:5050/auth/resend-otp`
- Header: `Content-Type: application/json`
- Body:

```json
{
  "phone": "9876543210"
}
```
