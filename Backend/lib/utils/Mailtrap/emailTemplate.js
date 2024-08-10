export const VERIFICATION_EMAIL_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email - Join Us in the Future of Social Networking</title>
</head>
<body style="font-family: 'Roboto', sans-serif; line-height: 1.8; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #1a1a1a;">
  <div style="background: linear-gradient(135deg, #1c92d2, #f2fcfe); padding: 20px; text-align: center; border-radius: 10px;">
    <h1 style="color: #ffffff; margin: 0; font-family: 'Poppins', sans-serif;">Verify Your Email</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.3);">
    <p>Hello,</p>
    <p>You're almost there! Use the verification code below to complete your sign-up and join the future of social networking:</p>
    <div style="text-align: center; margin: 30px 0;">
      <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1c92d2;">{verificationCode}</span>
    </div>
    <p>Please enter this code on the verification page within the next 15 minutes to activate your account.</p>
    <p>If you didn't sign up, you can safely ignore this email.</p>
    <p>Welcome to your new digital playground,</p>
    <p>— The Future Social Team</p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #bbb; font-size: 0.8em;">
    <p>This is an automated message. Please do not reply to this email.</p>
  </div>
</body>
</html>
`;



export const PASSWORD_RESET_SUCCESS_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset Successful - Account Secured</title>
</head>
<body style="font-family: 'Roboto', sans-serif; line-height: 1.8; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #1a1a1a;">
  <div style="background: linear-gradient(135deg, #1c92d2, #f2fcfe); padding: 20px; text-align: center; border-radius: 10px;">
    <h1 style="color: #ffffff; margin: 0; font-family: 'Poppins', sans-serif;">Password Reset Successful</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.3);">
    <p>Hello,</p>
    <p>Your password has been successfully reset. You can now log in with your new credentials.</p>
    <div style="text-align: center; margin: 30px 0;">
      <div style="background-color: #1c92d2; color: white; width: 50px; height: 50px; line-height: 50px; border-radius: 50%; display: inline-block; font-size: 30px;">
        ✓
      </div>
    </div>
    <p>If you did not request this change, please contact our support team immediately to secure your account.</p>
    <p>For optimal security:</p>
    <ul>
      <li>Use a unique password with a mix of characters</li>
      <li>Enable two-factor authentication</li>
      <li>Avoid reusing passwords across platforms</li>
    </ul>
    <p>Thank you for prioritizing your account’s safety,</p>
    <p>— The Future Social Team</p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #bbb; font-size: 0.8em;">
    <p>This is an automated message. Please do not reply to this email.</p>
  </div>
</body>
</html>
`;



export const PASSWORD_RESET_REQUEST_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password - Secure Your Account</title>
</head>
<body style="font-family: 'Roboto', sans-serif; line-height: 1.8; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #1a1a1a;">
  <div style="background: linear-gradient(135deg, #1c92d2, #f2fcfe); padding: 20px; text-align: center; border-radius: 10px;">
    <h1 style="color: #ffffff; margin: 0; font-family: 'Poppins', sans-serif;">Password Reset Request</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.3);">
    <p>Hello,</p>
    <p>We received a request to reset your password. If you did not make this request, please disregard this email.</p>
    <p>To reset your password, please click the button below:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{resetURL}" style="background-color: #1c92d2; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
    </div>
    <p>This link will remain active for 1 hour to ensure your account's security.</p>
    <p>Stay safe,</p>
    <p>— The Future Social Team</p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #bbb; font-size: 0.8em;">
    <p>This is an automated message. Please do not reply to this email.</p>
  </div>
</body>
</html>
`;


export const WELCOME_EMAIL_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Our Community, {username}!</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(to right, #4CAF50, #45a049); padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0;">Welcome, {username}!</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <p>Hello {username},</p>
    <p>We're thrilled to have you with us! Click the button below to explore your dashboard and start your journey:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{dashboardURL}" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Go to Dashboard</a>
    </div>
    <p>If you have any questions, feel free to reach out to our support team.</p>
    <p>Best regards,<br>Your App Team</p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #888; font-size: 0.8em;">
    <p>This is an automated message, please do not reply to this email.</p>
  </div>
</body>
</html>
`;


