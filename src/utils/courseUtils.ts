/**
 * Helper utilities for course duration, difficulty levels, and learning outcomes
 */

export type DurationUnit = 'Days' | 'Weeks' | 'Months' | 'Years';

export function parseDuration(durationStr?: string): { value: string; unit: DurationUnit } {
  if (!durationStr || !durationStr.trim()) {
    return { value: '8', unit: 'Weeks' };
  }

  const trimmed = durationStr.trim();
  const match = trimmed.match(/^(\d+)\s*(days?|weeks?|months?|years?)/i);
  if (match) {
    const val = match[1];
    const rawUnit = match[2].toLowerCase();
    if (rawUnit.startsWith('day')) return { value: val, unit: 'Days' };
    if (rawUnit.startsWith('week')) return { value: val, unit: 'Weeks' };
    if (rawUnit.startsWith('month')) return { value: val, unit: 'Months' };
    if (rawUnit.startsWith('year')) return { value: val, unit: 'Years' };
  }

  const digits = trimmed.replace(/\D/g, '');
  return { value: digits || '8', unit: 'Weeks' };
}

export function formatDuration(value: string | number, unit: DurationUnit): string {
  const num = String(value).trim() || '8';
  return `${num} ${unit}`;
}

export function parseWhatYouWillLearn(raw?: any, courseTitle?: string, categoryName?: string): string[] {
  if (raw) {
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    }
    if (typeof raw === 'string' && raw.trim().length > 0) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
        }
      } catch {
        // Not JSON string, split by newlines or bullets
      }

      const lines = raw
        .split(/\r?\n/)
        .map(line => line.replace(/^[\s\-*•\d.]+\s*/, '').trim())
        .filter(line => line.length > 0);

      if (lines.length > 0) return lines;
    }
  }

  // Smart contextual default based on title/category so courses never look broken if not filled yet
  const title = (courseTitle || '').toLowerCase();
  const cat = (categoryName || '').toLowerCase();

  if (title.includes('data') || cat.includes('data')) {
    return [
      'Master data analytical thinking and core methodologies',
      'Data preparation, formula modeling, and clean structuring',
      'Build dynamic executive dashboards and automated reporting',
      'Hands-on portfolio projects ready for industry presentation'
    ];
  }

  if (title.includes('design') || title.includes('ux') || title.includes('ui') || cat.includes('design')) {
    return [
      'Design thinking, user empathy, and thorough user research',
      'High-fidelity wireframing and interactive prototyping in Figma',
      'Modern design systems, typography hierarchy, and accessibility standards',
      'End-to-end design case study tailored for your career portfolio'
    ];
  }

  if (title.includes('web') || title.includes('code') || title.includes('develop') || title.includes('software') || title.includes('python')) {
    return [
      'Core programming architecture, syntax, and modern problem solving',
      'Hands-on full-stack labs with real-time code reviews',
      'Version control with Git & GitHub industry workflows',
      'Deploy production-ready applications with modern best practices'
    ];
  }

  return [
    'Master foundational and advanced industry-standard concepts',
    'Practical hands-on exercises and real-world project applications',
    'Live mentor feedback and interactive code / portfolio reviews',
    'Accelerate your career trajectory with verifiable practical skills'
  ];
}
