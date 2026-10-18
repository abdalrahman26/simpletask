# simple task innovalz

## التشغيل على Vercel
1. Supabase ← SQL Editor: شغّل ملف `supabase-setup.sql` مرة واحدة.
2. Supabase ← Authentication ← Sign In / Providers: اقفل **Allow new users to sign up** (الموظفين بيتضافوا من جوه السيستم بس).
3. ارفع الفولدر ده على GitHub واربطه بـ Vercel (من غير Build Command).
4. Vercel ← Settings ← Environment Variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (سري — متحطوش في أي مكان تاني)
5. اعمل Redeploy وافتح الموقع: أول مرة هيطلب منك تعمل حساب المدير العام.

الملفات: `index.html` (السيستم) + `api/config.js` + `api/admin.js`.
