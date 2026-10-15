import ui from "./en/ui.js";
import blocks from "./en/blocks.js";
import { LANGUAGES, SOURCE } from "./languages.js";
import { loadLocal, saveLocal } from "../storage/local.js";
import { isDev } from "../ui/dom.js";

// The player's language (PLAN.md §8, Languages): choosing it, fetching its
// catalogues, and wording messages in it. English is bundled. Another language
// is fetched when it's chosen, and Blockly's catalogue for it when an editor is
// first shown in it. Whatever a language doesn't have is said in English, never
// shown as a key.

export const ENGLISH = { ui, blocks };

// Development only: English with every letter marked, to find text that isn't
// from a catalogue (./pseudo.js). Not a listed language; ?dev offers it.
export const PSEUDO = { code: "pseudo", name: "Pseudo", locale: "en-XA" };

// Fired on window when the player changes language; main.js opens the page again.
export const LANGUAGE_EVENT = "island:language";

let current = { code: SOURCE, locale: SOURCE, messages: ENGLISH };

// The languages on offer: the listed ones, and with ?dev the pseudo-language.
export const languages = () => (typeof location !== "undefined" && isDev() ? [...LANGUAGES, PSEUDO] : LANGUAGES);

// The current language's code, and its tag for Intl and <html lang>.
export const language = () => current.code;
export const locale = () => current.locale;

const intl = new Map();
function cached(Kind, tag, options) {
  const key = `${Kind.name} ${tag} ${JSON.stringify(options ?? {})}`;
  if (!intl.has(key)) intl.set(key, new Kind(tag, options));
  return intl.get(key);
}

// Message `key` of interface catalogue `ui`, worded for language `tag`. {name}
// placeholders are filled from `params`, numbers written the language's way
// (Intl.NumberFormat: 1,234.5 in English, 1.234,5 in German). A message with
// plural forms ({ one, other, … }) takes the form Intl.PluralRules picks for
// params.count. A key no catalogue has shows as itself, which npm test catches
// before anyone sees it.
export function translate(ui, tag, key, params = {}) {
  let message = ui[key];
  if (message == null) return key;
  if (typeof message !== "string") message = message[cached(Intl.PluralRules, tag).select(Number(params.count ?? 0))] ?? message.other;
  return message.replace(/\{(\w+)\}/g, (all, name) => {
    if (!(name in params)) return all;
    const value = params[name];
    return typeof value === "number" ? cached(Intl.NumberFormat, tag).format(value) : String(value);
  });
}

// The interface's words for `key` in the current language.
export const t = (key, params) => translate(current.messages.ui, current.locale, key, params);

// Whether the interface has a message `key`.
export const hasMessage = (key) => key in current.messages.ui;

// Number `n` written the current language's way: formatNumber(0.6, { style: "percent" }).
export const formatNumber = (n, options) => cached(Intl.NumberFormat, current.locale, options).format(n);

// Phrases as a short list the current language's way: "2 wood, 1 plank".
export const formatList = (parts) => cached(Intl.ListFormat, current.locale, { style: "short", type: "unit" }).format(parts);

// A message to word later, in whatever language is current then. Names the game
// gives things are kept this way, never as words (PLAN.md §8): ref("entity.robo",
// { n: 1 }) is "Robo 1" in every language until the player renames the robot.
export const ref = (key, params) => (params ? { key, params } : { key });

// A name to show: the player's own words as typed, or a ref's message.
export const display = (name) => (typeof name === "string" ? name : t(name.key, name.params));

// --- Choosing --------------------------------------------------------------

// The language to start in: one asked for in the address (with ?dev), else the
// one the player chose on this device, else the first of the browser's that's on
// offer (de-AT gives de), else English.
export function chooseLanguage({ asked = null, stored = null, browser = [], available = LANGUAGES }) {
  const find = (tag) => (typeof tag === "string" ? available.find((l) => l.code.toLowerCase() === tag.toLowerCase())?.code : undefined);
  for (const tag of [asked, stored]) if (find(tag)) return find(tag);
  for (const tag of browser) {
    const found = find(tag) ?? find(String(tag).split("-")[0]);
    if (found) return found;
  }
  return SOURCE;
}

// The languages whose messages make up language `code`'s, most particular first:
// a variant, its base, English.
export function chainOf(code, list = LANGUAGES) {
  const chain = [];
  for (let c = code; c && !chain.includes(c); c = list.find((l) => l.code === c)?.base) chain.push(c);
  if (!chain.includes(SOURCE)) chain.push(SOURCE);
  return chain;
}

// One catalogue ({ ui, blocks }) from several, the first having the last word.
export const mergeCatalogues = (catalogues) =>
  Object.fromEntries(Object.keys(ENGLISH).map((part) => [part, Object.assign({}, ...catalogues.map((c) => c[part] ?? {}).reverse())]));

// --- Fetching --------------------------------------------------------------

// A listed language's own catalogue files, or English's for English. Every
// language folder has every file; a variant's hold only what it changes.
async function own(code) {
  if (code === SOURCE) return ENGLISH;
  const [ui, blocks] = await Promise.all([import(`./${code}/ui.js`), import(`./${code}/blocks.js`)]);
  return { ui: ui.default, blocks: blocks.default };
}

// Everything the game says in language `code`, English filling any gaps.
export async function loadMessages(code) {
  if (code === PSEUDO.code) {
    const { pseudoCatalogue } = await import("./pseudo.js");
    return pseudoCatalogue(ENGLISH);
  }
  return mergeCatalogues(await Promise.all(chainOf(code).map(own)));
}

// Blockly's words in language `code`, for Blockly.setLocale: its catalogue for
// the language, the language's overrides of it (blockly.js), and the game's block
// messages `blocks`.
export async function loadBlocklyMessages(code, blocks) {
  if (code === PSEUDO.code) {
    const [{ pseudoBlockly }, english] = await Promise.all([import("./pseudo.js"), import("./en/blockly.js")]);
    return { ...pseudoBlockly({ ...(await english.load()), ...english.overrides }), ...blocks };
  }
  const files = await Promise.all(chainOf(code).map((c) => import(`./${c}/blockly.js`)));
  const catalogue = await files.find((f) => f.load).load();
  return { ...catalogue, ...Object.assign({}, ...files.map((f) => f.overrides ?? {}).reverse()), ...blocks };
}

const blockly = new Map(); // code → promise of its Blockly messages

// The current language and its Blockly messages, fetched once per language.
export async function blocklyMessages() {
  const { code, messages } = current;
  if (!blockly.has(code)) {
    const loading = loadBlocklyMessages(code, messages.blocks);
    blockly.set(code, loading);
    loading.catch(() => blockly.delete(code)); // offline: try again next time
  }
  return { code, messages: await blockly.get(code) };
}

// --- Switching -------------------------------------------------------------

let latest = 0;

// Makes `code` the current language once its catalogues are here, unless another
// was asked for meanwhile. Returns whether it did.
async function use(code) {
  const ticket = ++latest;
  const messages = await loadMessages(code);
  if (ticket !== latest) return false;
  current = { code, locale: languages().find((l) => l.code === code)?.locale ?? code, messages };
  if (typeof document !== "undefined") document.documentElement.lang = current.locale;
  return true;
}

// Picks the language at start-up (chooseLanguage). A language that can't be
// fetched, offline, leaves the game in English.
export async function startLanguage() {
  const code = chooseLanguage({
    asked: isDev() ? new URLSearchParams(location.search).get("lang") : null,
    stored: loadLocal("language"),
    browser: navigator.languages?.length ? navigator.languages : [navigator.language],
    available: languages(),
  });
  try {
    await use(code);
  } catch (e) {
    console.warn(`Language ${code} couldn't be fetched; staying in English.`, e);
    await use(SOURCE);
  }
}

// The player chose language `code`: remember it on this device and switch at
// once. Returns whether the language changed; one that can't be fetched leaves
// everything as it was.
export async function setLanguage(code) {
  if (!languages().some((l) => l.code === code)) return false;
  saveLocal("language", code);
  if (code === current.code) return false;
  try {
    if (!(await use(code))) return false;
  } catch (e) {
    console.warn(`Language ${code} couldn't be fetched.`, e);
    return false;
  }
  window.dispatchEvent(new CustomEvent(LANGUAGE_EVENT, { detail: { code } }));
  return true;
}
