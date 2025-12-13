## Future-Vote Frontend
Next.js + Tailwind (App Router) mit Kachel-Feed fuer Ja/Nein-Prognosen, Draft-Review-Board und Mock-Daten.

### Lokales Setup
- `npm install`
- `npm run dev` → http://localhost:3000
- **Falls Turbopack/Sourcemap-Fehler:** `.env.development` setzt jetzt `NEXT_JAVASCRIPT_BUNDLER=webpack` und `NEXT_DISABLE_SOURCEMAPS=1`; einfach `npm run dev` neu starten (nimmt automatisch webpack + ohne Sourcemaps).
- `npm run lint` → ESLint
- `npm run build` → Produktionsbuild

### Supabase / Sicherheit
- Fuer Produktion/oeffentliche Tests: `SUPABASE_SERVICE_ROLE_KEY` als Server-Secret setzen und RLS aktivieren.
- SQL dafuer liegt in `../supabase/rls_policies.sql`.


### Struktur
- `src/app/page.tsx` → Landing + Kachel-Grid + Draft-Review (Mock-Daten)
- `src/app/questions/[id]/page.tsx` → Frage-Detailseite (Mock-Daten)
- `src/app/data/mock.ts` → Mock-Daten/Typen
- `src/app/api/questions/route.ts` → Mock-API fuer Feed/Drafts
- `src/app/layout.tsx` → Fonts/Metadata
- `src/app/globals.css` → Basis-Theme (Gradient, Buttons)

### Deployment Hinweis (Strato + Vercel)
- In Vercel `future-vote.de` als Domain hinterlegen, DNS bei Strato per CNAME/A auf Vercel zeigen (siehe Vercel Domain-Settings).
- SSL erledigt Vercel automatisch nach DNS-Propagation.
- Backend spaeter auf eigener Subdomain (z. B. `api.future-vote.de`).

### Weiteres
- Produkt-/Scope-Idee: `../IDEA_OVERVIEW.md`
- Vorgehensplan: `../IMPLEMENTATION_PLAN.md`
