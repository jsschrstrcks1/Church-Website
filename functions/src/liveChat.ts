/**
 * Live chat for Live Studio: YouTube live chat and Facebook live video comments, together.
 *
 * While live, the streaming computer calls 'chatPoll' every few seconds (only that computer, to
 * keep within YouTube's free daily allowance). New messages are saved to liveChat/{id}, which
 * every open studio (including co-hosts) shows. 'chatSend' replies as the church channel/Page.
 *
 * Needs the YouTube and/or Facebook automatic setup. Facebook comments also need the Meta
 * configuration to include pages_read_user_content (read) and pages_manage_engagement (reply).
 *
 * liveChat/{yt_<id> | fb_<id>}  { platform, author, text, at, mine }  (members read; written here)
 * State kept in liveStream/state: youtubeChatId, youtubeChatPageToken, facebookChatSince
 */

import * as admin from 'firebase-admin';
import { youtubeCall } from './youtube';
import { facebookCall } from './facebook';

const db = () => admin.firestore();
const chat = () => db().collection('liveChat');
const stateRef = () => db().collection('liveStream').doc('state');

// Remove the previous service's chat when a new stream starts
export const clearChat = async () => {
  const old = await chat().limit(500).get();
  if (old.empty) return;
  const batch = db().batch();
  old.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
};

const save = async (messages: { id: string; platform: string; author: string; text: string; at: string; mine?: boolean }[]) => {
  if (messages.length === 0) return;
  const batch = db().batch();
  messages.forEach((m) => batch.set(chat().doc(m.id), {
    platform: m.platform,
    author: m.author.slice(0, 100),
    text: m.text.slice(0, 1000),
    at: m.at,
    mine: !!m.mine
  }, { merge: true }));
  await batch.commit();
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

// Fetch what's new since the last check; returns when to check next and any per-site problem
export const pollChat = async () => {
  const state = (await stateRef().get()).data();
  if (!state || state.status !== 'live') return { nextPollMs: 15000, errors: {} };
  const errors: Record<string, string> = {};
  const updates: Record<string, unknown> = {};
  let nextPollMs = 8000;

  if (state.youtubeChatId) {
    try {
      const params = new URLSearchParams({ liveChatId: state.youtubeChatId, part: 'id,snippet,authorDetails', maxResults: '200' });
      if (state.youtubeChatPageToken) params.set('pageToken', state.youtubeChatPageToken);
      const res = await youtubeCall('GET', `/liveChat/messages?${params}`);
      await save((res.items || [])
        .filter((m: any) => m.snippet?.type === 'textMessageEvent' || m.snippet?.displayMessage)
        .map((m: any) => ({
          id: `yt_${m.id}`,
          platform: 'youtube',
          author: m.authorDetails?.displayName || 'YouTube viewer',
          text: m.snippet?.displayMessage || m.snippet?.textMessageDetails?.messageText || '',
          at: m.snippet?.publishedAt || new Date().toISOString(),
          mine: !!m.authorDetails?.isChatOwner
        })));
      if (res.nextPageToken) updates.youtubeChatPageToken = res.nextPageToken;
      // YouTube says how long to wait; never faster than 8 s to save the daily allowance
      nextPollMs = Math.max(nextPollMs, Math.min(Number(res.pollingIntervalMillis) || 8000, 30000));
    } catch (error) {
      errors.youtube = errorMessage(error);
    }
  }

  if (state.facebookLiveVideoId) {
    try {
      const params: Record<string, string> = {
        fields: 'id,message,from{name},created_time',
        order: 'chronological',
        filter: 'stream',
        limit: '100'
      };
      if (state.facebookChatSince) params.since = String(state.facebookChatSince);
      const res = await facebookCall('GET', `/${encodeURIComponent(state.facebookLiveVideoId)}/comments`, params);
      const items = res.data || [];
      await save(items.filter((c: any) => c.message).map((c: any) => ({
        id: `fb_${c.id}`,
        platform: 'facebook',
        author: c.from?.name || 'Facebook viewer',
        text: c.message,
        at: c.created_time ? new Date(c.created_time).toISOString() : new Date().toISOString()
      })));
      const newest = items.reduce((max: number, c: any) => Math.max(max, Math.floor(Date.parse(c.created_time || 0) / 1000)), 0);
      if (newest) updates.facebookChatSince = newest; // seconds; the same comment may come again, but its id dedupes it
    } catch (error) {
      errors.facebook = errorMessage(error);
    }
  }

  if (Object.keys(updates).length) await stateRef().update(updates);
  return { nextPollMs, errors };
};

// Reply as the church on the chosen sites
export const sendChat = async (text: string, platforms: string[], authorName: string) => {
  const state = (await stateRef().get()).data();
  if (!state || state.status !== 'live') throw new Error('Chat is only available while live.');
  const message = text.trim().slice(0, 200);
  if (!message) throw new Error('Type a message first.');
  const errors: Record<string, string> = {};
  const now = new Date().toISOString();

  if (platforms.includes('youtube') && state.youtubeChatId) {
    try {
      const res = await youtubeCall('POST', '/liveChat/messages?part=snippet', {
        snippet: { liveChatId: state.youtubeChatId, type: 'textMessageEvent', textMessageDetails: { messageText: message } }
      });
      await save([{ id: `yt_${res.id}`, platform: 'youtube', author: authorName || 'Church', text: message, at: now, mine: true }]);
    } catch (error) {
      errors.youtube = errorMessage(error);
    }
  }
  if (platforms.includes('facebook') && state.facebookLiveVideoId) {
    try {
      // Comments go on the live broadcast's video (Facebook doesn't accept them on the broadcast itself)
      let videoId = state.facebookVideoId as string | undefined;
      if (!videoId) {
        const live = await facebookCall('GET', `/${encodeURIComponent(state.facebookLiveVideoId)}`, { fields: 'video' });
        videoId = live.video?.id;
        if (videoId) await stateRef().update({ facebookVideoId: videoId });
      }
      if (!videoId) throw new Error('Facebook has not created the video for this broadcast yet. Try again in a moment.');
      const res = await facebookCall('POST', `/${encodeURIComponent(videoId)}/comments`, { message });
      await save([{ id: `fb_${res.id}`, platform: 'facebook', author: authorName || 'Church', text: message, at: now, mine: true }]);
    } catch (error) {
      errors.facebook = errorMessage(error);
    }
  }
  return { errors };
};
