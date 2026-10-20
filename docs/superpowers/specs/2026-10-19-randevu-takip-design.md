# Gizli randevu takip sayfası: tasarım ve iş planı (Faz 3, adım 3)

**Durum:** Öneri. 20 Ekim 2026'da sahip yokken yazıldı. **Kod yazılmadı.** Bu iş, danışana ait kayıtların (e-posta, randevu saati, talepler) saklanmasını gerektiriyor. Saklama süresi ve metinler sahip onaylamadan uygulanmaz. Önce randevu formlarının (11. iş) açık soruları yanıtlanmalı: `2026-10-20-randevu-formlari-design.md`.

## Sahip için kısa özet (sade Türkçe)

- Bir randevuyu onayladığınızda panelde **"Danışana takip bağlantısı gönder"** düğmesine basarsınız. Danışana, uzun ve tahmin edilemez bir kod içeren bir bağlantı e-postayla gider.
- Danışan bağlantıyı açınca **adı görünmez**. Yalnızca sıradaki randevusunun günü ve saati görünür, altında dört düğme yer alır:
  - **Randevuyu iptal et:** 24 saatten az kaldıysa uyarı çıkar (kuralı siz belirleyin).
  - **Saat değişikliği iste:** danışan uygun olduğu birkaç saati seçer.
  - **Terapiyi sonlandırmak istiyorum:** isteğe bağlı kısa bir not yazılabilir.
  - **Bağlantıyı kapat:** danışan kendi bağlantısını iptal eder.
- Her talep **size e-postayla** gelir ve panelde yeni **"Talepler"** ekranında görünür. "Onayla" ya da "Başka saat öner" dediğinizde danışana e-posta gider.
- Kayıtlar **yalnızca sizin Google Drive'ınızda** tutulur. GitHub'a ve siteye hiçbir zaman gitmez. Sahibin kendi hasta numaraları sisteme girmez.

## Sahibin yanıtı (20 Ekim 2026)

"Sayfa seanslar sürdükçe açık kalır, terapi bitince kapanır. Kişisel bilgi tutulmaz; kişilere kod verilir." Buna göre kararlar şöyle değişti:
- **E-posta saklanmaz.** Kayıtta ad, e-posta ve telefon yok. Yalnızca kod özeti, sahibin göreceği kısa rastgele bir etiket (örneğin `D-7Q3K`, hasta numarası değil), sıradaki randevu saati ve talepler var.
- **Bağlantıyı danışana sahip kendisi gönderir.** Panel bağlantıyı gösterir, sahip kopyalayıp kendi e-postasıyla yollar. Talepler sahibe etiketle gelir ("D-7Q3K saat değişikliği istiyor"). Sahip danışana Gmail'den kendisi yanıt verir.
- **Kapanış:** Sahip panelde "Terapi sona erdi" dediğinde kayıt hemen silinir ve bağlantı çalışmaz olur. Ayrıca 90 gün boyunca hiç randevusu olmayan kayıt da otomatik silinir (önerildi).

## Durum (20 Ekim 2026)

Panel tarafı yapıldı: **Seans takip** sayfası (KT001OGO numarası ve haftalık seans), talepten "Seans takibe geçir", "Terapiyi sonlandır" (iki e-posta türü), "Geri al", "Sil"; ayrıntı `2026-10-20-randevu-formlari-design.md` içinde. Kalan iş, **danışana açılan gizli sayfa** (kodlu bağlantı, iptal ve saat değişikliği talebi, sonlandırma talebi). Bunun için aşağıdaki T2 ve T5 görevleri, yeni `Client` kaydına bir kod özeti eklenerek uygulanacak.

## Yapıldı (20 Ekim 2026, sahibin kararlarıyla)

Sahibin kararları: **24 saat kuralı zorunlu** (seansa 24 saatten az kaldıysa sayfa iptal ve saat değişikliği isteğini kabul etmez); **danışan başına tek bağlantı** (panelde "Yenile" ile değişir); **iptal hemen olur** (seans "İptal edildi · danışan istedi" diye işaretlenir, saat açılır, sahibe bilgi e-postası gider); **bağlantı panelden e-postayla gider** (düzenlenebilir hazır metin, ayrıca "Kopyala"); sayfa metinleri taslak, sahip önizlemede bakacak.

Yapılan:
- `src/lib/tracking.ts`: bağlantı adresi (`/randevum/#k=…`, `/en/my-appointment/#k=…`), 24 saat kuralı, danışana gösterilen bilgi (sıradaki 4 seans; ad, e-posta ve sahibin notları yok).
- `apps-script/src/tracking.ts`: kod = danışan kimliği + HMAC imzası (SEAL_KEY'den türetilen anahtarla; kod hiçbir yerde saklanmaz). `track.view`, `track.ask` (iptal / başka saat / sonlandırma isteği; her biri sahibe e-posta, Reply-To danışan), `clients.link` (bağlantı, `renew` ile yenisi), `clients.linkMail`. Yanlış kodlar site geneli sayılır: saatte 30'dan sonra sayfa bir saat bekler. Terapi sonlanınca kayıt silinir, bağlantı da ölür.
- `sessions.ts`: `asked: 'reschedule'` işareti; sahip seansı işaretleyince kalkar. Danışan kaydında `endAsked` (tarih ve not).
- Panel: danışan sayfasında "Danışanın randevu sayfası" kutusu (Bağlantıyı gönder / Kopyala / Yenile), "saat değişikliği istedi" işareti, sonlandırma isteği uyarısı; Seans takip listesinde rozetler.
- Site: `TrackingView.astro` + `track-page.ts` (noindex, site haritası dışı, sayaç yok, "Randevu Al" çubuğu yok). Geliştirme sunucusunda `/randevum/#k=demo` örnek verilerle açılır.
- Testler: `tests/unit/apps-script/requests.test.ts` (6), `tests/unit/tracking.test.ts` (6), `tests/unit/admin/appointments.test.tsx` (1), `tests/build/pages.test.ts` (1).

Kalan: Aydınlatma ve Gizlilik metinlerine paragraf (avukata gidecek metinlerle birlikte); canlıya alma (`gas:push`, `gas:deploy`, sonra site push).

## Kararlar (ilk öneri; yukarıdaki kararlar geçerli)

1. **Kod:** 32 bayt rastgele değer (`Utilities.getUuid` iki kez + HMAC), base64url, yaklaşık 43 karakter. Drive'da kodun kendisi değil, **HMAC özeti** saklanır. Drive dosyası ele geçse bile bağlantılar üretilemez.
2. **Bağlantı biçimi:** `klinikterapist.com/randevum/#k=<kod>`. Kod adresin `#` sonrasında durur, bu yüzden sunucu kayıtlarına ve yönlendiren site bilgisine düşmez. Sayfa `noindex` olur, site haritasına girmez ve çerez kullanmaz.
3. **Deneme sınırı:** Yanlış kod denemeleri IP'ye göre değil site geneli sayılır, çünkü Apps Script IP göremez. Saatte 30 yanlış denemeden sonra sayfa bir saat "biraz sonra tekrar deneyin" der. Kod uzayı 2^256 olduğu için bu sınır yalnızca yükü korur.
4. **Kayıt** (Drive: `Klinikterapist Panel/danisanlar/<özet>.json`): `{ email, nextAt, kind, status, requests[], createdAt, lastSeenAt }`. Ad yok, telefon yok, sağlık bilgisi yok. Not alanı yalnızca sonlandırma talebinde var, en fazla 500 karakter.
5. **Saklama:** Sonlandırılan ya da 6 ay boyunca randevusu olmayan kayıt otomatik silinir (saatlik tetikleyiciye ek iş). Süre sahibin kararı (aşağıda 1. soru).
6. **Panel "Talepler" ekranı** (`#/talepler`): bekleyen talepler, her birinde "Onayla", "Başka saat öner", "Reddet" ve kısa bir not alanı. Onayla dendiğinde randevu saati güncellenir ve danışana sabit metinli e-posta gider.
7. **24 saat kuralı:** Öneri, sistemin engellememesi. Uyarı göstersin, talebi yine iletsin; kararı siz verin.

## Sahibe açık sorular

1. Kayıtlar ne kadar süre saklansın? (Öneri: sonlandırmadan hemen sonra ya da son randevudan 6 ay sonra silinsin.)
2. 24 saat kuralı sistemde zorunlu mu olsun, yoksa yalnızca uyarı mı?
3. Bağlantı her randevu için yeni mi olsun, yoksa danışan başına tek mi? (Öneri: danışan başına tek; "bağlantıyı yenile" düğmesiyle değiştirilebilir.)
4. Aydınlatma ve Gizlilik metnine eklenecek paragraf. Taslak: "Randevu takip sayfası: Randevunuzu yönetebilmeniz için e-posta adresiniz ve randevu saatiniz Google hesabımda saklanır. Bağlantınızdaki kod size özeldir; adınız bu sayfada görünmez. Kaydınız terapi sona erdiğinde ya da son randevunuzdan 6 ay sonra silinir."

## İş planı (onaydan sonra; her görev ayrı commit)

**Görev T1: Kayıt deposu ve kodlar (Apps Script).**
- Yeni dosya `apps-script/src/clients.ts`. İşlevler:
  - `issueCode(gas, email, nextAt, kind)`: kod üretir, özetini saklar, kodu döndürür.
  - `findByCode(gas, code)`: kaydı bulur.
  - `addRequest(gas, code, req)`, `resolveRequest(gas, id, decision)`, `purgeOld(gas, now)`.
- Testler `tests/unit/apps-script/clients.test.ts`: kod özeti saklanır, kodun kendisi saklanmaz; yanlış kod sayacı; saklama süresi dolan kayıt silinir; ad ve telefon alanı kabul edilmez.

**Görev T2: Herkese açık işlemler.**
- `tracking.view` (kod → `{ nextAt, kind, pending }`; e-posta döndürmez) ve `tracking.request` (tür: `cancel | reschedule | end | revoke`).
- Her talep sahibe e-posta gönderir; iletişim formu sınırları geçerli.
- Testler: kodsuz ya da yanlış kodla bilgi sızmaz; deneme sınırı; sabit metinli e-postalar.

**Görev T3: Panel işlemleri (oturum gerekli).**
- `clients.invite` (e-posta, randevu saati, tür → danışana bağlantı e-postası), `clients.requests` (liste), `clients.resolve`.
- `Api` arayüzüne, `ACTIONS` listesine, HTTP ve mock bağlantılarına eklenir.

**Görev T4: Panel ekranları.**
- "Talepler" ekranı (`#/talepler`) ve kenar menüde bir bağlantı.
- Ana sayfada "Bekleyen talepler" kartı.
- Randevu onayında "Danışana takip bağlantısı gönder" penceresi.
- Telefonda 375 px kontrolü.

**Görev T5: Site sayfası.**
- `src/pages/randevum.astro` + `src/pages/en/my-appointment.astro` (noindex, site haritası dışında).
- İstemci betiği kodu `#` sonrasından okur, `tracking.view` ile bilgileri getirir, düğmeleri gösterir.
- Erişilebilirlik: odak, canlı bölge, 44 px dokunma alanı.
- Derleme testi: sayfa site haritasında yok, `noindex` var, sayfada kişisel veri yok.

**Görev T6: Saklama işi.**
- `hourly()` içinde `purgeOld`. Hata olursa kayıtlara metin düşmeden loglanır.

**Görev T7: Metinler ve canlıya alma.**
- Aydınlatma ve Gizlilik (TR + EN) paragrafı, sahip onayıyla.
- Sıra: `gas:push`, `gas:deploy`, sonra site push.
