/**
 * Sends a Live Studio video clip (an intro or outro) to a signed-in member's browser.
 *
 * Clips are uploaded to Storage (liveStudioVideos/...). The stream canvas can only draw video
 * that the browser treats as the site's own, and Storage doesn't send the headers that would
 * allow it. So the studio downloads each clip through this function (which does allow it) into
 * memory, and plays it from there.
 *
 * GET https://us-central1-your-firebase-project-id.cloudfunctions.net/liveStudioVideo?id=<asset id>
 *   Authorization: Bearer <Firebase ID token of an active member>
 */

import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { ALLOWED_ORIGINS } from './siteConfig';

export const liveStudioVideo = onRequest(
  { cors: ALLOWED_ORIGINS, timeoutSeconds: 540, memory: '512MiB' },
  async (req, res) => {
    if (req.method !== 'GET') { res.status(405).send('Method not allowed'); return; }
    try {
      const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
      if (!token) { res.status(401).send('Please sign in.'); return; }
      const { uid } = await admin.auth().verifyIdToken(token);
      const member = (await admin.firestore().collection('members').doc(uid).get()).data();
      if (!member || member.accountStatus === 'removed') { res.status(403).send('Only church members can use the live studio.'); return; }

      const id = String(req.query.id || '');
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) { res.status(400).send('Bad clip id.'); return; }
      const asset = (await admin.firestore().collection('liveStudioAssets').doc(id).get()).data();
      if (!asset || asset.kind !== 'video' || typeof asset.storagePath !== 'string' || !asset.storagePath.startsWith('liveStudioVideos/')) {
        res.status(404).send('Clip not found.');
        return;
      }

      const file = admin.storage().bucket().file(asset.storagePath);
      const [meta] = await file.getMetadata();
      res.setHeader('Content-Type', String(meta.contentType || 'video/mp4'));
      if (meta.size) res.setHeader('Content-Length', String(meta.size));
      res.setHeader('Cache-Control', 'private, max-age=3600');
      file.createReadStream()
        .on('error', (error) => {
          console.error('Clip read failed:', error);
          if (!res.headersSent) res.status(500).send('Could not read the clip.');
          else res.destroy();
        })
        .pipe(res);
    } catch (error) {
      console.error('Clip request failed:', error);
      if (!res.headersSent) res.status(401).send('Please sign in again.');
    }
  }
);
