// The church's shared space. Newsletters and the share page belong to the church, not to one
// person: every member (admin) can edit all of them.
//   spaces/church/newsletters/{id}               newsletters (+ archive, revisions, responses, pollTallies)
//   spaces/church/settings/sharePageCustomization  the share page's look (public)
//   spaces/church/settings/{other}               shared editor settings (card library, brand presets, ...)
// Public links: /share and /newsletter/church[/{newsletterId}]
export const CHURCH_SPACE = 'church';
// The church's name is set in config.js (one place to edit); re-exported here for existing imports
export { CHURCH_NAME } from './config';
