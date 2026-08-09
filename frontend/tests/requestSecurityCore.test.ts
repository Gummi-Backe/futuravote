import assert from "node:assert/strict";
import test from "node:test";
import { isTrustedMutationSource } from "../src/app/lib/requestSecurityCore.ts";

test("same-origin mutations are allowed", () => {
  assert.equal(
    isTrustedMutationSource({
      requestUrl: "https://www.future-vote.de/api/votes",
      origin: "https://www.future-vote.de",
      secFetchSite: "same-origin",
    }),
    true
  );
});

test("cross-site browser mutations are blocked", () => {
  assert.equal(
    isTrustedMutationSource({
      requestUrl: "https://www.future-vote.de/api/votes",
      origin: "https://example.test",
      secFetchSite: "cross-site",
    }),
    false
  );
});

test("configured trusted origins support comma-separated values", () => {
  assert.equal(
    isTrustedMutationSource({
      requestUrl: "http://localhost:3000/api/votes",
      origin: "https://www.future-vote.de",
      secFetchSite: "same-site",
      configuredOrigins: ["https://future-vote.de, https://www.future-vote.de/path"],
    }),
    true
  );
});

test("malformed origins are blocked", () => {
  assert.equal(
    isTrustedMutationSource({
      requestUrl: "https://www.future-vote.de/api/votes",
      origin: "not a URL",
      secFetchSite: null,
    }),
    false
  );
});
