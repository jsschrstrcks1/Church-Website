/**
 * Live streaming (the Live Studio page at /admin/live).
 *
 * The video itself never passes through Firebase or any paid service. The streaming computer
 * runs the free Church Stream Helper (public/stream-helper), which takes the studio's picture and
 * sends it to every channel with ffmpeg. This function only:
 *   - 'start':     hands the studio the RTMP addresses (server + stream key) of the chosen
 *                  channels, and records that the church is live
 *   - 'heartbeat': the streaming computer says "still live" every 30 seconds
 *   - 'stop':      records that the stream ended (the streaming computer then stops)
 *   - 'status':    what's on air; a stream with no heartbeat for 90 seconds counts as ended
 *
 * Data:
 *   liveStreamDestinations/{id}  name, platform, serverUrl, keyHint  (members read and write)
 *   liveStreamKeys/{id}          { key }: members can write a stream key but never read it back
 *                                directly; it reaches only the computer that goes live
 *   liveStream/state             what is on air right now; written only here
 *   publicLive/status            the public "we're live" flag the home page reads (live, youtube,
 *                                startedAt, heartbeatAt); nothing private; written only here
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { ALLOWED_ORIGINS, CHURCH_NAME, TIME_ZONE } from './siteConfig';
import {
  YoutubeError, endYoutubeBroadcast, startYoutubeBroadcast, youtubeAuthUrl, youtubeConfigured, youtubeConnected, youtubeDisconnect
} from './youtube';
import {
  FacebookError, endFacebookLive, facebookAuthUrl, facebookChoosePage, facebookConfigured, facebookConnected, facebookDisconnect, facebookScopes, startFacebookLive
} from './facebook';
import { clearChat, pollChat, sendChat } from './liveChat';

const MAX_DESTINATIONS = 6;
const STALE_MS = 90 * 1000;

// The destination's server address plus its stream key, e.g. rtmp://a.rtmp.youtube.com/live2/abcd-1234
const rtmpUrl = (serverUrl: string, key: string) => `${serverUrl.replace(/\/+$/, '')}/${key.trim()}`;

const isFresh = (state: FirebaseFirestore.DocumentData | undefined) =>
  !!state && state.status === 'live' && Date.now() - Date.parse(state.heartbeatAt || state.startedAt || 0) < STALE_MS;

type Action = 'start' | 'heartbeat' | 'stop' | 'status' | 'youtubeConnect' | 'youtubeDisconnect' | 'youtubeInfo'
  | 'facebookConnect' | 'facebookDisconnect' | 'facebookChoosePage' | 'chatPoll' | 'chatSend';

const defaultTitle = () => {
  const day = new Date().toLocaleDateString('en-US', { timeZone: TIME_ZONE, weekday: 'long', month: 'long', day: 'numeric' });
  return `${CHURCH_NAME} · ${day}`;
};

const facebookFailure = (error: unknown) => {
  console.error('Facebook:', error);
  return new HttpsError('failed-precondition', error instanceof FacebookError ? error.message : 'Facebook could not set up the live video. Try again.');
};

const youtubeFailure = (error: unknown) => {
  console.error('YouTube:', error);
  return new HttpsError('failed-precondition', error instanceof YoutubeError ? error.message : 'YouTube could not set up the broadcast. Try again.');
};

// The home page's "Watch live" section reads this (anyone can). It treats a heartbeat older than
// a few minutes as not live, in case the streaming computer vanished without ending the stream.
const setPublicLive = (db: FirebaseFirestore.Firestore, data: Record<string, unknown>) =>
  db.collection('publicLive').doc('status').set(data);

export const liveStream = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Please sign in.');
  }
  const db = admin.firestore();
  const caller = (await db.collection('members').doc(request.auth.uid).get()).data();
  if (!caller || caller.accountStatus === 'removed') {
    throw new HttpsError('permission-denied', 'Only church members can use the live studio.');
  }

  const data = (request.data || {}) as {
    action?: Action; destinationIds?: unknown; force?: unknown; title?: unknown; privacy?: unknown; description?: unknown; pageId?: unknown;
    text?: unknown; platforms?: unknown;
  };
  const stateRef = db.collection('liveStream').doc('state');
  const now = new Date().toISOString();

  switch (data.action) {
    case 'start': {
      const ids = Array.isArray(data.destinationIds)
        ? [...new Set(data.destinationIds.filter((id): id is string => typeof id === 'string' && id.length > 0))]
        : [];
      if (ids.length === 0) {
        throw new HttpsError('invalid-argument', 'Choose at least one channel to stream to.');
      }
      if (ids.length > MAX_DESTINATIONS) {
        throw new HttpsError('invalid-argument', `You can stream to at most ${MAX_DESTINATIONS} channels at once.`);
      }
      const current = (await stateRef.get()).data();
      if (isFresh(current) && current?.startedBy !== request.auth.uid && data.force !== true) {
        throw new HttpsError('failed-precondition', `The church is already live (started by ${current?.startedByName || 'another admin'}). End that stream first.`);
      }

      const destinations = [];
      const urls = [];
      // With YouTube connected, GO LIVE creates the YouTube broadcast and uses its stream address
      const ytAuto = await youtubeConnected();
      let youtube: Awaited<ReturnType<typeof startYoutubeBroadcast>> = null;
      // Same for Facebook: GO LIVE creates the Page's live video
      const fbAuto = await facebookConnected();
      let facebook: Awaited<ReturnType<typeof startFacebookLive>> = null;
      const title = typeof data.title === 'string' && data.title.trim() ? data.title.trim() : defaultTitle();
      const description = typeof data.description === 'string' ? data.description : '';
      const privacy = typeof data.privacy === 'string' ? data.privacy : 'public';
      // If a later channel fails, undo the broadcasts already created
      const undo = async () => {
        if (youtube) await endYoutubeBroadcast(youtube.broadcastId);
        if (facebook) await endFacebookLive(facebook.liveVideoId);
      };
      for (const id of ids) {
        const [destSnap, keySnap] = await Promise.all([
          db.collection('liveStreamDestinations').doc(id).get(),
          db.collection('liveStreamKeys').doc(id).get()
        ]);
        const dest = destSnap.data();
        if (ytAuto && dest?.platform === 'youtube') {
          if (youtube) continue; // one broadcast per stream, even if YouTube is listed twice
          try {
            youtube = await startYoutubeBroadcast(title, privacy, description);
          } catch (error) {
            await undo();
            throw youtubeFailure(error);
          }
          if (youtube) {
            destinations.push({ id, name: dest.name || 'YouTube', platform: 'youtube' });
            urls.push(youtube.ingestUrl);
            continue;
          }
        }
        if (fbAuto && dest?.platform === 'facebook') {
          if (facebook) continue;
          try {
            // "Unlisted (tests)" makes the Facebook video an unpublished preview (only Page admins see it)
            facebook = await startFacebookLive(title, description, privacy === 'public');
          } catch (error) {
            await undo();
            throw facebookFailure(error);
          }
          if (facebook) {
            destinations.push({ id, name: dest.name || 'Facebook', platform: 'facebook' });
            urls.push(facebook.ingestUrl);
            continue;
          }
        }
        const key = keySnap.data()?.key;
        if (!dest || typeof dest.serverUrl !== 'string' || typeof key !== 'string' || !key.trim()) {
          await undo();
          throw new HttpsError('failed-precondition', `"${dest?.name || 'A channel'}" is missing its server address or stream key.`);
        }
        if (!/^rtmps?:\/\//i.test(dest.serverUrl)) {
          await undo();
          throw new HttpsError('failed-precondition', `"${dest.name}" needs a server address starting with rtmp:// or rtmps://.`);
        }
        destinations.push({ id, name: dest.name || 'Channel', platform: dest.platform || 'custom' });
        urls.push(rtmpUrl(dest.serverUrl, key));
      }

      const state = {
        status: 'live',
        destinations,
        startedBy: request.auth.uid,
        startedByName: caller.name || '',
        startedAt: now,
        heartbeatAt: now,
        ...(youtube ? { youtubeBroadcastId: youtube.broadcastId, youtubeWatchUrl: youtube.watchUrl, youtubeChatId: youtube.liveChatId } : {}),
        ...(facebook ? { facebookLiveVideoId: facebook.liveVideoId, facebookVideoId: facebook.videoId, facebookWatchUrl: facebook.watchUrl } : {})
      };
      await stateRef.set(state);
      await clearChat().catch((error) => console.error('Clearing old chat:', error));
      await setPublicLive(db, {
        live: true,
        youtube: destinations.some((d) => d.platform === 'youtube'),
        facebook: destinations.some((d) => d.platform === 'facebook'),
        ...(youtube ? { youtubeVideoId: youtube.broadcastId } : {}),
        startedAt: now,
        heartbeatAt: now
      });
      // The addresses go only to this caller (the streaming computer); they aren't stored in state
      return { ...state, urls };
    }

    // ----- Live chat (see liveChat.ts) -----
    case 'chatPoll':
      return pollChat();

    case 'chatSend': {
      const platforms = Array.isArray(data.platforms) ? data.platforms.filter((p): p is string => typeof p === 'string') : [];
      try {
        return await sendChat(typeof data.text === 'string' ? data.text : '', platforms, caller.name || 'Church');
      } catch (error) {
        throw new HttpsError('failed-precondition', error instanceof Error ? error.message : 'Could not send.');
      }
    }

    case 'heartbeat': {
      const current = (await stateRef.get()).data();
      if (current?.status !== 'live') return { status: 'idle' };
      await stateRef.update({ heartbeatAt: now });
      await db.collection('publicLive').doc('status').set({ heartbeatAt: now }, { merge: true });
      return { ...current, heartbeatAt: now };
    }

    case 'stop': {
      const current = (await stateRef.get()).data();
      if (current?.youtubeBroadcastId) await endYoutubeBroadcast(current.youtubeBroadcastId);
      if (current?.facebookLiveVideoId) await endFacebookLive(current.facebookLiveVideoId);
      const state = { status: 'idle', endedAt: now, endedBy: request.auth.uid, endedByName: caller.name || '' };
      await stateRef.set(state);
      await setPublicLive(db, { live: false, endedAt: now });
      return state;
    }

    case 'status': {
      const current = (await stateRef.get()).data();
      if (current?.status === 'live' && !isFresh(current)) {
        // The streaming computer stopped checking in (closed, asleep, or offline)
        if (current.youtubeBroadcastId) await endYoutubeBroadcast(current.youtubeBroadcastId);
        if (current.facebookLiveVideoId) await endFacebookLive(current.facebookLiveVideoId);
        const idle = { status: 'idle', endedAt: now };
        await stateRef.set(idle);
        await setPublicLive(db, { live: false, endedAt: now });
        return idle;
      }
      return current || { status: 'idle' };
    }

    // ----- YouTube automatic setup (see youtube.ts) -----
    case 'youtubeInfo':
      return {
        configured: youtubeConfigured(),
        connected: await youtubeConnected(),
        facebookConfigured: facebookConfigured(),
        facebookConnected: await facebookConnected(),
        facebookScopes: await facebookScopes(),
        defaultTitle: defaultTitle()
      };

    case 'youtubeConnect':
      try {
        return { url: await youtubeAuthUrl(request.auth.uid) };
      } catch (error) {
        throw youtubeFailure(error);
      }

    case 'youtubeDisconnect':
      await youtubeDisconnect();
      return { connected: false };

    // ----- Facebook automatic setup (see facebook.ts) -----
    case 'facebookConnect':
      try {
        return { url: await facebookAuthUrl(request.auth.uid) };
      } catch (error) {
        throw facebookFailure(error);
      }

    case 'facebookChoosePage':
      try {
        if (typeof data.pageId !== 'string') throw new FacebookError('Choose a Page.');
        await facebookChoosePage(data.pageId);
        return { connected: true };
      } catch (error) {
        throw facebookFailure(error);
      }

    case 'facebookDisconnect':
      await facebookDisconnect();
      return { connected: false };

    default:
      throw new HttpsError('invalid-argument', 'Unknown action.');
  }
});
