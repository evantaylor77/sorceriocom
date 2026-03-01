# Supabase OTP Email Setup

This project uses the 6-digit code sent to email during the sign-up flow.

## Dashboard setup

1. Go to Supabase Dashboard > `Auth` > `Templates` page.
2. Open the `Confirm signup` template.
3. Update the content to show the OTP code.

Example:

```html
<h2>Verify your signup</h2>
<p>Enter the following code in the app:</p>
<p style="font-size:28px; font-weight:700; letter-spacing:4px;">{{ .Token }}</p>
<p>If you did not request this code, please ignore this email.</p>
```

Note:
- `{{ .Token }}` is the 6-digit OTP code.
- Use `{{ .Token }}` instead of `{{ .ConfirmationURL }}`.
- The app code uses `verifyOtp({ email, token, type: 'email' })` for verification.
