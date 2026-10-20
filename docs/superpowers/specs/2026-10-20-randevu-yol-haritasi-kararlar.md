# Randevu sistemi: sahibin yol haritası kararları ve iş planı

**Tarih:** 20 Ekim 2026. **Kaynaklar:** yol haritası (https://claude.ai/artifact/EL2zQyWC5dW2gTwNdVGyEm), sahibin değerlendirmesi (`Güneş'in Kasası/Randevu sistemi yol haritası değerlendirme.md`) ve aynı gün verdiği cevaplar.

## Sahibin kararları

1. **E-posta adresleri:** A ve B yolları. Ayrı takma adlar: `bildirim@` (sisteme gelenler, sahibe), `randevu@` (kişilere giden randevu e-postaları), `bilgi@` (bilgi yolu otomatik cevapları). Takma adları sahip Yönetici konsolunda açar; "farklı adresten gönder" için sistem MailApp yerine GmailApp kullanır (daha geniş Gmail izni; sahip kabul etti).
2. **Ücret:**
   - Sitede yazmaz. Yalnızca bilgi isteyenlere de gönderilmez.
   - Ücret ve ayrıntılı bilgilendirme, randevusu oluşan kişiye (onay e-postası) gider.
   - Ücretler her yılbaşından sonra güncellenir: panel ayarlarında yıl ve tür bazında ücret.
   - Ödeme seanstan en geç 24–48 saat önce istenir; hatırlatmalar gider.
   - Ödenmezse: iptal ve ertelemede tam ücret kuralı geçerli. **Otomatik erteleme yok:** süre dolunca sahibe bildirim gelir, erteleme kararını sahip verir.
3. **Ön görüşme ve bilgi yolu:** e-posta onayı **zorunlu değil**. Yalnızca yanlış ya da eksik yazılan adres engellenir (bugünkü iki kez yazma ve alan adı düzeltme önerisine ek olarak: alan adının gerçekten e-posta aldığının denetimi).
4. **Hatırlatma:** seansa **72 saat** kala; seans hatırlatması, ödeme hatırlatması (ödenmemişse) ve önemli uyarılar (iptal ve tam ücret kuralı, danışan sayfası bağlantısı) birlikte.
5. **Bildirimler ekranı:** hareketler tek akışta: kim ne talep etti, ne oldu (onay, iptal, erteleme, ödeme, sonlandırma isteği), hareketsiz danışanlar (önerilen eşik 45 gün işaretlenmemiş seans).
6. **Ödeme takibi:**
   - Esneklik yok.
   - "Ödendi" bilgisini sahip, danışanın panel sayfasında her seans için elle girer.
   - Ödendi girilince danışana otomatik teşekkür e-postası: ödemenin alındığı ve seans motivasyonunu destekleyen kısa bir cümle (hazır havuzdan; sahip metinleri onaylar).
   - Ödenmediyse danışan sayfasında "Ödeme hatırlatması gönder" seçeneği.
   - Ödeme yolu: havale/EFT (banka bilgisini sahip panel ayarlarına girer; Claude görmez, yazmaz) ve isteğe bağlı ödeme bağlantısı alanı. Şirketsiz ödeme alma konusunu sahip mali müşavirine danışacak.
7. **Terapist profili (yeni ana ekran):** Randevu talepleri ve Seans takip'in üstünde. İçinde: yaklaşan seanslar, sade bildirimler, gelen talepler, ortak takvim, saat, toplam seans grafikleri ve istatistikler. Takvimde **"Saat kapat"** düğmesi: seçilen tarih ve saat aralıkları kapanır, ortak takvime ve sitedeki dolu saatlere işler. Google Takvim bağlantısı bunun yerine yapılmaz.
8. **Tek giriş:** ana sayfadaki "ücretsiz ön görüşme" düğmesi kalkar. "Randevu Al" üç seçenekli bir seçim sayfası açar; seçenekler kısaca açıklanır ve terapiye başlamak isteyenlere önce ön görüşme önerilir.
   - "Tanışmak istiyorum" → bugünkü `/on-gorusme/`.
   - "Başlamaya hazırım" → bugünkü `/randevu/`.
   - "Süreç bilgisi" → yeni kısa form: kişi ne öğrenmek istediğini seçer (süre, sıklık, çevrimiçi görüşme, gizlilik, iptal kuralı …). Yalnızca seçtiği konuların hazır cevabı otomatik e-postayla gider. Ücret için: "randevunuz oluşunca ücret bilgisi size iletilir". Talep bildirimler ekranına düşer.
9. **Karar beklemeyen düzeltmeler ilk iş:** H1, E1, E3, E4 (yol haritası).

## Tarama oturumundan sahibe kalan sorular (DEVAM-NOTU "Genel tarama")
- Google Analytics `/randevu/` ve `/on-gorusme/` sayfalarında kapatılsın mı?
- "Haber et" formu alım açıkken arka uçta reddedilsin mi?
- Sayfa açıkken alım kapanırsa form "Haber et"e geçsin mi?
- Karar e-postası Drive kaydından önce gidiyor; sıra değişsin mi?

## İş planı (sırayla; her faz ayrı commit grubu, push yok)

**Faz 0. Düzeltmeler (karar gerekmez).**
- H1: Onayla, Randevu ekle, takvime ekle ve ön görüşmeden takibe geçirme `allBusy` ile denetlenir (takvim + Seans takipteki seanslar); çakışmada neyle çakıştığı söylenir.
- E1: danışan sayfasından iptal ve ertelemede danışana sabit metinli onay e-postası (geç işlemde tam ücret cümlesiyle).
- E3: saatlik görev, 20 saati geçmiş kararsız talepler için sahibe bir kez uyarı.
- E4: 30 günde silinen onaylı talebin takvim saati de silinir; 25. günden kartta uyarı.

**Faz 1. Ödeme ve hatırlatmalar.**
- Panel ayarları: yıllık ücret tablosu (tür bazında), banka bilgisi metni, ödeme bağlantısı (isteğe bağlı), ödeme son saati (24 ya da 48).
- Seans kaydına ödeme durumu (`paid`, tarih); danışan sayfasında "Ödendi" ve "Ödeme hatırlatması gönder".
- Ödendi → teşekkür ve motivasyon e-postası (havuz metinleri `yazi-editoru` ile hazırlanır, sahip onaylar).
- Onay e-postasına ücret ve ayrıntılı bilgilendirme.
- Saatlik görev: 72 saat kala hatırlatma (seans + ödeme + kurallar + danışan sayfası); ödeme son saati geçip ödenmemişse sahibe bildirim ("Ertele" kararı sahipte).
- Randevu sayfasındaki "bir gün önce hatırlatma" sözü 72 saate göre düzeltilir (H2 kapanır).

**Faz 2. Terapist profili ve bildirimler.**
- Yeni ana ekran (panel `#/` randevu bölümünün başı): yaklaşan seanslar, bildirim özeti, gelen talepler, ortak takvim, saat, istatistikler.
- Bildirimler akışı: olay kaydı (talep geldi, onaylandı, danışan iptal/erteleme, ödendi, sonlandırma isteği, hareketsiz danışan, ödeme süresi doldu). Kişisel veri az: KT numarası ya da baş harfler.
- Takvimde "Saat kapat": tarih ve saat aralığı; `takvim.json`'da "kapalı" kaydı; sitede dolu görünür.

**Faz 3. Tek giriş ve bilgi yolu.**
- Ana sayfadaki ön görüşme düğmesi kalkar; "Randevu Al" seçim sayfası (üç kart, ön görüşme önerisiyle).
- Süreç bilgisi formu ve konu bazlı otomatik cevap; bildirimlere düşer.
- E-posta adresi denetimi: alan adının e-posta alıp almadığı (DNS üzerinden MX) arka uçta denetlenir.

**Faz 4. E-posta adresleri.**
- Sahip: Yönetici konsolunda `bildirim@`, `randevu@`, `bilgi@` takma adları ve Gmail'de "farklı adresten gönder" (adım adım rehber yazılır).
- Kod: bildirimler `bildirim@`'e; kişilere giden e-postalar `randevu@` ya da `bilgi@`'den (GmailApp). Panelde kalan günlük e-posta hakkı.

## Açık kalanlar (fazlar sırasında sorulacak)
- Motivasyon cümlelerinin ve bilgi cevaplarının metinleri (taslak hazırlanır, sahip onaylar).
- İkinci ödeme hatırlatması (ör. 48 saat kala, hâlâ ödenmemişse) istenip istenmediği.
- Hukuki metinler: ödeme kuralı, bilgi formu ve bildirim kaydı aydınlatma metnine eklenmeli (avukat listesi).
