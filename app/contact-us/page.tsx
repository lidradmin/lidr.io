import type { Metadata } from "next";
import Image from "next/image";
import styles from "./page.module.css";
import { ContactForm } from "../../components/ContactForm/ContactForm";
import { RevealManager } from "../../components/Reveal/RevealManager";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with the Lidr.io team — we're here to help with questions, demos, and support for your construction documentation needs.",
  alternates: { canonical: "https://lidr.io/contact-us/" },
  openGraph: {
    title: "Contact Us - Lidr.io",
    description: "Contact Us",
    url: "https://lidr.io/contact-us/",
    type: "article",
  },
};

export default function ContactUs() {
  return (
    <div className={styles.page}>
      <RevealManager />
      <section className={styles.section}>
        <div className={styles.inner}>
          <div className={styles.row}>
            <div className={styles.formCol}>
              <h1 className={styles.heading} data-reveal="always" data-reveal-delay="10">Contact Us</h1>
              <div className={styles.formWrap} data-reveal="always" data-reveal-delay="50">
                <ContactForm />
              </div>
            </div>
            <div className={styles.imageCol} data-reveal="always" data-reveal-delay="100">
              <Image
                src="/images/Group_162.webp"
                alt="Hand holding phone showing Lidr.io app"
                width={800}
                height={1000}
                priority
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
