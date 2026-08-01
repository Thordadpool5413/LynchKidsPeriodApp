/**
 * DRAFT CONTENT — AWAITING CLINICIAN REVIEW
 *
 * This file is server-side only and is NOT imported by the client app bundle.
 * None of these items are served to users until a qualified clinician has reviewed
 * and approved each one (see shared/content.ts for the publishing workflow).
 *
 * Once an item is signed off:
 *   1. Record the clinician's name, credentials, and approval date.
 *   2. Move the approved item to shared/content.ts with:
 *        reviewerStatus: 'clinician-reviewed'
 *        reviewedAt: '<sign-off date>'
 *        publishedAt: '<go-live date>'
 *   3. Remove it from this file.
 */

import type { ContentItem } from '../shared/types';

export const PENDING_CONTENT: ContentItem[] = [
  {
    id: 'first-period',
    slug: 'first-period',
    title: 'Your first period',
    summary: 'What it can look and feel like—and why every body has its own timing.',
    body: `Your first period is a normal part of growing up. Blood may appear red, pink, or brownish—all of these colors are normal. The flow is usually light at first and may last between two and seven days.

Periods often begin anywhere from age 8 to 16. In the first year or two it is very common for cycles to be irregular, meaning they might not come at the same time each month. That is completely normal.

Keep a pad or period underwear in your bag so you feel prepared. If your period starts at school, a trusted adult like a school nurse or teacher can help. Let a trusted grown-up at home know so they can support you.`,
    category: 'basics',
    premium: false,
    reviewedAt: '2026-07-30',
    reviewerStatus: 'draft',
    publishedAt: '2026-07-30',
  },
  {
    id: 'period-products',
    slug: 'period-products',
    title: 'Pads, period underwear, and tampons',
    summary: 'A calm guide to the products you might hear about.',
    body: `There are several safe options for managing your period. You do not need to use every type—start with whatever feels most comfortable.

Pads stick to the inside of your underwear and absorb flow. They come in different sizes for lighter or heavier days. Change them every four to six hours, or sooner if needed.

Period underwear looks like regular underwear and has a built-in absorbent layer. Rinse in cold water after wearing, then wash as directed.

Tampons are worn inside the vagina. They are safe when changed every four to eight hours—never leave one in longer than eight hours. Read the package directions carefully and ask a trusted grown-up for help the first time.

Menstrual cups are reusable cups worn inside the vagina. They need to be emptied, rinsed, and reinserted. They are an option some people prefer once they are more familiar with their body.

If you are unsure which product to try first, pads or period underwear are a good starting point. Ask a trusted grown-up or nurse if you have questions.`,
    category: 'basics',
    premium: false,
    reviewedAt: '2026-07-30',
    reviewerStatus: 'draft',
    publishedAt: '2026-07-30',
  },
  {
    id: 'cramp-comfort',
    slug: 'cramp-comfort',
    title: 'Comfort for cramps',
    summary: 'Gentle things that may help your body feel more comfortable.',
    body: `Cramps—a dull ache or tightening feeling in the lower belly or back—are common around the start of a period. They happen because the uterus is squeezing gently, and they usually ease within one to three days.

Things that can help:
- Warmth: a warm water bottle or heat pad on your lower belly or back (keep a cloth between the heat and your skin)
- Gentle movement: a short walk or light stretching
- Rest: lying down with your knees slightly bent
- Water: staying hydrated
- Slow breathing: breathing in for four counts and out for four counts

Over-the-counter pain relievers such as ibuprofen (like Advil or Motrin) or naproxen sodium (like Aleve) can reduce cramp pain. Always ask a trusted grown-up before taking any medicine, and follow the dose on the package.

Tell a trusted grown-up right away if cramps are very severe, come on suddenly and feel different from usual, or stop you from doing normal activities. Those are signs a health professional should take a look.`,
    category: 'self-care',
    premium: false,
    reviewedAt: '2026-07-30',
    reviewerStatus: 'draft',
    publishedAt: '2026-07-30',
  },
  {
    id: 'school-kit',
    slug: 'school-kit',
    title: 'Build a tiny school kit',
    summary: 'Pack what you need so you feel ready wherever you are.',
    body: `Having a small period kit in your bag means you are prepared—no matter where you are when your period arrives.

What to pack:
- Two pads in the size you use most (or period underwear as a backup)
- One pair of spare underwear in a small zip-lock bag
- A few individually wrapped moist wipes suitable for skin (unscented)
- A small zip-lock bag to seal used products before putting them in the bin

A pencil case or small pouch works perfectly. Tuck it in a front pocket of your backpack so you can reach it quickly.

Keeping it fresh: Check your kit once a month and replace anything you have used. Pads in wrappers and wipes in sealed packets stay clean inside your bag.

If your period starts unexpectedly at school, you can also ask a school nurse, teacher, or trusted adult for a pad—most schools keep supplies for students.`,
    category: 'school',
    premium: true,
    reviewedAt: '2026-07-30',
    reviewerStatus: 'draft',
    publishedAt: '2026-07-30',
  },
  {
    id: 'ask-for-help',
    slug: 'ask-for-help',
    title: 'When to ask for help',
    summary: 'Your body deserves attention when something feels wrong.',
    body: `Most period symptoms are normal, but some signs mean you should talk to a trusted grown-up or health professional right away. You are not being dramatic—these things deserve attention.

Tell a trusted grown-up the same day if:
- You are soaking through a pad or tampon every hour for two or more hours in a row
- Your period has lasted more than seven days
- You feel faint, very pale, or unusually tired
- Cramps are severe or feel very different from usual
- You notice a high fever or unusual discharge along with your period

Call for urgent help (911 or your local emergency number) if:
- You feel so faint that you cannot stand or walk
- You have sudden, very severe pain in your belly
- You cannot wake up or stay awake

It is also okay to ask about:
- Anything about your body that worries or confuses you—there are no silly questions
- Choosing or using period products for the first time
- How to track your cycle

A doctor, nurse, school counselor, or any trusted adult can help. You deserve to feel comfortable and safe.`,
    category: 'safety',
    premium: false,
    reviewedAt: '2026-07-30',
    reviewerStatus: 'draft',
    publishedAt: '2026-07-30',
  },
];
