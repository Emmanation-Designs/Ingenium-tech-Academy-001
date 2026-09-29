import React from 'react';
import { ExternalLink } from 'lucide-react';

/**
 * Regex to detect URLs (http, https, and www)
 */
const URL_REGEX = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s]|www\.[^\s<]+[^<.,:;"')\]\s])/gi;

/**
 * Extract all URLs from a text string
 */
export function extractUrls(text?: string): string[] {
  if (!text) return [];
  const matches = text.match(URL_REGEX);
  return matches || [];
}

/**
 * Ensures a URL starts with http:// or https://
 */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

interface LinkifiedTextProps {
  text: string;
  className?: string;
  linkClassName?: string;
}

/**
 * Renders text with any embedded URLs transformed into safe, clickable links.
 */
export const LinkifiedText: React.FC<LinkifiedTextProps> = ({
  text,
  className = '',
  linkClassName = 'text-[#0A9D8F] font-semibold underline underline-offset-2 hover:text-[#087A6F] inline-flex items-center gap-1 transition-colors'
}) => {
  if (!text) return null;

  // Split text by URLs while preserving them
  const parts = text.split(URL_REGEX);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (URL_REGEX.test(part)) {
          // Reset regex state
          URL_REGEX.lastIndex = 0;
          const href = normalizeUrl(part);
          return (
            <a
              key={index}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={linkClassName}
              title={`Open link: ${href}`}
            >
              <span>{part}</span>
              <ExternalLink className="w-3 h-3 inline-block shrink-0 stroke-[2.2]" />
            </a>
          );
        }
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </span>
  );
};
