export const MAX_IMAGE_UPLOAD_MEGABYTES = 8;
export const MAX_IMAGE_UPLOAD_BYTES = MAX_IMAGE_UPLOAD_MEGABYTES * 1024 * 1024;

export const IMAGE_UPLOAD_TOO_LARGE_MESSAGE =
  `Die Datei ist zu groß (max. ${MAX_IMAGE_UPLOAD_MEGABYTES} MB). Bitte wähle ein kleineres Bild.`;
