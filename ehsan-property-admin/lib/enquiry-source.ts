export function campaignField(utm: unknown, key: 'utm_source' | 'utm_medium' | 'utm_campaign'): string {
  if (!utm || typeof utm !== 'object') return '';
  const value = (utm as Record<string, unknown>)[key];
  return typeof value === 'string' ? value.trim().slice(0, 200) : '';
}

const platforms = [
  { label: 'Google Search', aliases: ['google', 'google search'], domains: ['google.com', 'google.com.my', 'google.co.uk', 'google.com.sg'] },
  { label: 'Facebook', aliases: ['fb', 'facebook'], domains: ['facebook.com', 'fb.com'] },
  { label: 'Threads', aliases: ['threads'], domains: ['threads.net', 'threads.com'] },
  { label: 'WhatsApp', aliases: ['whatsapp', 'wa'], domains: ['whatsapp.com', 'wa.me'] },
  { label: 'Instagram', aliases: ['instagram', 'ig'], domains: ['instagram.com'] },
  { label: 'LinkedIn', aliases: ['linkedin'], domains: ['linkedin.com'] },
  { label: 'TikTok', aliases: ['tiktok'], domains: ['tiktok.com'] },
  { label: 'X', aliases: ['x', 'twitter'], domains: ['x.com', 't.co', 'twitter.com'] },
  { label: 'Bing', aliases: ['bing'], domains: ['bing.com'] },
];

export function enquirySource(enquiry: { utm?: unknown; referrer?: string | null }): string {
  const source = campaignField(enquiry.utm, 'utm_source');
  let host = '';
  try { host = new URL(enquiry.referrer ?? '').hostname.toLowerCase(); } catch { /* No referrer. */ }
  const matchesDomain = (value: string, domain: string) => value === domain || value.endsWith('.' + domain);
  const platform = platforms.find(({ aliases, domains }) => source
    ? aliases.includes(source.toLowerCase()) || domains.some(domain => matchesDomain(source.toLowerCase(), domain))
    : domains.some(domain => matchesDomain(host, domain)));
  if (platform?.label === 'Google Search' && /^(cpc|ppc|paid|paidsearch)$/i.test(campaignField(enquiry.utm, 'utm_medium'))) return 'Google Ads';
  if (platform) return platform.label;
  if (source) return source;
  if (host && !['ehsanproperty.com', 'localhost', '127.0.0.1'].some(domain => matchesDomain(host, domain))) return host;
  return 'Direct / unknown';
}
