export function getPasswordResetEmailHtml({
  url,
  userName,
}: {
  url: string;
  userName: string;
}) {
  const primaryColor = '#2563EB'; // specified in PRD
  const bgLight = '#F4F5F7';
  const textDark = '#172B4D';
  const textMuted = '#5E6C84';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: ${bgLight};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
      -webkit-font-smoothing: antialiased;
    }
    .email-wrapper {
      width: 100%;
      background-color: ${bgLight};
      padding: 40px 20px;
    }
    .email-container {
      max-width: 500px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      overflow: hidden;
      border: 1px solid #E5E7EB;
    }
    .email-header {
      text-align: center;
      padding: 32px 32px 0;
    }
    .logo {
      font-size: 24px;
      font-weight: 800;
      color: ${textDark};
      text-decoration: none;
      letter-spacing: -0.5px;
      margin-bottom: 24px;
      display: inline-block;
    }
    .illustration {
      width: 100px;
      height: 100px;
      margin: 0 auto 16px;
      display: block;
    }
    .heading {
      font-size: 22px;
      font-weight: 700;
      color: ${textDark};
      margin: 0 0 24px;
    }
    .email-body {
      padding: 0 32px 32px;
      color: ${textDark};
      font-size: 15px;
      line-height: 1.6;
    }
    .email-body p {
      margin: 0 0 16px;
    }
    .btn-container {
      text-align: center;
      margin: 32px 0;
    }
    .btn {
      display: inline-block;
      background-color: ${primaryColor};
      color: #ffffff;
      text-decoration: none;
      font-weight: 600;
      font-size: 15px;
      padding: 14px 28px;
      border-radius: 10px;
      min-width: 200px;
    }
    .security-note {
      font-size: 14px;
      color: ${textMuted};
      background-color: #F8FAFC;
      padding: 16px;
      border-radius: 8px;
      border: 1px solid #E2E8F0;
      margin-top: 24px;
    }
    .email-footer {
      text-align: center;
      padding: 24px;
      font-size: 12px;
      color: #9CA3AF;
      line-height: 1.5;
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper { padding: 20px 10px; }
      .email-container { width: 100%; border-radius: 12px; }
      .email-header { padding: 24px 20px 0; }
      .email-body { padding: 0 20px 24px; }
      .btn { display: block; width: 100%; box-sizing: border-box; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      
      <!-- Header with Logo and Illustration -->
      <div class="email-header">
        <div class="logo">Kordit</div>
        
        <!-- Microsoft Fluent 3D Key Emoji as the friendly character/illustration -->
        <img src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Key/3D/key_3d.png" alt="Key Illustration" class="illustration" />
        
        <h1 class="heading">Reset your password</h1>
      </div>

      <!-- Body -->
      <div class="email-body">
        <p>Hi ${userName},</p>
        
        <p>We received a request to reset the password for your Kordit account.</p>
        
        <p>Click the button below to create a new password. This link will expire in <strong>30 minutes</strong> for your security.</p>
        
        <div class="btn-container">
          <a href="${url}" class="btn">Reset Password</a>
        </div>
        
        <div class="security-note">
          If you did not request this, you can safely ignore this email. Your password will not be changed.
        </div>
        
        <p style="margin-top: 24px; margin-bottom: 0;">
          Thanks,<br>
          The Kordit Team
        </p>
      </div>

    </div>
    
    <!-- Footer -->
    <div class="email-footer">
      This is a security email from Kordit.<br>
      &copy; ${new Date().getFullYear()} Kordit Task Board. All rights reserved.
    </div>
  </div>
</body>
</html>
  `;
}
