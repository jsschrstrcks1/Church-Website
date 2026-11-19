/**
 * Cloud Functions for the church app.
 *
 * Accounts:    acceptInvite, removeMember
 * Newsletters: translateNewsletter,
 *              onNewsletterPollVote, onNewsletterFormResponse, onNewsletterEventRsvp
 * Live:        liveStream (go live, heartbeat, end stream; the video goes through public/stream-helper)
 */

import * as admin from 'firebase-admin';

admin.initializeApp();

export { acceptInvite } from './acceptInvite';
export { removeMember } from './removeMember';
export { translateNewsletter } from './translateNewsletter';
export { onNewsletterPollVote } from './newsletterPollTally';
export { onNewsletterFormResponse } from './newsletterFormNotifications';
export { onNewsletterEventRsvp } from './newsletterEventNotifications';
export { liveStream } from './liveStream';
export { youtubeOAuthCallback } from './youtube';
export { facebookOAuthCallback } from './facebook';
export { liveStudioVideo } from './liveStudioVideo';
