import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ENGLISH, chainOf, chooseLanguage, loadBlocklyMessages, loadMessages, mergeCatalogues, translate } from "../src/i18n/index.js";
import { LANGUAGES, SOURCE } from "../src/i18n/languages.js";
import { NOT_WORDS, UNUSED_BLOCKLY, mayStayEnglish } from "../src/i18n/blockly-unused.js";
import { pseudo, pseudoBlockly, pseudoCatalogue } from "../src/i18n/pseudo.js";
import { BLOCKS } from "../src/blockly/blocks.js";
import { LAB_TOOLBOX, toolboxFor } from "../src/blockly/toolboxes.js";
import { TYPES } from "../src/sim/entities.js";

// The language checks of PLAN.md §12: every listed language has exactly
// English's messages, with the same placeholders and the plural forms its rules
// need, and every Blockly message the game shows is translated or allowed to stay
// in English. A failure names what's missing.

const SRC = new URL("../src/", import.meta.url);
const BLOCKLY = new URL("../node_modules/blockly/", import.meta.url);
const sources = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : path.endsWith(".js") ? [path] : [];
  });

const others = LANGUAGES.filter((l) => l.code !== SOURCE);
const own = async (code, part) => (await import(`../src/i18n/${code}/${part}.js`)).default;
const forms = (message) => (typeof message === "string" ? [message] : Object.values(message));
const names = (message) => [...new Set(forms(message).flatMap((text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1])))].sort();
const inputs = (text) => [...text.matchAll(/%(\d+)/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
const blocklyEnglish = { ...(await import("blockly/msg/en")) };
// Every toolbox the game offers: the lab's, and the editor's for each robot and
// building type.
const TOOLBOXES = [LAB_TOOLBOX, ...Object.keys(TYPES).filter((type) => TYPES[type].kind !== "node").map((type) => toolboxFor([type]))];

test("messages fill placeholders, choose plural forms and write numbers the language's way", async () => {
  const en = ENGLISH.ui;
  assert.equal(translate(en, "en", "lab.selected", { name: "Robo 1" }), "Selected: Robo 1");
  assert.equal(translate(en, "en", "lab.roundTripOk", { count: 1, bytes: 1234 }), "Saved and reloaded 1 block (1,234 bytes); nothing changed.");
  assert.equal(translate(en, "en", "lab.roundTripOk", { count: 15, bytes: 1234 }), "Saved and reloaded 15 blocks (1,234 bytes); nothing changed.");
  const de = (await loadMessages("de")).ui;
  assert.equal(translate(de, "de", "lab.roundTripOk", { count: 1, bytes: 1234 }), "1 Baustein (1.234 Bytes) gespeichert und neu geladen; nichts hat sich geändert.");
  assert.equal(translate(de, "de", "lab.roundTripOk", { count: 15, bytes: 1234 }), "15 Bausteine (1.234 Bytes) gespeichert und neu geladen; nichts hat sich geändert.");
  assert.equal(translate(de, "de", "entity.rock", { n: 0.5 }), "Felsen 0,5");
  assert.equal(translate(de, "de", "lab.selected", { other: 1 }), "Ausgewählt: {name}", "a placeholder without a value stays visible");
});

test("a message a language doesn't have is said in English; only an unknown key shows as itself", () => {
  const partial = mergeCatalogues([{ ui: { "nav.home": "Startseite" } }, ENGLISH]);
  assert.equal(translate(partial.ui, "de", "nav.home"), "Startseite");
  assert.equal(translate(partial.ui, "de", "lab.title"), "Editor lab");
  assert.equal(translate(partial.ui, "de", "no.such.key"), "no.such.key");
  assert.deepEqual(partial.blocks, ENGLISH.blocks);
});

test("the language is the one asked for, else the stored one, else the browser's first on offer, else English", () => {
  assert.equal(chooseLanguage({ stored: "de", browser: ["en-US"] }), "de");
  assert.equal(chooseLanguage({ browser: ["fr-FR", "de-AT", "en"] }), "de");
  assert.equal(chooseLanguage({ browser: ["DE"] }), "de");
  assert.equal(chooseLanguage({ browser: ["fr-FR", "it"] }), "en");
  assert.equal(chooseLanguage({ stored: "klingon", browser: [] }), "en");
  assert.equal(chooseLanguage({}), "en");
  const dev = [...LANGUAGES, { code: "pseudo" }];
  assert.equal(chooseLanguage({ asked: "pseudo", stored: "de", available: dev }), "pseudo");
  assert.equal(chooseLanguage({ asked: "pseudo", stored: "de" }), "de", "only offered with ?dev");
});

test("a regional variant has its own words, then its base language's, then English", () => {
  const list = [...LANGUAGES, { code: "de-CH", name: "Deutsch (Schweiz)", base: "de" }];
  assert.equal(chooseLanguage({ browser: ["de-CH"], available: list }), "de-CH");
  assert.equal(chooseLanguage({ browser: ["de-AT"], available: list }), "de");
  assert.deepEqual(chainOf("de-CH", list), ["de-CH", "de", "en"]);
  assert.deepEqual(chainOf("de"), ["de", "en"]);
  assert.deepEqual(chainOf("en"), ["en"]);
  const swiss = mergeCatalogues([{ ui: { street: "Strasse" } }, { ui: { street: "Straße", day: "Tag" } }, { ui: { street: "street", day: "day", night: "night" } }]);
  assert.deepEqual(swiss.ui, { street: "Strasse", day: "Tag", night: "night" });
});

for (const { code, base } of others) {
  test(`${code} has every English message and no others, with the same placeholders`, async () => {
    for (const part of Object.keys(ENGLISH)) {
      const english = ENGLISH[part];
      const theirs = await own(code, part);
      const missing = base ? [] : Object.keys(english).filter((key) => !(key in theirs));
      const extra = Object.keys(theirs).filter((key) => !(key in english));
      assert.deepEqual({ missing, extra }, { missing: [], extra: [] }, `${code}/${part}.js`);
      for (const [key, message] of Object.entries(theirs)) {
        assert.deepEqual(names(message), names(english[key]), `${code} ${key}: {placeholders}`);
        if (part === "blocks") assert.deepEqual(inputs(message), inputs(english[key]), `${code} ${key}: %inputs`);
      }
    }
  });
}

for (const { code } of LANGUAGES) {
  test(`${code}'s plural messages have the forms Intl.PluralRules gives ${code}`, async () => {
    const needed = new Intl.PluralRules(code).resolvedOptions().pluralCategories.sort();
    for (const part of ["ui", "missions"]) {
      const messages = code === SOURCE ? ENGLISH[part] : await own(code, part);
      for (const [key, message] of Object.entries(messages)) {
        if (typeof ENGLISH[part][key] === "string" && typeof message === "string") continue;
        assert.equal(typeof message, "object", `${code} ${key} needs plural forms`);
        assert.deepEqual(Object.keys(message).sort(), needed, `${code} ${key}`);
      }
    }
  });
}

test("every interface message the code uses is in the English catalogue", () => {
  const used = new Set();
  for (const file of sources(fileURLToPath(SRC))) {
    for (const m of readFileSync(file, "utf8").matchAll(/\b(?:t|ref)\("([\w.]+)"/g)) used.add(m[1]);
  }
  assert.ok(used.size > 30);
  assert.deepEqual([...used].filter((key) => !(key in ENGLISH.ui)), []);
});

test("every block message the blocks and toolbox refer to is in the English catalogue", () => {
  const refs = [...JSON.stringify([BLOCKS, TOOLBOXES]).matchAll(/%\{BKY_(\w+)\}/g)].map((m) => m[1]);
  assert.ok(refs.length > 20);
  assert.deepEqual(refs.filter((key) => !(key in ENGLISH.blocks)), []);
});

test("each block's message has one placeholder per input or field, in every language", async () => {
  for (const { code } of LANGUAGES) {
    const { blocks } = await loadMessages(code);
    for (const def of BLOCKS) {
      // A value block that's only its dropdown has no words of its own.
      if (/^%1$/.test(def.message0) && def.args0.length === 1) continue;
      const key = def.message0.match(/^%\{BKY_(\w+)\}$/)?.[1];
      assert.ok(key, `${def.type}'s first line is a message reference`);
      assert.deepEqual(inputs(blocks[key]), def.args0.map((_, i) => i + 1), `${code} ${key}`);
    }
  }
});

test("block dropdowns store the same ids in every language; only their labels are words", () => {
  for (const def of BLOCKS) {
    for (const arg of def.args0.filter((a) => a.type === "field_dropdown" || a.type === "field_choice")) {
      for (const [label, value] of arg.options) {
        assert.match(label, /^%\{BKY_\w+\}$/, `${def.type} ${arg.name}`);
        assert.match(value, /^[a-z]+$/, `${def.type} ${arg.name}`);
      }
    }
  }
});

// --- Blockly's own messages ------------------------------------------------

for (const { code } of others) {
  test(`${code}: every Blockly message the game shows is translated, or allowed to stay in English`, async () => {
    const files = await Promise.all(chainOf(code).map((c) => import(`../src/i18n/${c}/blockly.js`)));
    const catalogue = { ...(await files.find((f) => f.load).load()) };
    const overrides = Object.assign({}, ...files.map((f) => f.overrides ?? {}));
    const stillEnglish = Object.keys(blocklyEnglish).filter((key) => catalogue[key] === blocklyEnglish[key] && !(key in overrides) && !mayStayEnglish(key));
    assert.deepEqual(stillEnglish, [], `Blockly messages to translate in src/i18n/${code}/blockly.js`);
    for (const [key, text] of Object.entries(overrides)) {
      assert.ok(key in blocklyEnglish, `${code}/blockly.js: Blockly has no message ${key}`);
      assert.deepEqual(inputs(text), inputs(blocklyEnglish[key]), `${code} ${key}: %inputs`);
    }
  });
}

test("Blockly's messages for each language take its overrides and the game's block messages", async () => {
  const de = await loadBlocklyMessages("de", { ROBOT_GO_TO: "%1 gehe zu %2" });
  assert.equal(de.CONTROLS_REPEAT_TITLE, "wiederhole %1-mal:", "Blockly's own German");
  assert.equal(de.ZOOM_IN, "Vergrößern", "an override");
  assert.equal(de.ROBOT_GO_TO, "%1 gehe zu %2", "the game's block");
  const en = await loadBlocklyMessages("en", {});
  assert.equal(en.ZOOM_IN, "Zoom in");
});

// The allowlist's claims, checked against the installed Blockly's code. Blockly
// reads a message as Msg.KEY, through "KEY", or as a %{BKY_KEY} reference.
const core = readFileSync(new URL("blockly_compressed.js", BLOCKLY), "utf8");
const blocklyBlocks = readFileSync(new URL("blocks_compressed.js", BLOCKLY), "utf8");
const reads = (code, key) => new RegExp(String.raw`(?:\$\.C\.|"|BKY_)${key}(?!\w)`).test(code);

test("no code in Blockly reads the messages of plugins the game doesn't load", () => {
  for (const { feature, kind, keys } of UNUSED_BLOCKLY.filter((u) => u.kind === "plugin")) {
    const matched = Object.keys(blocklyEnglish).filter((key) => keys.test(key));
    assert.ok(matched.length, `${feature} (${kind}) matches no Blockly message`);
    const read = matched.filter((key) => !NOT_WORDS.test(key) && (reads(core, key) || reads(blocklyBlocks, key)));
    assert.deepEqual(read, [], `${feature}: Blockly reads these after all`);
  }
});

test("only Blockly's blocks read the messages of blocks the game doesn't offer, and the toolbox offers none of them", () => {
  const offered = [...new Set([...JSON.stringify(TOOLBOXES).matchAll(/"type":"(\w+)"/g)].map((m) => m[1]))].filter((type) => !BLOCKS.some((b) => b.type === type));
  assert.ok(offered.includes("controls_if"));
  // Each offered block's JSON definition in Blockly's blocks, to the next block's.
  const theirMessages = offered.flatMap((type) => {
    const at = blocklyBlocks.indexOf(`{type:"${type}",`);
    assert.ok(at >= 0, `${type} is defined in Blockly's blocks`);
    const def = blocklyBlocks.slice(at, blocklyBlocks.indexOf("{type:", at + 1));
    return [...def.matchAll(/BKY_(\w+)/g)].map((m) => m[1]);
  });
  assert.ok(theirMessages.includes("CONTROLS_REPEAT_TITLE"));
  for (const { feature, keys } of UNUSED_BLOCKLY.filter((u) => u.kind === "blocks")) {
    const matched = Object.keys(blocklyEnglish).filter((key) => keys.test(key));
    assert.ok(matched.length, `${feature} matches no Blockly message`);
    assert.deepEqual(matched.filter((key) => reads(core, key)), [], `${feature}: Blockly's core reads these`);
    assert.deepEqual(theirMessages.filter((key) => keys.test(key) && !NOT_WORDS.test(key)), [], `${feature}: blocks the toolbox offers read these`);
  }
});

// --- The pseudo-language ---------------------------------------------------

const PLACEHOLDERS = /\{\w+\}|%\{BKY_\w+\}|%\d+/g;

test("the pseudo-language marks every letter, pads, brackets, and keeps placeholders", () => {
  assert.equal(pseudo("Selected: {name}"), "[Šéļéçţéð: {name}~~~~]");
  assert.equal(pseudo("%1 go to %2"), "[%1 ĝö ţö %2~~~]");
  assert.equal(pseudo("%{BKY_PLACE_GROVE}"), "[%{BKY_PLACE_GROVE}]");
  assert.equal(pseudo(""), "");
  const catalogue = pseudoCatalogue(ENGLISH);
  assert.deepEqual(Object.keys(catalogue.ui), Object.keys(ENGLISH.ui));
  assert.deepEqual(Object.keys(catalogue.ui["lab.roundTripOk"]), ["one", "other"]);
  for (const part of Object.values(catalogue)) {
    for (const message of Object.values(part)) {
      for (const text of forms(message)) assert.doesNotMatch(text.replace(PLACEHOLDERS, ""), /[A-Za-z]/, text);
    }
  }
});

test("the pseudo-language marks Blockly's words too, but not its addresses and hues", () => {
  const marked = pseudoBlockly(blocklyEnglish);
  assert.equal(marked.CONTROLS_IF_HELPURL, blocklyEnglish.CONTROLS_IF_HELPURL);
  assert.equal(marked.LOOPS_HUE, blocklyEnglish.LOOPS_HUE);
  assert.equal(marked.ZOOM_IN, "[Žööɱ îñ~~~]");
  for (const [key, text] of Object.entries(marked)) {
    if (!NOT_WORDS.test(key)) assert.doesNotMatch(text.replace(PLACEHOLDERS, ""), /[A-Za-z]/, key);
  }
});
