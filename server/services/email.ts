import { config } from '../config';

export async function sendParentMagicLink(email: string, token: string): Promise<void> {
  const url = new URL('/parent', config.PUBLIC_APP_URL);
  url.searchParams.set('magicToken', token);
  const from = config.PARENT_EMAIL_FROM ?? config.EMAIL_FROM;
  const message = {
    from,
    to: [email],
    subject: 'Your Glitter parent sign-in link',
    text: `Use this private link to sign in to the Glitter parent area. It expires in 15 minutes.\n\n${url.toString()}\n\nNo child or health information is included in this email.`,
  };

  if (config.RESEND_API_KEY) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    if (!response.ok) throw new Error('Parent email could not be sent');
    return;
  }

  if (config.SMTP_URL) {
    const nodemailer = await import('nodemailer');
    await nodemailer.createTransport(config.SMTP_URL).sendMail({ ...message, to: email });
    return;
  }

  if (process.env.REPLIT_CONNECTORS_HOSTNAME) {
    const { ReplitConnectors } = await import('@replit/connectors-sdk');
    const response = await new ReplitConnectors().proxy('resend', '/emails', { method: 'POST', body: message });
    if (!response.ok) throw new Error('Parent email could not be sent');
    return;
  }

  if (config.NODE_ENV === 'production') throw new Error('Parent email is not configured');
}
