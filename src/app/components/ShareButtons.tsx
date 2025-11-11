"use client";

import { useState } from "react";

type Props = {
  url: string;                   // e.g., https://gradeyour401k.com/share/abc123
  title?: string;                // e.g., "My 401(k) Grade"
  text?: string;                 // e.g., "Just got my 401(k) graded on GradeYour401k!"
};

export default function ShareButtons({ url, title = "My 401(k) Grade", text = "Just got my 401(k) graded on GradeYour401k!" }: Props) {
  const [copied, setCopied] = useState(false);

  const doWebShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch {
        // user canceled
      }
    } else {
      copyLink();
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const enc = encodeURIComponent;
  const xUrl  = `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`;
  const liUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`;

  return (
    <div className="flex items-center gap-2">
      <button onClick={doWebShare} className="rounded-xl px-3 py-2 border">Share</button>
      <a className="rounded-xl px-3 py-2 border" href={xUrl} target="_blank" rel="noopener noreferrer">Post on X</a>
      <a className="rounded-xl px-3 py-2 border" href={liUrl} target="_blank" rel="noopener noreferrer">Share on LinkedIn</a>
      <a className="rounded-xl px-3 py-2 border" href={fbUrl} target="_blank" rel="noopener noreferrer">Share on Facebook</a>
      <button onClick={copyLink} className="rounded-xl px-3 py-2 border">{copied ? "Copied!" : "Copy link"}</button>
    </div>
  );
}
