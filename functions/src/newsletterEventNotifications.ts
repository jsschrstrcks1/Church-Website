/**
 * Emails a newsletter's author when someone RSVPs to an "event" section
 * (unless the event turns "Email me when a new guest RSVPs" off).
 * Email is optional (see email.ts): without Gmail credentials nothing is sent, and RSVPs
 * are still saved and shown in the editor and on the admin Form Responses page.
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

export const onNewsletterEventRsvp = onDocumentCreated(
  'spaces/{spaceId}/newsletters/{newsletterId}/responses/{responseId}',
  async (event) => {
    const data = event.data?.data();
    // Only event RSVPs carry a name together with sectionId and option
    if (!data || typeof data.sectionId !== 'string' || typeof data.option !== 'string' || typeof data.name !== 'string') return;

    const transporter = getEmailTransporter();
    if (!transporter) {
      logger.info('RSVP saved; email is not set up, so no notification was sent');
      return;
    }

    const { spaceId, newsletterId } = event.params;
    const db = admin.firestore();

    try {
      const newsletterSnap = await db.doc(`spaces/${spaceId}/newsletters/${newsletterId}`).get();
      const sections: Array<Record<string, any>> = newsletterSnap.data()?.sections || [];
      const section = sections.find((item) => item.id === data.sectionId && item.type === 'event');
      if (!section || !section.eventCollectRsvps || section.eventNotify === false) return;

      const to = (await ownerEmails()).join(', ');
      if (!to) return;

      const eventName = section.eventName || 'your event';
      const guests = data.option === 'Not going' ? '' : ` (${Number(data.guests) || 1} ${Number(data.guests) === 1 ? 'person' : 'people'})`;

      await transporter.sendMail({
        from: EMAIL_FROM,
        to,
        subject: `New RSVP: ${eventName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #10295e; padding: 24px; border-radius: 8px 8px 0 0; border-bottom: 4px solid #e6252e;">
              <h2 style="margin: 0; color: white; font-size: 20px;">New RSVP: ${escapeHtml(eventName)}</h2>
            </div>
            <div style="background: #fffdf8; padding: 24px; border-radius: 0 0 8px 8px; color: #18202d; font-size: 15px;">
              <p><strong>${escapeHtml(data.name)}</strong> responded <strong>${escapeHtml(data.option)}</strong>${guests}.</p>
              <p style="margin-top:20px;"><a href="${SITE_URL}/admin/form-responses" style="color:#c41d25;">See all RSVPs</a></p>
            </div>
          </div>`,
      });
    } catch (error) {
      logger.error('Event RSVP notification failed', error);
    }
  }
);
