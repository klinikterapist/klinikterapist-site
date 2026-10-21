# Panel ana ekranı: yeni düzen (21 Ekim 2026)

Kaynak: `SITE-GUNCELLEMESI.md` (ana depo), "Panel ana ekranı ilhamları". Sahip örnekleri birlikte değerlendirdi ve taslağı denemek üzere onayladı ("beğenmezsek geri döneriz").

## Yedek
- `yedek-panel-oncesi-2026-10-21` etiketi: `site-duzeltmeler` dalının bu işten önceki hali (5d99100).
- `yedek-canli-main-2026-10-21` etiketi: canlıdaki `main`.
- İş `panel-anasayfa` dalında yapılır. Beğenilmezse dal silinir ve `site-duzeltmeler`'e dönülür; hiçbir şey kaybolmaz.

## Hedef düzen (masaüstü)
1. **Karşılama:** saate göre "Günaydın / İyi günler / İyi akşamlar / İyi geceler", altında bugünün tarihi ve tek cümlelik özet ("Bugün 2 seans var, 1 talep yanıt bekliyor.").
2. **Dört özet kutucuğu:** Bugünkü seanslar · Bekleyen talepler · Bu ay yayınlanan · Taslaklar. Her biri ilgili ekrana bağlantı. 20 saati geçmiş bekleyen talep varsa kutucuk uyarı renginde.
3. **İki sütun:**
   - Sol (geniş): "Çalışma alanı" kartları (Son yayınlanan, Taslaklar, Planlanan, Eksikler).
   - Sağ (dar): **Bugün** akışı: bugünkü seanslar saat sırasıyla (saat, danışan numarası, seans türü, danışan sayfasına bağlantı), altında bekleyen talepler (en eski 3), "Takvimi aç" bağlantısı.
4. **Site istatistikleri** tam genişlikte en altta (değişmeden).

Telefonda her şey alt alta; sıra: karşılama, kutucuklar, Bugün, çalışma alanı, istatistikler.

## Kurallar
- Renkler yalnızca `--p-*` jetonlarından; gündüz ve gece ikisi de çalışmalı.
- Kart görünümü mevcut `.stat-card` / `.home-card` ile aynı aile (köşe `--k-radius`, `--k-shadow-1`).
- Randevu verisi (danışanlar, talepler) yüklenemezse ana ekran yine açılır; Bugün kutusunda kısa bir not görünür.
- Yeni hesaplamalar `src/admin/lib/dashboard.ts` içinde saf fonksiyon olarak ve testli.

## Adımlar
1. `dashboard.ts`: `greeting(hour)`, `todayAgenda(clients, now)`, `pendingRequests(requests, now)` + birim testleri.
2. `Home.tsx`: karşılama, kutucuklar, iki sütun, Bugün akışı; veriler `clientsList` ve `requestsList` ile.
3. `admin.css`: `.home-hero`, `.home-tiles`, `.home-layout`, `.agenda` stilleri.
4. Kontrol: `npm test`, `npx astro check`, deneme modunda (`/admin/?mock`) gündüz, gece ve telefon genişliğinde ekran görüntüsü.
