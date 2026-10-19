# Randevu ve ön görüşme formlarının çalışması: tasarım (Faz 3, adım 2)

**Durum:** Taslak. 20 Ekim 2026'da sahip bilgisayar başında değilken yazıldı. Aşağıdaki "Sahibe açık sorular" yanıtlanmadan formlar canlıda açılmaz. Formlar bugünkü gibi yalnızca önizlemede (geliştirme sunucusu ya da `BOOKING_DESIGN=1`) görünür.

## Sahip için kısa özet (sade Türkçe)

- Danışan sitede görüşme türünü, gün ve saati seçer, bilgilerini yazar ve **"Randevu talebi gönder"**e basar.
- Talep **size e-postayla** gelir. "Yanıtla" dediğinizde e-posta danışana gider. Danışana da "talebiniz alındı, onay e-postası gelince kesinleşir" diye kısa bir e-posta gider. Bu e-postada yalnızca seçtiği tür, gün ve saat yazar.
- **Hiçbir şey saklanmaz.** Ne sitede, ne GitHub'da, ne Drive'da. Bilgiler yalnızca iki e-postada bulunur. İletişim formu bugün de aynı şekilde çalışıyor.
- Takvimde görünen gün ve saatleri **siz belirlersiniz:** haftanın hangi günü hangi saatler, en az kaç saat önceden, en fazla kaç hafta ileriye kadar. İlk sürümde bu ayarlar bir dosyada (`src/data/booking.json`) duruyor; panele "Randevu saatleri" ekranı sonraki adımda eklenecek.
- Bu ilk sürüm **dolu saatleri bilmez.** İki kişi aynı saati isteyebilir. Siz e-postayla onaylarken düzeltirsiniz. Google Takvim'le bağlantı (dolu saatlerin otomatik kapanması) ayrı bir karar (aşağıda 3. soru).

## Kararlar (gizliliği en çok koruyan seçenekler)

1. **Talep modeli, kayıt yok.** Gönderim, sahibe giden bir e-posta ve danışana giden sabit metinli bir alındı e-postasıdır. Panelde "Talepler" ekranı ve takip sayfası (12. iş) kayıt gerektirir; onlar ayrı tasarım.
2. **Ortak kurallar tek dosyada:** `src/lib/booking-form.ts`. Alanlar, sınırlar, uygun saat hesabı. Hem site hem Apps Script kullanır; Apps Script her şeyi yeniden denetler.
3. **Uygunluk dosyası:** `src/data/booking.json`. Seans: pazartesi–cuma, bugünkü tasarımdaki saatler. Ön görüşme: cumartesi–pazar, 30 dakikalık satırlar. En az 24 saat önceden, en fazla 6 hafta ileriye. Bu dosya herkese açıktır. İçinde yalnızca boş çalışma saati şablonu var, kimseye ait bilgi yok.
4. **Arka uç:** Apps Script'te herkese açık `booking.request` işlemi.
   - Bal küpü (honeypot) alanı dolarsa sessizce düşer.
   - Alanlar ve seçilen saat uygunluk şablonuna göre yeniden denetlenir. Geçmiş, çok yakın ya da çok uzak saatler reddedilir.
   - İletişim formuyla aynı sınırlar ve aynı günlük kota kullanılır: adres başına saatte 5, site geneli saatte 50, günde 80.
   - Sahibe tek e-posta gider (Reply-To: danışan). Danışana sabit metinli alındı e-postası gider. Danışanın yazdığı hiçbir metin (ad, not) bu e-postaya konmaz; böylece form başkalarına istenmeyen e-posta göndermek için kullanılamaz.
5. **Not alanı** isteğe bağlıdır ve en fazla 500 karakterdir. Altında "sağlığınızla ilgili ayrıntıları görüşmede konuşuruz" yazar.
6. **Ön görüşme konuları** (kaygı, depresyon…) KVKK'da sağlık verisi sayılır. Konu seçildiyse ayrı bir **açık rıza** kutusu çıkar ve işaretlenmeden gönderilemez. Metin taslağı aşağıda; sahip ya da avukatı onaylamalı.
7. **Yaş aralığı** (ön görüşme): bugünkü tasarımdaki seçenekler aynen kaldı ("18 yaşından küçük (veli ya da vasi onayıyla)" dahil). Yaş aralığı yalnızca size giden e-postada yazar. 18 yaş altının engellenip engellenmeyeceği 4. soruya bağlı.
8. **Site tarafı:** Form, adres (`ADMIN_CONFIG.apiUrl`) tanımlıysa gönderir. Değilse ya da hata olursa e-posta bağlantısını gösterir (bugünkü gibi). Çerez yok, üçüncü taraf yok.

## Sahibin yanıtları (20 Ekim 2026)

- **Saklama:** Talep e-postaları 30 gün tutulur. Site zaten hiçbir şey saklamıyor; e-postaları 30 gün sonra sahip siler. Gmail'de otomatik silme ileride eklenebilir, ama bunun için ayrı bir izin gerekir. Aydınlatma paragrafındaki "yasal saklama süreleri boyunca" ifadesi "30 gün" oldu.
- **Yaş:** Ergen, yetişkin ve yaşlı danışanlar. Seçenekler: 12–17 (veli ya da vasi onayıyla), 18–24, 25–34, 35–44, 45–54, 55–64, 65 ve üzeri. 12 yaş altı seçeneği yok.
- **Saatler:** Hafta içi 10.00–19.00 arası çalışılıyor. Öğle arası 13.00–14.30. Seanslar arasında en az 40 dakika var. Seanslar 50–60 dakika sürdüğü için başlangıç saatleri 10.00, 11.30, 14.30, 16.00 ve 17.30 (son seans en geç 18.30'da biter). Hafta sonu 11.00–16.00 arası öğle arası olmadan ön görüşme yapılıyor. Ön görüşmeler 25–30 dakika sürdüğü için saatler 11.00, 12.00, 13.00, 14.00 ve 15.00 (önerildi, onay bekliyor).
- **Ön görüşme türleri:** "Görüşme kimin için?" sorusu "Hangi görüşmeyi düşünüyorsunuz?" oldu. Seçenekler randevu sayfasındaki gibi: Bireysel, Çift, Erişilebilir (kontenjanlı; ekonomik durumu elverişli olmayanlar ve öğrenciler için). Grup ("Yakında") ve Yüz yüze ("Şu an uygun değil") görünüyor ama seçilemiyor.
- **Açık rıza metni:** Sahibe gösterildi, yanıt bekleniyor.

## Sahibe açık sorular

1. **Açık rıza metni** (ön görüşmede konu seçilince). Taslak: "Seçtiğim konuların ve yazdığım notun, ön görüşmeyi hazırlamak amacıyla Klinik Psikolog Osman Güneş Özkurt'a e-postayla iletilmesine açık rıza veriyorum." Uygun mu? Yoksa konu sorusu tamamen kaldırılsın mı? (En az veri ilkesine göre kaldırmak da bir seçenek.)
2. **Aydınlatma ve Gizlilik metinlerine eklenecek paragraf.** Taslak: "Randevu ve ön görüşme talepleri: Formda yazdığınız ad, e-posta, telefon, seçtiğiniz gün/saat ve (varsa) not ile konu seçimleri, talebinizi yanıtlamak amacıyla bana e-postayla iletilir. Site bu bilgileri saklamaz. Talep e-postaları Google Workspace hesabımda 30 gün tutulur, sonra silinir." (Süre sahibin yanıtıyla 30 gün oldu; metnin son onayı bekleniyor.)
3. **Google Takvim.** Dolu saatler takvimden okunsun ve formda kapansın mı? Bunun için Apps Script'e takvim izni verilir ve yalnızca "dolu/boş" bilgisi okunur. Etkinlik adları okunmaz.
4. **Yaş sınırı:** Hangi yaş grubuyla çalışıyorsunuz? (Notta da açık karar olarak duruyor.)
5. **Geç iptal kuralı** ve **çift terapisinde bireysel görüşme** metinleri (randevu sayfası, notta açık karar).
6. **Ücret satırı:** Özet kartında "Ücret" görünüyor. Gösterilsin mi, değeri ne olsun?
7. **Panelde "Randevu saatleri" ekranı** şimdi mi yapılsın, yoksa saatleri Claude'a söyleyip dosyada mı güncelleyelim?

8. **Hatırlatma metni:** Özet kartında "Randevudan bir gün önce hatırlatma e-postası gelir" yazıyor, ama hatırlatma e-postası henüz yok. Metin kalsın mı (hatırlatmayı siz elle mi göndereceksiniz), yoksa kaldırılsın mı?
9. **Önizlemede deneme:** Önizleme gerçek panel adresini kullanır. Google tarafı yüklendikten sonra önizlemeden gönderilen talepler gerçek e-posta üretir. Denerken kendi e-posta adresinizi yazın.

## Uygulama (20 Ekim 2026, dalda)

- `src/lib/booking-form.ts`: seçenekler, kurallar, `timesFor`, `validateBooking`.
- `src/data/booking.json` (+ şema `bookingSchema`, `getBooking()`): uygunluk şablonu.
- `apps-script/src/booking.ts`: `booking.request` (herkese açık). İletişim formunun sınırları `allowSend` ile ortak; her talep 2 e-posta sayılır. `booking.json` GitHub'dan okunur, 10 dakika önbellekte tutulur.
- `src/components/appointment/booking-submit.ts`: takvim, uygunluk dosyasından; gönderim; teşekkür kartı; hata mesajları.
- `BookingDesign.astro` / `PreConsultDesign.astro`: alan adları, bal küpü, açık rıza kutusu (ön görüşme), gönder düğmesi, teşekkür kartı. Konu ve yaş listeleri ortak dosyadan geliyor.
- Canlıya alma: Apps Script `gas:push` + `gas:deploy` (yeni izin gerekmez), sonra `AppointmentView`/`PreConsultView` içindeki `design` koşulu kaldırılır, Aydınlatma/Gizlilik paragrafı eklenir. Sahip onayı olmadan yapılmaz.

## Kapsam dışı (sonraki işler)

- Panelde talep listesi, onay/ret düğmeleri, takip sayfası (12. iş, kayıt gerektirir).
- Hatırlatma e-postaları.
- Ödeme.
