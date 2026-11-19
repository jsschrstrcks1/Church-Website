/**
 * Keeps a running tally for newsletter polls ("response" sections).
 * Recounts from the votes each time, so older votes are included and the tally can never drift.
 * Visitors read the tally doc (public); only this function writes it.
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const MAX_VOTES_COUNTED = 5000;

export const onNewsletterPollVote = onDocumentCreated(
  'spaces/{spaceId}/newsletters/{newsletterId}/responses/{responseId}',
  async (event) => {
    const data = event.data?.data();
    if (!data || typeof data.sectionId !== 'string' || typeof data.option !== 'string') return;

    const { spaceId, newsletterId } = event.params;
    const newsletterRef = admin.firestore().doc(`spaces/${spaceId}/newsletters/${newsletterId}`);

    try {
      const votes = await newsletterRef
        .collection('responses')
        .where('sectionId', '==', data.sectionId)
        .limit(MAX_VOTES_COUNTED)
        .get();

      const counts = new Map<string, number>();
      votes.forEach((vote) => {
        const option = vote.get('option');
        if (typeof option === 'string') counts.set(option, (counts.get(option) || 0) + 1);
      });

      await newsletterRef.collection('pollTallies').doc(data.sectionId).set({
        counts: Array.from(counts, ([option, count]) => ({option, count})),
        total: votes.size,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      logger.error('Poll tally update failed', error);
    }
  }
);
