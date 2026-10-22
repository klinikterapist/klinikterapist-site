# Yönetim paneli kurulum rehberi (klinikterapist.com/admin)

Bu rehber teknik bilgi gerektirmez. Adımları sırayla izleyin; takıldığınız yerde ekran görüntüsünü Claude'a gönderin.

Kurulum bir kez yapılır. Sonrasında yalnızca **5. bölümdeki** günlük kullanım ve yılda bir kez **GitHub anahtarını yenileme** kalır.

**Şifre ve anahtar kuralı:** Şifrenizi ya da GitHub anahtarını hiçbir zaman Claude'a yazmayın. Anahtarı yalnızca 3. adımda gösterilen yere siz yapıştırırsınız. Claude'a göndereceğiniz iki bilgi (Google istemci kimliği ve web uygulaması adresi) gizli değildir; zaten sitenin kodunda herkese açık durur.

---

## 1. Google ile giriş için istemci kimliği (Google Cloud)

Panelde "Google ile giriş yap" düğmesinin çalışması için Google'a panelin adresini tanıtırız.

1. https://console.cloud.google.com adresine **merhaba@klinikterapist.com** hesabıyla girin.
2. Üstteki proje seçicisine, sonra **Yeni proje**'ye tıklayın. Ad: `klinikterapist-panel`. **Oluştur**'a basın ve projenin seçili olduğundan emin olun.
3. Sol menüden **API'ler ve Hizmetler › OAuth izin ekranı** (bazı hesaplarda **Google Auth Platform › Marka bilgileri**) sayfasını açın.
   - Kullanıcı türü olarak **Dahili (Internal)** seçin. Böylece yalnızca Workspace hesabınız giriş yapabilir.
   - Uygulama adı: `Klinikterapist Panel`. Destek e-postası: `merhaba@klinikterapist.com`. Kaydedin.
4. **Kimlik bilgileri** (ya da **İstemciler**) sayfasında **Kimlik bilgisi oluştur › OAuth istemci kimliği**'ni seçin.
   - Uygulama türü: **Web uygulaması**. Ad: `Panel`.
   - **Yetkilendirilmiş JavaScript kaynakları** bölümüne iki adres ekleyin:
     - `https://klinikterapist.com`
     - `http://localhost:4321`
   - Yönlendirme URI'si **eklemeyin**. **Oluştur**'a basın.
5. Ekranda **İstemci kimliği** (`…apps.googleusercontent.com` ile biter) görünür. Bunu Claude'a gönderin. (İstemci gizli anahtarına gerek yok; onu kimseye göndermeyin.)

**Ne göreceksiniz:** "OAuth istemcisi oluşturuldu" penceresi ve uzun bir kimlik.

## 2. Apps Script (panelin arka tarafı)

Panelin yazdıklarınızı GitHub'a kaydetmesi ve taslakları Drive'ınızda tutması için hesabınızda küçük bir Google Apps Script uygulaması çalışır.

1. https://script.google.com/home/usersettings adresini açın ve **Google Apps Script API** anahtarını **Açık** yapın.
2. Claude bilgisayarda bir komut çalıştırır ve tarayıcıda bir Google giriş penceresi açılır. **merhaba@klinikterapist.com** ile giriş yapıp istenen izinleri onaylayın. (Bu, Claude'un kodu sizin hesabınıza yükleyebilmesi içindir.)
3. Claude kodu yükler ve uygulamayı yayınlar. Size bir **Apps Script düzenleyici** bağlantısı gönderir.

## 3. GitHub anahtarı

Panel GitHub'a bu anahtarla yazar. Anahtar yalnızca sizin Apps Script ayarlarınızda durur; tarayıcıya ya da siteye hiç gitmez.

1. GitHub'da sağ üstte profil resminize, sonra **Settings › Developer settings › Personal access tokens › Fine-grained tokens**'a tıklayın.
2. **Generate new token**'a basın.
   - **Token name:** `klinikterapist-panel`
   - **Expiration:** 1 yıl (366 gün). Panel, süre dolmadan 30 gün önce sizi uyarır.
   - **Resource owner:** deponun sahibi olan hesap (`klinikterapist`).
   - **Repository access:** **Only select repositories** › `klinikterapist-site`. Başka depo seçmeyin.
   - **Permissions › Repository permissions:**
     - **Contents:** Read and write
     - **Actions:** Read-only
     - **Metadata:** Read-only (kendiliğinden seçilir)
3. **Generate token**'a basın ve görünen anahtarı (`github_pat_…`) kopyalayın. **Bu anahtarı Claude'a göndermeyin.**
4. Claude'un gönderdiği Apps Script düzenleyici bağlantısını açın. Soldaki **⚙ Proje ayarları**'na tıklayın, sayfanın altındaki **Komut dosyası özellikleri** bölümünde **Komut dosyası özelliği ekle**'ye basın ve şu beş satırı ekleyin:

   | Özellik | Değer |
   |---|---|
   | `GITHUB_TOKEN` | kopyaladığınız anahtar |
   | `GOOGLE_CLIENT_ID` | 1. adımdaki istemci kimliği |
   | `OWNER_EMAIL` | `merhaba@klinikterapist.com` |
   | `GITHUB_REPO` | `klinikterapist/klinikterapist-site` |
   | `GITHUB_BRANCH` | `main` |

5. **Komut dosyası özelliklerini kaydet**'e basın.

## 4. İlk izin

1. Apps Script düzenleyicide soldaki **‹› Düzenleyici**'ye dönün.
2. Üstteki işlev listesinden **doGet**'i seçip **Çalıştır**'a basın.
3. "Yetkilendirme gerekli" penceresinde **İzinleri incele**'ye basın, hesabınızı seçin ve **İzin ver**'e tıklayın. Uygulama iki izin ister: **Drive** (taslaklar için "Klinikterapist Panel" klasörü) ve **harici istek** (GitHub'a ve Google girişini doğrulamaya bağlanmak için).

**Ne göreceksiniz:** Alttaki yürütme günlüğünde "Yürütme tamamlandı" yazısı.

Bundan sonra Claude panelin son ayarını yapar ve sizden **yayına alma (push) onayı** ister.

## 5. Günlük kullanım

- **Giriş (iki adım):** https://klinikterapist.com/admin adresini açın. **1. adım:** panelin kullanıcı adı ve şifresi. **2. adım:** **Google ile giriş yap**, ardından sitenin sahibi olan Google hesabınızı kendiniz seçin (sayfa hesap adını yazmaz, Google da kendiliğinden seçmez). Giriş 12 saat geçerlidir; sonra yeniden giriş istenir.
  - **İlk kez:** şifre henüz belirlenmemişse yalnızca Google sorulur ve panel hemen "Panel şifrenizi belirleyin" penceresini açar. Kullanıcı adı ve şifreyi siz seçersiniz; Claude'a yazmayın.
  - **Değiştirmek:** **Ayarlar › Giriş Bilgileri**. Şu anki şifre istenir.
  - **5 yanlış deneme:** giriş 15 dakika kapanır ve size "Panel girişinde art arda yanlış şifre" e-postası gelir.
  - **Şifreyi unutursanız:** script.google.com › "Klinikterapist Panel" › **Proje ayarları › Komut dosyası özellikleri**'nde `PANEL_LOGIN` satırını silin. Sonraki girişte yalnızca Google sorulur ve panel yeni şifre ister.
  - **En güçlü koruma:** Google hesabınızda **2 adımlı doğrulama** açık olsun (myaccount.google.com › Güvenlik).
- **Yazı yazmak:** **Yazılar › Yeni yazı**. Türkçe ve İngilizce sekmelerini ayrı ayrı doldurun. Metni seçince küçük bir araç çubuğu açılır (kalın, italik, alt başlık, bağlantı, alıntı). Boş bir satırın başındaki **+** ile görsel, ayraç, YouTube videosu ya da vurgu kutusu eklenir.
- **Otomatik kayıt:** Yazdıklarınız birkaç saniyede bir Drive'ınızdaki "Klinikterapist Panel" klasörüne kaydedilir. Sağ üstteki yazı durumu gösterir:
  - **Taslak kaydedildi:** her şey güvende.
  - **Kaydediliyor…:** birkaç saniye bekleyin.
  - **Bağlantı yok — bu cihazda saklandı:** internet gelince kendiliğinden tekrar denenir. Sayfayı kapatsanız bile yazı bu cihazda durur; tekrar açtığınızda "Geri yükle" önerilir.
  - **Başka bir cihazda daha yeni bir kopya var:** aynı taslağı telefonda ve bilgisayarda açtıysanız hangisinin kalacağını siz seçersiniz.
- **Yayınlamak:** İki dil de tamamlanınca **Yayınla** düğmesi açılır. Eksik kalanlar düğmenin altında listelenir. SEO panelindeki kırmızı ışıklar yayını engellemez, yalnızca öneridir.
- **"Site güncelleniyor (1–3 dk)":** Değişiklik GitHub'a kaydedildi, site yeniden hazırlanıyor. Bu sırada çalışmaya devam edebilirsiniz. **"Yayında ✓"** görününce değişiklik sitededir.
- **"Yayın başarısız oldu":** Sitede eski sürüm durmaya devam eder, hiçbir şey bozulmaz. Ekran görüntüsünü Claude'a gönderin.
- **Adres değiştirmek:** Yayındaki bir yazının ya da kategorinin adresini değiştirirseniz eski adres yenisine otomatik yönlendirilir.
- **Yayından kaldırmak:** Yazı sitede görünmez, taslaklara döner; eski adresler blog sayfasına yönlenir.
- **Medium:** Yazı yayınlandıktan sonra Medium › **Import a story** ile yazının adresini verin (Medium kaynağı otomatik ekler). Substack'e özet ya da farklı bir versiyon koyun.

## 6. Yılda bir: GitHub anahtarını yenileme

Panel süre dolmadan 30 gün önce sarı bir uyarı gösterir. Süre dolarsa kaydetme sırasında "GitHub bağlantı anahtarının süresi dolmuş" mesajı çıkar; yazılarınız Drive'da güvende kalır.

1. 3. adımdaki gibi yeni bir anahtar oluşturun (aynı ayarlar).
2. Apps Script › **Proje ayarları › Komut dosyası özellikleri**'nde `GITHUB_TOKEN` değerini yeni anahtarla değiştirip kaydedin.
3. GitHub'da eski anahtarı silebilirsiniz (**Fine-grained tokens** listesinde **Delete**).

## 7. Planlı yayın için tek seferlik izin

Yazıyı ileri bir tarihe planlayabilmek için panelin arka tarafı saatte bir kendi kendine çalışır. Bunun için Google bir kez ek izin ister.

1. Bu özellik ilk kez yüklendiğinde (Claude `npm run gas:push`, sonra `npm run gas:deploy` çalıştırdıktan sonra) Apps Script düzenleyicisini açın: **script.google.com** › "Klinikterapist Panel" projesi.
2. Üstteki işlev listesinden **hourly** seçip **Çalıştır**'a basın.
3. "Yetkilendirme gerekli" penceresi çıkar. **İzinleri gözden geçir**'e basın, merhaba@klinikterapist.com hesabını seçin. "Google bu uygulamayı doğrulamadı" uyarısında **Gelişmiş** › **Klinikterapist Panel'e git (güvenli değil)** deyin. Bu uygulamayı siz yazdırdınız, uyarı bu yüzden çıkar. Sonra **İzin ver**'e basın. Yeni izin, "komut dosyası tetikleyicilerini yönetme" iznidir.
4. Panele dönün, bir yazıyı ileri bir saate planlayın. Panel saatlik çalışmayı kendisi kurar.
5. Kontrol: Apps Script › sol menüde **Tetikleyiciler** (saat simgesi) ekranında `hourly`, "Saat başı zamanlayıcı" olarak tek satır görünmelidir.

Planlanan yazı, seçilen saatten sonraki bir saat içinde yayına girer. O ana kadar metni yalnızca Drive'daki taslaktadır; GitHub'a ve siteye gitmez. Yayın bir sebeple yapılamazsa (örneğin GitHub anahtarının süresi dolmuşsa) yazı planlı kalır, panelde sarı bir uyarı görünür ve bir saat sonra yeniden denenir.

## Sorun giderme

| Ne görüyorsunuz | Ne yapmalı |
|---|---|
| "Bu panel yalnızca site sahibine açıktır." | Sitenin sahibi olmayan bir Google hesabı seçtiniz. Yeniden girip doğru hesabı seçin. |
| "Kullanıcı adı ya da şifre yanlış." | Panelin kullanıcı adını ve şifresini kontrol edin (Google şifreniz değil). |
| "Çok fazla yanlış deneme yapıldı…" | 15 dakika bekleyin. Denemeleri siz yapmadıysanız girdikten sonra şifrenizi değiştirin. |
| "Panel henüz kurulmadı" | Kurulum tamamlanmamış. Claude'a haber verin. |
| Google düğmesi görünmüyor | Reklam/izleme engelleyici Google girişini engelliyor olabilir. Bu site için kapatın ya da başka bir tarayıcı deneyin. |
| "GitHub bağlantı anahtarının süresi dolmuş…" | 6. bölümü uygulayın. |
| "…siz düzenlerken başka bir yerde değişmiş" | Sayfayı yenileyip değişikliği tekrar yapın. |
