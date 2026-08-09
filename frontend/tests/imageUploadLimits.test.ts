import assert from "node:assert/strict";
import test from "node:test";
import {
  IMAGE_UPLOAD_TOO_LARGE_MESSAGE,
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_IMAGE_UPLOAD_MEGABYTES,
} from "../src/app/lib/imageUploadLimits.ts";

test("image upload limit stays consistent in bytes and user-facing text", () => {
  assert.equal(MAX_IMAGE_UPLOAD_MEGABYTES, 8);
  assert.equal(MAX_IMAGE_UPLOAD_BYTES, 8 * 1024 * 1024);
  assert.match(IMAGE_UPLOAD_TOO_LARGE_MESSAGE, /max\. 8 MB/);
});
