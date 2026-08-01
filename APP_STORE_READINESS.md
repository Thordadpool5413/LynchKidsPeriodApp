# App Store readiness gate

Do not submit until every required item is checked and supported by evidence.

## Product and content

- [ ] Pediatric/adolescent-health clinician approves every education item, symptom threshold, activity, and Ask Glitter escalation.
- [ ] Supervised usability sessions completed with children in the target range and their parents.
- [ ] No fertility, pregnancy, advertising, public community, direct messaging, or punitive streak functionality is present.
- [ ] Monthly Plus content calendar has at least three approved releases queued.

## Child privacy

- [ ] Counsel approves COPPA and state child/consumer-health privacy approach.
- [ ] Verifiable parental consent works independently of Apple’s parental gate.
- [ ] Free local-only mode works without account creation.
- [ ] Parent access is audited; unshared journals and exact AI questions are excluded from API, dashboard, export, logs, and crash data.
- [ ] Cloud export, deletion, consent withdrawal, unlinking, and session revocation pass end-to-end tests.
- [ ] Child-readable and legal privacy policies are published at stable URLs.

## Subscriptions

- [ ] Apple subscription group has monthly and annual products plus seven-day introductory offer.
- [ ] Native purchases, Restore Purchases, Manage Subscription, Ask to Buy, and parental gate work.
- [ ] Signed Apple transactions and server notifications are verified before entitlement changes.
- [ ] Stripe webhook signatures and event-id replay protection pass production tests.
- [ ] Entitlement states pass sandbox tests across iOS and web.
- [ ] Paywall shows price, period, renewal, trial conversion, cancellation, privacy, and terms before purchase.

## AI

- [ ] OpenAI Zero Data Retention is contractually enabled for the production project.
- [ ] Legal and clinical owners approve the reviewed knowledge corpus and response boundaries.
- [ ] Red-team suite passes urgent health, self-harm, abuse, bullying, sexual content, diagnosis, dosage, prompt injection, and personal-data tests.
- [ ] Feature remains curated-only when any production prerequisite is absent.

## Engineering and review

- [ ] Production PostgreSQL migration and encrypted-field key rotation are tested.
- [ ] Native SQLCipher database is initialized with a SecureStore-backed key and migration/recovery tests.
- [ ] No health or journal data appears in URLs, analytics, logs, crash reports, or notification bodies.
- [ ] VoiceOver, Dynamic Type, reduced motion, contrast, keyboard navigation, and touch targets pass.
- [ ] Privacy manifests and required-reason APIs are audited for every native dependency.
- [ ] Current Apple SDK requirement is rechecked immediately before build.
- [ ] TestFlight parent/child beta, App Review credentials, review notes, screenshots, privacy nutrition labels, support URL, privacy URL, and terms are complete.
