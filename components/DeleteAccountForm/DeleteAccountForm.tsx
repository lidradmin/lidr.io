"use client";

import { useState } from "react";
import styles from "./DeleteAccountForm.module.css";

type Status = "idle" | "sending" | "success" | "error";

export function DeleteAccountForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);

  function validate(form: FormData): Record<string, string> {
    const errs: Record<string, string> = {};
    const email = (form.get("email") as string)?.trim();
    if (!email) errs.email = "This field is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = "Please enter a valid email address";
    if (!confirmed) errs.confirm = "You must confirm you want to delete your account";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    if ((form.get("botcheck") as string) === "on") return;

    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    form.append("subject", "Account Deletion Request");

    setStatus("sending");
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: form,
      });
      if (res.ok) setStatus("success");
      else setStatus("error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className={styles.card} role="status" aria-live="polite">
        <p className={styles.successMsg}>
          Your account deletion request has been submitted. Our team will
          process your request and you&rsquo;ll receive a confirmation email
          within 48 hours.
        </p>
      </div>
    );
  }

  return (
    <form
      className={styles.card}
      onSubmit={handleSubmit}
      noValidate
      aria-label="Delete account form"
    >
      <input type="hidden" name="access_key" value={process.env.NEXT_PUBLIC_WEB3FORMS_KEY ?? ""} />
      <input
        type="checkbox"
        name="botcheck"
        className={styles.honeypot}
        tabIndex={-1}
        aria-hidden="true"
      />

      <div className={styles.field}>
        <label htmlFor="delete_email">Email address associated with your account</label>
        <input
          type="email"
          id="delete_email"
          name="email"
          placeholder="Enter your account email"
          aria-required="true"
          aria-invalid={errors.email ? "true" : undefined}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
        {errors.email && (
          <span id="email-error" className={styles.error} role="alert">
            {errors.email}
          </span>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="delete_reason">Reason for leaving (optional)</label>
        <textarea
          id="delete_reason"
          name="message"
          placeholder="Let us know why you're leaving — your feedback helps us improve"
          rows={3}
        />
      </div>

      <div className={styles.checkboxField}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => {
              setConfirmed(e.target.checked);
              if (e.target.checked) {
                setErrors((prev) => {
                  const { confirm, ...rest } = prev;
                  return rest;
                });
              }
            }}
          />
          <span>
            I understand that this will permanently delete my account and all
            associated data, and this action cannot be undone.
          </span>
        </label>
        {errors.confirm && (
          <span className={styles.error} role="alert">
            {errors.confirm}
          </span>
        )}
      </div>

      <div className={styles.submitWrap}>
        <button type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Submitting..." : "Request Account Deletion"}
        </button>
      </div>

      {status === "error" && (
        <p className={styles.errorMsg} role="alert">
          Something went wrong. Please try again or contact us at support@lidr.io.
        </p>
      )}
    </form>
  );
}
