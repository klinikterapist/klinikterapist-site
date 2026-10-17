# Yazı Editörü v2 ve Panel Görünümü — Tasarım Belgesi

**Tarih:** 17 Ekim 2026
**Sahibi:** Osman Güneş Özkurt
**Durum:** Tamamlandı, sahibinin son onayını bekliyor
**Dayandığı iş:** Faz 2 yönetim paneli (`faz-2-yonetim-paneli` dalı). Mevcut editör: `src/admin/ui/editor/`.

Belgede iki tür karar var: **(Sahibinin kararı)** ile işaretlenenleri site sahibi konuşmada kendisi verdi. **(Claude'un kararı)** ile işaretlenenler önerdiğim varsayılanlar; sahibi okurken bunları değiştirebilir.

---

## 1. Amaç ve neden

Sahibi Medium ve Substack'te yazıyor ve panelin yazı editörünün bunlar kadar "profesyonel" hissettirmesini istiyor. Ekran görüntüleriyle iki editörü gösterdi. İki tasarım taslağı arasından **Substack tarzını (üstte hep görünen araç çubuğu)** seçti **(Sahibinin kararı)**.

Sahibi psikolog. Yazılarında bilimsel kaynak gösteriyor ve bunun **APA 7** biçiminde olmasını istiyor **(Sahibinin kararı)**. Bu sürümün en önemli yeni yeteneği bu. DOI yapıştırınca künyenin kendiliğinden oluşması, elle künye yazma yükünü kaldırıyor.

Ghost'a geçiş konuşuldu ve elendi. Sunucu ücreti gerekiyor, iki dili doğal olarak desteklemiyor ve Faz 2'de yapılan işi çöpe atıyor. Bunun yerine mevcut Tiptap editörü geliştirilecek.

## 2. Hedefler

1. **Sabit araç çubuğu** (Substack gibi). Yazı alanının üstünde hep görünür; sayfa kayınca üstte yapışık kalır **(Sahibinin kararı: B seçeneği)**.
2. **Alt başlık:** Başlığın altında gri bir satır. Sitede de yazının başında görünür **(Sahibinin kararı)**.
3. **Daha fazla biçim:** Numaralı liste, üstü çizili yazı, fosforlu kalemle vurgulama **(Sahibinin kararı)**.
4. **Önizle:** Yazının sitede nasıl görüneceğini yayınlamadan gösterir **(Sahibinin kararı)**.
5. **Sürüm geçmişi:** Taslağın önceki kayıtlarından birine dönmek **(Sahibinin kararı)**.
6. **Kelime sayısı ve okuma süresi**, editörün altında **(Sahibinin kararı)**.
7. **APA 7 kaynak gösterme:** DOI'den otomatik künye, elle künye formu, metin içi atıf ve yazı sonunda kendiliğinden oluşan Kaynakça **(Sahibinin kararı)**.

## 3. Kapsam dışı

- **İçindekiler.** Sahibi istemedi **(Sahibinin kararı)**.
- **İleri tarihli yayın, şablonlar, büyük ilk harf (drop cap).** Sonraki bir sürüme ertelendi **(Sahibinin kararı, Claude'un önerisiyle)**.
- **Numaralı dipnotlar.** Sahibi APA tarzı metin içi atıfı seçti; numaralı dipnot eklenmeyecek **(Sahibinin kararı)**.
- Substack'e özgü olanlar: abonelere e-posta, abone ol / paylaş düğmeleri, anket, ses dosyası, yorum ayarları, ücretli içerik. Sitenin böyle bir altyapısı yok.
- Yazı rengi ve metin hizalama. Sitenin tipografisini bozar **(Claude'un kararı)**.
- Faz 3 (randevu sistemi).

## 4. Kaçınılacaklar (iş "çalışsa bile" başarısız sayılır)

- **Var olan yazıların bozulması.** Mevcut Markdown yazıları değişmeden derlenmeli ve aynı görünmeli. Yeni alanların hepsi isteğe bağlı olmalı.
- **Yanlış künyenin sessizce yayına girmesi.** Otomatik gelen her künye eklenmeden önce sahibine düzenlenebilir bir önizleme olarak gösterilmeli. Bilimsel güvenilirlik sahibinin mesleki itibarı demek.
- **Kaynakçanın metinle uyuşmaması.** Kaynakçada metinde atıf yapılmamış bir kaynak, metinde de kaynakçada olmayan bir atıf bulunmamalı. Kaynakça elle değil, atıflardan üretilmeli.
- **Kalabalık bir ekran.** Araç çubuğu tek satıra sığmalı; az kullanılanlar "Daha fazla" menüsünde durmalı. Telefonda çubuk yatay kaydırılabilir olmalı ve yazı alanını kapatmamalı.
- **Sitenin hızının düşmesi.** Atıf ve kaynakça derleme sırasında statik HTML'e dönüşmeli; ziyaretçinin tarayıcısında JavaScript gerektirmemeli.
- Faz 2'nin güvenlik kuralları gevşememeli: güvenli bağlantı kontrolü (`SAFE_LINK`), ham HTML'in kaçışlanması, sahip dışında kimsenin yazamaması.

## 5. Ayrıntılar

### 5.1 Araç çubuğu

Soldan sağa gruplar **(Claude'un kararı; sahibinin onayladığı taslaktaki sıra)**:

| Grup | Düğmeler |
|---|---|
| Geçmiş | Geri al, Yinele |
| Blok türü | Açılır liste: Paragraf, Alt başlık (H2), Küçük alt başlık (H3) |
| Biçim | Kalın, İtalik, Üstü çizili, Vurgula (fosforlu kalem) |
| Ekle | Bağlantı, Görsel, YouTube, Alıntı |
| Liste | Madde listesi, Numaralı liste |
| Referans | **Referans ekle**: kitap simgeli; Alıntı düğmesinin tırnak simgesinden açıkça farklı **(Sahibinin kararı)** |
| Daha fazla ▾ | Vurgu kutusu, Ayraç |

- **Dil seçimi:** Üst satırda, Önizle düğmesinin yanında **TR / EN** düğmeleri olur (şimdiki sekmelerin yerine). Her dilin yanında ✓ (tamam) ya da ⚠ (eksik) işareti görünür **(Sahibinin kararı)**.
- **Yazı ayarları alanı açılıp kapanır** **(Sahibinin kararı)**. Sağdaki yayın, kapak, kategori, adres ve SEO alanı tek tıkla daraltılır; yazı alanı genişler. Seçim cihazda hatırlanır. Telefonda alan varsayılan olarak kapalıdır **(Claude'un kararı)**.
- Düğmeler etkin durumlarını göstermeli (örneğin imleç kalın yazıdaysa "Kalın" basılı görünür).
- Mevcut seçim balonu (BubbleMenu) ve boş satırdaki "+" menüsü kaldırılır. Sahibi B'yi seçti, aynı işi yapan iki ayrı yer kafa karıştırır **(Claude'un kararı)**.
- Klavye kısayolları (Ctrl+B, Ctrl+I, Ctrl+Z vb.) çalışmaya devam eder.
- Başlık seviyeleri H2 ve H3'te kalır. Sitenin başlık yapısı (`h1` = yazı başlığı) böyle kurulu.

### 5.2 Alt başlık

- Her dil için ayrı, isteğe bağlı bir `subtitle` alanı.
- Editörde başlığın hemen altında, gri ve daha küçük yazıyla, "Alt başlık ekleyin…" yer tutucusuyla.
- Sitede yazı sayfasında başlığın altında gösterilir. Yazı kartlarında ve SEO meta açıklamasında kullanılmaz; meta açıklama ayrı alan olarak kalır **(Claude'un kararı)**.
- Boşsa hiçbir şey gösterilmez. Mevcut yazılarda alan yoktur ve öyle kalabilir.

### 5.3 Biçimler

- **Numaralı liste:** Markdown'da `1.` listesi. Dönüştürücü bunu zaten destekliyor; yalnızca düğme eksik.
- **Üstü çizili:** Markdown'da `~~metin~~`.
- **Vurgula:** Markdown'da `<mark>` olarak saklanabilir ya da kurucu uygun bir sözdizimi seçebilir. Sitede `<mark>` elementi olarak, sitenin renk paletine uygun bir arka planla gösterilir. Güvenlik kuralları ham HTML'i engelliyorsa yalnızca bu etikete izin verilmeli.

### 5.4 Önizle

- Sağ üstte "Yayınla"nın yanında **Önizle** düğmesi.
- Seçili dildeki yazıyı sitenin kendi yazı sayfası görünümüyle gösterir: başlık, alt başlık, kapak, metin, figürler, vurgu kutuları ve Kaynakça. Ayrı bir pencerede ya da tam ekran bir katmanda açılabilir.
- Görünümün sitedekiyle birebir aynı olması hedeflenir, ama sahibine "yaklaşık görünüm" olduğu söylenmez; fark çıkarsa bu bir hatadır. Kurucu bunu sitenin CSS'ini ve Markdown işleyicisini yeniden kullanarak ya da eşdeğer bir istemci tarafı işleyiciyle yapabilir.
- Önizleme hiçbir şeyi yayınlamaz, GitHub'a hiçbir şey yazmaz.

### 5.5 Sürüm geçmişi

- Editörün sol alt köşesinde **Sürüm geçmişi** düğmesi.
- Taslağın önceki kayıtlarını tarih ve saatleriyle listeler (örneğin "Bugün 14.32", "Dün 21.05"). Birine tıklanınca o sürüm salt okunur olarak gösterilir; **"Bu sürüme dön"** düğmesi mevcut taslağı o sürümle değiştirir.
- **Geri dönüş yalnızca açık olan dili etkiler (Claude'un kararı):** O dilin başlığı, alt başlığı, metni ve kaynakları eski haline döner. Diğer dil ve ortak ayarlar (kategori, kapak, tarih, görseller) olduğu gibi kalır. Böylece bir dili geri alırken diğer dildeki yeni emek kaybolmaz. Liste yine taslak düzeyinde tutulur. Geri dönüş, mevcut `rev` çakışma korumasından geçen normal bir kayıt olarak yapılır.
- Geri dönüş de yeni bir kayıt sayılır. Yani geri dönmek de geri alınabilir, hiçbir şey kaybolmaz.
- Otomatik kayıt birkaç saniyede bir çalıştığı için her kaydı ayrı sürüm saymak listeyi şişirir. Sürümler seyreltilmeli: örneğin en az 10 dakika arayla ve bir oturumun son hali mutlaka. Son 30 gün saklanır **(Claude'un kararı; kurucu eşikleri ayarlayabilir)**.
- Kapsam: Drive'daki taslaklar. Yayındaki yazıların eski halleri zaten GitHub geçmişinde duruyor; bu sürümde panelden onlara erişim yok.
- Saklama yöntemi kurucuya bırakılmıştır: Drive'ın kendi dosya sürümleri ya da taslak klasöründe ayrı anlık görüntü dosyaları olabilir. Koşul: Apps Script kotalarını zorlamamalı ve iki cihazdan düzenlemedeki mevcut çakışma (rev) korumasını bozmamalı.

### 5.6 Kelime sayısı ve okuma süresi

- Editörün altında, sağda: "412 kelime · 2 dk okuma".
- Okuma süresi sitenin kullandığı hesapla aynı olmalı (`src/lib/readingTime.ts`).
- Kaynakça kelime sayısına dahil edilmez.

### 5.7 APA 7 kaynak gösterme

**Kaynak ekleme akışı**

1. Sahibi araç çubuğunda **Referans ekle**'ye basar (panelde her yerde "kaynak" yerine "referans" denir; yazının sonundaki liste başlığı ise APA gereği "Kaynakça" / "References" kalır). Bir pencere açılır ve iki sekme gösterir: **"Kayıtlı referanslar"** (bu yazıda daha önce eklenenler) ve **"Yeni referans"**.
2. **Yeni kaynak** sekmesinde bir kutu var: "DOI ya da doi.org bağlantısı". `10.1037/...`, `https://doi.org/10.1037/...` ve `doi:10.1037/...` biçimlerinin hepsi kabul edilir.
3. Künye bilgileri DOI üzerinden çekilir. Yöntem: `https://doi.org/<doi>` adresine `Accept: application/vnd.citationstyles.csl+json` başlığıyla istek atılır (Crossref ve DataCite DOI'lerinin ikisini de kapsar). 17 Ekim 2026'da yapılan denemede doi.org tarayıcıdan gelen isteklere CORS izni veriyordu. Kurucu isteği tarayıcıdan ya da Apps Script'ten (`UrlFetchApp`) atmayı seçebilir.
4. Gelen bilgiler **düzenlenebilir bir formda** gösterilir: yazarlar, yıl, başlık, dergi/kitap adı, cilt, sayı, sayfalar, yayınevi, DOI. Altında APA 7 biçimli künyenin canlı önizlemesi yer alır.
5. Başlık, APA 7 gereği **cümle düzenine** çevrilmiş olarak gelir (yalnızca ilk kelime ve iki noktadan sonraki ilk kelime büyük harfle başlar). Otomatik çevirme özel isimleri (Freud, Jung, Türkiye) küçültebilir. Bu yüzden formda "Başlığın büyük/küçük harflerini kontrol edin" uyarısı gösterilir.
6. DOI bulunamazsa ya da istek başarısız olursa Türkçe bir hata mesajı gösterilir ve elle doldurma formuna geçilir.
7. **Elle künye:** DOI'si olmayan kaynaklar için kaynak türü seçilir, form alanları türe göre değişir. Bu sürümde desteklenen türler **(Claude'un kararı)**:
   - Dergi makalesi
   - Kitap
   - Kitap bölümü (editörlü kitapta)
   - Web sayfası
8. **Eklemeden önce atıf ayarı:** Sayfa numarası (isteğe bağlı, örneğin "s. 34") ve atıf biçimi seçilir:
   - Parantez içi: "(Ray, 2004)"
   - Anlatı: "Ray (2004)"
   **(Claude'un kararı; ikisi de APA 7'nin standart atıf biçimleri)**
9. **"Ekle"** ile atıf imlecin olduğu yere eklenir. Kaynak, yazının kayıtlı kaynaklarına da katılır.

**DOI'den gelen diğer türler (Claude'un kararı)**

Crossref/DataCite konferans bildirisi, rapor, tez, ön baskı (preprint) ya da veri seti de döndürebilir. Bu sürümde bunlar için ayrı APA şablonu yok. Böyle bir sonuç gelirse form açılır ama künye eklenmez: "Bu kaynak türü (örneğin rapor) otomatik biçimlendirilemiyor. Uygun türü seçip alanları kontrol edin." uyarısı gösterilir ve sahibi dört türden birini kendisi seçmeden "Ekle" düğmesi çalışmaz. Böylece en yakın türe sessizce eşleme yapılmaz.

**Yazar ve tarih çeşitleri (Claude'un kararı; APA 7'nin standart durumları)**

Veri modeli ve biçimlendirici şunları desteklemeli:
- Kişi yazarlar (soyadı + adların baş harfleri, "Jr." gibi ekler dahil).
- Kurum yazarlar (örneğin "American Psychiatric Association", "Dünya Sağlık Örgütü"). Kısaltılmaz, olduğu gibi yazılır.
- Yazarsız kaynaklar: atıfta ve sıralamada başlık kullanılır.
- Tarihsiz kaynaklar ("n.d." / "t.y.") ve "baskıda" ("in press") olanlar.
- Kitap bölümü için ayrıca editörler.

**Bir atıfta birden fazla kaynak (Claude'un kararı; APA 7 kuralı)**

- Bir atıf birden çok kaynak içerebilir: "(Ray, 2004; Smith & Lee, 2010)". Kaynaklar parantez içinde ilk yazara göre alfabetik sıralanır ve noktalı virgülle ayrılır. Aynı yazarın farklı yılları birleştirilir: "(Ray, 2004, 2010)".
- Akış: imleç bir atıfın üzerindeyken ya da atıf menüsünden "Kaynak ekle" seçilirse kaynak o atıfa eklenir. Aksi halde yeni bir atıf eklenir.
- Her kaynağın kendi konum bilgisi olabilir. Desteklenen konumlar: sayfa (s. / p.), sayfa aralığı (ss. / pp.), paragraf (para.) ve bölüm (Bölüm / Chapter). Sayfa numarası olmayan web sayfaları için paragraf gerekir.

**Metin içi atıf**

- Editörde atıf, düzenlenemeyen tek bir parça olarak görünür (silinebilir, taşınabilir; içi elle değiştirilemez). Üzerine tıklanınca küçük bir menü açılır: sayfa numarasını ya da biçimi değiştir, kaynağın künyesini düzenle, atıfı kaldır.
- Atıf metni APA 7 kurallarına göre **kendiliğinden** üretilir:
  - 1 yazar: (Ray, 2004)
  - 2 yazar: (Ray & Smith, 2004)
  - 3 ve daha fazla yazar: (Ray et al., 2004)
  - Sayfa numarası varsa: (Ray, 2004, p. 34)
  - Aynı yazar ve aynı yılda iki kaynak varsa: 2004a, 2004b. Harfler Kaynakça sırasına göre verilir.
- **Dile göre kurallar.** Türkçe yazılarda hem metin içi atıflar hem Kaynakça **tamamen Türkçe kalıplarla** yazılır **(Sahibinin kararı: Türkiye'deki üniversite ve dergilerin yaygın kullanımı)**. İngilizce yazılarda standart APA 7 kalıpları kullanılır.

  | | İngilizce | Türkçe |
  |---|---|---|
  | Son yazardan önce (atıf ve Kaynakça) | & (parantez içi ve Kaynakça), and (anlatı) | ve |
  | 3+ yazar (atıf) | et al. | vd. |
  | Sayfa | p. / pp. | s. / ss. |
  | Paragraf, bölüm | para. / Chapter | paragraf / Bölüm |
  | Tarihsiz | n.d. | t.y. |
  | Baskıda | in press | baskıda |
  | Kitap bölümü | In A. Editor (Ed.), *Book* (pp. 10–20) | A. Editör (Ed.), *Kitap* içinde (ss. 10–20) |
  | Editörler | (Ed.) / (Eds.) | (Ed.) / (Ed.) |
  | Baskı | (2nd ed.) | (2. bs.) |
  | Web erişimi (yalnızca değişken sayfalarda) | Retrieved Month D, YYYY, from URL | Erişim tarihi: G Ay YYYY, URL |
  | Kaynakça başlığı | References | Kaynakça |

  Kurucu, bu tablodaki Türkçe kalıpları yaygın bir Türkçe APA 7 kılavuzuyla (örneğin bir üniversitenin yazım kılavuzu) karşılaştırıp tutarlı hale getirebilir; kalıpların hepsi tek bir yerde (dil tablosu) durmalı ki sahibi bir ifadeyi değiştirmek isterse tek yerden değişsin.

  Künyedeki özgün başlıklar, dergi adları ve yazar adları çevrilmez. Yalnızca APA'nın kalıp ifadeleri dile göre değişir.
- Bir kaynak yazının TR ve EN sürümlerinde ayrı ayrı eklenir. Kurucu, bir dilde eklenen kaynağın diğer dilin "Kayıtlı kaynaklar" listesinde de hazır görünmesini sağlayabilir; bu, sahibi için iyi bir kolaylık olur ama zorunlu değildir.

**Kaynakça**

- Yazının sonunda, "Kaynakça" / "References" başlığı altında **kendiliğinden** oluşur. Editörde ve önizlemede metnin altında salt okunur olarak görünür.
- Yalnızca metinde en az bir kez atıf yapılmış kaynaklar listelenir. Bir atıf silinirse, kaynağa başka atıf da yoksa kaynak Kaynakçadan düşer. Kaynak yazının kayıtlı kaynaklarında kalır.
- APA 7 düzeni:
  - Sıralama: ilk yazarın soyadına göre alfabetik **(sahibi teyit etti)**, Türkçe harf sırasına uygun (`localeCompare` `tr`/`en`).
  - Asılı girinti (hanging indent).
  - Dergi adı ve cilt numarası italik, kitap adı italik.
  - DOI, `https://doi.org/...` biçiminde tıklanabilir bir bağlantı.
  - 21 yazara kadar bütün yazarlar yazılır; daha fazlasında ilk 19 yazar, "…" ve son yazar.
- Ham HTML kuralları gereği Kaynakça bağlantıları da `SAFE_LINK` kontrolünden geçmeli.

**Saklama ve derleme**

- Kaynak listesi her dilin frontmatter'ında yapılandırılmış veri olarak durur (örneğin CSL-JSON'a yakın bir `references` dizisi; her kaynağın kalıcı bir kimliği olur). Metindeki atıf, Markdown'da bu kimliğe başvuran bir işaret olarak saklanır. Sözdizimi kurucuya bırakılmıştır (örneğin Pandoc tarzı `[@ray2004, s. 34]`). Koşullar:
  - Markdown'a elle bakan biri de okuyabilmeli.
  - Panel → Markdown → panel dönüşümü kayıpsız olmalı (mevcut dönüştürücünün test yaklaşımıyla).
  - Var olan yazılardaki metinle çakışmamalı.
- Sitede atıflar ve Kaynakça derleme sırasında, mevcut `figurePlugin` gibi bir mdast eklentisiyle HTML'e dönüşür. Ziyaretçi tarafında JavaScript yok.
- APA biçimlendirmesi tek bir modülde yapılır; panel önizlemesi ve site derlemesi aynı modülü kullanır. Böylece editörde görülenle sitedeki aynı olur.
- Şema (`postFrontmatterSchema`) yeni alanları isteğe bağlı olarak kabul eder. Atıfı olup kaynağı listede bulunmayan bir yazı derlemede açık bir Türkçe hatayla durur.

### 5.8 Panelin görünümü (Substack tarzı)

Sahibi Substack'in yönetim panelini gösterdi ve panelin de ona benzemesini istedi. İki taslağı onayladı **(Sahibinin kararı)**:

- **Açık ve karanlık mod** **(Sahibinin kararı)**. Açık mod sitenin renklerini kullanır (`--cream`, `--forest`, `--ink`). Karanlık mod koyu gridir, vurgu rengi yine orman yeşilidir. Sağ üstteki ay/güneş simgesiyle geçiş yapılır ve seçim cihazda hatırlanır. İlk açılışta cihazın kendi ayarına uyar **(Claude'un kararı)**. Editör, önizleme dışındaki bütün ekranlar ve diyaloglar iki modda da okunaklı olmalı. Önizleme her zaman sitenin kendi (açık) görünümündedir.
- **Logo** **(Sahibinin kararı)**: Sol menünün en üstünde klinikterapist logosu durur. Açık modda siyah, karanlık modda beyaz görünür. Kaynak dosyalar: `C:\Users\ogune\Desktop\Klinik Terapist\Logo\` (`3.png` saydam arka planlı beyaz logo; siyah sürümü bundan renk çevrilerek üretilir). Kurucu logoyu kırpıp küçültmeli, mümkünse SVG'ye çevirmeli ve depoya eklemeli.
- **Sol menü:** Logo, Ana sayfa, Siteyi aç ↗, belirgin **"+ Yeni yazı"** düğmesi, Yazılar, "Site ayarları" grubu (mevcut 9 ekran), en altta Çıkış yap. Öğelerin simgeleri olur. Telefonda menü, şimdiki gibi ☰ ile açılan bir çekmecedir.
- **Ana sayfa (pano), yeni ekran:** Panele girince ilk bu açılır.
  - Son yayınlanan yazı ve sitenin yayın durumu (mevcut DeployStatus).
  - Son taslaklar (en fazla 5) ve "Tümü" bağlantısı.
  - Bu ay yayınlanan yazı sayısı.
  - Eksikler: örneğin bir dili eksik olan taslaklar.
- **Yazılar ekranı:** "Yayında" ve "Taslaklar" sekmeleri (sayılarıyla), başlıkta arama, kategoriye göre süzme, sıralama (en yeni / en eski). Arama ve süzme tarayıcıda, zaten yüklenmiş liste üzerinde yapılır.
- Substack'teki abonelik, ödeme, e-posta, podcast, topluluk ve analiz ayarları alınmaz; sitede karşılıkları yok.

## 6. Kısıtlar

- Mevcut yapı korunur: Astro 7 + Sätteri Markdown işleyicisi (rehype eklentileri çalışmıyor, mdast eklentisi kullanılmalı), React + Tiptap paneli, Apps Script arka tarafı, GitHub Pages'te statik yayın. Yeni sunucu ya da ücretli hizmet yok.
- Apps Script V8'de `atob`, `btoa` ve `TextEncoder` yok. Arka tarafa eklenen kod `Utilities` kullanmalı ve esbuild paketine uymalı.
- Panelin bütün metinleri Türkçe, sade ve teknik olmayan bir dille yazılmalı. Sahibi teknik biri değil.
- Telefonda (iPhone Safari) kullanılabilir olmalı.
- Mevcut test düzeni sürdürülür: `npm test` ve `npm run test:build` yeşil kalmalı. APA biçimlendirme modülü örnek künyelerle ayrıntılı test edilmeli (yazar sayıları, aynı yazar-yıl, dile göre kurallar, eksik alanlar).

## 7. Sıralama

Faz 2 henüz canlıya çıkmadı (giriş testi ve push bekliyor). Bu iş Faz 2 canlıya çıktıktan sonra, `main`'den açılan ayrı bir dalda yapılır **(Claude'un kararı)**. Böylece Faz 2'nin denenmiş hali bu büyük değişiklikten bağımsız olarak yayına girer.

Plan aşamalara bölünür ve her aşama kendi başına çalışır, test edilir ve ayrı yayınlanabilir **(Claude'un kararı)**:
1. Panelin görünümü: iki mod, logo, sol menü, Ana sayfa, Yazılar ekranı
2. Araç çubuğu, yeni biçimler, alt başlık, kelime sayısı
3. APA 7 kaynak gösterme
4. Önizle
5. Sürüm geçmişi

## 8. Kurucuya bırakılanlar

- Atıfın Markdown sözdizimi ve `references` alanının tam şekli (5.7'deki koşullarla).
- Sürüm geçmişinin saklama yöntemi ve seyreltme eşikleri (5.5'teki koşullarla).
- Önizlemenin teknik yolu (5.4'teki koşullarla).
- Vurgulamanın Markdown gösterimi (5.3).
- DOI isteğinin tarayıcıdan mı Apps Script'ten mi atılacağı.
- Araç çubuğu simgeleri ve telefondaki görünüm ayrıntıları.
