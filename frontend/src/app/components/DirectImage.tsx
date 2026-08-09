import type { ComponentPropsWithoutRef } from "react";

type DirectImageProps = Omit<ComponentPropsWithoutRef<"img">, "alt"> & { alt: string };

export function DirectImage(props: DirectImageProps) {
  // Blob previews and legacy remote image hosts cannot reliably use Next's image optimizer.
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img {...props} />;
}
