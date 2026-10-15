import { NOT_WORDS } from "./blockly-unused.js";

// The pseudo-language, for development (?dev&lang=pseudo, PLAN.md §8): English
// with every letter accented, padded by about 40% and in brackets, Blockly's own
// words included. Plain letters on screen are text that didn't come from a
// catalogue; a missing closing bracket is text cut off by a layout too tight for
// longer languages. Blockly splits a block's message into separate words around
// its fields, so a bracket can be far from a word; the accents are on every one.
const PLAIN = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ACCENTED = [..."áƀçðéƒĝĥîĵķļɱñöþǫŕšţûṽŵẋýžÅƁÇÐÉƑĜĤÎĴĶĻṀÑÖÞǪŔŠŢÛṼŴẊÝŽ"];
const SWAP = new Map([...PLAIN].map((ch, i) => [ch, ACCENTED[i]]));

// Placeholders stay as they are: {name}, %1, and Blockly's %{BKY_KEY}.
const PLACEHOLDER = /(\{\w+\}|%\{BKY_\w+\}|%\d+)/;

export function pseudo(text) {
  if (typeof text !== "string" || !text.trim()) return text;
  const parts = text.split(PLACEHOLDER);
  let length = 0;
  const marked = parts
    .map((part, i) => {
      if (i % 2) return part;
      length += part.length;
      return part.replace(/[A-Za-z]/g, (ch) => SWAP.get(ch));
    })
    .join("");
  return `[${marked}${"~".repeat(Math.ceil(length * 0.4))}]`;
}

// A message, which may have plural forms.
const pseudoMessage = (message) => (typeof message === "string" ? pseudo(message) : Object.fromEntries(Object.entries(message).map(([form, text]) => [form, pseudo(text)])));
const mapValues = (object, fn) => Object.fromEntries(Object.entries(object).map(([key, value]) => [key, fn(value, key)]));

// The game's catalogues ({ ui, blocks }) in the pseudo-language.
export const pseudoCatalogue = (messages) => mapValues(messages, (part) => mapValues(part, pseudoMessage));

// Blockly's messages in the pseudo-language. Help-page addresses and hues aren't
// words, and stay as they are.
export const pseudoBlockly = (messages) => mapValues(messages, (text, key) => (NOT_WORDS.test(key) ? text : pseudo(text)));
