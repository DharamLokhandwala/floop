"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link as LinkIcon, Check } from "lucide-react";

interface ShareButtonProps {
  auditId: string;
}

export function ShareButton({ auditId }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCopy = async () => {
    if (!mounted || typeof window === "undefined") return;
    
    const url = `${window.location.origin}/audit/${auditId}?view=shared`;
    
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        // Fallback for browsers without clipboard API
        const textArea = document.createElement("textarea");
        textArea.value = url;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand("copy");
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (err) {
          console.error("Failed to copy:", err);
        }
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  if (!mounted) {
    return (
      <Button variant="outline" size="sm" disabled>
        <LinkIcon className="w-4 h-4 mr-2" />
        Copy share link
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {copied ? (
        <>
          <Check className="w-4 h-4 mr-2" />
          Copied!
        </>
      ) : (
        <>
          <LinkIcon className="w-4 h-4 mr-2" />
          Copy share link
        </>
      )}
    </Button>
  );
}
