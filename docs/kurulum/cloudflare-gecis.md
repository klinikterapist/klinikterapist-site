# Cloudflare'e geçiş rehberi (klinikterapist.com)

Bu rehberi Claude ile birlikte, bilgisayar başındayken uygulayın. Toplam süre yaklaşık 1 saat. Alan adı adımından sonra e-postanın ve sitenin tam oturması birkaç saat sürebilir. Bu sürede site açık kalır.

## Ne değişiyor, ne değişmiyor

- **Değişmeyenler:** Yazılarınız ve kodlar GitHub'da kalır. Panel (`/admin/`) aynı şekilde çalışır. Yayınla'ya bastığınızda site yine GitHub'da hazırlanır. Panelin "Yayında ✓" göstergesi de değişmez. E-postanız (Google Workspace) aynı kalır.
- **Değişen:** Hazırlanan site, ziyaretçilere GitHub Pages yerine Cloudflare Pages üzerinden sunulur. Alan adının "adres defteri" (DNS) da Squarespace'ten Cloudflare'e taşınır.
- **Ücret:** Cloudflare'in ücretsiz planı yeterli.

## Bugünkü alan adı kayıtları (20 Ekim 2026'da okundu)

Bu liste Cloudflare'e taşınırken **birebir korunmalı**. Özellikle e-posta satırları eksik kalırsa e-posta gelmez.

| Tür | Ad | Değer | Ne işe yarar |
|---|---|---|---|
| MX | `@` (klinikterapist.com) | `smtp.google.com`, öncelik 1 | **E-posta** gelişi (Google Workspace) |
| TXT | `@` | `v=spf1 include:_spf.google.com ~all` | **E-posta**: gönderdiğiniz postaların spam sayılmaması |
| TXT | `google._domainkey` | `v=DKIM1; k=rsa; p=MIIBIjANBgkq…` (uzun anahtar; Cloudflare tarayınca kendisi getirir, sonundaki `…IDAQAB` dahil tam olmalı) | **E-posta** imzası |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:merhaba@klinikterapist.com` | **E-posta**: alan adınız adına sahte e-posta gönderilmesine karşı (22 Ekim 2026'da eklendi) |
| A | `@` | 185.199.108.153, .109.153, .110.153, .111.153 | Bugünkü site (GitHub). **Geçişte silinecek.** |
| AAAA | `@` | 2606:50c0:8000::153 … 8003::153 | Bugünkü site (GitHub). **Geçişte silinecek.** |
| CNAME | `www` | `klinikterapist.github.io` | Bugünkü site (GitHub). **Geçişte silinecek.** |

Alan adı şu an Squarespace'te kayıtlı (ad sunucuları `nsd1…nsd4.squarespacedns.com`).

**DNSSEC açık (22 Ekim 2026'da görüldü):** Squarespace alan adında DNSSEC'i açık tutuyor (`.com` kaydında bir DS satırı var, süresi 24 saat). Ad sunucuları DNSSEC kapatılmadan değiştirilirse alan adı (site **ve e-posta**) bir güne kadar açılmaz. Sıra şöyle olmalı: önce Squarespace'te DNSSEC'i kapatın, Claude DS satırının kalktığını görene kadar bekleyin (genelde 1 gün), sonra ad sunucularını değiştirin. Taşıma bitince DNSSEC'i Cloudflare'de açıp verdiği DS bilgisini Squarespace'e girin.

**pages.dev Türkiye'de açılmıyor olabilir:** 22 Ekim'de Türkiye'deki bağlantıdan `klinikterapist.pages.dev` açılmadı (internet sağlayıcısı `pages.dev` adlarını engelliyor). Bu yalnızca deneme adresini etkiler; ziyaretçiler siteyi `klinikterapist.com` adresinden açar.

## 0. Önce: iki adımlı doğrulama

Google (merhaba@klinikterapist.com), GitHub ve açacağınız Cloudflare hesabında iki adımlı doğrulamayı açın. Site bu hesaplara emanet olacak.

## 1. Cloudflare hesabı

1. **dash.cloudflare.com/sign-up** adresinde merhaba@klinikterapist.com ile ücretsiz hesap açın. Şifreyi kendiniz belirleyin, Claude'a söylemeyin.
2. İki adımlı doğrulamayı açın: **My Profile › Authentication**.

## 2. Pages projesi (adı tam olarak `klinikterapist`)

1. Sol menüden **Workers & Pages › Create › Pages › Upload assets** (ya da "Direct Upload") seçin.
2. Proje adına `klinikterapist` yazın.
3. Sizden dosya isterse, Claude'un hazırlayacağı küçük bir klasörü (`index.html` içeren) yükleyin. Asıl site sonraki adımda GitHub'dan gelecek.

## 3. Cloudflare anahtarı (GitHub'ın siteyi gönderebilmesi için)

1. **My Profile › API Tokens › Create Token › Create Custom Token** açın.
2. Ad olarak "GitHub site yayını" yazın. İzin satırını şöyle seçin: **Account › Cloudflare Pages › Edit**.
3. **Continue to summary › Create Token** deyin. Çıkan anahtarı bir kez gösterir: kopyalayın, Claude'a **vermeyin**, doğrudan 4. adımda GitHub'a yapıştırın.
4. Hesap kimliği (Account ID): **Workers & Pages** sayfasının sağında "Account ID" yazar. Bunu da kopyalayın.

## 4. GitHub ayarları

`github.com/klinikterapist/klinikterapist-site` › **Settings › Secrets and variables › Actions**:

1. **Secrets** sekmesinde **New repository secret** ile iki gizli değer ekleyin:
   - `CLOUDFLARE_API_TOKEN` = 3. adımdaki anahtar
   - `CLOUDFLARE_ACCOUNT_ID` = hesap kimliği
2. **Variables** sekmesinde **New repository variable** ile şunu ekleyin: `DEPLOY_TARGET` = `cloudflare`.
3. **Actions › Deploy to GitHub Pages › Run workflow** ile bir yayın başlatın. Yeşil tik gelince `https://klinikterapist.pages.dev` adresinde site görünmeli.

Bu andan sonra site GitHub Pages'e değil Cloudflare'e gönderilir. Alan adı henüz GitHub'ı gösterdiği için ziyaretçiler hâlâ son GitHub sürümünü görür. Bu ara dönemde yayınladığınız yazılar 5. adım bitince görünür. Bu yüzden 4 ve 5. adımları aynı oturumda yapın.

## 5. Alan adını Cloudflare'e taşımak

1. Cloudflare'de **Add a domain** › `klinikterapist.com` › **Free** planı seçin. Cloudflare mevcut kayıtları tarar.
2. Taranan listeyi yukarıdaki tabloyla karşılaştırın: MX, SPF (TXT), `google._domainkey` (TXT) ve `_dmarc` (TXT) **mutlaka** listede olsun. Eksik varsa **Add record** ile ekleyin.
3. GitHub'a ait A, AAAA ve `www` CNAME kayıtlarını silin (tabloda "silinecek" yazanlar).
4. **DNSSEC kapalı olmalı** (yukarıdaki nota bakın; Claude DS satırının kalktığını doğrulamadan bu adıma geçmeyin). Cloudflare size iki ad sunucusu verir (örneğin `xxx.ns.cloudflare.com`). Squarespace'te **Domains › klinikterapist.com › DNS › Nameservers › Use custom nameservers** yolunu izleyip bu ikisini yazın ve kaydedin.
5. Cloudflare'de alan adı "Active" olunca (birkaç dakikadan birkaç saate kadar sürebilir) **Workers & Pages › klinikterapist › Custom domains** ekranına gidin. Önce `klinikterapist.com`, sonra `www.klinikterapist.com` ekleyin. Gerekli kayıtları Cloudflare kendisi oluşturur.
6. **SSL/TLS** ayarı "Full" olsun. **Always Use HTTPS** açık olsun.

### Kontrol listesi (Claude ile)

- [ ] `https://klinikterapist.com` ve `https://www.klinikterapist.com` açılıyor, kilit simgesi var.
- [ ] Başka bir adresten merhaba@klinikterapist.com'a e-posta gönderin: geliyor. Sizden bir dış adrese gönderin: spam'e düşmüyor.
- [ ] Panelde bir yazının küçük bir yerini değiştirip yayınlayın: "Yayında ✓" çıkıyor ve değişiklik sitede görünüyor.
- [ ] İletişim formu, randevu sayfası ve okunma sayaçları çalışıyor.
- [ ] Search Console'da site hâlâ doğrulanmış görünüyor (doğrulama dosyası sitede kalıyor).

## 6. GitHub Pages'i kapatmak

Her şey bir gün sorunsuz çalıştıktan sonra **Settings › Pages** ekranına gidin ve yayını kapatın (Source: None / Unpublish). Claude da `public/CNAME` dosyasını ve iş akışındaki GitHub Pages adımlarını kaldırır.

**Depoyu gizli yapmak (isteğe bağlı):** **Settings › General › Danger Zone › Change visibility › Private**. Panel ve yayın çalışmaya devam eder, çünkü GitHub anahtarı bu depoya zaten erişebiliyor. Planlı yayınlar da GitHub'a ancak zamanı gelince gider.

## 7. Gizlilik metinleri

Geçiş bitince Claude, Gizlilik ve Aydınlatma metinlerinde (TR + EN) barındırma sağlayıcısını değiştirir. Önerilen metin:

> **Barındırma:** Site, Cloudflare Pages üzerinden yayınlanır. Cloudflare, hizmetin güvenliği ve işletilmesi için IP adresi gibi teknik kayıtları kendi [gizlilik politikası](https://www.cloudflare.com/privacypolicy/) çerçevesinde işleyebilir. Sitenin kaynak dosyaları GitHub'da tutulur.

Aydınlatma metnindeki "site barındırma hizmeti GitHub" ifadesi de "site barındırma hizmeti Cloudflare" olur. Metinleri siz onaylamadan yayınlanmaz.

## Geri dönüş (bir sorun olursa)

1. GitHub'da `DEPLOY_TARGET` değişkenini silin. Yayınlar yeniden GitHub Pages'e gider. (GitHub Pages'i 6. adımda kapattıysanız önce yeniden açın.)
2. Squarespace'te ad sunucularını yeniden **Use Squarespace nameservers** yapın. Tablodaki eski kayıtlar orada durur.
