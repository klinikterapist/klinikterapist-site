# E-posta adresleri rehberi (bildirim@, randevu@, bilgi@)

Bu rehber teknik bilgi gerektirmez. Adımları sırayla izleyin; takıldığınız yerde ekran görüntüsünü Claude'a gönderin. Şifrenizi hiçbir zaman Claude'a yazmayın.

**Amaç:** Sistemin e-postalarını kişilerin mesajlarından ayırmak.

| Adres | Ne işe yarar |
| --- | --- |
| `bildirim@klinikterapist.com` | Sistemden size gelen bildirimler: yeni randevu talebi, danışanın iptali, ödenmeyen seans, süresi dolan talep. |
| `randevu@klinikterapist.com` | Danışanlara giden onay, hatırlatma ve ödeme e-postaları bu adresten gider. Danışan "Yanıtla" derse cevap da buraya gelir. |
| `bilgi@klinikterapist.com` | "Önce bilgi almak istiyorum" formunun otomatik cevapları bu adresten gider. |
| `iletisim@klinikterapist.com` | Türkçe iletişim formundan gelen mesajlar buraya gelir. Sitenin Türkçe sayfalarında görünen adres budur. |
| `hello@klinikterapist.com` | İngilizce iletişim formundan gelen mesajlar buraya gelir. İngilizce sayfalarda görünen adres budur. |

**merhaba@klinikterapist.com** sitede görünmez (22 Ekim 2026 kararı); kişilere doğrudan yazdığınız ve panele girdiğiniz ana adrestir.

Üç adres de ayrı bir hesap değildir. Hepsi sizin hesabınızın **takma adıdır**: gelen her şey aynı gelen kutusuna düşer, ek ücret yoktur.

---

## 1. Takma adları açın (Google Yönetici konsolu)

1. https://admin.google.com adresine **merhaba@klinikterapist.com** ile girin.
2. Sol menüden **Dizin › Kullanıcılar**'ı açın ve kendi adınıza tıklayın.
3. **Kullanıcı bilgileri** bölümünde **Alternatif e-posta adresleri (e-posta takma adları)** satırına tıklayın.
4. **Alternatif e-posta** kutusuna sırayla `bildirim`, `randevu`, `bilgi`, `iletisim` ve `hello` yazıp her birini ekleyin. Sonra **Kaydet**'e basın.
5. Takma adların çalışması birkaç dakika, bazen birkaç saat sürebilir.

## 2. Gmail'de "farklı adresten gönder" ekleyin (randevu@ ve bilgi@ için)

Sistem danışanlara bu adreslerden yazabilsin diye Gmail'e bunları tanıtırız. `bildirim@`'i de ekleyin: sistemin size gönderdiği bildirimler bu adresten gelir ve gelen kutunuzda "ben" yerine "Randevu Formu", "İletişim Formu" gibi açıklayıcı bir ad görünür. (Gmail, ana adresinizden gelen e-postalarda verilen adı gizleyip "ben" yazar.)

1. Bilgisayarda Gmail'i açın. Sağ üstteki **⚙ Ayarlar › Tüm ayarları görün**'e tıklayın.
2. **Hesaplar** sekmesinde **Postayı farklı adresten gönder** satırını bulun ve **Başka bir e-posta adresi ekle**'ye basın.
3. Açılan pencerede:
   - Ad: `Osman Güneş Özkurt`
   - E-posta adresi: `randevu@klinikterapist.com`
   - **Takma ad olarak işle** kutusu işaretli kalsın.
4. **Sonraki adım**'a basın. Google bir doğrulama e-postası gönderirse aynı gelen kutusuna gelir; içindeki bağlantıya tıklayın.
5. Aynı adımları `bilgi@`, `iletisim@`, `hello@` ve `bildirim@` için tekrarlayın.
6. Aynı ekranda **Bir iletiyi yanıtlarken** seçeneğini **İletinin gönderildiği adresten yanıtla** yapın ve kaydedin.

## 3. Yeni Gmail iznini verin (tek seferlik)

Sistemin bu adreslerden gönderebilmesi için Google bir kez ek izin ister. Bunu Claude yeni kodu yükledikten sonra yaparsınız. Claude önce `npm run gas:push`, sonra `npm run gas:deploy` çalıştırır ve size haber verir.

1. **script.google.com** adresinde "Klinikterapist Panel" projesini açın.
2. Üstteki işlev listesinden **hourly**'yi seçip **Çalıştır**'a basın.
3. "Yetkilendirme gerekli" penceresinde **İzinleri gözden geçir**'e basın ve **merhaba@klinikterapist.com** hesabını seçin.
4. "Google bu uygulamayı doğrulamadı" uyarısı çıkarsa **Gelişmiş › Klinikterapist Panel'e git (güvenli değil)** deyin. Uygulamayı siz yazdırdığınız için bu uyarı çıkar.
5. **İzin ver**'e basın. Google bu izni geniş yazar: "Gmail'deki tüm e-postalarınızı okuma, oluşturma, gönderme ve kalıcı olarak silme". Farklı adresten gönderebilmenin tek yolu bu izindir; daha dar bir seçeneği yoktur. Sistemin kodu bu izni yalnızca iki iş için kullanır: e-posta göndermek ve Gmail'e eklediğiniz gönderen adreslerin listesini görmek. E-postalarınızı okuyan ya da silen bir kod yoktur.

Bu izni vermeden önce sistem çalışmaya devam eder ama yeni adresleri kullanamaz. Her şey eskisi gibi merhaba@ adresinden gider.

## 4. Panelde adresleri kaydedin

1. Panelde **Ayarlar › E-posta Ayarları**'nı açın. **E-posta adresleri** kutusunda **Düzenle**'ye basın.
2. Beş adresi yazın ve **Kaydet**'e basın.
   - "Gmail'de eklenmemiş" uyarısı çıkarsa 2. adımı tamamlayın ve birkaç dakika bekleyip tekrar kaydedin.
3. **Deneme gönder**'e basın. Gelen kutunuza birkaç deneme e-postası gelir; her biri hangi adresin ne işe yaradığını yazar.

Bir alanı boş bırakırsanız o iş için yine ana adresiniz kullanılır.

## 5. İsteğe bağlı: bildirimleri ayrı klasöre alın

Gmail'de arama kutusuna `to:bildirim@klinikterapist.com` yazın. Sağdaki **Filtre oluştur**'a basın, **Etiket uygula › Yeni etiket: Bildirimler** seçin ve **Filtre oluştur**'a basın. Sistem bildirimleri artık ayrı bir klasörde toplanır.

---

## Günlük e-posta hakkı

Google, bir hesabın bir günde gönderebileceği otomatik e-posta sayısını sınırlar. **E-posta adresleri** kutusu bugün kalan hakkı gösterir. Hak 20'nin altına düşerse kırmızı yazılır. Hak her gece yarısından sonra yenilenir. Hak biterse sistem yeni e-posta gönderemez; panel size bunu hata olarak söyler ve ertesi gün tekrar deneyebilirsiniz.
