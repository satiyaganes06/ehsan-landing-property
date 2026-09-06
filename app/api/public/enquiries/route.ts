import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { enquiryRateLimited, hashIp } from '@/lib/server/rate-limit';
import { clientIp, json, publicRoute } from '@/lib/server/route';

export const runtime = 'nodejs';

const PublicEnquiryBody = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().max(30).optional(),
  interest: z.string().max(200).optional(),
  message: z.string().min(1).max(4000),
  consent: z.literal(true),
  // Honeypot: a real visitor never sees or fills this (hidden via CSS on the
  // form). Any value here means an automated submission.
  website: z.string().max(0).optional().or(z.literal('')),
  // The client records when the form became visible; anything submitted
  // faster than a human can read and fill five fields is not a human.
  renderedAt: z.number().optional(),
  utm: z.record(z.string(), z.string()).optional(),
});

const MIN_FILL_MS = 2500;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const OPTIONS = publicRoute(async () => new Response(null, { status: 204, headers: CORS }));

export const POST = publicRoute(async ({ request }) => {
  const parsed = PublicEnquiryBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: 'bad_request', message: 'Please complete the required fields.' },
      { status: 400, headers: CORS },
    );
  }

  const { website, renderedAt, consent, utm, ...data } = parsed.data;
  void consent;

  // A bot that gets a rejection learns to adjust; one that gets a quiet
  // success moves on. Both traps return 200 without writing a row.
  if (website) return Response.json({ ok: true }, { headers: CORS });
  if (renderedAt && Date.now() - renderedAt < MIN_FILL_MS) {
    return Response.json({ ok: true }, { headers: CORS });
  }

  const ipHash = hashIp(clientIp(request));
  if (await enquiryRateLimited(ipHash)) {
    return Response.json(
      { error: 'too_many_requests', message: 'Too many messages. Try again later.' },
      { status: 429, headers: CORS },
    );
  }

  await prisma.enquiry.create({
    data: {
      ...data,
      utm: utm as never,
      referrer: request.headers.get('referer') ?? undefined,
      ipHash,
      userAgent: request.headers.get('user-agent') ?? undefined,
      consentAt: new Date(),
    },
  });

  // TODO: transactional email to sales (Resend/Postmark).
  return Response.json({ ok: true }, { headers: CORS });
});

// `json` is imported for parity with the other routes but the CORS headers
// above mean these responses are built directly.
void json;
