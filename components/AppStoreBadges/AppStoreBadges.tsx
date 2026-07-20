/**
 * App Store / Google Play badge pair, shared by the home QR CTA band, the
 * bottom download CTA (and the features/about pages later). Markup + link
 * targets verbatim from the live DOM; ALL styling comes from the parent's
 * CSS module (each section skins the badges differently on the live site),
 * so this component only takes classNames.
 */
import type { RevealMode } from "../Reveal/RevealManager";

type Props = {
  className?: string;
  imgClassName?: string;
  /** scroll-reveal participation (see components/Reveal/RevealManager) */
  reveal?: RevealMode;
  revealDelay?: number;
};

export function AppStoreBadges({ className, imgClassName, reveal, revealDelay }: Props) {
  return (
    <div className={className} data-reveal={reveal} data-reveal-delay={revealDelay}>
      <a
        href="https://apps.apple.com/app/id6759912615"
        target="_blank"
        rel="noreferrer"
        aria-label="Download on the App Store"
      >
        <img
          className={imgClassName}
          src="/icons/Apple-Pay.svg"
          width={179}
          height={62}
          alt="Download on the App Store"
        />
      </a>
      <a
        href="https://play.google.com/"
        target="_blank"
        rel="noreferrer"
        aria-label="Get it on Google Play"
      >
        <img
          className={imgClassName}
          src="/icons/Google-Pay.svg"
          width={208}
          height={62}
          alt="Get it on Google Play"
        />
      </a>
    </div>
  );
}
