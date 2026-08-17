import assert from "node:assert/strict";
import test from "node:test";
import {
  getAllowedGptImageHosts,
  getGptImageUrlHost,
  isAllowedGptImageUrl,
} from "../src/app/lib/gptImageUrls.ts";

const PRODUCTION_SUPABASE_URL = "https://tmsccdcbrihcmmnjptye.supabase.co";
const GENERATED_IMAGE_URL =
  `${PRODUCTION_SUPABASE_URL}/storage/v1/object/public/question-images/questions/gpt-example.jpg`;

test("the configured Supabase host remains allowed alongside an explicit host list", () => {
  const environment = {
    FV_GPT_ALLOWED_IMAGE_HOSTS: "images.future-vote.de",
    FV_GPT_DEFAULT_IMAGE_URL: undefined,
    NEXT_PUBLIC_SUPABASE_URL: PRODUCTION_SUPABASE_URL,
  };

  assert.deepEqual(
    [...getAllowedGptImageHosts(environment)].sort(),
    ["images.future-vote.de", "tmsccdcbrihcmmnjptye.supabase.co"]
  );
  assert.equal(isAllowedGptImageUrl(GENERATED_IMAGE_URL, environment), true);
});

test("temporary OpenAI and ChatGPT image hosts stay blocked", () => {
  const environment = {
    FV_GPT_ALLOWED_IMAGE_HOSTS: "images.future-vote.de",
    FV_GPT_DEFAULT_IMAGE_URL: undefined,
    NEXT_PUBLIC_SUPABASE_URL: PRODUCTION_SUPABASE_URL,
  };

  assert.equal(
    isAllowedGptImageUrl("https://oaidalleapiprodscus.blob.core.windows.net/example/image.png", environment),
    false
  );
  assert.equal(isAllowedGptImageUrl("https://chatgpt.com/backend-api/files/example", environment), false);
});

test("Supabase URLs must reference public storage objects", () => {
  const environment = {
    FV_GPT_ALLOWED_IMAGE_HOSTS: undefined,
    FV_GPT_DEFAULT_IMAGE_URL: undefined,
    NEXT_PUBLIC_SUPABASE_URL: PRODUCTION_SUPABASE_URL,
  };

  assert.equal(isAllowedGptImageUrl(`${PRODUCTION_SUPABASE_URL}/rest/v1/questions`, environment), false);
  assert.equal(isAllowedGptImageUrl(GENERATED_IMAGE_URL, environment), true);
});

test("host diagnostics never expose the full image URL", () => {
  assert.equal(
    getGptImageUrlHost("https://images.example.test/private/image.jpg?token=secret"),
    "images.example.test"
  );
  assert.equal(getGptImageUrlHost("not-a-url"), null);
});
