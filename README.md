# 3-maktab sayti — ishga tushirish

Papkada: `index.html` (sayt) va `api/` (Cloudflare serveri: `worker.js`, `wrangler.toml`).

## 1. Telegram bot (kirish uchun)
1. Telegramda @BotFather → `/newbot` — bot yarating, **token** va **username** oling.
2. @BotFather → `/setdomain` → botingizni tanlang → saytingiz domenini yozing (masalan `maktab3.pages.dev`).

## 2. Serverni deploy qilish (bir marta)
1. Node.js va bepul Cloudflare hisob.
2. `cd api` → `npx wrangler login`
3. `wrangler.toml` da `DEV_USERNAME` (developer username) va `BOT_USERNAME` (bot username, @ siz) ni yozing.
4. Maxfiy kalitlar:
   - `npx wrangler secret put AUTH_SECRET` (uzun tasodifiy matn)
   - `npx wrangler secret put BOT_TOKEN` (BotFather tokeni)
5. `npx wrangler deploy` — oxirida `https://maktab3-api.<nom>.workers.dev` chiqadi.

## 3. Saytni ulash va joylash
1. `index.html` da `window.API_URL=''` ga yuqoridagi manzilni yozing.
2. Cloudflare → Workers & Pages → Create → Pages → "Upload assets": `index.html`, `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png`, `icon.svg` (`api/` ni tashlamang).

## 4. Birinchi ishlar
1. `DEV_USERNAME` bilan **Register** qiling → siz developersiz.
2. Admin panel: **Fanlar** (Standart fanlarni yuklash), **Xodim qo'shish** (o'qituvchi + fani, direktor), sinflarni yarating.
3. Jadval sahifasida admin **dars soatlarini** kiritadi; o'qituvchilar darslarni (fan + ustoz) qo'shadi.
4. Jadval hamma qurilmada real vaqtda yangilanadi; "Hozir n-dars" / "Tanafus" holati soatga qarab o'zi o'zgaradi (Toshkent vaqti).

## Ilovani yuklab olish
Saytda **«Ilovani yuklab olish»** tugmasi bor (Android/Chrome o'rnatadi; iPhone: Ulashish → Bosh ekranga qo'shish).

## Yangilanishlar (dizayn)
- Dars soatlari: 1-dars 08:30, har dars 45 daqiqa, darslar orasida 5 daqiqa, 3-darsdan keyin 10 daqiqa katta tanafus (8:30–13:30). Admin soatlarni tahrirlagan bo'lsa, «Standart (8:30 dan)» tugmasi bilan qaytarish mumkin.
- Yangiliklarga poster (rasm) qo'shish mumkin — rasm avtomatik siqiladi.
- Sayt kompyuter, noutbuk, planshet va telefonga moslashadi (katta ekranda yon menyu va haftalik jadval jadvali).
- Developed by A.Karimov belgisi yon menyuda, sahifa pastida va kirish oynasida.

## Yangi bo‘limlar (SchoolMind / SchoolDirect uslubida)
- **Bosh sahifa paneli**: salomlashuv, bugungi darslar / topshirish kerak / nazorat ishlari / bajarilgan, «Bugungi ustuvorliklar», e’lonlar (MUHIM belgisi bilan).
- **Uyga vazifa**: o‘qituvchi vazifa yoki nazorat ishini qo‘shadi (sinf, fan, muddat); o‘quvchi katakcha bilan belgilaydi; muddati o‘tganlari qizil belgi bilan.
- **AI vositalari**: Maktabdan so‘ra (+ suzuvchi AI tugma), SnapHomework (matn/rasm), AI Planner, AI Quiz, AI repetitor.
- **Arizalar**: maxfiy (anonim) rejim, muhimlik darajasi, ovozli yozish, AI tahlil, status kuzatuvi, qabul qilingan takliflar doskasi va Ma’muriyat bo‘limi.
- **Ota-onam**: ota va ona ismi/telefoni, Telegramga ulash havolasi.
- **UZ/RU** tugmasi (menyu va asosiy sarlavhalar), bildirishnoma qo‘ng‘irog‘i.

### Qo‘shimcha sozlash (server)
1. `cd api && npx wrangler secret put HOOK_SECRET` (ixtiyoriy harf/raqam, masalan `m3hook2026`), keyin `npx wrangler deploy`.
2. Telegram webhook (bir marta, brauzerda ochish kifoya):
   `https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<worker-manzil>/tg/hook&secret_token=<HOOK_SECRET>`
3. `BOT_USERNAME` ni `wrangler.toml` da yozilganiga ishonch hosil qiling.
4. AI uchun Cloudflare hisobingizda Workers AI yoqilgan bo‘lishi kerak (`[ai]` allaqachon qo‘shilgan). Eslatmalar har kuni 09:00 (Toshkent) ketadi.
5. Saytga yuklashda yangilangan `index.html`, `sw.js`, `manifest.webmanifest` ni qayta yuklang.

## Yangilanish: 7 kunlik hafta
- Jadval endi 7 kunni ko‘rsatadi: Dushanba–Juma hamma sinflarda, **Shanba faqat 5–11-sinflarda**, **Yakshanba dam olish kuni** (chiroyli dam olish kartasi bilan).
- 1–4-sinflar uchun shanba “Dars yo‘q” deb ko‘rsatiladi; o‘qituvchi 1–4-sinfga shanba darsi qo‘sha olmaydi.
- “Hozir n-dars” holati shanba kuni ham ishlaydi, yakshanba “dam olish kuni” deydi.
- Animatsiya tuzatishlari: menyu (drawer) siljishi, sahifa almashish, tugma va kartalar hover-animatsiyasi, kun almashganda yumshoq o‘tish; keraksiz qayta chizish (miltillash) olib tashlandi.
- Yangi umumiy ko‘rinish: yumshoq fon, aniqroq sarlavhalar, chiroyli fokus/hover holatlari.

## Yangilanish v12
- Rus tili olib tashlandi — sayt faqat o‘zbek tilida.
- Yetishmagan ikonkalar tuzatildi (menyuda “undefined”, “Qo‘shish” tugmasidagi buzuq belgi).
- AI yordamchi oynasi sayt uslubiga moslandi, AI sahifalari tugmalari ham.
- Kirish sahifasida ikki yarim bir-biriga qorishadi (o‘rtadagi chiziq yo‘q).
- Mavzu almashtirish qotmaydi; glow effektlari olib tashlandi, yengil animatsiyalar qo‘shildi.

## Yangilanish v13 (xatolar tuzatildi + yangi dizayn)
**Xatolar**
- Bosh sahifada «Bajarilgan 0 / 2» ustida yashil quti chiqishi tuzatildi (CSS `.g` klassi to‘qnashuvi).
- Emoji (🎉 ✅ 📌 ☕ …) o‘rniga SVG ikonkalar — Linux/Arch kabi emoji shrifti yo‘q qurilmalarda «▮» belgisi chiqmaydi.
- Kirish sahifasida har 15 soniyada konsolga chiqadigan xato (`me` null) tuzatildi.
- «Mening kunim» yakshanba kuni dushanba darslarini «bugun» deb ko‘rsatardi — endi «Dam olish kuni» va alohida «Ertangi darslar» chiqadi.
- Server: CORS’da `PUT`/`DELETE` ruxsat berilmagani uchun serverga ulanganda saqlash/o‘chirish ishlamasdi — tuzatildi.
- Server: email bilan kirish ishlamasdi — endi server emailni username’ga aylantiradi; ro‘yxatdan o‘tishda email takrori tekshiriladi.
- Server: davomat va xabarlar endi faqat o‘ziga tegishli o‘quvchi/ota-onaga qaytariladi (o‘qituvchi va admin hammasini ko‘radi).
- Direktor sarlavhasi bir nechta direktor bo‘lsa takrorlanardi — tuzatildi.

**Dizayn**
- Dars jadvali: haftalik jadvalda kun sanasi, bugungi ustun belgisi, fan rangli kartalari, o‘qituvchi qisqa ismi (A. Karimova), xona belgisi; hozirgi dars yashil halqa va nuqta bilan.
- Kunlik ro‘yxat: vaqt, rangli chiziq, ustoz va xona ikonkalari; barcha 6 slot ko‘rinadi (bo‘shlari xira), tanafuslar yengil belgi bilan.
- Qo‘ng‘iroq jadvali ixcham kartochkalarda (telefonda matn sinmaydi).
- «Hozir n-dars / Tanafus / Dam olish kuni» paneli ikonka bilan; statistika kartalari rangli.
- «server ulanmagan» o‘rniga «oflayn rejim» belgisi; Telegram tugmasi chiroyli holatda.
- sw.js keshi v13 ga yangilandi — yangilangach saytni bir marta qayta yuklang (Ctrl+Shift+R).

**Yangilash:** `index.html`, `sw.js` ni saytga qayta yuklang; serverni `cd api && npx wrangler deploy` bilan qayta deploy qiling.
