# Panel v3: Görünüm, Editör Yan Paneli, Görseller ve İstatistikler — Tasarım Belgesi

**Tarih:** 18 Ekim 2026
**Sahibi:** Osman Güneş Özkurt
**Durum:** Tamamlandı, sahibinin son onayını bekliyor
**Dayandığı iş:** Editör v2 ve Substack tarzı panel (main `e5af901`). Tasarımı: `docs/superpowers/specs/2026-10-17-editor-v2-design.md`.

Belgede iki tür karar var. **(Sahibinin kararı)** ile işaretlenenleri site sahibi konuşmada kendisi verdi. **(Claude'un kararı)** ile işaretlenenler benim önerdiğim varsayılanlar; sahibi okurken bunları değiştirebilir. Sahibi "eksiklerimi senin fikirlerine bırakıyorum" dedi; bu yüzden Claude'un kararları bu belgede bir önceki belgeden daha fazla.

---

## 1. Amaç ve neden

Panel ve editör v2 canlıya çıktı. Sahibi kullanırken şunları fark etti:

- Panel sade ama "bitmemiş" görünüyor. Sol menüdeki dokuz ayarın hepsinde aynı güneş simgesi var. Tema düğmesi ve "Yeni yazı" düğmesi rastgele bir köşede duruyor. Ana sayfa dört boş kutudan ibaret.
- Editörün sağındaki "yazı ayarları" tek, uzun bir sütun. Yayınla düğmesi, kategori, kapak, adres, meta ve SEO alanları üst üste yığılmış.
- Görseller yüklendiği gibi duruyor. Kırpılamıyor ya da şekillendirilemiyor. Kapak görseli yan panelde küçük bir önizleme olarak kalıyor, yazının içinde görünmüyor.
- Sitenin kaç kişiye ulaştığını görmenin bir yolu yok.
- Önizlemedeyken telefonun ya da tarayıcının "geri" hareketi kullanıcıyı yazıdan atıp ana sayfaya götürüyor.

Bu sürümün amacı paneli Medium ve Substack kadar derli toplu hissettirmek. Yazıyı yazarken sitede nasıl görüneceğini (kapak, büyük baş harf, şekilli görseller) editörün içinde göstermek. Sahibine sitesinin istatistiklerini, ziyaretçilerin gizliliğinden ödün vermeden sunmak.

## 2. Hedefler

Sahibi istekleri tek tek yazdı. Numaralar konuşmadaki sırayla aynı:

1. **İkon kütüphanesi.** Panelde tutarlı bir simge seti olacak; her öğeye anlamına uygun bir simge gelecek **(Sahibinin kararı)**.
2. **Panelin görünümünü ve kullanımını güzelleştirmek** **(Sahibinin kararı)**. Kapsamı §5.2'de.
3. **Gövde görsellerinde kırpma ve şekil.** Seçenekler: dikdörtgen, kare, hap, yuvarlak (profil fotoğrafı gibi) **(Sahibinin kararı)**.
4. **Önizlemeden "geri" hatası.** Geri hareketi önizlemeyi kapatıp düzenlenen yazıya dönmeli **(Sahibinin kararı)**.
5. **Yayınla düğmesi üst çubukta**, Önizle'nin yanında olacak. Önizle yerinde kalıyor **(Sahibinin kararı)**.
6. **Yan paneli üç simgeye bölmek:** Ayarlar, SEO ve Meta **(Sahibinin kararı)**.
   - Ayarlar: yayın planlaması, kapak görseli ve yayın kontrol listesi.
   - SEO: SEO puanı ve öneriler.
   - Meta: meta alanları ile Google ve sosyal medya önizlemesi.
7. **Kapak görseli** alt başlığın hemen altında görünecek. Boyutu standart olacak, yakınlaştırmayı ve kırpma konumunu sahibi seçecek **(Sahibinin kararı)**.
8. **Büyük baş harf (drop cap)**, Medium ve Substack'teki gibi. Hangi kelimenin baş harfinin büyüyeceğini sahibi elle seçecek, otomatik olmayacak **(Sahibinin kararı: "otomatik olursa bazen hata verir")**.
9. **Dil düğmeleri bayraklı** olacak, adları "Türkçe Sayfa" ve "English Page" **(Sahibinin kararı)**.
10. **Sahibinin bıraktığı boşlukları doldurmak.** Bu belgedeki Claude'un kararları bunlar.
11. **Açık/karanlık mod düğmesi** düzgün bir yere taşınacak **(Sahibinin kararı)**.
12. **Ana sayfanın üstündeki "Yeni yazı" düğmesi kaldırılacak**, çünkü sol menüde zaten var **(Sahibinin kararı)**.
13. **Ana sayfa yeniden tasarlanacak ve site istatistikleri grafiklerle gösterilecek.** İçerik: yazıların okunma sayıları, sayfaların görüntülenme sayıları ve genel istatistikler **(Sahibinin kararı)**. İstatistikler kendi sayacımızla toplanacak; Google Analytics kullanılmayacak **(Sahibinin kararı)**.
14. **Sosyal hesaplar.** TikTok, X ve Threads eklenecek. İletişim sayfasında bütün sosyal hesaplar kart olarak yer alacak **(Sahibinin kararı)**.

## 3. Kapsam dışı

- Google Analytics, Meta Pixel ya da herhangi bir üçüncü taraf takip aracı **(Sahibinin kararı)**.
- Tekil ziyaretçi sayısı. Ziyaretçiyi tanımak için bir kimlik (çerez, cihaz kimliği) gerekir; bu da "takip yok" sözünü bozar. Sayaç yalnızca görüntüleme ve okuma sayar **(Claude'un kararı)**.
- Ziyaretçinin şehri ya da ülkesi. IP adresi okunmaz ve saklanmaz **(Claude'un kararı)**.
- Gövde görsellerine filtre, renk ayarı ya da üzerine yazı ekleme. Sadece kırpma, yakınlaştırma, şekil ve boyut var **(Claude'un kararı)**.
- Sitenin ziyaretçilerin gördüğü genel tasarımının yeniden yapılması. Bu iş panel içindir. Sitede değişen yerler şunlardır: İletişim sayfasındaki kartlar, yeni sosyal simgeler, kapak oranı, şekilli görseller, büyük baş harf ve sayaç **(Claude'un kararı; bkz. §9'daki soru)**.
- Faz 3 (randevu sistemi).

## 4. Kaçınılacaklar (iş "çalışsa bile" başarısız sayılır)

- **Var olan yazıların bozulması.** Şu an yayında yazı yok ama taslaklar var. Mevcut Markdown ve taslaklar değişmeden açılmalı ve aynı görünmeli. Yeni alanların hepsi isteğe bağlı olmalı. Şekil seçilmemiş bir görsel bugünkü gibi görünmeli.
- **"Takip yok" sözünün sessizce bozulması.** Sayaç çerez, `localStorage` kimliği, parmak izi ya da IP kaydı kullanmamalı. Gizlilik ve aydınlatma metinleri sayaçla aynı yayında güncellenmeli. Sayaç metinlerden önce canlıya çıkmamalı.
- **Sitenin yavaşlaması.** Sayaç sayfanın açılmasını beklememeli. Sayfa yüklendikten sonra arka planda küçük bir istek atılmalı. Bir ziyarette en fazla üç tür istek olur: açılışta görüntüleme, metnin sonuna inilince bir kez okuma, sayılan bir bağlantıya tıklanınca tıklama **(Claude'un kararı)**. İstek başarısız olursa ziyaretçi hiçbir şey fark etmemeli.
- **Planlanmış bir yazının vaktinden önce görünmesi.** Bu yazı sitede, yazı listelerinde, kategori sayfalarında, RSS'te, site haritasında ve "ilgili yazılar"da görünmemeli.
- **Kırpılan görselin geri dönülemez olması.** Sahibi kırpmayı sonradan değiştirmek isterse görseli yeniden yüklemek zorunda kalmamalı.
- **Kalabalık bir üst çubuk.** Telefonda (iPhone Safari) dil düğmeleri, Önizle ve Yayınla tek satıra sığmalı ya da düzgünce kırılmalı. Hiçbir düğme ekrandan taşmamalı.
- **Windows'ta bayrak yerine "TR" harfleri.** Windows bayrak emojilerini göstermez. Bayraklar emoji değil, küçük SVG görseller olmalı.
- Editör v2'nin güvenlik kuralları gevşememeli: güvenli bağlantı kontrolü (`SAFE_LINK`), ham HTML'in kaçışlanması (yalnızca editörün ürettiği etiketlere izin), sahibi dışında kimsenin yazamaması. Sayaç için açılan herkese açık uç nokta bu kuralların dışında kalmamalı (§5.9).

## 5. Ayrıntılar

### 5.1 İkon kütüphanesi (madde 1)

- **Panel:** [Lucide](https://lucide.dev) (`lucide-react`) **(Claude'un kararı)**. Gerekçeler: açık kaynak (ISC lisanslı), sitenin ve panelin şimdiki ince çizgili simgelerine benziyor (24×24, 2px çizgi), React'te yalnızca kullanılan simgeler pakete girdiği için panel ağırlaşmıyor. Panelde elle çizilmiş simgelerin hepsi (Shell'deki `ICONS`, araç çubuğu simgeleri) Lucide'a geçer.
- **Site:** Site kendi küçük simge dosyasını (`src/lib/icons.ts`) kullanmaya devam eder, çünkü ziyaretçiye JavaScript gönderilmiyor. Lucide marka simgelerini artık içermiyor. Bu yüzden sosyal medya simgeleri (Instagram, LinkedIn, Medium, Substack, YouTube, X, TikTok, Threads) bu dosyada tek tip çizgi stiliyle durur. Şimdiki `x` simgesi sıradan bir çarpı işareti; gerçek X logosuyla değiştirilir **(Claude'un kararı)**. Marka simgeleri için Simple Icons (CC0) kaynak alınabilir, ama sitenin çizgi stiline uydurulmalı.
- **Sol menüdeki ayar ekranlarının simgeleri** **(Claude'un kararı)**:

  | Ekran | Simge (Lucide adı) |
  |---|---|
  | Profil | `user-round` |
  | Site ana sayfası | `layout-template` |
  | Sosyal ve linkler | `share-2` |
  | Hakkımda | `id-card` |
  | Kaynaklar | `book-open` |
  | İletişim | `mail` |
  | Kategoriler | `tags` |
  | SEO genel | `search` |
  | Yasal metinler | `scale` |

  Kurucu, anlamı koruyarak benzer bir Lucide simgesi seçebilir.

### 5.2 Panelin görünümü (madde 2, 11, 12)

"Güzelleştirmek" geniş bir istek. Bu sürümde şunları kapsar **(Claude'un kararı)**:

- **Tema düğmesi:** Ana içerik alanının üstündeki ayrı satır kalkar. Sol menünün en altına, "Çıkış yap"ın üstüne taşınır. Ay/güneş simgeli bir satır olur: "Karanlık mod" / "Açık mod". Telefonda çekmecenin içinde aynı yerde durur. Seçim yine cihazda hatırlanır.
- **"Yeni yazı":** Ana sayfa başlığındaki düğme kalkar. Sol menüdeki düğme tek giriş noktası olur.
- **Sol menü:** Her öğenin kendi simgesi olur (§5.1). Etkin öğe hafif bir arka plan rengiyle belirginleşir. "Site ayarları" grubu bugünkü gibi kalır.
- **Genel düzen:** Aralıklar, köşe yuvarlaklıkları ve gölgeler tek bir ölçek üzerinden gider (ör. 4/8/12/16/24/32 px aralık; kartlarda tek bir köşe yarıçapı). Düğmelerde üç seviye olur: birincil (dolgulu yeşil), ikincil (çerçeveli), sessiz (yalnızca yazı). Bugünkü `kit` bileşenleri bu ölçeğe göre güncellenir.
- **Boş durumlar:** "Taslak yok", "Henüz yayınlanmış yazı yok" gibi yerlerde soluk bir simge, tek cümlelik bir açıklama ve varsa bir eylem bağlantısı olur.
- **Ayar ekranları:** Her ekranın başlığında simgesi ve bir cümlelik açıklaması olur ("Sitede görünen sosyal hesaplarınız").
- Açık ve karanlık modun ikisinde de okunaklılık korunur (WCAG AA kontrastı).

Kurucu Substack ve Medium panellerinin sadeliğini örnek almalı. Yeni renk eklenmez; sitenin paleti (`--cream`, `--forest`, `--ink`) ve karanlık moddaki koyu gri kalır.

### 5.3 Editörün üst çubuğu (madde 5, 9)

Soldan sağa **(Claude'un kararı; düğmelerin yan yana olması sahibinin kararı)**:

`← Yazılar` · kayıt durumu · … · **[🇹🇷 Türkçe Sayfa ✓] [🇬🇧 English Page ⚠]** · **Önizle** · **Yayınla**

- **Dil düğmeleri:** Bayrak, ad ve tamam/eksik işareti (✓/⚠) yan yana durur. İngilizce için Birleşik Krallık bayrağı kullanılır **(Claude'un kararı)**. Bayraklar SVG'dir (§4). Telefonda dar ekranda yalnızca bayrak ve işaret görünür; ad ekran okuyucu için gizli metin olarak kalır.
- **Yayınla:** Birincil (dolgulu) düğmedir. Durumuna göre yazısı değişir:
  - "Yayınla" (taslak)
  - "Planla" (ileri bir tarih ve saat seçilmişse, §5.5)
  - "Değişiklikleri yayınla" (yayındaki yazı)
- **Eksik varken Yayınla'ya basılırsa** düğme pasif görünmez; tıklanabilir kalır. Ayarlar paneli açılır ve kontrol listesindeki eksik maddeler vurgulanır **(Claude'un kararı)**. Gerekçe: pasif düğme neyin eksik olduğunu söylemez.
- Yayınla'nın yanında küçük bir **"⋯" menüsü** olur: "Yayından kaldır", "Değişiklikleri at" / "Taslağı sil". Bunlar bugün yan paneldeki yayın kartında duruyor **(Claude'un kararı)**.
- "Yazı ayarlarını gizle/göster" düğmesi kalkar; yerine §5.4'teki simge şeridi gelir.

### 5.4 Yan panelin üç simgeye bölünmesi (madde 6)

Editörün sağ kenarında dikey, ince bir **simge şeridi** olur (Google Docs'un yan şeridi gibi). Üç simge vardır:

| Simge | Panel | İçerik |
|---|---|---|
| `settings` (dişli) | **Ayarlar** | Yayın durumu rozeti (Taslak / Planlandı / Yayında). Yayın tarihi ve saati, planlama (§5.5). Kategori. Kapak görseli: değiştir, kırp, kaldır (görselin kendisi editörde görünür, §5.6). **Yayın kontrol listesi** (§5.4.1). |
| `search-check` | **SEO** | SEO puanı halkası, ışıklı öneriler, odak kelime alanı. |
| `tag` ya da `file-code` | **Meta** | SEO başlığı, meta açıklama, URL kısa adı, kapak görselinin alt metni. Google önizlemesi (masaüstü/mobil) ve sosyal medya paylaşım önizlemesi. |

**(Simgelerin ve alanların dağılımı Claude'un kararı.)** URL kısa adı Meta'dadır, çünkü Google önizlemesinde adres olarak görünür. Odak kelime SEO'dadır, çünkü SEO ışıklarının çoğu ona bakar.

- Bir simgeye tıklanınca o panel açılır; aynı simgeye yeniden tıklanınca kapanır. Aynı anda tek panel açıktır. Panel kapalıyken yazı alanı genişler.
- Hangi panelin açık olduğu cihazda hatırlanır (bugünkü `panel.side` gibi). Telefonda panel varsayılan olarak kapalıdır ve açılınca ekranın altından çıkan bir sayfa (bottom sheet) olarak görünür **(Claude'un kararı)**.
- Simgelerin üzerinde durunca adları görünür. SEO simgesinin köşesinde puan rengi (kırmızı/sarı/yeşil) küçük bir nokta olarak durur. Ayarlar simgesinde eksik madde varsa sarı bir nokta olur **(Claude'un kararı)**.
- Paneller seçili dile göre çalışır (bugünkü gibi). Ortak alanlar (kategori, tarih, kapak) iki dil için tektir ve bunu belirtir.

#### 5.4.1 Yayın kontrol listesi

Ayarlar panelinde, yayınlamak için gerekenlerin hepsi tek listede ve işaretli olarak durur **(Sahibinin kararı: "bir yazının yayınlanması için ihtiyaç duyulan tüm maddeleri sıralarsın")**. İki grup vardır **(gruplama Claude'un kararı)**:

**Zorunlu (eksikse yayınlanamaz)**: bugünkü `missingFields` / `canPublish` kurallarıyla aynı.
- Kategori seçildi
- Her dil için: başlık, metin, URL kısa adı (geçerli), meta açıklama, odak kelime
- Kapak varsa: her dil için kapak alt metni
- Metindeki her atıfın kaynağı kayıtlı

**Önerilen (yayını engellemez)**:
- Kapak görseli eklendi
- Her dil için alt başlık var
- Her gövde görselinin alt metni var
- SEO puanı 80 ve üzeri (her dil)
- Meta açıklama 120–158 karakter

Her madde ✓ ya da ○ ile gösterilir. Eksik maddeye tıklanınca ilgili alana gidilir: alan Meta panelindeyse o panel açılır, öbür dildeyse dil değişir **(Claude'un kararı)**.

### 5.5 Yayın planlaması (madde 6)

Sahibi "yayın planlaması" dedi. Bu, ileri tarihli yayın demek: bir yazıyı bugün hazırlayıp gelecekteki bir gün ve saatte kendiliğinden yayına girmesini sağlamak. Sahibi panele girmese de yayın gerçekleşir **(Sahibinin kararı, Claude'un yorumunu onayladı)**. Bir önceki belgede bu özellik "sonraki sürüme" ertelenmişti.

- Ayarlar panelindeki "Yayın tarihi" alanı **tarih + saat** olur. Saat dilimi İstanbul'dur.
- Seçilen zaman gelecekteyse Yayınla düğmesi "Planla" olur. Onay penceresinde "Yazı 24 Ekim 2026, 09.00'da yayına girecek" yazar.
- Planlanmış yazı panelde **"Planlandı"** rozetiyle görünür. Yazılar ekranında Yayında ve Taslaklar sekmelerinin yanına "Planlanan" sekmesi eklenir **(Claude'un kararı)**.
- Planlanmış bir yazının zamanı değiştirilebilir. Planlama iptal edilerek yazı taslağa döndürülebilir.
- Hassasiyet: Yazı, seçilen saatten sonraki en geç **bir saat** içinde yayına girer. Bu panelde açıkça yazar ("Planlanan saatten sonraki bir saat içinde yayınlanır") **(Claude'un kararı)**.
- **Yöntem: yazı saati gelene kadar Drive'daki taslaklarda kalır** **(Sahibinin kararı)**. Sitenin GitHub deposu herkese açık (18 Ekim 2026'da kontrol edildi). Yazı önceden GitHub'a yazılırsa metni orada okunabilirdi. Sahibi klinik içerikli bir yazının yayından önce hiçbir yerde görünmemesini seçti. Bu yüzden:
  - "Planla" sırasında hiçbir şey GitHub'a yazılmaz. Taslak, planlanan zamanla birlikte Drive'da işaretlenir.
  - Apps Script'te saatlik bir zaman tetikleyicisi (time-driven trigger) zamanı gelen taslakları bulur. Her birini bugünkü Yayınla'nın yaptığı gibi tek bir GitHub commit'iyle yayınlar: Markdown dosyaları, görseller, gerekirse yönlendirmeler. Sonra taslağı siler. Bugün bu yayın paketini tarayıcı kuruyor (`buildPublishChangeset`, `images.forPublish`). Kurucu, aynı paketin panel açık değilken de kurulabilmesini sağlamalı. İki yol var: paketi "Planla" anında tarayıcıda hazırlayıp Drive'da saklamak ya da paketleme mantığını Apps Script'te de çalışır hale getirmek. Hangisi seçilirse seçilsin, tarayıcıdaki ve Apps Script'teki yayın aynı çıktıyı üretmeli; bunu testler göstermeli.
  - Planlamadan sonra taslak düzenlenirse yayınlanacak olan son kaydedilmiş hâli olmalı. Paket önceden hazırlanıyorsa her kayıtta yenilenmeli.
  - Zamanı gelen yayın başarısız olursa (ör. GitHub'a erişilemedi) bir sonraki saatte yeniden denenir. Panelde ilgili yazıda "Planlanan yayın yapılamadı, tekrar denenecek" uyarısı görünür. Üst üste başarısız olursa Ana sayfada da görünür.
  - Yayının yapıldığı panelde görünür (yazı "Yayında" olur, Ana sayfada son yayınlanan olarak çıkar).
  - Ücretli hizmet ya da yeni sunucu olmamalı. Apps Script tetikleyici kotaları (günlük toplam süre) zorlanmamalı. Zamanı gelen yazı yoksa tetikleyici hemen bitmeli.
  - Tetikleyiciyi kurmak sahibinin bir kez onay vermesini gerektirebilir. Kurucu bunu kurulum rehberine (`docs/kurulum/yonetim-paneli.md`) sade Türkçe adımlarla yazmalı.

### 5.6 Kapak görseli (madde 7)

- Kapak **editörün içinde, alt başlığın hemen altında** görünür. Sitede de aynı yerde durur (bugün de öyle). Kapak yoksa orada kesik çizgili bir "Kapak görseli ekle" alanı olur. Tıklanınca ya da üzerine görsel sürüklenince yükleme başlar **(Claude'un kararı)**.
- **Standart oran: 16:9**, çıktı 1600×900 **(Claude'un kararı)**. Sitede, panelde ve önizlemede kapak hep bu oranda görünür.
- Yükleme sonrası **"Kapağı ayarla"** penceresi açılır. Penceredeki 16:9 çerçeve içinde görsel sürüklenerek konumlanır, bir kaydırıcıyla yakınlaştırılır (1×–3×). "Uygula" denir. Editördeki kapağın üzerine gelince "Kapağı ayarla", "Değiştir" ve "Kaldır" düğmeleri çıkar. Aynı düğmeler Ayarlar panelinde de bulunur.
- **Sosyal medya paylaşım görseli** (1200×630, yaklaşık 1.91:1) kapağın aynı odak noktası etrafında kırpılarak üretilir **(Claude'un kararı)**. Meta panelindeki paylaşım önizlemesi bu kırpmayı gösterir.
- **Mevcut taslakların kapakları:** Kırpma bilgisi olmayan bir kapak, ortadan 16:9 kırpılmış olarak gösterilir ve sahibi istediğinde ayarlayabilir. Ayrı bir "eski oran" yolu tutulmaz. Şu an yayında yazı olmadığı için sitede değişen bir şey olmaz **(Claude'un kararı)**.
- **Geri dönülebilirlik:** Özgün görsel saklanır, kırpma bilgisi (konum + yakınlaştırma) ayrıca tutulur. Sahibi kırpmayı istediği zaman yeniden açıp değiştirebilir. Yayınlanan görsel kırpılmış hâlidir. Özgünün nerede tutulacağı (Drive taslak klasörü, depo) ve yayına girip girmeyeceği kurucuya bırakılmıştır. Koşul: sitenin yükü ve depo boyutu gereksiz yere büyümemeli.

### 5.7 Gövde görsellerinde kırpma, şekil ve boyut (madde 3)

Yazıya görsel eklendiğinde ya da editördeki bir görsele tıklanıp "Düzenle" denildiğinde **"Görseli düzenle"** penceresi açılır **(Claude'un kararı)**.

**Şekil** **(seçenekler sahibinin kararı, oranlar Claude'un kararı)**:

| Şekil | Oran | Görünüm |
|---|---|---|
| Özgün (varsayılan) | Görselin kendi oranı | Bugünkü gibi |
| Dikdörtgen | 3:2 yatay ya da 2:3 dikey (yön düğmesiyle) | Hafif yuvarlatılmış köşeler |
| Kare | 1:1 | Hafif yuvarlatılmış köşeler |
| Hap | 2:1 yatay | Kısa kenarlar tam yuvarlak |
| Yuvarlak | 1:1 | Daire (profil fotoğrafı gibi) |

**Kırpma:** Seçilen şeklin çerçevesi içinde görsel sürüklenir ve yakınlaştırılır, kapaktakiyle aynı araç kullanılır. "Özgün" şekilde serbest kırpma yapılabilir.

**Boyut** **(Claude'un kararı, sahibinin "eksiklerimi senin fikirlerine bırakıyorum" demesine dayanarak)**:
- Tam genişlik: metin sütunu kadar (varsayılan)
- Orta: sütunun yaklaşık üçte ikisi, ortalı
- Küçük: sütunun yaklaşık üçte biri, ortalı

  Yuvarlak ve kare şekiller varsayılan olarak "Orta" gelir.

- Altyazı ve alt metin alanları bugünkü gibi kalır.
- Kapaktaki gibi özgün görsel ve kırpma bilgisi saklanır, sonradan değiştirilebilir (§5.6).
- **Saklama ve derleme:** Şekil ve boyut, Markdown'da görselin yanında okunabilir bir işaretle saklanır. Sözdizimi kurucuya bırakılmıştır. Koşullar:
  - İşaretsiz görseller (mevcut taslaklar) bugünkü gibi görünür.
  - Panel → Markdown → panel dönüşümü kayıpsızdır.
  - Sitede görsel yine Astro'nun görsel optimizasyonundan geçer.
  - Şekil ve boyut, derleme sırasında statik HTML/CSS'e dönüşür; ziyaretçi tarafında JavaScript gerekmez.
  - Önizleme sitedekiyle aynı görünür.

### 5.8 Büyük baş harf (madde 8)

- Araç çubuğunun "Daha fazla" menüsünde ya da biçim grubunda **"Büyük baş harf"** düğmesi olur (Lucide `drop-cap` benzeri bir simgeyle) **(Claude'un kararı)**.
- Sahibi büyütmek istediği kelimeyi seçer ya da imleci o kelimeye koyar ve düğmeye basar. O kelimenin ilk harfi büyük baş harf olur **(Sahibinin kararı: kelimeyi sahibi seçer)**.
- **Kelime paragrafın başında olmalıdır** **(Claude'un kararı)**. Büyük baş harf metin satırlarının içine gömülen bir öğedir; paragraf ortasında bir kelimeye uygulanırsa satırlar bozulur. İmleç paragraf başındaki kelimede değilse düğme çalışmaz ve "Büyük baş harf yalnızca bir paragrafın ilk kelimesine uygulanabilir" ipucu görünür. Böylece sahibi istediği paragrafı seçebilir: ilk paragraf, bir alıntıdan sonraki paragraf ya da başka bir paragraf.
- Paragraf tırnak işaretiyle başlıyorsa (“, ", «) tırnak da büyük harfle birlikte büyür. Medium ve Substack de böyle yapar **(Claude'un kararı)**.
- **Her dilde, her yazıda en fazla bir** büyük baş harf olur. Yeni bir kelimeye uygulanırsa eskisi kaldırılır. Düğmeye büyük baş harfli kelimede yeniden basılırsa kaldırılır **(Claude'un kararı)**.
- Görünüm: Fraunces (sitenin başlık yazı tipi), yaklaşık üç satır yüksekliğinde, orman yeşili. Editörde, önizlemede ve sitede aynı görünür.
- Saklama: Markdown'da okunabilir bir işaret, ham HTML'e izin verilen etiket listesine eklenir. Sözdizimi kurucuya bırakılmıştır. Koşullar §5.7'dekilerle aynıdır.
- Ekran okuyucular kelimeyi bölmeden okumalı ("B" + "u gün" değil, "Bu gün").

### 5.9 Kendi sayacımız (madde 13)

**İlke:** Kişisel veri yok, çerez yok, ziyaretçi tanınmaz **(Sahibinin kararı: kendi sayacımız; ayrıntılar Claude'un kararı)**.

**Ne sayılır**:
- **Sayfa görüntüleme:** Hangi sayfa (yol, ör. `/blog/kaygi/`), hangi gün.
- **Yazı okuma:** Bir yazı sayfasında metnin sonuna (Kaynakça başlığına ya da yazar kutusuna) kadar inilmişse bir "okuma" sayılır. Böylece "açıp kapatan" ile "okuyan" ayrılır **(Claude'un kararı)**.
- **Geliş kaynağı:** Yalnızca yönlendiren sitenin adı (ör. `instagram.com`, `google.com`, `t.co`) ya da "doğrudan". Adresin geri kalanı alınmaz.
- **Cihaz türü:** Ekran genişliğinden "telefon / tablet / bilgisayar".
- **Dil:** TR ya da EN sayfa.
- **Bağlantı tıklamaları:** Sosyal hesap bağlantılarına, e-posta adresine ve Randevu düğmesine tıklama sayısı **(Claude'un kararı)**.

**Ne sayılmaz:** IP adresi, tarayıcı parmak izi, tam yönlendiren adresi, kullanıcıya özel kimlik, kişi bazlı ziyaret geçmişi.

**Ayıklama** **(Claude'un kararı)**:
- `navigator.webdriver` olan tarayıcılar (otomasyon) ve "bot" içeren tarayıcı kimlikleri sayılmaz.
- **Sahibinin kendi ziyaretleri:** Panelde oturum açılmış tarayıcıda site ziyaretleri sayılmaz. Bunun için tarayıcıda bir "beni sayma" işareti tutulur. Bu işaret ziyaretçiyi tanımaz, yalnızca sahibinin tarayıcısında bulunur. Panelde "Bu cihazda kendi ziyaretlerimi sayma" anahtarıyla da açılıp kapatılabilir.

**Nasıl çalışır (çerçeve; ayrıntılar kurucuya bırakılmıştır)**:
- Sitenin her sayfasında, sayfa yüklendikten sonra çalışan küçük bir satır içi betik `navigator.sendBeacon` ile Apps Script web uygulamasına tek bir istek atar. Betik sayfaya birkaç yüz bayttan fazla yük eklememeli.
- Apps Script'te oturum gerektirmeyen tek bir yeni işlem açılır (ör. `stats.hit`). Bu işlem:
  - yalnızca beklenen alanları ve uzunlukları kabul eder, gerisini atar;
  - yolu sitenin gerçek sayfa yollarıyla sınırlar ya da en azından biçimini doğrular, böylece rastgele metinlerle tablo şişirilemez;
  - hiçbir okuma yapmaz ve hata ayrıntısı döndürmez;
  - diğer bütün işlemlerin oturum kontrolünü değiştirmez.
- Veri, sahibinin Drive'ında bir Google E-Tablosu'nda ya da benzer bir yerde **günlük toplamlar** olarak tutulur (gün × yol × tür → sayı). Ham istek kaydı tutulmaz. Kurucu Apps Script kotalarına (eşzamanlı çalışma sınırı, günlük süre) ve kilitlemeye (`LockService`) dikkat etmeli. Küçük bir sitenin trafiği için ucuz olmalı.
- Panel istatistikleri oturumlu bir işlemle (ör. `stats.summary`) okur.
- **Saklama süresi:** Günlük toplamlar süresiz tutulabilir, çünkü kişisel veri içermez **(Claude'un kararı)**.

**Yasal metinler:** Gizlilik politikası ve aydınlatma metni (TR ve EN) güncellenir. Eklenecekler: "Ziyaret edilen sayfaların anonim, toplam sayıları tutulur. Çerez kullanılmaz, IP adresi ve kişiyi tanımlayan hiçbir bilgi kaydedilmez." Bugünkü "takip aracı kullanılmıyor" ifadesi buna göre düzeltilir. Metinler sayaçla aynı yayında canlıya çıkar (§4). Bugünkü metinlerde "Takip yok" (gizlilik) ve "analiz aracı kullanılmaz" (aydınlatma) ifadeleri var; ikisi de düzeltilir. Kurucu yeni metinleri 7. aşamanın başında sahibine onaylatmalı. Onay gelene kadar sayaç kapalı kalır, pano yine çalışır ve boş istatistik durumunu gösterir.

### 5.10 Ana sayfa (pano) yeniden tasarımı (madde 12, 13)

Üstten alta **(Claude'un kararı)**:

1. **Başlık:** "Ana sayfa" ve sağda sitenin yayın durumu ("Sitede yayında ✓" / "Site güncelleniyor…"). "Yeni yazı" düğmesi yok.
2. **Dönem seçici:** Son 7 gün / 30 gün / 90 gün / Tümü. Varsayılan 30 gün.
3. **Özet kartları (tek satır, telefonda 2×2):** Görüntüleme, Okuma, Yayındaki yazı sayısı, Bu ay yayınlanan. Her kartta bir önceki döneme göre değişim (ör. "↑ %12") gösterilir.
4. **Ana grafik:** Günlük görüntüleme ve okuma, çizgi ya da alan grafiği. Üzerine gelince gün ve sayılar görünür.
5. **İki sütun (telefonda alt alta):**
   - **En çok okunan yazılar:** İlk 5. Başlık, okuma, görüntüleme ve okunma oranı (okuma ÷ görüntüleme), yatay çubuklarla. Başlığa tıklanınca yazı editörde açılır.
   - **En çok görüntülenen sayfalar:** Ana sayfa, Hakkımda, İletişim, Randevu vb.
6. **Üç küçük kart:** Geliş kaynakları (Instagram, Google, doğrudan, diğer), cihaz dağılımı, dil dağılımı (TR/EN).
7. **Bağlantı tıklamaları:** Hangi sosyal hesaba ya da Randevu'ya kaç tıklama geldiği.
8. **Çalışma alanı:** Son taslaklar, planlanan yazılar ve eksikler (bugünkü kartların yeni düzende hâli).

- **Sayaç yeni kurulduğu için** ilk günlerde veri az olacak. Grafikler boşken "İstatistikler {kurulum tarihi} itibarıyla toplanıyor" bilgisi gösterilir. Boş grafik hata gibi görünmemeli.
- Grafikler panelin iki temasında da okunaklı olmalı. Renkler sitenin paletinden türetilir.
- **Grafik kütüphanesi kurucuya bırakılmıştır**. Koşul: paneli belirgin biçimde ağırlaştırmamalı (ör. hafif bir kütüphane ya da elle SVG). Sitenin ziyaretçi tarafına hiçbir grafik kodu girmez.

### 5.11 Sosyal hesaplar ve İletişim sayfası (madde 14)

- Şemaya (`linkSchema` icon listesi) ve "Sosyal ve linkler" ekranına **TikTok** ve **Threads** eklenir. Ekranda ikon seçimi, adın yanında simgenin kendisini gösterir.
- `src/data/links.json`'a eklenecekler (giriş bölümünde ve sayfa altında görünür; `inHero: true`, `inFooter: true`):
  - TikTok: `https://www.tiktok.com/@klinikterapist`
  - X: `https://x.com/klinikterapist`
  - Threads: `https://www.threads.com/@klinikterapist`
- LinkedIn adresi (`https://www.linkedin.com/in/oguneso/`) zaten doğru, değişmez.
- **İletişim sayfası:** Kanal kartları `links.json`'dan otomatik üretilir. Sıra şöyledir: E-posta, `links.json` sırasıyla bütün sosyal hesaplar, Randevu **(Sahibinin kararı: tüm sosyal medyalar yer alsın)**. Panelden eklenen yeni bir hesap kendiliğinden kart olur. E-posta, `links.json`'daki `mailto` satırından değil, `contact.json`'dan gelir, bugünkü gibi. Bu yüzden iki kez görünmemeli.
- Her ağın kartında kısa bir alt yazı olur, TR ve EN (ör. Instagram "Güncel paylaşımlar", TikTok "Kısa videolar", LinkedIn "Mesleki geçmiş", X "Kısa notlar", Threads "Sohbetler", Medium "Uzun yazılar") **(Claude'un kararı; metinler sahibinin onayına açık)**.
- Google için `sameAs` listesi yeni hesapları kendiliğinden içerir (şu an `links.json`'dan üretiliyor; kurucu doğrulamalı).

### 5.12 Önizlemeden "geri" hatası (madde 4)

- **Belirti:** Önizleme açıkken telefonun geri hareketi ya da tarayıcının geri düğmesi önizlemeyi kapatmıyor, yazıdan çıkıp bir önceki sayfaya (çoğunlukla ana sayfa) gidiyor.
- **Muhtemel neden (doğrulanmalı):** Önizleme, adres çubuğunu değiştirmeyen bir katman. Tarayıcı geçmişinde önizleme diye bir adım olmadığı için "geri" bir önceki panel sayfasına dönüyor.
- **Beklenen davranış:** Önizleme açılınca tarayıcı geçmişine bir adım eklenir. "Geri" önizlemeyi kapatır ve aynı yazıya, aynı dile ve aynı kaydırma konumuna döner. "Kapat" düğmesi ve Esc tuşu da aynı adımı geri alır, böylece geçmişte boşta adım kalmaz. Aynı ilke sürüm geçmişi, görsel düzenleme ve kapak ayarlama pencereleri için de uygulanır **(Claude'un kararı)**.
- Kurucu önce hatayı tekrar üretmeli (test ya da tarayıcıda) ve nedeni doğrulamalı.

## 6. Kısıtlar

- Mevcut yapı korunur:
  - Astro 7 + Sätteri Markdown işleyicisi (mdast eklentileri; rehype çalışmıyor)
  - React + Tiptap paneli
  - Apps Script arka tarafı
  - GitHub Pages'te statik yayın

  Yeni sunucu ya da ücretli hizmet yok.
- Apps Script V8'de `atob`, `btoa`, `TextEncoder` yok; `Utilities` kullanılır, kod esbuild paketine uyar. Apps Script değişiklikleri `npm run gas:push` + `npm run gas:deploy` ile canlıya çıkar (adres aynı kalır).
- Görsel kırpma tarayıcıda yapılır (bugünkü `resizeImage` gibi). Kırpma aracı için hafif bir kütüphane (ör. `react-easy-crop`) ya da elle yazılmış bir bileşen kullanılabilir.
- Panelin bütün metinleri Türkçe, sade ve teknik olmayan bir dille yazılır.
- iPhone Safari'de kullanılabilir olmalı: dokunarak kırpma ve yakınlaştırma (iki parmak), alttan açılan paneller.
- `npm test` ve `npm run test:build` yeşil kalmalı. Yeni Markdown işaretleri (şekil, boyut, büyük baş harf) için kayıpsız dönüşüm testleri, sayaç uç noktası için doğrulama testleri, planlanmış yazının derlemede gizlendiğini gösteren derleme testi yazılmalı.
- Sahibinin açık onayı olmadan `main`'e push edilmez (push canlıya yayın demek).

## 7. Sıralama

İş `main`'den açılan ayrı bir dalda yapılır. Plan aşamalara bölünür; her aşama kendi başına çalışır, test edilir ve ayrı yayınlanabilir **(Claude'un kararı)**:

1. **Hızlı düzeltmeler ve sosyal hesaplar:** önizleme geri hatası (§5.12), TikTok/Threads/X, İletişim kartları (§5.11).
2. **İkonlar ve panel görünümü:** Lucide, sol menü, tema düğmesinin yeri, "Yeni yazı"nın kaldırılması, genel görsel düzen (§5.1, §5.2).
3. **Editörün üst çubuğu ve yan paneli:** bayraklı dil düğmeleri, Yayınla üstte, üç simgeli şerit, kontrol listesi (§5.3, §5.4).
4. **Kapak ve gövde görselleri:** editörde kapak, kırpma aracı, şekiller ve boyutlar (§5.6, §5.7).
5. **Büyük baş harf** (§5.8).
6. **Yayın planlaması** (§5.5).
7. **Sayaç, yasal metinler ve yeni Ana sayfa** (§5.9, §5.10). Sayaç ve metinler aynı yayında çıkar.

## 8. Kurucuya bırakılanlar

- Şekil, boyut ve büyük baş harfin Markdown sözdizimi (§5.7, §5.8'deki koşullarla).
- Özgün görsellerin nerede saklanacağı (§5.6).
- Planlanmış yayının paketinin nerede kurulacağı (§5.5'teki koşullarla).
- Sayacın veri yapısı, depolama yeri ve kilitleme yöntemi (§5.9'daki koşullarla).
- Grafik ve kırpma kütüphaneleri (boyut koşuluyla).
- Lucide simgelerinin tam seçimi (anlamı koruyarak).

## 9. Açık sorular

Kalmadı. Kurucu kontrolünde çıkan iki soru (yayın planlamasının anlamı ve planlanan metnin GitHub'da önceden görünmesi) sahibine soruldu ve §5.5'e işlendi.
