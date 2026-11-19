import type { ImageRef } from "../../lib/blog/types";

type Props = {
  image: ImageRef;
  sizes: string;
  className?: string;
  /** Load immediately instead of lazily. */
  eager?: boolean;
  /** Also mark as high fetch priority (the LCP image). Only meaningful with `eager`. */
  priority?: boolean;
  /** Purely decorative (e.g. a card cover next to its title): renders alt="". */
  decorative?: boolean;
};

/** Optimised blog image: WebP srcset with a JPEG fallback, intrinsic size to prevent layout shift. */
export function BlogImage({ image, sizes, className, eager, priority, decorative }: Props) {
  return (
    <picture className={className}>
      <source type="image/webp" srcSet={image.srcset} sizes={sizes} />
      <img
        src={image.src}
        alt={decorative ? "" : image.alt}
        width={image.width}
        height={image.height}
        loading={eager ? undefined : "lazy"}
        decoding={eager ? undefined : "async"}
        fetchPriority={eager && priority ? "high" : undefined}
      />
    </picture>
  );
}
