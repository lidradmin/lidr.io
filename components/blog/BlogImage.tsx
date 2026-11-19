import type { ImageRef } from "../../lib/blog/types";

type Props = { image: ImageRef; sizes: string; className?: string; eager?: boolean };

/** Optimised blog image: WebP srcset with a JPEG fallback, intrinsic size to prevent layout shift. */
export function BlogImage({ image, sizes, className, eager }: Props) {
  return (
    <picture className={className}>
      <source type="image/webp" srcSet={image.srcset} sizes={sizes} />
      <img
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        loading={eager ? undefined : "lazy"}
        decoding="async"
        fetchPriority={eager ? "high" : undefined}
      />
    </picture>
  );
}
