import type { Metadata } from "next";
import styles from "./page.module.css";
import { DeleteAccountForm } from "../../components/DeleteAccountForm/DeleteAccountForm";
import { RevealManager } from "../../components/Reveal/RevealManager";

export const metadata: Metadata = {
  title: "Delete Account",
  description:
    "Request deletion of your Lidr.io account and all associated data.",
  alternates: { canonical: "https://lidr.io/delete-account/" },
  openGraph: {
    title: "Delete Account - Lidr.io",
    description: "Request deletion of your Lidr.io account.",
    url: "https://lidr.io/delete-account/",
    type: "website",
  },
};

export default function DeleteAccount() {
  return (
    <div className={styles.page}>
      <RevealManager />
      <section className={styles.section}>
        <div className={styles.inner}>
          <div className={styles.content}>
            <h1 className={styles.heading} data-reveal="always" data-reveal-delay="10">Delete Account</h1>
            <p className={styles.description} data-reveal="always" data-reveal-delay="30">
              We&rsquo;re sorry to see you go. Submitting this form will send a
              request to our team to permanently delete your account and all
              associated data. Once processed, this action cannot be undone.
            </p>
            <div className={styles.formWrap} data-reveal="always" data-reveal-delay="50">
              <DeleteAccountForm />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
