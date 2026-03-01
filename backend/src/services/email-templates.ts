function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function wrapLayout(body: string): string {
  return `<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px">
    <div style="background:#f8f9fa;padding:16px;border-radius:8px;margin-bottom:20px">
      <h1 style="margin:0;font-size:18px;color:#333">myDevices MDM</h1>
    </div>
    ${body}
    <div style="border-top:1px solid #eee;padding-top:12px;margin-top:24px;font-size:12px;color:#999">
      This email was sent automatically by myDevices. Please do not reply.
    </div>
  </div>`;
}

export const emailTemplates = {
  assetAssigned(vars: { userName: string; deviceName: string; serialNumber: string }) {
    return {
      subject: `Asset Assigned - ${vars.deviceName}`,
      html: wrapLayout(`
        <h2>Asset Assignment Notice</h2>
        <p>Hello ${escapeHtml(vars.userName)},</p>
        <p>The following device has been assigned to you:</p>
        <table style="border-collapse:collapse;width:100%">
          <tr><td style="padding:8px;border:1px solid #ddd"><strong>Device</strong></td>
              <td style="padding:8px;border:1px solid #ddd">${escapeHtml(vars.deviceName)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><strong>Serial Number</strong></td>
              <td style="padding:8px;border:1px solid #ddd">${escapeHtml(vars.serialNumber)}</td></tr>
        </table>
      `),
    };
  },

  welcome(vars: { userName: string; email: string; password: string }) {
    return {
      subject: `Welcome to myDevices`,
      html: wrapLayout(`
        <h2>Welcome</h2>
        <p>Hello ${escapeHtml(vars.userName)}, your account has been created.</p>
        <p><strong>Email:</strong> ${escapeHtml(vars.email)}</p>
        <p><strong>Initial Password:</strong> <code>${escapeHtml(vars.password)}</code></p>
        <p>Please change your password immediately after logging in.</p>
      `),
    };
  },

  mdmCommandAlert(vars: { userName: string; deviceName: string; commandType: string }) {
    return {
      subject: `MDM Command Notification - ${vars.commandType}`,
      html: wrapLayout(`
        <h2>MDM Command Executed</h2>
        <p>Hello ${escapeHtml(vars.userName)},</p>
        <p>The following command has been executed on your device:</p>
        <p><strong>Device:</strong> ${escapeHtml(vars.deviceName)}</p>
        <p><strong>Command:</strong> ${escapeHtml(vars.commandType)}</p>
      `),
    };
  },

  assetStatusChanged(vars: { userName: string; deviceName: string; oldStatus: string; newStatus: string }) {
    return {
      subject: `Asset Status Changed - ${vars.deviceName}`,
      html: wrapLayout(`
        <h2>Asset Status Change Notice</h2>
        <p>Hello ${escapeHtml(vars.userName)},</p>
        <p>Your device status has changed:</p>
        <p><strong>${escapeHtml(vars.oldStatus)}</strong> → <strong>${escapeHtml(vars.newStatus)}</strong></p>
      `),
    };
  },
};
