# Kişisel Web Sitesi — Tasarım Belgesi

**Tarih:** 17 Ekim 2026
**Sahibi:** Osman Güneş Özkurt (online terapi veren psikolog)
**Durum:** Tamamlandı, sahibinin son onayını bekliyor

Belgede iki tür karar var: **(Sahibinin kararı)** ile işaretlenenleri site sahibi konuşmada kendisi verdi. **(Claude'un kararı)** ile işaretlenenler önerdiğim varsayılanlar; sahibi okurken bunları değiştirebilir.

---

## 1. Amaç ve neden

Sosyal medyada (Instagram, Medium, Substack) içerik üreten bir psikolog için tek bir "ev" adresi kurulacak. Bio linkine tıklayan kişi birkaç saniye içinde şunları anlamalı: bu kişi kim, bana nasıl yardımcı olabilir, ona nasıl ulaşırım. Sitenin üç işi var:

1. **Güven vermek ve randevuya yönlendirmek.** Ana eylem "Randevu Al".
2. **Randevu sürecini otomatikleştirmek.** Danışan kendisi saat seçer. Mailler, takvim daveti, toplantı linki ve sahibine bildirim kendiliğinden gider.
3. **Google'dan trafik çekmek.** Türkçe ve İngilizce blog yazılarıyla organik trafik ve otorite kazanmak.

Sahibi teknik biri değil. Kurulumdan sonra her şeyi (yazılar, metinler, randevu ayarları) kod yazmadan bir yönetim panelinden yönetebilmeli.

## 2. Hedefler

- Linktree hissinde, mobil öncelikli ama masaüstünde de iyi görünen bir kişisel site.
- Mevcut tasarım dilinin korunması (bkz. §4).
- Siteye gömülü, sahibinin tasarımında bir randevu sistemi.
- Her yazının TR ve EN olarak yayınlandığı, SEO odaklı bir blog.
- Medium/Substack tarzı yazı editörü ve canlı SEO denetleyicisi olan bir yönetim paneli. Panelden tüm site ayarları da yönetilir.
- Barındırma maliyetinin sıfır ya da sıfıra yakın olması.

## 3. Kapsam dışı ve kaçınılacaklar

**Kapsam dışı (şimdilik yapılmayacaklar):**
- Dijital ürün satışı **(Sahibinin kararı, kaldırıldı)**
- Sitede online ödeme. Seans ücreti havale/EFT ile alınır. **(Sahibinin kararı)**
- Yüz yüze seans ve fiziksel adres. Yalnızca online terapi var. **(Sahibinin kararı)**
- NFC kart, abonelik ve çok kullanıcılı SaaS yapısı. Bunlar ayrı bir projeye ait (PDF'teki iş modeli bu sitenin parçası değil).
- Klinik not, tanı, danışan dosyası saklama.
- Blog yorumları, üyelik sistemi.
- Danışanlara WhatsApp mesajı (ileride eklenebilir, bkz. §7).

**Kaçınılacaklar (çalışsa bile başarısızlık sayılır):**
- Danışan bilgilerinin gereksiz üçüncü taraf servislere dağılması.
- Hazır şablon gibi duran, kimliksiz bir görünüm.
- Yavaş açılan bir site. Instagram'dan gelen kullanıcı beklemez, Google da yavaş siteyi cezalandırır.
- Yazı yayınlamak ya da bir metni değiştirmek için kod veya GitHub bilgisi gerekmesi.
- Aynı saate iki randevu verilmesi.

## 4. Görsel kimlik

Kaynak: `Terapist özel internet sitesi.pdf` sayfa 3–8 (ana sayfa, randevu, kaynaklar, hakkımda, iletişim ve blog ekranları). Bu görsel dil korunacak **(Sahibinin kararı)**:

- Krem/kırık beyaz zemin, koyu orman yeşili ana renk, yumuşak adaçayı yeşili yüzeyler.
- Başlıklarda zarif bir serif yazı tipi, gövde metninde okunaklı bir sans-serif.
- Yaprak/dal çizimleri, yumuşak köşeli kartlar, organik şekilli portre çerçevesi.
- El yazısı fontunda slogan: "Daha iyi bir yaşam mümkün."

Tasarımdan yapılacak değişiklikler **(Claude'un kararı, sahibinin onayladığı yön)**:
- Ana sayfada "Randevu Al" tek ve baskın eylem olarak kalır. Hakkımda, Blog, Kaynaklar ve İletişim kart olarak durur. Medium ve Substack alttaki ikon satırına iner.
- "NFC Kartımı Tara" bölümü kaldırılır.
- "Yüz yüze görüşme" seçeneği ve tüm adres/ofis bilgileri kaldırılır.
- PDF'teki portreler yapay zekâ görseli. Gerçek fotoğraf gelene kadar yer tutucu kullanılır, fotoğraf panelden yüklenir.
- Unvan metni ("Psikolog" / "Klinik Psikolog") panelden düzenlenebilir olur. Doğru unvanı sahibi belirler.
- Koyu tema yapılmaz, site tek açık temada kalır.

## 5. Sayfalar

Her sayfa iki dilde yayınlanır: TR kök adreste, EN `/en/` altında. Sayfalar:

| Sayfa | İçerik |
|---|---|
| Ana sayfa | Portre, isim, unvan, slogan, kısa tanıtım; Randevu Al butonu; sosyal linkler; kartlar; son 3 yazı; alt bilgi |
| Hakkımda | Ben kimim, çalışma alanları, yaklaşım, eğitim ve mesleki gelişim zaman çizelgesi |
| Blog listesi | Kategori filtreleri, yazı kartları, bülten kutusu (Substack abonelik linkine gider) |
| Blog yazısı | Yazı, yazar kutusu, okuma süresi, ilgili yazılar, diğer dile geçiş linki |
| Kaynaklar | Kitap/makale/ölçek/video/podcast önerileri, filtreleme, öne çıkan kaynak |
| İletişim | E-posta ve sosyal linkler, mesaj formu, çalışma biçimi (online, dönüş süresi), acil durum uyarısı |
| Randevu | §7'deki akış |
| Randevu iptal | Mail linkinden gelinen iptal onay sayfası |
| Aydınlatma metni / Gizlilik | KVKK metinleri. Metin içeriği sahibinin sorumluluğunda, panelden düzenlenir |
| 404 | Tasarıma uygun hata sayfası |

Dil değiştirici her sayfada bulunur ve kullanıcıyı aynı sayfanın diğer dildeki karşılığına götürür.

## 6. Teknik mimari

**(Claude'un kararı. Sahibi teknik seçimleri Claude'a bıraktı.)**

```
┌────────────────────────────┐    commit     ┌──────────────────────┐
│ Yönetim paneli (/admin)    │──────────────▶│ GitHub deposu        │
│ statik, tarayıcıda çalışır │  (Apps Script │ içerik + ayar dosyası│
└──────────┬─────────────────┘   üzerinden)  └─────────┬────────────┘
           │ Google ile giriş                          │ GitHub Actions
           ▼                                           ▼ (derle + yayınla)
┌────────────────────────────┐               ┌──────────────────────┐
│ Google Apps Script         │◀──randevu────│ Statik site          │
│ (sahibinin Workspace'i)    │   iletişim    │ GitHub Pages +       │
│ • randevu, takvim, Meet    │               │ özel alan adı        │
│ • mailler, hatırlatmalar   │               └──────────────────────┘
│ • panelin GitHub'a yazması │
│ • WhatsApp bildirimi       │
└────────────────────────────┘
```

- **Site:** Astro ile statik üretim. Çok dilli yönlendirme yerleşik. Sayfa başına çok az JavaScript kullanılır, randevu ve form gibi etkileşimli parçalar "ada" olarak yüklenir.
- **Barındırma:** GitHub Pages ve sahibinin alan adı. Alan adı Google'dan alınmıştı. Google Domains 2023'te Squarespace'e devredildiği için DNS kayıtları muhtemelen Squarespace panelinden girilecek. Google Workspace mail kayıtları (MX) bozulmamalı.
- **İçerik deposu:** Yazılar ve ayarlar depoda dosya olarak tutulur. Yazılar Markdown + frontmatter olarak, her yazı için TR ve EN dosyası. Ayarlar JSON olarak. Veritabanı yoktur.
- **Arka taraf:** Sahibinin Google Workspace hesabında çalışan tek bir Google Apps Script web uygulaması. Sunucu masrafı yoktur ve danışan verisi sahibinin Google hesabında kalır.
- **Panelin yazma yolu:** Panel GitHub'a doğrudan yazmaz. Değişiklikleri Apps Script'e gönderir. Apps Script, yalnızca bu depoya yetkili ve kendi gizli ayarlarında saklanan bir GitHub token'ıyla commit atar. Commit GitHub Actions'ı tetikler, site 1–3 dakika içinde güncellenir. Tarayıcıya hiçbir gizli anahtar gönderilmez.
- **Panel girişi:** "Google ile giriş yap". Apps Script her istekte Google kimlik token'ını doğrular ve yalnızca sahibinin e-posta adresini kabul eder.
- **Görseller:** Panelde yüklenirken tarayıcıda küçültülür ve WebP'ye çevrilir, sonra depoya commit edilir. Astro yayında boyutlandırılmış sürümler üretir.

## 7. Randevu sistemi

### Danışan akışı
1. Görüşme türünü seçer.
2. Tarihi seçer. Yalnızca uygun saati olan günler aktif görünür.
3. Saati seçer. Saatler danışanın kendi saat diliminde gösterilir ve dilim etiketi yazılır **(Claude'un kararı. Yurt dışından İngilizce sayfayla gelen danışan için gerekli)**.
4. Ad soyad, e-posta ve telefon girer. İsteğe bağlı kısa notun yanında "Lütfen klinik ayrıntı yazmayın" uyarısı bulunur.
5. Ücretli seansta danışan para birimini seçer: TL, USD ya da EUR. TR sayfada TL, EN sayfada USD varsayılan olarak gelir **(Claude'un kararı)**.
6. Onay kutuları işaretlenmeden gönderim yapılamaz:
   - KVKK aydınlatma metnini okudum (her randevu türünde).
   - **Bilgilendirilmiş onam formunu, ücret, ödeme ve iptal koşullarını okudum, kabul ediyorum** (ücretli seansta) **(Sahibinin kararı)**. Onam metni panelden TR/EN, sürüm numarasıyla düzenlenir. Onam metninin hukuki içeriği sahibinin sorumluluğundadır.
7. Onay ekranı: "Randevunuz alındı. Kesinleştirmek için e-postanızdaki onay butonuna dokunun."

### Bilgilendirilmiş onam ve kanıt **(Sahibinin isteği, Claude'un tasarımı)**
Onam danışan başına bir kez, ilk ücretli seansta alınır. Kanıt dört katmanlıdır:
1. **Okutma ve onay kutusu:** Metnin tamamı randevu ekranında açılır, onay kutusu boş gelir.
2. **E-posta doğrulaması:** Danışana "Onamı onaylıyorum" butonlu bir mail gider. Butona tıklanana kadar randevu "Onay bekleniyor" durumunda kalır ve saat geçici olarak tutulur. 24 saat içinde onaylanmazsa saat serbest bırakılır, danışana bilgi verilir **(Claude'un kararı)**. Ücretsiz ön görüşmede de e-posta doğrulaması istenir, ama onam metni olmadan. Bu adım sahte e-postayla randevu alınmasını da engeller.
3. **Değiştirilemez kayıt:** Onay anında sahibinin Drive'ındaki "Onam kayıtları" klasörüne şu bilgiler yazılır: ad, e-posta, onam sürümü, form onay zamanı, e-posta onay zamanı ve metnin SHA-256 parmak izi. Her sürümün tam metni ayrıca arşivlenir ve silinemez.
4. **İki tarafa PDF kopya:** Onaylanan metnin PDF'i, onay zamanıyla birlikte danışana ve sahibine e-postayla gönderilir.

Sahibi onam metnini güncellerse (yeni sürüm), danışan bir sonraki randevusunda yeni sürümü onaylar. İlk seansın başında sözlü teyit sahibinin klinik pratiğidir, sistemin parçası değildir.

### Görüşme türleri (varsayılan, panelden düzenlenir) **(Claude'un kararı)**
- **Ücretsiz ön görüşme:** 20 dk, online (Google Meet).
- **Online seans:** 50 dk, ücretli, ödeme havale/EFT ile. TL, USD ve EUR için ayrı ücret ve ayrı IBAN tanımlanır **(Sahibinin kararı: yurt dışı ödemeler dolar/euro hesaplarına havale)**.

### Ödeme ve iptal politikası **(Sahibinin kararı)**
Kurallar panelden değiştirilebilir sayılar olarak tutulur (48 saat, 24 saat, %50):

| Seansa kalan süre | Durum |
|---|---|
| 48 saatten fazla | Ödeme bu süreye kadar yapılmalı. Danışan maildeki linkten iptal edebilir. Ödeme yapılmışsa **tam iade** edilir. |
| 48 – 24 saat | Seans kesinleşmiştir. Danışan linkten iptal edebilir, ücretin **%50'si** iade edilir. |
| Son 24 saat | İptal linki çalışmaz ("Son 24 saatte iptal yapılamaz" mesajı çıkar). **İade yapılmaz.** |
| Sahibi iptal ederse | Her durumda **tam iade** yapılır. |

- İadeler havaleyle elle yapılır. Sistem yalnızca iade tutarını hesaplayıp sahibine ve danışana bildirir.
- Sahibi istisnai durumlarda (hastalık, acil durum) panelden kuralı esnetebilir.

### Arka planda olanlar
- **Uygunluk:** Apps Script, sahibinin Google Takvimi'ndeki dolu zamanları ve paneldeki çalışma saatlerini, seans arası tamponu, en erken rezervasyon süresini (ör. 12 saat) ve en uzak tarihi (ör. 30 gün) birlikte hesaplar.
- **Çakışma önleme:** Kayıt anında kilit alınır ve saat yeniden kontrol edilir. Saat bu arada dolduysa danışana "Bu saat az önce doldu" mesajı gösterilir.
- **Takvim:** Sahibinin takvimine bir etkinlik ve otomatik Google Meet linki oluşturulur. Danışan katılımcı olarak eklenir. Google'ın daveti Apple Takvim, Outlook ve Google Takvim'de çalışır.
- **Onay maili:** Sahibinin Workspace adresinden, sitenin tasarımında ve danışanın dilinde (TR/EN) bir HTML mail gider. İçinde tarih ve saat, Meet linki, `.ics` eki ve "Apple/Google Takvim'e ekle" bağlantıları, ücretli seansta seçilen para birimine ait IBAN, tutar ve "en geç seanstan 48 saat önce ödeme" notu, iptal politikası ve iptal linki bulunur.
- **Hatırlatma:** Seanstan 24 saat önce danışana hatırlatma maili gider.
- **İptal:** Maildeki tek kullanımlık link iptal sayfasını açar. Sayfa, o anki süreye göre iade durumunu politika tablosundaki gibi gösterir. Danışan onaylarsa etkinlik silinir ve iki tarafa da bilgi maili gider (iade tutarı mailde yazar). Son 24 saatte link iptal yaptırmaz. Tarih değiştirmek isteyen danışan iptal edip yeniden randevu alır **(Claude'un kararı)**.
- **Ödeme takibi:** Ücretli seans takvime "Ödeme bekleniyor" işaretiyle düşer. Sahibi ödemeyi görünce panelde "Ödendi" butonuna basar ve işaret kalkar.
- **WhatsApp bildirimi:** Sahibinin numarasına "Yeni randevu: 18 Eyl 15:30, Online seans (50 dk)" gibi bir mesaj gider. **Mesajda danışanın adı ya da bilgisi yer almaz.** Bu sayede danışan verisi bildirim servisine gitmez **(Claude'un kararı)**. İlk aşamada ücretsiz kişisel bildirim servisi CallMeBot kullanılır. Kod, ileride WhatsApp Cloud API'ye geçilebilecek şekilde ayrı bir modülde tutulur.
- **Danışana iletişim yalnızca e-postayla yapılır** **(Sahibinin kararı)**. Danışana WhatsApp mesajı (Meta WhatsApp Business Platformu ve danışanın ayrı onayıyla) ileride eklenebilecek bir özelliktir. Bu sürümde yapılmaz, ama bildirim kodu kanal eklemeye uygun tutulur.

### Kötüye kullanım koruması **(Claude'un kararı)**
- Ücretsiz ön görüşme aynı e-posta ya da telefon numarasıyla yalnızca bir kez alınabilir.
- Formda gizli bir bot tuzağı alanı bulunur. Apps Script, kısa sürede çok fazla randevu denemesini reddeder. Bunun için ek bir üçüncü taraf servis (CAPTCHA) kullanılmaz.

### Sahibinin müdahaleleri **(Claude'un kararı)**
- Sahibi panelden bir randevuyu iptal edebilir. Danışana otomatik iptal maili gider.
- **Ödeme hatırlatması:** Seanstan 72 saat önce ödemesi işaretlenmemiş danışana nazik bir hatırlatma maili gider.
- **48 saat kararı:** 48 saat kala ödemesi hâlâ "Ödendi" işaretlenmemiş seanslar için sahibine WhatsApp ve mail ile "Ödeme gelmedi, kararınız?" bildirimi gider. Panelde tek tıkla "Ödendi" ya da "İptal et" seçilir. Sistem kendiliğinden iptal etmez. Gerekçe: havale gelmiş ama sahibi henüz işaretlememiş olabilir. Otomatik iptal ödeme yapmış bir danışanı mağdur edebilir **(Claude'un kararı)**.

### Veri
- Randevu kaydı yalnızca Google Takvim etkinliğinde tutulur. Ad, e-posta, telefon ve not etkinlik açıklamasına yazılır. Ayrı bir veritabanı ya da tablo yoktur.
- Formdan gelen veri loglanmaz.

## 8. Yönetim paneli

Panel `/admin` adresinde açılır, Türkçedir ve sitenin görsel dilini kullanır. Telefonda da kullanılabilir olmalıdır.

### 8.1 Yazılar
- **Liste:** Yazılar taslak/yayında durumuyla listelenir. Arama ve kategori filtresi vardır.
- **Editör (Medium/Substack tarzı):** Beyaz, dikkat dağıtmayan bir yazı alanı. Büyük başlık alanının altında yazı başlar. Metin seçilince yüzen bir araç çubuğu açılır (kalın, italik, H2, H3, link, alıntı). Boş satırdaki "+" menüsünden görsel (açıklama ve alt metinle), ayraç, YouTube gömme ve vurgu kutusu eklenir. Yazarken otomatik taslak kaydı yapılır. Tiptap (ProseMirror tabanlı) önerilir.
- **TR / EN sekmeleri:** Aynı yazının iki dili ayrı sekmelerde yazılır. Bir dil eksikse "Yayınla" butonu pasiftir. Kategori, kapak görseli ve tarih iki dil için ortaktır. Başlık, URL kısa adı, meta açıklama ve odak kelime her dil için ayrıdır.
- **Yazı ayarları:** Kategori, kapak görseli, yayın tarihi, URL kısa adı (başlıktan otomatik üretilir, Türkçe karakterler dönüştürülür, elle değiştirilebilir).
- **Taslak ve yayın:** Taslaklar sitede görünmez. "Yayınla" commit atar. Yayındaki yazının URL'si değiştirilirse eski adresten yeni adrese yönlendirme kaydı otomatik oluşturulur.

### 8.2 SEO denetleyici
Editörün sağında (mobilde altta) canlı bir panel bulunur. Her dil için ayrı çalışır. Her kontrol yeşil, sarı ya da kırmızı ışıkla ve tek cümlelik bir öneriyle gösterilir:

- Odak anahtar kelime: başlıkta, URL'de, meta açıklamada, ilk paragrafta ve en az bir alt başlıkta geçiyor mu; yoğunluğu makul mü.
- SEO başlığı uzunluğu (yaklaşık 50–60 karakter, piksel genişliğine göre) ve meta açıklama uzunluğu (yaklaşık 120–158 karakter).
- Google arama sonucu önizlemesi (masaüstü ve mobil).
- Sosyal paylaşım önizlemesi (kapak görseli, başlık, açıklama).
- Yazı uzunluğu (ör. 600 kelimenin altı sarı).
- Başlık hiyerarşisi: H1 tek, H2/H3 sırası atlanmamış.
- Görsellerin alt metni var mı.
- Site içi link (en az 1) ve dış kaynak linki var mı.
- Okunabilirlik: cümle ve paragraf uzunluğu, ardışık aynı kelimeyle başlayan cümleler. TR ve EN için ayrı eşikler.
- Odak kelime daha önce başka bir yazıda kullanıldıysa uyarı verilir.
- Genel puan gösterilir. Kırmızı ışıklar yayını **engellemez**, yalnızca uyarır.

### 8.3 Site ayarları
Sitedeki her metin ve ayar panelden değiştirilebilir:

- **Profil:** İsim, unvan, kısa tanıtım, slogan, portre fotoğrafı (TR/EN alanlarıyla).
- **Ana sayfa:** Kartların sırası, görünürlüğü ve metinleri.
- **Sosyal ve linkler:** Instagram, LinkedIn, Medium, Substack, e-posta vb. Ekle, sil, sırala.
- **Hakkımda:** Bölüm metinleri, çalışma alanları, eğitim zaman çizelgesi.
- **Kaynaklar:** Kaynak ekle, düzenle, sil (tür, başlık, yazar, kısa not, link, kapak), öne çıkanı seç.
- **İletişim:** Çalışma biçimi metni, dönüş süresi, acil durum uyarı metni.
- **Randevu:** Görüşme türleri (ad, süre, ücret, ücretli/ücretsiz, açıklama), haftalık çalışma saatleri, tatil/kapalı günler, seans arası tampon, en erken/en uzak rezervasyon, IBAN ve ödeme notu, iptal politikası metni.
- **Mail şablonları:** Onay, hatırlatma ve iptal mailleri TR/EN. Değişken yer tutucuları (`{ad}`, `{tarih}`, `{meet_linki}` …) ve önizleme bulunur.
- **Bildirimler:** WhatsApp numarası ve açık/kapalı ayarı.
- **SEO genel:** Site başlığı, varsayılan açıklama, varsayılan paylaşım görseli, Google Search Console doğrulama kodu.
- **Yasal metinler:** Aydınlatma metni ve gizlilik politikası (TR/EN).
- **Randevular görünümü:** Yaklaşan randevular listesi (takvimden okunur) ve "Ödendi" işaretleme.

Gizli değerler (GitHub token, WhatsApp API anahtarı) panelde gösterilmez. Bunlar yalnızca Apps Script'in gizli ayarlarında durur.

### 8.4 Verinin nerede durduğu **(Claude'un kararı)**
GitHub Pages ücretsiz planda yalnızca **herkese açık** depodan yayın yapar. Bu yüzden depoda yalnızca sitede zaten herkesin görebileceği şeyler tutulur:

- **GitHub deposu (herkese açık):** Yayındaki yazılar, görseller ve sitede görünen metin/ayarlar.
- **Sahibinin Google Drive'ı (Apps Script'in yönettiği özel bir klasör):** Taslaklar ve otomatik taslak kayıtları; randevu ayarları (çalışma saatleri, görüşme türleri, ücretler, IBAN); mail şablonları; WhatsApp numarası. Panel bu verileri Apps Script üzerinden okur ve yazar. Apps Script de randevu ayarlarını buradan okur, yani randevu ayarlarının tek doğruluk kaynağı Drive'daki bu dosyadır.
- **Otomatik taslak kaydı** birkaç saniyede bir Drive'a yapılır, GitHub'a commit atılmaz. Böylece telefonda başlanan yazıya bilgisayarda devam edilebilir. GitHub'a yalnızca "Yayınla" ya da yayındaki bir şeyi güncelleme commit atar.

## 9. SEO altyapısı (tüm site)

- Her sayfada benzersiz `title`, `meta description`, canonical ve Open Graph/Twitter etiketleri bulunur.
- `hreflang` ile TR↔EN eşleştirmesi ve `x-default` yapılır.
- Otomatik `sitemap.xml` (iki dil) ve `robots.txt` üretilir. Blog için RSS (TR ve EN ayrı) sunulur.
- Yapılandırılmış veri (JSON-LD) eklenir: `Person` ve `ProfessionalService` (online hizmet, adres yok), yazılarda `BlogPosting` ve yazar, `BreadcrumbList`.
- Sağlık içeriği (YMYL) için her yazıda yazar kutusu, unvan ve "son güncelleme" tarihi gösterilir.
- Performans hedefi: mobil Lighthouse performans, SEO ve erişilebilirlik puanları 90+. Görseller boyutlandırılır ve tembel yüklenir, fontlar alt kümelenir.
- Yazı adresi değişirse yönlendirme yapılır (GitHub Pages sunucu yönlendirmesi desteklemediği için yönlendirme sayfası ve canonical ile).
- Analitik: İlk aşamada yalnızca Google Search Console kullanılır. Çerez kullanan analitik araç eklenmez, böylece çerez onay bandına gerek kalmaz **(Claude'un kararı)**.
- Medium/Substack düzeni için panelde ve dokümanda bir hatırlatma bulunur: yazı önce sitede yayınlanır, Medium'a "içe aktar" ile alınır (canonical'ı otomatik ekler), Substack'e özet ya da farklı versiyon konur.

## 10. Kısıtlar

- Barındırma ve arka taraf ücretsiz araçlarla çalışır: GitHub Pages, GitHub Actions, Google Apps Script. Tek ücretli kalemler alan adı ve sahibinin zaten ödediği Workspace'tir.
- Apps Script günlük kotaları (mail gönderimi vb.) bir kişinin randevu hacmi için yeterlidir. Builder kotaları doğrulamalıdır.
- Sahibi teknik değil. Kurulumdaki elle yapılacak adımlar (DNS, Apps Script dağıtımı, GitHub token'ı) adım adım, ekran görüntülü bir rehberle belgelenmelidir.
- Kişisel verilerde KVKK'ya uygun hareket edilir. Hassas veri en aza indirilir (§7 Veri).

## 10b. Mevcut içerik **(Claude'un kararı)**
Medium/Substack'teki eski yazılar için otomatik içe aktarma aracı yapılmaz. Sahibi isterse eski yazılarını editöre yapıştırıp iki dilli olarak yeniden yayınlar.

## 11. Builder'a bırakılanlar

- Astro sürümü, panelin UI kütüphanesi (React/Preact/Svelte), Tiptap eklentileri, CSS yaklaşımı.
- Depo içindeki klasör yapısı ve dosya formatlarının ayrıntıları.
- Apps Script uç noktalarının tasarımı ve panelden gelen isteklerin doğrulama ayrıntıları (§6'daki ilkeler korunmak kaydıyla).
- SEO kontrollerinin kesin eşikleri.
- Yazı tipleri. Tasarımdaki görünüme uygun, Türkçe karakter destekli ve ücretsiz olmalı.
- Test stratejisi. Randevu çakışması, iptal ve panel girişinin yetkisiz erişime kapalı olması mutlaka test edilmeli.

## 12. Yapım sırası **(Sahibinin kararı)**

1. **Aşama 1 — Site ve blog:** Tüm sayfalar (TR/EN), görsel kimlik, SEO altyapısı ve yayın hattı (GitHub Pages, alan adı). Randevu butonu bu aşamada geçici olarak İletişim sayfasına ya da e-postaya yönlendirir.
2. **Aşama 2 — Yönetim paneli:** Google girişi, Apps Script yazma yolu, editör, SEO denetleyici, site ayarları, Drive'da taslaklar.
3. **Aşama 3 — Randevu sistemi:** §7'nin tamamı ve panelin randevu ayarları ile randevular görünümü.

Her aşama ayrı ayrı yayına alınabilir olmalıdır.

## 13. Açık sorular

Açık soru kalmadı.
