import type { ReactNode } from "react";
import styles from "./LegalLayout.module.css";
import { RevealManager } from "../Reveal/RevealManager";

interface LegalLayoutProps {
  title: string;
  children: ReactNode;
}

export function LegalLayout({ title, children }: LegalLayoutProps) {
  return (
    <div className={styles.page}>
      <RevealManager />
      <article className={styles.article}>
        <header className={styles.header}>
          <h1 className={styles.title}>{title}</h1>
        </header>
        <div className={styles.content}>{children}</div>
      </article>
    </div>
  );
}
