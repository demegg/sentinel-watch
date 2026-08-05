"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

export default function ShareBrief({
  title,
  text,
}: {
  title: string;
  text?: string;
}) {
  const [copied, setCopied] = useState(false);

  const url = typeof window !== "undefined" ? window.location.href : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: text || title, url });
        return;
      } catch {
        /* fall through to copy */
      }
    }
    await copy();
  };

  return (
    <div className="sw-share-brief">
      <button type="button" className="sw-share-btn" onClick={() => void share()}>
        <Share2 size={13} />
        Share brief
      </button>
      <button type="button" className="sw-share-btn is-ghost" onClick={() => void copy()}>
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
