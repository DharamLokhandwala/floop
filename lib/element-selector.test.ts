import assert from "node:assert/strict";
import test from "node:test";
import {
  selectorForElementId,
  USABLE_ELEMENT_ID_PATTERN,
} from "./element-selector";

test("uses ordinary element IDs as stable selectors", () => {
  assert.equal(selectorForElementId("hero"), "#hero");
  assert.equal(selectorForElementId("main-nav"), "#main-nav");
  assert.equal(selectorForElementId("cta-button-2"), "#cta-button-2");
});

test("skips IDs that cannot be used as unescaped CSS ID selectors", () => {
  assert.equal(selectorForElementId("2hero"), null);
  assert.equal(selectorForElementId("contains space"), null);
  assert.equal(selectorForElementId(""), null);
});

test("the injected RegExp source preserves the word-character escape", () => {
  const injectedPattern = new RegExp(
    JSON.parse(JSON.stringify(USABLE_ELEMENT_ID_PATTERN.source))
  );
  assert.equal(injectedPattern.test("hero"), true);
  assert.equal(injectedPattern.test("main-nav"), true);
  assert.equal(injectedPattern.test("cta-button-2"), true);
  assert.equal(injectedPattern.test("2hero"), false);
});
