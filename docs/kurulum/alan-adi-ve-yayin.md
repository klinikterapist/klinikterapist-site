# Siteyi yayına alma rehberi (klinikterapist.com)

Bu rehber teknik bilgi gerektirmez. Adımları sırayla izleyin; takıldığınız yerde ekran görüntüsünü Claude'a gönderin.

Kaynak (GitHub'ın resmi belgesi): https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site

> `klinikterapist` yazan her yere kendi GitHub kullanıcı adınızı yazın.

## 1. GitHub'da depo (repository) oluşturma

1. https://github.com adresine girin ve hesabınızla oturum açın.
2. Sağ üstte **+** simgesine, sonra **New repository** (Yeni depo) seçeneğine tıklayın.
3. **Repository name** kutusuna `klinikterapist-site` yazın.
4. **Public** (Herkese açık) seçeneğini işaretleyin.
5. **Dikkat:** "Add a README file", "Add .gitignore" ve "Choose a license" kutularını **işaretlemeyin**. Depo boş olmalı.
6. Yeşil **Create repository** düğmesine basın.
7. Açılan sayfadaki adresi (`https://github.com/klinikterapist/klinikterapist-site`) Claude'a gönderin. Dosyaları oradan yükleyecek (push) kişi Claude/yöneticidir; siz bir şey yüklemeyeceksiniz. Gerekirse sizden erişim izni vermeniz istenir.

## 2. Pages ayarları

Dosyalar yüklendikten sonra:

1. Deponuzda üstteki **Settings** (Ayarlar) sekmesine tıklayın.
2. Sol menüde **Pages** yazısına tıklayın.
3. **Build and deployment** bölümünde **Source** kutusunu **GitHub Actions** yapın.
4. Aşağıdaki **Custom domain** kutusuna `klinikterapist.com` yazıp **Save**'e basın. (DNS henüz hazır değilse bir uyarı görebilirsiniz; 4. adımdan sonra düzelir.)
5. **Enforce HTTPS** kutusu aktif olunca işaretleyin. Sertifika hazırlanırken kutu gri kalabilir; bu **24 saate kadar** sürebilir. Bekleyip tekrar bakın.

## 3. Alan adı doğrulaması (önerilir)

Başkalarının alan adınızı kendi GitHub hesabına bağlamasını engeller. **Bu adımı 4. adımdaki DNS işlemiyle birlikte yapın:** GitHub size bir TXT kaydı verecek, onu DNS panelini açtığınızda A/AAAA/CNAME kayıtlarıyla aynı oturumda ekleyeceksiniz.

1. GitHub'da sağ üstte profil resminize, sonra **Settings**'e tıklayın (bu sefer deponun değil, hesabınızın ayarları).
2. Sol menüde **Pages**'e tıklayın.
3. **Add a domain** düğmesine basın, `klinikterapist.com` yazın.
4. GitHub size bir **TXT kaydı** gösterir (ad ve değer). Bunu DNS panelinde (4. adım) yeni bir **TXT** kaydı olarak ekleyin. **Mevcut TXT kayıtlarını silmeyin ya da değiştirmeyin; bu kaydı yenisi olarak EKLEYİN.** Sonra GitHub sayfasında **Verify** düğmesine basın (birkaç dakika sürebilir).

## 4. DNS ayarları

### DNS'i nerede yöneteceğinizi bulma

Alan adı Google üzerinden alındıysa: Google Domains 2023'te **Squarespace Domains**'e devredildi. Çoğu zaman DNS ayarları orada, https://domains.squarespace.com adresindedir. Alan adını **Google Workspace** veya **Google Cloud Domains** üzerinden aldıysanız DNS Squarespace'te ya da Cloud DNS'te olabilir. Nerede olduğunu bulmak için:

1. https://admin.google.com adresine yönetici hesabıyla girin.
2. **Hesap (Account) > Alan adları (Domains) > Alan adlarını yönet (Manage domains)** bölümüne gidin.
3. `klinikterapist.com` satırındaki bilgi/ayar bağlantısı DNS'in hangi hizmette olduğunu gösterir. Emin olamazsanız ekran görüntüsünü Claude'a gönderin.

> **UYARI: Google Workspace e-posta kayıtlarına DOKUNMAYIN.**
> Mevcut **MX** ve **TXT** kayıtlarını (SPF, DKIM, `google-site-verification` ile başlayanlar) **silmeyin/değiştirmeyin** (yeni TXT eklemek sorun değil). Aksi halde e-postalarınız çalışmayı durdurur.
> Yalnızca şunları kaldırın: başka bir yere işaret eden eski **A**, **AAAA** kayıtlarını ve **www** için olan **CNAME** kaydını (örneğin Squarespace'in "park" sayfası kayıtları).

### Eklenecek kayıtlar

DNS panelinde **Add record / Kayıt ekle** deyip şunları girin. Ana alan adı için "Host" kutusu genellikle `@` olur (veya boş bırakılır).

| Tür | Host | Değer |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| AAAA | @ | 2606:50c0:8000::153 |
| AAAA | @ | 2606:50c0:8001::153 |
| AAAA | @ | 2606:50c0:8002::153 |
| AAAA | @ | 2606:50c0:8003::153 |
| CNAME | www | `klinikterapist.github.io` |

CNAME değerinde depo adını yazmayın; yalnızca `klinikterapist.github.io`. Değişikliklerin yayılması 24 saate kadar sürebilir. Bu değerler GitHub'ın yukarıdaki güncel belgesinden doğrulanmıştır.

Ayrıca 3. adımdaki doğrulama TXT kaydını da şimdi, burada ekleyin. Mevcut TXT kayıtlarını silmeyin ya da değiştirmeyin; bu kaydı yenisi olarak EKLEYİN.

## 5. Kontrol

1. https://klinikterapist.com adresini açın: site, adres çubuğunda kilit simgesiyle (https) açılmalı. İngilizce kısım: https://klinikterapist.com/en/
2. `www.klinikterapist.com` yazın: otomatik olarak `klinikterapist.com`'a yönlenmeli.
3. Workspace e-posta adresinize başka bir adresten test e-postası gönderin ve gelip gelmediğine bakın. Gelmiyorsa DNS'te MX kayıtlarına dokunulmuş olabilir; hemen Claude'a haber verin.

## 6. Google Search Console

1. https://search.google.com/search-console adresine girin.
2. **Mülk ekle (Add property)** > **Alan adı (Domain)** kutusuna `klinikterapist.com` yazın.
3. Google bir **TXT kaydı** verir; 4. adımdaki gibi DNS paneline ekleyip **Doğrula**'ya basın. Mevcut TXT kayıtlarını silmeyin ya da değiştirmeyin; bu kaydı yenisi olarak EKLEYİN. (Faz 2'ye kadar doğrulama kodunu Claude'a gönderin, o yerleştirir.)
4. Sol menüde **Site Haritaları (Sitemaps)** bölümüne `https://klinikterapist.com/sitemap-index.xml` yazıp gönderin.

## Yazı yayın düzeni

1. Her yazıyı **önce kendi sitenizde** yayınlayın. Orijinal kaynak burası olsun.
2. **Medium:** "Import a story" (Hikâye içe aktar) özelliğini kullanın ve sitedeki yazının adresini yapıştırın. Medium, orijinal adresi otomatik olarak "canonical" (asıl kaynak) olarak işaretler; Google yinelenen içerik saymaz.
3. **Substack:** yazının tamamını değil, **kısa bir özetini** veya **farklı bir versiyonunu** koyun, sonuna sitedeki yazının bağlantısını ekleyin.

## Yayın öncesi doldurulacaklar

Sitede şu an yer tutucu bilgiler var: örnek e-posta adresi (example.com), profil bağlantıları (LinkedIn, Medium, Substack), `[Üniversite Adı]` gibi üniversite adları, hukuki metinler (taslak) ve unvan. Bunlar gerçek bilgiyle değişmeden site yayına çıkmamalıdır.

Bunu otomatik bir kontrol sağlar: `npm run check:launch`. Yer tutucu kaldıkça kontrol hata verir ve GitHub'daki yayın işlemi **bilerek durur**; yani yarım bilgili site yayına girmez.

Sizin yapmanız gereken tek şey: gerçek e-posta adresinizi, profil bağlantılarınızı, üniversite adlarınızı, hukuki metinleri ve unvanınızı Claude'a göndermek. Gerisini Claude doldurur ve kontrol geçince site yayınlanır.
