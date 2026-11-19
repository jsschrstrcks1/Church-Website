import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {v2} from "@google-cloud/translate";

const translateClient = new v2.Translate();

// Languages offered by the public newsletter's Translate menu (NewsletterPublicView.jsx LANGUAGES)
const SUPPORTED_LANGUAGES = ["es", "fr", "pt", "zh-CN", "vi", "ar", "ko", "de"];

/**
 * Translate a published newsletter (or one of its archived issues) using the Google Cloud
 * Translation API. Results are cached in newsletterTranslations/{key} and reused until the
 * newsletter is edited again.
 *
 * No sign-in required: it is called from the public newsletter page.
 * Needs the Cloud Translation API turned on for the project.
 */
export const translateNewsletter = onCall(
  {cors: true, maxInstances: 5},
  async (request) => {
    const {memberId, newsletterId, archiveId, targetLang} = request.data || {};
    // Links without a newsletter id open the member's "primary" newsletter
    const resolvedNewsletterId = newsletterId || "primary";

    if (!targetLang || !SUPPORTED_LANGUAGES.includes(targetLang)) {
      throw new HttpsError("invalid-argument", "Unsupported target language");
    }
    if (memberId !== "church") {
      throw new HttpsError("invalid-argument", "Unknown newsletter");
    }

    const db = admin.firestore();

    let newsletterRef: admin.firestore.DocumentReference;
    let cacheKey: string;
    if (archiveId) {
      newsletterRef = db.doc(
        `spaces/${memberId}/newsletters/${resolvedNewsletterId}/archive/${archiveId}`
      );
      cacheKey = `archive_${memberId}_${resolvedNewsletterId}_${archiveId}_${targetLang}`;
    } else {
      newsletterRef = db.doc(`spaces/${memberId}/newsletters/${resolvedNewsletterId}`);
      cacheKey = `member_${memberId}_${resolvedNewsletterId}_${targetLang}`;
    }
    const cacheRef = db.doc(`newsletterTranslations/${cacheKey}`);

    const newsletterDoc = await newsletterRef.get();
    if (!newsletterDoc.exists) {
      throw new HttpsError("not-found", "Newsletter not found");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newsletter = newsletterDoc.data() as any;

    // Drafts are never translated (archived issues were published when they were archived)
    if (!archiveId && !newsletter.published) {
      throw new HttpsError("failed-precondition", "This newsletter is not published");
    }

    // The cached copy is valid while the newsletter hasn't changed since it was translated
    const sourceDate = newsletter.lastModified || newsletter.publishedDate || newsletter.archivedAt || null;

    try {
      const cacheDoc = await cacheRef.get();
      if (cacheDoc.exists) {
        const cached = cacheDoc.data()!;
        if (cached.sourceDate === sourceDate) {
          logger.info(`Cache hit for ${cacheKey}`);
          return {newsletter: cached.newsletter, cached: true};
        }
        logger.info(`Cache stale for ${cacheKey}, re-translating`);
      }
    } catch (err) {
      logger.warn("Cache check failed, proceeding with translation", err);
    }

    // Collect all translatable text into arrays (plain text and HTML)
    const plainTexts: string[] = [];
    const htmlTexts: string[] = [];
    const mapping: {type: "plain" | "html"; index: number; path: string[]}[] = [];

    const addPlain = (text: unknown, path: string[]) => {
      if (typeof text === "string" && text.trim()) {
        mapping.push({type: "plain", index: plainTexts.length, path});
        plainTexts.push(text);
      }
    };
    const addHtml = (html: unknown, path: string[]) => {
      if (typeof html === "string" && html.trim()) {
        mapping.push({type: "html", index: htmlTexts.length, path});
        htmlTexts.push(html);
      }
    };

    addPlain(newsletter.title, ["title"]);
    addPlain(newsletter.subtitle, ["subtitle"]);
    addPlain(newsletter.brandTagline, ["brandTagline"]);
    addPlain(newsletter.footerText, ["footerText"]);

    if (Array.isArray(newsletter.sections)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      newsletter.sections.forEach((section: any, i: number) => {
        const at = (...keys: string[]) => ["sections", `${i}`, ...keys];

        if (section.type === "header") addPlain(section.headerText, at("headerText"));
        if (["text", "quote"].includes(section.type)) addHtml(section.content, at("content"));
        if (["imageText", "textImage"].includes(section.type)) {
          addPlain(section.heading, at("heading"));
          addHtml(section.content, at("content"));
        }
        if (section.type === "twoColumn") {
          addHtml(section.leftContent, at("leftContent"));
          addHtml(section.rightContent, at("rightContent"));
        }
        if (section.type === "event") {
          addPlain(section.eventName, at("eventName"));
          addPlain(section.eventDetails, at("eventDetails"));
        }
        // The poll question only: options stay as written, so every vote counts toward the same answer
        if (section.type === "response") addPlain(section.responsePrompt, at("responsePrompt"));
        if (section.type === "customForm") {
          addPlain(section.formTitle, at("formTitle"));
          addPlain(section.formDescription, at("formDescription"));
          addPlain(section.confirmationMessage, at("confirmationMessage"));
          if (Array.isArray(section.fields)) {
            // Answers are stored by field id, so translating the labels is safe
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            section.fields.forEach((field: any, j: number) => addPlain(field?.label, at("fields", `${j}`, "label")));
          }
        }
        if (Array.isArray(section.gridImages)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          section.gridImages.forEach((img: any, j: number) => addPlain(img?.caption, at("gridImages", `${j}`, "caption")));
        }
        if (Array.isArray(section.carouselImages)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          section.carouselImages.forEach((img: any, j: number) => addPlain(img?.caption, at("carouselImages", `${j}`, "caption")));
        }
      });
    }

    logger.info(`Translating ${plainTexts.length} plain + ${htmlTexts.length} HTML blocks to ${targetLang}`);

    let translatedPlain: string[] = [];
    let translatedHtml: string[] = [];
    try {
      if (plainTexts.length > 0) {
        const [results] = await translateClient.translate(plainTexts, targetLang);
        translatedPlain = Array.isArray(results) ? results : [results];
      }
      if (htmlTexts.length > 0) {
        const [results] = await translateClient.translate(htmlTexts, {to: targetLang, format: "html"});
        translatedHtml = Array.isArray(results) ? results : [results];
      }
    } catch (err) {
      logger.error("Google Translation API error:", err);
      throw new HttpsError("internal", "Translation failed. Make sure the Cloud Translation API is enabled.");
    }

    const tNewsletter = JSON.parse(JSON.stringify(newsletter));
    for (const m of mapping) {
      const translated = m.type === "plain" ? translatedPlain[m.index] : translatedHtml[m.index];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let target: any = tNewsletter;
      const keys = m.path;
      for (let i = 0; i < keys.length - 1 && target !== undefined; i++) {
        target = target[keys[i]];
      }
      if (target && translated !== undefined) {
        target[keys[keys.length - 1]] = translated;
      }
    }

    try {
      await cacheRef.set({
        newsletter: tNewsletter,
        targetLang,
        sourceDate,
        translatedAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      // Still return the translation even if caching fails
      logger.warn("Failed to cache translation:", err);
    }

    return {newsletter: tNewsletter, cached: false};
  }
);
