/**
 * Left/right carousel arrows, paths copied verbatim from the live DOM
 * (capture/dom/home.html — swiper/mobile-carousel/review buttons all share
 * these two 24x24 paths).
 */
export function ArrowLeftIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...props}>
      <path d="m19,11.5H6.265l4.617-4.617-.707-.707-4.717,4.717c-.61.61-.61,1.604,0,2.214l4.718,4.718.707-.707-4.617-4.617h12.734v-1Z" />
    </svg>
  );
}

export function ArrowRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...props}>
      <path d="m18.541,10.894l-4.717-4.717-.707.707,4.616,4.617H5v1h12.735l-4.618,4.617.707.707,4.717-4.716c.296-.296.459-.69.459-1.108s-.163-.812-.459-1.106Z" />
    </svg>
  );
}
