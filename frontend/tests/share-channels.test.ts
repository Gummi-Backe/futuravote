import assert from "node:assert/strict";
import test from "node:test";
import { addShareTracking, isShareChannel, shareMedium } from "../src/app/lib/shareChannels.ts";

test("share tracking preserves referral data and identifies the selected channel", () => {
  const result = new URL(
    addShareTracking(
      "https://www.future-vote.de/questions/abc?fv_ref=signed&utm_source=old&utm_medium=old",
      "whatsapp"
    )
  );

  assert.equal(result.searchParams.get("fv_ref"), "signed");
  assert.equal(result.searchParams.get("utm_source"), "whatsapp");
  assert.equal(result.searchParams.get("utm_medium"), "social");
  assert.equal(result.searchParams.get("utm_campaign"), "poll_share");
});

test("share channel validation and media stay restricted to known values", () => {
  assert.equal(isShareChannel("telegram"), true);
  assert.equal(isShareChannel("unknown"), false);
  assert.equal(shareMedium("email"), "email");
  assert.equal(shareMedium("qr"), "qr");
  assert.equal(shareMedium("copy"), "copy");
});
