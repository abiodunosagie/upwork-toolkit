import { storage } from '#imports'

const namespace = 'sync:__COVER_LETTER_PROMPT'

export enum PromptVariable {
  TITLE = '#{title}',
  JOB_DESCRIPTION = '#{job_description}',
}

const get = () =>
  storage.getItem<string>(namespace, { fallback: defaultPrompt })

const save = async (value: string) => {
  await storage.setItem<string>(namespace, value)
  return value
}

const defaultPrompt = `Write my Upwork cover letter for this job.

Job title:
#{title}

Job description:
#{job_description}

About me (use only these facts, never invent anything):
- Abiodun O., Flutter and Next.js developer, building production apps since 2021, $30/hr.
- Beepex (fintech, Google Play): wallet with Paystack funding, airtime, data, TV and electricity bills, gift cards, PIN and fingerprint security. Flutter with Riverpod and Clean Architecture; moved the live backend from Laravel to Supabase without disrupting users; worked on the Next.js admin dashboard.
- Communitee Golf (App Store and Google Play, 225+ members): took over the live Flutter chat app, moved it from Firebase to Supabase, upgraded Stream Chat, added polls, reactions, push notifications and OTP reset. Also built its Next.js marketing site with a Supabase content editor.
- VotixCare (healthcare): Flutter patient app plus Next.js and Supabase clinic and admin dashboards with appointments and Paystack payments.
- BGlory Rides: rider and driver Flutter apps with live maps, real-time tracking and push notifications.
- Elli (education): Flutter app for children with Down syndrome in 4 languages; I run the App Store and Google Play releases.
- Chiefs House: Next.js and Supabase site with Paystack ticket payments, member accounts and an admin dashboard.
- Forza Projects: Next.js website plus an internal Supabase dashboard with invoices, payroll and role-based access.
- Numd: core contributor to an open-source NumPy-style maths library for Dart.
- Other Next.js sites: Evvy Hairs e-commerce, Generations Specialist Hospital, Gerald Nwoye Foundation, HD Attitude Studios, Forza Apartments.

How to write it:
- First line: restate the client's exact problem or goal in their own words and show I understood the hard part.
- Name the 1 or 2 projects above that best match this job and say what I built, tied to their need.
- Give 2 or 3 concrete first steps using details from their post.
- End with one short, specific question about their project.
- Under 1200 characters. Plain, confident, human.
- No "Dear hiring manager", no placeholders like [Name] or [X], no generic claims, no em dashes.
- If the post is in another language, write in that language.`

export default { get, save, defaultPrompt }
