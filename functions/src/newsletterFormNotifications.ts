/**
 * Emails for newsletter custom-form submissions.
 *  - Author notification (on unless the form turns it off; the stored field is still called
 *    notifyTeacher, from the app this newsletter builder came from, so copied newsletters keep their setting).
 *  - Optional confirmation copy to the person who filled it out, if the form has an Email
 *    field and "sendConfirmationEmail" is on.
 * Email is optional (see email.ts): without Gmail credentials nothing is sent, and the
 * responses are still saved and shown on the admin Form Responses page.
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import { getEmailTransporter, EMAIL_FROM, SITE_URL, ownerEmails } from './email';

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

interface FormField { id: string; label?: string; type?: string }

const answersTable = (fields: FormField[], answers: Record<string, unknown>) => fields
  .filter((field) => String(answers[field.id] ?? '').trim())
  .map((field) => `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;vertical-align:top;">${escapeHtml(field.label || 'Field')}</td><td style="padding:6px 0;color:#111827;">${escapeHtml(answers[field.id])}</td></tr>`)
  .join('');

const wrap = (heading: string, body: string) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: #10295e; padding: 24px; border-radius: 8px 8px 0 0; border-bottom: 4px solid #e6252e;">
      <h2 style="margin: 0; color: white; font-size: 20px;">${heading}</h2>
    </div>
    <div style="background: #fffdf8; padding: 24px; border-radius: 0 0 8px 8px; color: #18202d; font-size: 15px; line-height: 1.5;">
      ${body}
    </div>
  </div>`;

export const onNewsletterFormResponse = onDocumentCreated(
  'spaces/{spaceId}/newsletters/{newsletterId}/responses/{responseId}',
  async (event) => {
    const data = event.data?.data();
    // Polls and RSVPs are handled elsewhere
    if (!data || !data.formId || !data.answers) return;

    const transporter = getEmailTransporter();
    if (!transporter) {
      logger.info('Form response saved; email is not set up, so no notification was sent');
      return;
    }

    const { spaceId, newsletterId } = event.params;
    const newsletterSnap = await admin.firestore().doc(`spaces/${spaceId}/newsletters/${newsletterId}`).get();
    const sections: Array<Record<string, any>> = newsletterSnap.data()?.sections || [];
    const form = sections.find((section) => section.id === data.formId && section.type === 'customForm');
    if (!form) return;

    const fields: FormField[] = form.fields || [];
    const answers: Record<string, unknown> = data.answers;
    const formTitle = form.formTitle || 'your form';
    const rows = answersTable(fields, answers);

    if (form.notifyTeacher !== false) {
      try {
        const to = (await ownerEmails()).join(', ');
        if (to) {
          await transporter.sendMail({
            from: EMAIL_FROM,
            to,
            subject: `New response: ${formTitle}`,
            html: wrap(
              `New response to “${escapeHtml(formTitle)}”`,
              `<table style="border-collapse:collapse;">${rows || '<tr><td>(No answers)</td></tr>'}</table>
               <p style="margin-top:20px;"><a href="${SITE_URL}/admin/form-responses" style="color:#c41d25;">View all responses</a></p>`
            ),
          });
        }
      } catch (error) {
        logger.error('Form notification to the author failed', error);
      }
    }

    if (form.sendConfirmationEmail) {
      const emailField = fields.find((field) => field.type === 'email' && EMAIL_PATTERN.test(String(answers[field.id] ?? '').trim()));
      if (emailField) {
        try {
          const message = form.confirmationMessage || 'Thank you! Your response has been recorded.';
          await transporter.sendMail({
            from: EMAIL_FROM,
            to: String(answers[emailField.id]).trim(),
            subject: `We received your response: ${formTitle}`,
            html: wrap(
              escapeHtml(formTitle),
              `<p>${escapeHtml(message)}</p>
               <p style="margin-bottom:6px;color:#69727b;">Here is a copy of what you sent:</p>
               <table style="border-collapse:collapse;">${rows}</table>`
            ),
          });
        } catch (error) {
          logger.error('Form confirmation email failed', error);
        }
      }
    }
  }
);
