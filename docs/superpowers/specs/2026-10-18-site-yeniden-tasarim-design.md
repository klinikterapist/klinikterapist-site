# Site Yeniden Tasarımı: Güneş Kimliği, Gündüz/Gece, Uygulama Gibi Mobil — Tasarım Belgesi

**Tarih:** 18 Ekim 2026
**Sahibi:** Osman Güneş Özkurt
**Durum:** Tamamlandı, sahibinin son onayını bekliyor
**Dayandığı iş:**
- Panel v3 tasarımı (`docs/superpowers/specs/2026-10-18-panel-v3-design.md`). Plan A'sı `main`'e birleşti, push edilmedi.
- Araştırma raporu: `reports/Güneş temalı terapist sitesi tasarımı.md` (notlar `research_notes/` altında).

**Görsel referanslar** (tarayıcıda açılır; `/files/...` görselleri yalnızca tasarım oturumunda çalıştığı için bu kopyalarda bazı görseller boş görünebilir), `docs/superpowers/specs/assets/2026-10-18-site/` altında:

| Dosya | Gösterdiği |
|---|---|
| `canli-anasayfa-2.html` | Telefonda ana sayfa, onaylanan son hâl. Tam sayfa, kaydırılabilir, gündüz/gece düğmesi çalışıyor. **Ana referans.** |
| `biolink-8.html` | Aynı ana sayfanın telefon çerçevesindeki gündüz ve gece hâli |
| `anasayfa-masaustu.html` | Masaüstü ana sayfa, gündüz ve gece |
| `blog.html` | Masaüstü blog listesi ve yazı sayfası |
| `blog-mobil-6.html` | Telefonda blog listesi ve yazı sayfası. Onaylanan son hâl, yazar satırı sola yaslı, okunma sayısı kısaltılmış. |
| `diger-sayfalar-2.html` | Telefonda Hakkımda, Kaynaklar, İletişim (gündüz ve gece). Sol üstte klinikterapist logosu. |
| `kombinler.html` | Palet seçenekleri (seçilen: 1 · Gün & Gece) |
| `portre-ayri.html` | Portre düzenleri: 1 · arka planda sabit fotoğraf (varsayılan), 2 · rozetli yuvarlak fotoğraf (panelden seçilebilen stil) |
| `gunes-taslak-gunduz.svg`, `gunes-taslak-gece.svg` | Onaylanan güneş ikonunun taslak vektörü |

Belgede iki tür karar var. **(Sahibinin kararı)** ile işaretlenenleri sahibi tasarım oturumunda kendisi verdi; çoğunu tarayıcıda görerek seçti. **(Claude'un kararı)** ile işaretlenenler önerdiğim varsayılanlar; sahibi okurken değiştirebilir.

---

## 1. Amaç ve neden

Sahibi "en iyi kişisel terapist sitesini" istiyor. Ziyaretçi sitenin karşısında sıcaklık, samimiyet ve güvende olduğunu hissetmeli; "aradığım terapisti buldum" demeli **(Sahibinin kararı, kendi sözleriyle)**.

Ziyaretçilerin çoğu Instagram'daki bio linkinden, telefonla geliyor. Bu yüzden:
- **Telefonda site bir uygulama gibi davranır.** Bio link dili bütün sayfalara yayılır.
- **Masaüstünde** klasik, ferah bir site düzeni olur **(Sahibinin kararı)**.

Adı **Güneş**. Marka bu isimden çıkıyor: yüzü olan, huzurlu bir güneş ve "Gün & Gece" renk paleti. Gündüz/gece modu hem bir erişilebilirlik özelliği hem markanın hikâyesi **(Sahibinin kararı)**.

## 2. Hedefler

1. **Yeni marka:** güneş ikonu, Gün & Gece paleti, klinikterapist yazı logosunun yeni yeri (§5.1–5.3).
2. **Gündüz/gece modu:** bütün sitede (§5.4).
3. **Telefonda uygulama gibi site:** bütün sayfalar aynı dille (§5.5).
4. **Yeni ana sayfa:** telefonda bio link, masaüstünde geniş düzen (§5.6, §5.7).
5. **Blog ve yazı sayfası:** masaüstü ve telefon (§5.8).
6. **Hakkımda, Kaynaklar, İletişim ve diğer sayfalar** aynı sisteme geçer (§5.9).
7. **Portre:** iki stil; panelden seçilir (§5.10).
8. **Yeni içerik alanları:** sık sorulan sorular, TPD üyeliği, tanıtım cümlesi, site adı (§5.11).
9. **Bekleyen küçük panel düzeltmeleri** (sahibinin listesi, §6).
10. Panel v3'ün kalan işleri (Plan B, Plan C) bu tasarıma uydurulur (§7).

## 3. Kapsam dışı

- Danışan yorumları, yıldız puanları, "kesin çözüm" vaadi, "ilk seans ücretsiz" gibi indirimler. Dayanaklar: TPD Etik Yönetmeliği 4.4–4.6, APA 5.05 ve 2023 sağlık tanıtım yönetmeliği (araştırma raporu) **(Claude'un kararı, araştırmaya dayanarak)**.
- Etiketler. Yazı sayısı 20–30'u geçince yeniden konuşulacak **(Sahibinin kararı)**.
- Kendi e-posta bülten sistemi. Abonelikler Substack'te toplanır **(Sahibinin kararı)**.
- Anonim soru kutusu, Instagram akışı gömme, Spotify oynatıcı. Kriz riski ve "takip yok" sözü nedeniyle eklenmez **(Claude'un kararı)**.
- Faz 3 (randevu sistemi). Randevu sayfası bugünkü gibi kalır, yalnızca yeni görünüme geçer.
- Logonun yapay zekâ ya da illüstratörle yeniden çizilmesi. Sahibi temel güneşi seçti; kurucu taslak vektörü temizler (§5.1).

## 4. Kaçınılacaklar (iş "çalışsa bile" başarısız sayılır)

- **Okunurluğun bozulması.** Her yazı ve düğme rengi her iki modda WCAG AA'yı geçmeli: metin 4.5:1, büyük metin ve arayüz öğeleri 3:1. Ayçiçeği sarısı krem zeminde **yazı rengi olarak kullanılmaz**; yalnızca güneşte, etiket zeminlerinde ve süslerde kullanılır.
- **Gece modunda açılışta beyaz parlama.** Sayfa her zaman doğru modda açılmalı; sayfanın başındaki küçük bir betik bunu sağlar.
- **Eğik, dengesiz şekiller.** Logo ve büyük görseller düz ve simetrik olmalı. Sahibi bir psikolog olarak eğik duruşun bazı insanlarda huzursuzluk uyandırabileceğini belirtti **(Sahibinin kararı)**.
- **Var olan içeriğin kaybolması.** Yazılar, ayarlar ve yasal metinler değişmeden yeni görünümde açılmalı. Yeni veri alanlarının hepsi isteğe bağlı olmalı ve boşken hiçbir yerde boşluk bırakmamalı.
- **Sitenin yavaşlaması.** Ziyaretçiye giden JavaScript küçük kalmalı: tema betiği, açılır kutular için yerel `<details>`, alttaki "Randevu Al" çubuğu için birkaç satır. Kütüphane yok. Portre ve kapaklar Astro'nun görsel optimizasyonundan geçmeli.
- **Acil durum notunun kaybolması.** Her sayfanın altında sakin bir "Acil bir durumdaysanız 112'yi arayın" satırı kalır **(Claude'un kararı; sahibi itiraz etmedi)**.
- Panel v3'ün güvenlik kuralları (`SAFE_LINK`, HTML kaçışlama, sahip dışında kimsenin yazamaması) gevşememeli.

## 5. Ayrıntılar

### 5.1 Güneş ikonu

- **Seçilen: "temel güneş"** **(Sahibinin kararı)**:
  - etrafında yumuşak, dalgalı bir hâle (`#FCD873`);
  - içinde hafif dalgalı bir disk (`#F6B92B`);
  - aşağı kavisli iki kapalı göz ve hafif bir gülümseme.
  - **Düz ve simetrik**, eğim yok.
- **Kurucunun işi:** `gunes-taslak-gunduz.svg`'yi temiz, dengeli bir SVG'ye çevirmek. Yol sayısını azaltmak ve ikonu görsel olarak simetrik hâle getirmek gerekiyor; taslak yollar bilgisayarla üretildiği için hafif düzensiz. Karakter aynı kalmalı: hâle, disk, kapalı gözler, gülümseme.
- **Yüz çizgilerinin rengi:** gündüz `#2A2420`, gece `#1F2E4A`. Gece modunda yüz zemin renginde olur ve güneş lacivert gökte "oyulmuş" gibi görünür.
- **Üretilecek sürümler:**
  - `favicon.svg`, renk modunu kendisi takip eder (`prefers-color-scheme`);
  - `favicon.ico` (32×32);
  - `apple-touch-icon.png` (180×180, krem zemin);
  - ana ekran simgeleri (192 ve 512 px, §5.12);
  - Instagram profil fotoğrafı için 1080×1080 PNG (krem ve lacivert zeminli iki dosya), `Masaüstü\Klinik Terapist\Logo\` klasörüne konur.
- **Not:** Kapalı gözlü güneş Headspace'in karakterine benziyor. Sahibine logoyu tescil ettirmeden önce TÜRKPATENT'te benzer logo araması yapması önerildi. Bu iş kurucunun değil, sahibinin.

### 5.2 Renk paleti: "Gün & Gece" **(Sahibinin kararı)**

| Görev | Gündüz | Gece |
|---|---|---|
| Zemin | `#FBF3E4` (krem) | `#1F2E4A` (gece mavisi) |
| Yüzey (kutu, kart) | `#F4E9D4` | `#26385A` |
| Metin | `#2A2420` | `#F4EBDD` |
| Soluk metin | `#5C5348` | `#B9C4D6` |
| Çizgi | `#2A2420` %12 | `#F4EBDD` %13 |
| Ana düğme zemini / yazısı | `#1F2E4A` / `#FBF3E4` | `#F6B92B` / `#1F2E4A` |
| Bağlantı, vurgu yazısı | `#1F2E4A` | `#FCD873` |
| Güneş: hâle / disk | `#FCD873` / `#F6B92B` | aynı |
| Büyük baş harf | `#1F2E4A` | `#F6B92B` |
| Alıntı çizgisi | `#F6B92B` | `#F6B92B` |

- **Kontrast** (hesaplandı):
  - gündüz: metin 13.9:1, düğme 12.3:1, soluk metin ≥ 5.4:1;
  - gece: metin 11.5:1, düğme yazısı 7.7:1, bağlantı 9.8:1, soluk metin 7.7:1.
- **Yeşil kimlikten çıkıyor:** Orman yeşili (`--forest`) ve adaçayı tonları ziyaretçi sitesinden kalkar **(Claude'un kararı; Gün & Gece seçimi bunu gerektiriyor)**.
- **Panelin kendi renkleri** (panel v3) bu işin kapsamında değil, sonra uyumlu hâle getirilebilir.
- **Odak halkası:** gündüz `#1F2E4A`, gece `#FCD873`; ikisi de 3:1'in üzerinde **(Claude'un kararı)**.
- **Uygulama:** `src/styles/tokens.css` iki moda bölünür, renkler CSS değişkenleri olarak tanımlanır. Bileşenler sabit renk yerine değişkenleri kullanır.

### 5.3 Yazı tipleri ve logolar

- **Yazı tipleri bugünkü gibi kalır:**
  - başlıklar Fraunces, `SOFT` ekseni yüksek (≈100), `WONK` kapalı;
  - metin DM Sans;
  - yazı gövdesi Fraunces, `SOFT` ≈50.

  Türkçe harfler (ğ, ş, İ, ı, Ö, Ü) küçük boyutta denenmeli **(Claude'un kararı, araştırma önerisi)**.
- **Caveat** (el yazısı) yeni tasarımda kullanılmıyorsa sitenin yüklemesinden çıkarılır **(Claude'un kararı)**.
- **klinikterapist yazı logosu:**
  - Kaynak dosyalar: `C:\Users\ogune\Desktop\Klinik Terapist\Logo\klinikterapist-siyah.webp` ve `klinikterapist-beyaz.webp` (2000×2000, ortada yazı). Kurucu bunu kırpar ve tek renkli, `currentColor` kullanan bir SVG'ye çevirir; böylece modun yazı rengini alır.
  - **Nerede:** telefonda ana sayfa dışındaki bütün sayfalarda sol üstte. Dokununca ana sayfaya gider **(Sahibinin kararı)**.
  - **Ana sayfada (bio link)** sol üstte logo yok, çünkü orada büyük güneş ve isim var **(Claude'un kararı; sahibine soruldu, itiraz etmedi)**.
  - **Masaüstünde** üst çubukta güneş ve "Osman Güneş Özkurt / Klinik Psikolog" yazısı kullanılır (`anasayfa-masaustu.html`) **(Claude'un kararı)**.

### 5.4 Gündüz/gece modu

- **İlk açılış:** Ziyaretçinin cihaz ayarı geçerlidir (`prefers-color-scheme`).
- **Ziyaretçinin seçimi:** Yaptığı seçim tarayıcıda (`localStorage`, anahtar ör. `site.theme`) saklanır ve her sayfada uygulanır.
- **Masaüstü:** Üst çubukta üç seçenekli bir düğme olur: Sistem · Gündüz · Gece. Simgeler monitör, güneş ve ay **(Claude'un kararı, araştırma önerisi)**.
- **Telefon:** Sol üstte yarı saydam bir kutucuk (ör. "☼ Gündüz"). Dokununca gündüz ile gece arasında geçer **(Sahibinin onayladığı taslak)**. Telefonda "Sistem"e dönmek gerekirse kurucu basılı tutma ya da üçlü döngü gibi sade bir yol seçebilir.
- **Parlama olmaz:** `<head>`'in başında satır içi, küçük bir betik doğru modu sayfa çizilmeden önce uygular. `<meta name="color-scheme" content="light dark">` ve CSS `color-scheme` ayarlanır.
- **Geçiş:** Renk değişimi kısa bir yumuşak geçişle olur (≈0.3 sn). `prefers-reduced-motion` açıksa geçiş olmaz.
- **Görseller:** Kapak ve portre gece modunda değişmez.
- **Gizlilik metni:** "Tercih ettiğiniz görünüm (gündüz/gece) yalnızca kendi tarayıcınızda saklanır, bize gönderilmez" cümlesi eklenir **(Claude'un kararı, araştırma önerisi)**.

### 5.5 Telefonda "uygulama dili" (bütün sayfalar) **(Sahibinin kararı)**

Telefon ve dar ekranlarda (yaklaşık < 768 px) her sayfa aynı parçalardan kurulur. Referans: `canli-anasayfa-2.html`, `blog-mobil-6.html` ve `diger-sayfalar-2.html`.

- **Üst satır:**
  - solda klinikterapist logosu (ana sayfada yok) ya da yazı sayfasında "← Blog";
  - sağda gündüz/gece kutucuğu ve bayraklı dil düğmesi.
  - **Dil düğmesi:** Türkçe sayfada İngiliz bayrağı ve **"ENG"**, İngilizce sayfada Türk bayrağı ve **"TR"**. Bayraklar emoji değil, SVG **(Sahibinin kararı)**.
- **Başlık bloğu:** ortalanmış başlık (Fraunces) ve kısa açıklama.
- **Kutular:**
  - yuvarlak köşeli (≈14 px), yüzey renginde;
  - solda çizgi simge, ortada kalın başlık ve soluk alt satır, sağda "›".
  - **Açılır kutular** yerel `<details>`/`<summary>` ile yapılır ve sağdaki ok döner. JavaScript gerekmez.
- **İkili bloklar:** yan yana iki kare kutu (ör. "Tüm blog yazıları · Popüler yazılar").
- **Alttaki "Randevu Al" çubuğu:**
  - ana sayfada, üstteki "Randevu Al" düğmesi ekranın tepesine kadar kaydırılınca aşağıdan belirir, yukarı dönünce kaybolur;
  - diğer bütün sayfalarda baştan sabittir **(Sahibinin kararı)**.
  - Yarı saydam zemin, ince üst çizgi; telefon çentiği ve ana ekran çizgisi için `env(safe-area-inset-bottom)` kadar boşluk.
- **Sayfa sonu:** "Acil bir durumdaysanız lütfen 112'yi arayın." ve "© 2026 klinikterapist.com · Tüm hakları saklıdır." **(Sahibinin kararı)**.
  - Yıl derleme sırasında otomatik yazılır.
  - Telefonda sayfa sonunda sosyal medya simgeleri yok; onlar "Sosyal medyada takip et" kutusunda.
- **Hamburger menü yok:** Gezinme ana sayfanın kutularıyla, geri düğmeleriyle ve logoyla yapılır. Kurucu, her sayfadan ana sayfaya ve bloga en fazla bir dokunuşla ulaşılabildiğini kontrol etmeli **(Claude'un kararı)**.
- **Dokunma hedefleri** en az 44 px yüksekliğinde; yazılar en az 12 px.

### 5.6 Ana sayfa: telefon (bio link) **(Sahibinin kararı, adım adım onaylandı)**

Yukarıdan aşağı, `canli-anasayfa-2.html` ile birebir:

1. **Portre başlığı (stil 1, varsayılan):**
   - Fotoğraf sayfanın en üstünde, yaklaşık ekran yüksekliğinin %64'ü kadar (en fazla ≈430 px).
   - `position: sticky` ile sabit kalır. Alt kenarı zemin rengine yumuşak bir geçişle karışır.
   - Gündüz/gece ve ENG kutucukları fotoğrafın üzerinde, yarı saydam beyaz zeminli.
   - Fotoğraf: `Masaüstü\Klinik Terapist\Fotoğraflar\portre.webp`. Panelden yüklenen profil fotoğrafı (`profile.json` `photo`) kullanılır. Odak noktası yüz; dikeyde yaklaşık %22–30.
2. **Kart:** Köşeleri yuvarlak (≈28 px) bir kart, fotoğrafın alt kısmının üzerine ≈64 px biner. Kaydırınca fotoğrafın üzerinden yukarı kayar.
3. **Kartın başında güneş:** Zemin renginde bir daire içinde, kart kenarının üstüne taşar.
4. Ad (Fraunces), "Klinik Psikolog · Online görüşme", "🛡 Türk Psikologlar Derneği üyesi" (TPD alanı doluysa).
5. **Tanıtım cümlesi**, panelden düzenlenir (ör. "Kaygı, ilişkiler ve kendini anlamak üzerine birlikte çalışıyoruz.").
6. **Büyük "Randevu Al"** düğmesi: randevu sayfasına gider.
7. **Sosyal medyada takip et** (açılır kutu):
   - Hesaplar alt alta, yalnızca adlarıyla ve büyük logolarla.
   - X'in adı **"X (Twitter)"**. Medium'un yanında İngiliz bayraklı **"İngilizce"** etiketi.
   - Liste `links.json`'dan gelir; e-posta bu listede yer almaz. Hesaba özel etiket gerekiyorsa `links.json`'a isteğe bağlı bir `note` alanı eklenir (TR/EN) **(Claude'un kararı)**.
8. **Yeni yazı kartı:** en yeni yazı, küçük kapak, "YENİ YAZI", başlık, okuma süresi ve okunma sayısı (§5.8).
9. **İki blok:** "Tüm blog yazıları" (kitap simgesi) ve "Popüler yazılar" (alev simgesi). Popüler yazılar sayaç verisine bağlıdır (§7).
10. **Sık sorulan sorular** (açılır kutu): her soru ayrıca açılır. İçerik panelden gelir (§5.11).
11. **Hakkımda:** "Eğitimim, yaklaşımım ve deneyimim".
12. **Kaynaklar:** "Kitap, ölçek ve rehber önerileri".
13. **Bültene abone ol:** "Substack · ayda bir mektup". `links.json`'daki Substack bağlantısına gider.
14. Sayfa sonu (§5.5).

### 5.7 Ana sayfa: masaüstü **(Sahibinin kararı)**

Referans: `anasayfa-masaustu.html`.

- **Üst çubuk:**
  - güneş ve "Osman Güneş Özkurt / Klinik Psikolog";
  - menü: Hakkımda, Blog, Kaynaklar, Sık sorulanlar, İletişim;
  - üç seçenekli tema düğmesi, bayraklı dil düğmesi, "Randevu Al".
- **Giriş:**
  - **Solda:** üst satır "KLİNİK PSİKOLOG · ONLINE GÖRÜŞME", büyük başlık, tanıtım paragrafı, "Randevu Al" ve "İlk görüşme nasıl geçer?" düğmeleri, "TPD üyesi · Yanıt süresi" satırı.
  - **Sağda görsel:** Portre stili 1 seçiliyse yuvarlak köşeli büyük portre, köşesinde güneş. Stil 2'de rozetli yuvarlak portre. Fotoğraf yoksa ışık hâleli büyük güneş **(Claude'un kararı; masaüstü taslağı portreden önce onaylanmıştı)**.
- **Son yazılar:** üç kart, "Tüm yazılar →", altında yan yana "Tüm blog yazıları" ve "Popüler yazılar" blokları.
- **Süreç nasıl işler?** Üç adım: Tanışma, Birlikte bir yön, Kendi hızında. Metinler panelden düzenlenir **(Claude'un kararı)**.
- **Sık sorulan sorular:** sorular ve yanında "Merhaba, ben Osman" kartı (→ Hakkımda).
- **Bülten bandı:** ters renkli (gündüz lacivert, gece ayçiçeği).
- **Sayfa sonu:** 112 notu ve © satırı. Masaüstünde sayfa sonunda sosyal simgeler ve yasal bağlantılar olabilir **(Claude'un kararı)**.

### 5.8 Blog ve yazı sayfası **(Sahibinin kararı)**

**Blog listesi**
- **Telefon:**
  - üst satır, "Blog" başlığı ve açıklama;
  - yuvarlak arama kutusu;
  - büyük kapaklı "Yeni yazı" kartı;
  - "Popüler yazılar · Konular" ikilisi ("Konular" kategori listesini açar);
  - diğer yazılar küçük kapaklı kutular hâlinde;
  - "Yeni yazılar e-postana gelsin" kutusu.
- **Masaüstü:**
  - arama ve konu çipleri (Tümü, kategoriler, Popüler);
  - öne çıkan büyük kart ve üçlü kart dizisi;
  - bülten bandı.
- Arama ve süzme ziyaretçinin tarayıcısında, sayfadaki liste üzerinde yapılır. Ek bir sunucu yok **(Claude'un kararı)**.

**Yazı sayfası**
- **Telefon:**
  - üst satırda "← Blog", gündüz/gece ve ENG;
  - ortalanmış konu, başlık ve alt başlık.
  - **Altında, ince bir çizgiden sonra sola yaslı yazar satırı:** güneş (ya da portre küçük resmi), "**Osman Güneş Özkurt** · Klinik Psikolog", altında "12 Ekim 2026 · 4 dk okuma · 👁 1,2B okunma".
  - **Yazar satırında TPD yazmaz** **(Sahibinin kararı)**. TPD yazar kutusunda, Hakkımda'da ve İletişim'de görünür.
- **Kapak:** 16:9, telefonda kenardan kenara (Panel v3 Plan B ile uyumlu).
- **Metin:** Fraunces, ≈18–19 px, satır aralığı ≈1.7, okuma sütunu ≈42rem.
  - İlk paragrafta (ya da sahibinin seçtiği paragrafta) büyük baş harf; renkleri §5.2'de.
  - Alıntılar sarı sol çizgili, yüzey renginde, yuvarlak köşeli bir kutuda.
- **Yazının sonu:**
  - açılır **Kaynakça** (mevcut APA Kaynakça bu kutunun içine taşınır);
  - **Yazıyı paylaş:** cihazın paylaşım menüsü (`navigator.share`), yoksa bağlantıyı kopyala;
  - **Yazar kutusu:** ortalı; güneş ya da portre, ad, "Klinik Psikolog · Türk Psikologlar Derneği üyesi", kısa tanıtım ve "Randevu Al";
  - **Benzer yazılar:** iki kutu.
- **Masaüstü:** aynı içerik, üst çubuklu geniş düzende (`blog.html`); yazar satırı soldan başlar.
- **Okunma sayısı** **(Sahibinin kararı)**:
  - 1.000'in altında olduğu gibi yazılır (ör. "980"). 1.000 ve üstü Türkçe kısaltmayla: "1,2B", "12,5B", "1,2M".
  - İngilizce sayfada "1.2K reads".
  - **50 okunmanın altındaki yazılarda sayı gösterilmez** **(Claude'un kararı; sahibi "tamamdır" dedi)**.
  - Sayılar Panel v3 Plan C'deki kendi sayacımızdan gelir. Sayaç kapalıyken ya da veri yokken sayı hiç görünmez.
  - **Teknik yol kurucuya bırakılmıştır.** Site statik olduğu için iki yol var: (a) sayılar derleme sırasında sayaçtan alınıp sayfaya yazılır ve günlük yeniden derlemeyle güncellenir; (b) sayfa açılınca Apps Script'ten küçük bir istekle okunur. Koşullar: ziyaretçi verisi toplanmaz; sayfa sayıyı beklemeden açılır; sayı gelmezse alan boş kalır.

### 5.9 Diğer sayfalar

Hepsi §5.5'teki telefon diliyle ve masaüstünde üst çubuklu geniş düzenle. Referans: `diger-sayfalar-2.html`.

- **Hakkımda:**
  - portre (yoksa güneş), "Hakkımda", ad ve ünvan, TPD, tanıtım cümlesi (`about.json` `lead`);
  - açılır kutular: "Ben kimim?" (`whoAmI`), "Bu işi neden yapıyorum?" (`whyThisWork`), "Eğitim ve deneyim" (zaman çizelgesi, `timeline`);
  - "Çalışma alanlarım" (`areas`) ikili bloklar hâlinde;
  - "Benimle iletişime geç".
- **Kaynaklar:**
  - başlık ve not (`resources.json` `myNote`);
  - öne çıkan kaynak büyük kartta;
  - "Türüne göre" altılı blok (Kitaplar, Makaleler, Ölçekler, Videolar, Podcastler, Rehberler); dokununca o türün açılır kutusuna gider;
  - türlere göre açılır listeler.
- **İletişim:**
  - güneş, "İletişim", tanıtım (`contact.json` `intro`);
  - büyük "Randevu Al", "E-posta gönder";
  - ikili blok: "Online görüşme" (`workStyle`) ve "Dönüş süresi" (`responseTime`);
  - açılır "Sosyal medyada takip et";
  - TPD üyeliği;
  - kesik çizgili kutuda acil durum notu (`emergencyNote`).
- **Randevu:** Bugünkü içerik yeni görünümde. Faz 3'e kadar işlevi değişmez.
- **Sık sorulanlar:** Kendi sayfası da olur (`/sik-sorulan-sorular/`, `/en/faq/`), masaüstü menüsünden ulaşılır. Aynı veriyi açılır kutularla gösterir; Google için `FAQPage` yapılandırılmış verisi eklenir **(Claude'un kararı)**.
- **Yasal metinler ve 404:** yeni görünüm, içerik aynı.

### 5.10 Portre stilleri **(Sahibinin kararı)**

- **Stil 1 · Arka planda sabit fotoğraf (varsayılan):** §5.6'daki gibi.
- **Stil 2 · Rozetli yuvarlak fotoğraf:**
  - arka plan sade;
  - en üstte büyük (≈112 px) yuvarlak portre, köşesinde güneş rozeti;
  - altında ad ve diğerleri (`portre-ayri.html`, 2. düzen).
- **Seçim:** panelde Site ayarları › Profil ekranında "Ana sayfa görünümü: Arka planda fotoğraf / Yuvarlak fotoğraf" seçeneği. `profile.json`'a isteğe bağlı bir `heroStyle: "background" | "round"` alanı eklenir; varsayılan `"background"`.
- **Fotoğraf yoksa** stil fark etmeksizin güneşli düzen kullanılır: bugünkü bio link taslağı, `biolink-8.html`.

### 5.11 Yeni ve değişen içerik alanları

Hepsi panelden düzenlenir, hepsi TR ve EN, hepsi isteğe bağlı **(Claude'un kararı, sahibinin istekleri üzerine)**.

- **Site adı** (`seo.json` `siteName`): TR "Psikolog Osman Güneş Özkurt", EN "Psychologist Osman Güneş Özkurt" **(Sahibinin kararı)**.
- **Tanıtım cümlesi:** ana sayfadaki tek cümle (`profile.json`'daki mevcut `intro` alanı kullanılabilir).
- **TPD üyeliği:** Profil'de "Mesleki üyelikler" listesi; her satırda kurum ve isteğe bağlı üye numarası. Yapılandırılmış veride `memberOf` olarak gösterilir. Boşsa hiçbir yerde görünmez **(Sahibinin kararı: logo yok, yalnızca yazı ve simge)**.
- **Sık sorulan sorular:** panelde yeni bir ayar ekranı, "Sık sorulan sorular". Soru ve cevap çiftleri sıralanabilir. Başlangıç soruları:
  - İlk görüşme nasıl geçer?
  - Ücret ne kadar, nasıl ödenir?
  - Online görüşme nasıl yapılır?
  - Konuştuklarım gizli kalır mı?
  - Randevuyu iptal edebilir miyim?

  Cevap metinlerini sahibi yazar; kurucu yer tutucu koyar ve `check:launch` yer tutucu kontrolüne ekler.
- **Süreç adımları** (masaüstü ana sayfa): üç başlık ve metin.
- **Substack bağlantısı** `links.json`'a eklenir: `https://substack.com/@klinikterapist` **(Sahibinin kararı)**. Bülten kutuları bu bağlantıyı kullanır.
- **`links.json`** hesaplarına isteğe bağlı `note` alanı (ör. Medium için "İngilizce").
- **Yazar bilgisi her yazıda** (bekleyen liste madde 20):
  - görünür yazar satırı (§5.8);
  - `<meta name="author">` ve `article:author`;
  - yapılandırılmış veride yazarın `jobTitle` ve `url` alanları (Hakkımda);
  - RSS'te yazar adı ve ünvanı.

### 5.12 Ana ekrana eklenebilen uygulama (isteğe bağlı, son aşama) **(Claude'un kararı; sahibine önerildi)**

- `manifest.webmanifest` dosyası:
  - ad "Osman Güneş Özkurt", kısa ad "Güneş";
  - güneş ikonları (192 ve 512 px, "maskable" sürümü dahil);
  - `display: standalone`, tema ve zemin renkleri krem.
- Çevrimdışı önbellek (service worker) **yok**. Yalnızca ana ekrana eklenebilirlik sağlanır; böylece yayınlanan güncellemeler her zaman anında görünür.

## 6. Bekleyen küçük panel düzeltmeleri (sahibinin listesi)

Sahibi tasarım oturumundan önce şunları istemişti. Hepsi panel tarafında, birbirinden bağımsız ve küçük **(Sahibinin kararı; ayrıntılar Claude'un kararı)**:

1. **Önizleme düğmesi:** Önizlemede "Kapat" yerine, aynı yerde "← Düzenlemeye dön".
2. **Yardım simgeleri (?):** Odak kelime alanında, SEO panelinin başlığında, Meta panelindeki dört alanda (SEO başlığı, meta açıklama, URL kısa adı, kapak alt metni) ve yayın kontrol listesinin başlığında. Tıklayınca alanın altında kısa bir açıklama açılır. Metinler sade Türkçe. Kontrol listesi metni sahibine gösterildi:

   > "Yazının yayına hazır olup olmadığını gösterir. Zorunlu maddeler tamamlanmadan yazı yayınlanamaz. Önerilen maddeler yayını engellemez, ama yazının Google'da daha iyi bulunmasına ve herkes için daha erişilebilir olmasına yardım eder. Bir maddeye tıklarsanız ilgili alana gidersiniz."
3. **Site adı:** §5.11.
4. **Paylaşım önizlemesi** (Meta paneli): "KLINIKTERAPIST.COM" satırının altında küçük gri bir satırla site adı. Kartın altında not: "Bazı uygulamalar site adını gösterir, bazıları yalnızca adresi."
5. **Kapak alt metni:** Meta panelinden çıkar, Ayarlar panelinde kapak görselinin hemen altına gelir. Yalnızca kapak varsa görünür; adı "Kapak görselinin alt metni (Türkçe)" / "(İngilizce)". Kontrol listesindeki maddesi Ayarlar paneline işaret eder.
6. **Kontrol listesi kendi paneline geçer:** Yan şeride dördüncü bir simge gelir (yuvarlak içinde tik, Lucide `CircleCheck`). Sıra: Ayarlar, SEO, Meta, Kontrol listesi. Eksik varken Yayınla'ya basılınca bu panel açılır; sarı "eksik" noktası bu simgeye taşınır.
7. Kontrol listesine **? açıklaması** (madde 2'deki metin).
8. **Meta simgesi:** Etiket gibi görünen `Tag` simgesi kalkar. Yerine etiket çağrıştırmayan bir simge gelir (ör. `FileText` ya da `Code`).

## 7. Panel v3'ün kalan planlarıyla ilişki

- **Plan B** (kapak, görsel kırpma ve şekiller, büyük baş harf): `docs/superpowers/plans/2026-10-18-panel-v3-b-gorseller-ve-buyuk-harf.md`. Olduğu gibi geçerli; yalnızca renkler §5.2'ye göre güncellenir:
  - büyük baş harf gündüz lacivert, gece ayçiçeği (planda orman yeşili yazıyor);
  - şekilli görsellerin köşe yarıçapları yeni kutu diline uyar.
- **Plan C** (yayın planlama, sayaç, istatistik panosu): `...-panel-v3-c-planlama-ve-istatistik.md`. Geçerli. Sayaç §5.8'deki okunma sayısını ve "Popüler yazılar"ı besler. Plan C'deki yasal metin güncellemesine §5.4'teki tema tercihi cümlesi de eklenir.

## 8. Kısıtlar

- Mevcut yapı korunur: Astro 7 + Sätteri, statik yayın (GitHub Pages), React yalnızca panelde, Apps Script arka tarafı. Yeni sunucu ya da ücretli hizmet yok.
- `npm test`, `npm run test:build` ve `npm run check` (astro check) yeşil kalmalı. Yeni ve değişen bileşenler için derleme testleri yazılmalı. Örneğin:
  - her sayfa iki temada render olur;
  - tema betiği `<head>`'in başında;
  - ana sayfada sosyal hesaplar ve SSS açılır kutuları var;
  - okunma sayısı 50'nin altında görünmez;
  - kısaltma biçimi doğru.
- Kontrast her iki temada bir testle doğrulanmalı. Ana renk çiftleri için WCAG formülüyle küçük bir birim testi yeterli.
- Telefonda (iPhone Safari) denenmeli: yapışkan fotoğraf, kart, alttaki çubuk ve çentik boşlukları.
- Bütün metinler TR ve EN.
- Sahibinin açık onayı olmadan `main`'e push edilmez.

## 9. Sıralama

İş `main`'den açılan ayrı bir dalda yapılır. Aşamalar sırayla ilerler ve her biri kendi başına çalışır **(Claude'un kararı)**:

1. **Panel düzeltmeleri** (§6, 8 madde) ve **Substack bağlantısı**: küçük ve bağımsız; önce bitip sahibinin elinde olsun.
2. **Marka temeli:** güneş SVG'si ve ikon dosyaları, klinikterapist SVG'si, `tokens.css`'in iki moda bölünmesi, tema betiği ve düğmeleri (§5.1–5.4).
3. **Telefon dili ve ortak parçalar:** üst satır, kutu, açılır kutu, ikili blok, alttaki çubuk, sayfa sonu (§5.5). İçerik alanları da burada: site adı, TPD, SSS ekranı, `heroStyle`, link `note` (§5.11).
4. **Ana sayfa:** telefon (iki portre stiliyle) ve masaüstü (§5.6, §5.7, §5.10).
5. **Blog ve yazı sayfası** (§5.8; okunma sayısı yeri hazırlanır, veri Plan C'den gelir).
6. **Diğer sayfalar** (§5.9) ve yazar meta verileri (§5.11).
7. **Ana ekran uygulaması** (§5.12).
8. Ardından Panel v3 Plan B, sonra Plan C.

## 10. Kurucu kontrolünden çıkan kararlar **(hepsi Claude'un kararı)**

Bağımsız bir okuyucu belgeyi "uygulamayı planlayacak kişi" gözüyle okudu. Sorularının hiçbiri sahibinin kararını gerektirmiyordu; aşağıdaki gibi karara bağlandı:

- **Okunma sayısı ve "Popüler yazılar" verisi:**
  - **Kaynak:** Sayılar derleme sırasında sayaçtan (Plan C, `stats.summary`'nin herkese açık, yalnızca yazı başına toplam okumayı döndüren küçük bir uç noktası) okunup sayfaya yazılır.
  - **Güncelleme:** `deploy.yml`'e günde bir kez çalışan zamanlanmış bir derleme (`schedule: cron`) eklenir. Depo herkese açık olduğu için GitHub Actions dakikası sorun değil.
  - **Hata durumu:** Uç noktaya ulaşılamazsa derleme durmaz, sayılar gösterilmez.
- **Sayaç verisi yokken "Popüler yazılar":**
  - Sahibinin panelde "öne çıkan" olarak işaretlediği yazılar gösterilir. Yazılara isteğe bağlı bir `featured: true` alanı eklenir; Ayarlar panelinde bir anahtar olur.
  - Hiç öne çıkan yazı da yoksa blok gizlenir. "Tüm blog yazıları" tek başına satırı kaplar; blog listesindeki "Popüler · Konular" ikilisinde "Konular" satırı kaplar.
- **Mevcut içeriğin yeni yerleri:**
  - **`home.json` kartları:**
    - Telefondaki ana sayfa kutularının kaynağı bu kartlar. "Site ana sayfası" ayarından başlık ve alt yazıları düzenlenmeye devam eder.
    - `about` kartı "Hakkımda" kutusunu, `resources` kartı "Kaynaklar" kutusunu oluşturur.
    - `blog` kartının başlık ve alt yazısı "Tüm blog yazıları" bloğunda kullanılır.
    - `contact` kartı telefondaki ana sayfa listesinde gösterilmez; onaylanan tasarımda yok, çünkü "Randevu Al" ve sosyal kutu bu işi görüyor. Masaüstü menüsünde İletişim yer alır.
    - `visible: false` olan kart hiçbir yerde görünmez.
  - **`profile.tagline`** ("Daha iyi bir yaşam mümkün."): masaüstü girişin büyük başlığı olur. `profile.intro` başlığın altındaki paragraf ve telefondaki tanıtım cümlesidir. Telefonda tagline gösterilmez.
  - **"İlk görüşme nasıl geçer?" düğmesi** Sık sorulanlar sayfasındaki ilk soruya gider (`/sik-sorulan-sorular/#ilk-gorusme`). Masaüstündeki "Merhaba, ben Osman" kartı Hakkımda sayfasına gider.
- **Sık sorulanlar sayfasının adresleri:** `/sik-sorulan-sorular/` ve `/en/faq/`. `src/i18n/routes.ts`'e yeni bir sayfa olarak eklenir; dil düğmesi, site haritası ve hreflang otomatik çalışır. Yönlendirme gerekmez, çünkü yeni sayfa.
- **Tema düğmesi** bütün sayfalarda geçerlidir: yasal metinler, 404, yönlendirme sayfaları dahil.
- **Portre ilk yayında:**
  - `profile.json`'da fotoğraf yok. Sahibinin bu tasarım için verdiği portre, kurucu tarafından sitenin profil fotoğrafı olarak eklenir. Kaynak: `C:\Users\ogune\Desktop\Klinik Terapist\Fotoğraflar\portre.webp`. Panelin mevcut profil fotoğrafı yükleme biçimi ve yolu kullanılır, böylece sahibi sonra panelden değiştirebilir.
  - Derleme testleri üç durumu kapsar: fotoğraflı stil 1, fotoğraflı stil 2, fotoğrafsız.
  - Yüzün dikey odak noktası CSS'te sabittir (`object-position` ≈ %25); panel alanı gerekmez.
- **Dal ve yayın:** Tek dal, her aşama ayrı commit'lerle. Plan A ile birlikte yayına alma (push) yalnızca sahibinin açık onayıyla yapılır. 1. aşama (panel düzeltmeleri) bitince sahibine "şimdi yayınlayalım mı?" diye sorulur.

## 11. Kurucuya bırakılanlar

- Güneş SVG'sinin temizlenmesi (karakter korunarak) ve klinikterapist SVG'sinin çıkarılması.
- Telefonda "Sistem" moduna dönüş yolu (§5.4).
- Okunma sayısının siteye taşınma yolu (§5.8'deki koşullarla).
- Bileşen yapısı (Astro bileşenleri) ve CSS düzeni.
- Masaüstü sayfa sonu içeriği (sosyal simgeler, yasal bağlantılar).
- Yardım (?) açıklamalarının metinleri; panelde sade Türkçe ve kısa olmalı.
