/**
 * The Turkish e-mail texts (owner's drafts of 2026-10-22, edited with the writing editor). A text is
 * a subject and a body with {placeholders} (mail-texts.ts `fill`); [[name]] … [[/name]] is a part
 * that only shows when the e-mail has it (the payment part of a reminder, the person's note …).
 * In the body "■ " is a heading, "– Label: value" a list item and "→ Label: link" a button
 * (apps-script/src/mail-html.ts). E-mails to people end with "Saygılarımla," and {imza}.
 * Generated once from the editor's file; edit here from now on.
 */
export const MAIL_TR = {
  // Talebiniz alındı (seans talebi)
  "oto.talep-alindi.seans": {
    subject: "Randevu talebiniz alındı – klinikterapist.com",
    body: "Merhaba,\n\nRandevu talebiniz bana ulaştı.\n\n– Görüşme türü: {tur}\n– Tarih ve saat: {tarih}, {saat} (Türkiye saati)\n– Süre ve biçim: {sure}, online\n\nTarih ve saatiniz henüz kesinleşmedi. Talebinizi değerlendirip çalışma saatlerim içinde en kısa sürede size yazacağım; saati onaylayacak ya da başka bir saat önereceğim.\n\nBu e-posta adresinin size ait olduğunu onaylamak için lütfen aşağıdaki düğmeye tıklayın (bir tıklama yeterlidir):\n\n{dogrulama_baglantisi}\n\nNot: E-posta adresinizi onayladıktan sonra bütün randevu ve talep yazışmalarımız bu adres üzerinden yürür.\n\nBu talebi siz göndermediyseniz bu e-postayı dikkate almayın.\n\nSaygılarımla,\n{imza}",
  },
  // Talebiniz alındı (ön görüşme talebi)
  "oto.talep-alindi.ongorusme": {
    subject: "Ön görüşme talebiniz alındı – klinikterapist.com",
    body: "Merhaba,\n\nÜcretsiz ön görüşme talebiniz bana ulaştı.\n\n– Görüşme türü: Ücretsiz ön görüşme\n– Kimin için: {kimin_icin}\n– Tarih ve saat: {tarih}, {saat} (Türkiye saati)\n– Süre: 25–30 dakika\n– Görüşme biçimi: {gorusme_bicimi}\n– Ücret: Ücretsiz\n\n[[telefonla]]\nGörüşme saatinde sizi formda yazdığınız telefon numarasından arayacağım. Ön görüşmeden sonraki terapi seansları görüntülü görüşmeyle yapılır.\n[[/telefonla]]\n\nTarih ve saatiniz henüz kesinleşmedi. Talebinizi değerlendirip çalışma saatlerim içinde en kısa sürede size yazacağım; saati onaylayacak ya da başka bir saat önereceğim.\n\nBu e-posta adresinin size ait olduğunu onaylamak için lütfen aşağıdaki düğmeye tıklayın (bir tıklama yeterlidir):\n\n{dogrulama_baglantisi}\n\nNot: E-posta adresinizi onayladıktan sonra bütün randevu ve talep yazışmalarımız bu adres üzerinden yürür.\n\nBu talebi siz göndermediyseniz bu e-postayı dikkate almayın.\n\nSaygılarımla,\n{imza}",
  },
  // Bekleme listesine alındınız
  "oto.bekleme-alindi": {
    subject: "Bekleme listeme alındınız – klinikterapist.com",
    body: "Merhaba,\n\nHaber ettiğiniz için teşekkür ederim. Şu an bütün seans saatlerim dolu olduğu için sizi bekleme listeme aldım. Uygun bir saat boşaldığında bu e-posta adresinize yazacağım.\n\nE-posta adresinizin doğru olduğunu onaylamak için lütfen aşağıdaki düğmeye tıklayın (bir tıklama yeterlidir):\n\n{dogrulama_baglantisi}\n\nBilgileriniz en fazla {saklama_gun} gün saklanır. Listeden çıkmak isterseniz bu e-postayı yanıtlamanız yeterlidir.\n\nBu formu siz doldurmadıysanız bu e-postayı dikkate almayın.\n\nSaygılarımla,\n{imza}",
  },
  // Seans hatırlatması (3 gün önce)
  "oto.seans-hatirlatma": {
    subject: "Seans hatırlatması: {tarih} – klinikterapist.com",
    body: "Sayın {ad},\n\nYaklaşan seansımızı hatırlatmak isterim. Seansınızın bilgileri aşağıdadır.\n\n■ Seans bilgileri\n\n– Seans türü: {tur}\n– Tarih: {tarih}\n– Saat: {saat} (Türkiye saati)\n– Seans ücreti: {ucret}\n\n[[odeme]]\n■ Ödeme bilgileri\n\nSeans ücretini seanstan en geç {odeme_suresi} saat önce aşağıdaki hesaba göndermenizi rica ederim.\n\n{odeme_bilgileri}\n\nÖdemenizi daha önce yaptıysanız bu hatırlatmayı dikkate almanıza gerek yok.\n[[/odeme]]\n\n■ İptal ve erteleme kuralı\n\n{kural}\n\n[[sayfa]]\nSeansınızı iptal etmek ya da ertelemek için size özel randevu sayfanızı kullanabilirsiniz.\n\n→ Randevu sayfama git: {sayfa_baglantisi}\n[[/sayfa]]\n\nGörüşmemizde buluşmak üzere.\n\nSaygılarımla,\n{imza}",
  },
  // Ödeme hatırlatması (48 saat önce kendiliğinden / panelden "Ödeme hatırlat")
  "odeme.hatirlatma": {
    subject: "Seans ödemesi hatırlatması – klinikterapist.com",
    body: "Sayın {ad},\n\nAşağıdaki seansınızın ödemesinin henüz hesabıma ulaşmadığını hatırlatmak isterim.\n\n■ Seans bilgileri\n\n– Seans türü: {tur}\n– Tarih: {tarih}\n– Saat: {saat} (Türkiye saati)\n– Seans ücreti: {ucret}\n\n■ Ödeme bilgileri\n\nÖdemenin seanstan en geç {odeme_suresi} saat önce yapılması gerekir. Aşağıdaki hesap bilgilerini kullanabilirsiniz:\n\n{odeme_bilgileri}\n\nÖdemenizi yaptıysanız bu e-postayı dikkate almayın; banka işleminin hesabıma yansıması biraz zaman almış olabilir.\n\n■ İptal ve erteleme kuralı\n\n{kural}\n\n[[sayfa]]\nSeansınızı iptal etmek ya da ertelemek için size özel randevu sayfanızı kullanabilirsiniz.\n\n→ Randevu sayfama git: {sayfa_baglantisi}\n[[/sayfa]]\n\nAnlayışınız için teşekkür ederim. Görüşmemizde buluşmak üzere.\n\nSaygılarımla,\n{imza}",
  },
  // Seans iptali
  "oto.iptal": {
    subject: "Seansınız iptal edildi – klinikterapist.com",
    body: "Merhaba,\n\nRandevu sayfanızdan yapılan işlemle aşağıdaki seansınızın iptal edildiğini bildirmek isterim.\n\n– Seans türü: {tur}\n– Tarih: {tarih}\n– Saat: {saat} (Türkiye saati)\n\nRandevularınızı görmek için size özel randevu sayfanızı kullanabilirsiniz.\n\n→ Randevu sayfama git: {sayfa_baglantisi}\n\nİptal işlemini siz yapmadıysanız lütfen bu e-postayı yanıtlayarak hemen bana yazın.\n\nSaygılarımla,\n{imza}",
  },
  // Seans iptali (24 saatten az kala)
  "oto.iptal-gec": {
    subject: "Seansınız iptal edildi – klinikterapist.com",
    body: "Merhaba,\n\nRandevu sayfanızdan yaptığınız işlemle aşağıdaki seansınızın iptal edildiğini bildirmek isterim.\n\n– Seans türü: {tur}\n– Tarih: {tarih}\n– Saat: {saat} (Türkiye saati)\n\n■ Ücret\n\nİptal seansa 24 saatten az kala yapıldığı için, randevu talebinizde onayladığınız iptal ve erteleme kuralı gereği seans ücretinin tamamı ödenir.\n\n■ Ödeme bilgileri\n\n– Seans ücreti: {ucret}\n\n{odeme_bilgileri}\n\n■ Randevu sayfanız\n\nRandevularınızı görmek için size özel randevu sayfanızı kullanabilirsiniz.\n\n→ Randevu sayfama git: {sayfa_baglantisi}\n\nİptal işlemini siz yapmadıysanız lütfen bu e-postayı yanıtlayarak hemen bana yazın.\n\nSaygılarımla,\n{imza}",
  },
  // Seans ertelemesi
  "oto.erteleme": {
    subject: "Seansınız ertelendi – klinikterapist.com",
    body: "Merhaba,\n\nRandevu sayfanızdan yapılan işlemle seansınızın ertelendiğini bildirmek isterim.\n\n– Seans türü: {tur}\n– Önceki tarih ve saat: {tarih}, {saat}\n– Yeni tarih ve saat: {yeni_tarih}, {yeni_saat} (Türkiye saati)\n\n[[gec]]\nBu işlem seansa 24 saatten az kala yapıldığı için, randevu talebinizde onayladığınız iptal ve erteleme kuralı gereği seans ücretinin tamamı ödenir.\n[[/gec]]\n\nRandevularınızı görmek için size özel randevu sayfanızı kullanabilirsiniz.\n\n→ Randevu sayfama git: {sayfa_baglantisi}\n\nBu işlemi siz yapmadıysanız lütfen bu e-postayı yanıtlayarak hemen bana yazın.\n\nSaygılarımla,\n{imza}",
  },
  // Terapiyi sonlandırma isteği
  "oto.sonlandirma-istegi": {
    subject: "Sonlandırma isteğiniz bana ulaştı – klinikterapist.com",
    body: "Merhaba,\n\nTerapiyi sonlandırma isteğiniz bana ulaştı. En kısa sürede size yazacağım.\n\nRandevularınızı görmek için size özel randevu sayfanızı kullanabilirsiniz.\n\n→ Randevu sayfama git: {sayfa_baglantisi}\n\nBu işlemi siz yapmadıysanız lütfen bu e-postayı yanıtlayarak hemen bana yazın.\n\nSaygılarımla,\n{imza}",
  },
  // Seans onayı
  "talep.onay.seans": {
    subject: "Randevunuz onaylandı – klinikterapist.com",
    body: "Sayın {ad},\n\n{tarih}, saat {saat} için gönderdiğiniz randevu talebiniz onaylandı. Görüşmenizle ilgili bilgileri aşağıda bulabilirsiniz.\n\n■ Randevu bilgileri\n\n– Seans türü: {tur}\n– Tarih: {tarih}\n– Saat: {saat} (Türkiye saati)\n– Seans süresi: {sure}\n– Görüşme biçimi: Online\n\nGörüşmeye katılmanız için gereken bağlantıyı seanstan önce size e-postayla göndereceğim.\n\n■ Seans ücreti ve ödeme bilgileri\n\n– Seans ücreti: {ucret}\n\n{odeme_bilgileri}\n\nÖdemenizi seanstan en geç {odeme_suresi} saat önce yukarıdaki hesaba yapmanızı rica ederim.\n\n■ İptal ve erteleme kuralı\n\n{kural}\n\nSeansınızdan 3 gün önce size bir hatırlatma e-postası gelir. Bu e-postada size özel randevu sayfanızın bağlantısı da bulunur; seansınızı iptal etmek ya da ertelemek isterseniz bu sayfayı kullanabilirsiniz.\n\n■ Online görüşme hakkında\n\nGörüşmeler, şifreli bağlantı kullanan Google Meet üzerinden yapılır. Seans için sessiz ve yalnız olabileceğiniz bir ortam ve düzgün bir internet bağlantısı yeterlidir. Kulaklık kullanmanızı özellikle öneririm.\n\n■ Gizlilik hakkında\n\nSeanslarda ses, görüntü ya da ekran kaydı almam; aynı kural sizin için de geçerlidir. Görüşmelerde konuşulanlar meslek etiği gereği aramızda kalır. Gizliliğin yasal sınırlarını ilk seansımızda sizinle konuşuruz.\n\nRandevu talebinizde onayladığınız aydınlatma metnine ve kurallara aşağıdaki bağlantıdan ulaşabilirsiniz.\n\n→ Aydınlatma metnini oku: {aydinlatma_baglantisi}\n\nGörüşmemizde buluşmak üzere.\n\nSaygılarımla,\n{imza}",
  },
  // Ön görüşme onayı
  "talep.onay.ongorusme": {
    subject: "Ön görüşmeniz onaylandı – klinikterapist.com",
    body: "Sayın {ad},\n\n{tarih}, saat {saat} için gönderdiğiniz ücretsiz ön görüşme talebiniz onaylandı. Görüşmeyle ilgili bilgileri aşağıda bulabilirsiniz.\n\n■ Ön görüşme bilgileri\n\n– Tarih: {tarih}\n– Saat: {saat} (Türkiye saati)\n– Süre: 25–30 dakika\n– Görüşme biçimi: {gorusme_bicimi}\n– Ücret: Ücretsiz\n\n[[basvuru]]\n■ Başvurunuz hakkında\n\nBaşvuru formunuzda görüşmenin {kimin_icin} olduğunu ve aşağıdaki konuları konuşmak istediğinizi belirttiniz:\n\n{konular}\n\nÖn görüşmemizde bu konuları genel hatlarıyla ele alabilir, ihtiyaçlarınızı ve beklentilerinizi konuşabiliriz.\n[[/basvuru]]\n\n■ Ücretsiz ön görüşmenin amacı\n\nBu görüşme; birbirimizi tanımak, ihtiyaçlarınızı genel hatlarıyla anlamak ve terapi süreci hakkında bilgi vermek için yapılır. Terapinin nasıl ilerlediğini, seansların yapısını ve merak ettiğiniz başka konuları sorabilirsiniz. Birlikte çalışmanın ihtiyaçlarınıza uygun olup olmadığını da karşılıklı olarak değerlendirebiliriz.\n\nÖn görüşme bir terapi seansı ya da kapsamlı bir psikolojik değerlendirme değildir. Görüşmeden sonra terapiye başlama zorunluluğunuz yoktur.\n\n[[telefonla]]\n■ Telefon görüşmesine hazırlık\n\nGörüşme saatinde sizi {telefon} numarasından arayacağım. Numaranız değiştiyse ya da yanlış yazıldıysa lütfen bu e-postayı yanıtlayarak bana bildirin.\n\n– Uygun bir ortam: Başkalarının sizi duyamayacağı, kendinizi rahatça ifade edebileceğiniz sessiz ve özel bir yerde olun.\n– Telefonunuz: Şarjının yeterli, sesinin açık olduğundan emin olun. Arama kayıtlı olmayan bir numaradan gelebilir; görüşme saatinde gelen aramayı yanıtlamanızı rica ederim.\n– Kulaklık: Mümkünse kulaklık kullanın; ses daha net olur ve çevrenizdekilerin konuşmayı duymasını önlemeye yardımcı olur.\n– Zamanında hazır olun: Görüşme 25–30 dakika sürdüğü için planlanan saatte ulaşılabilir olmanızı rica ederim.\n– Mahremiyet: Görüşmenin ses kaydını almamanızı rica ederim.\n\nTelefonla görüşme yalnızca bu ön görüşme içindir. Terapiye başlamaya karar verirsek seanslarımız görüntülü görüşmeyle yapılır; ayrıntıları görüşmemizde konuşuruz.\n[[/telefonla]]\n\n[[goruntulu]]\n■ Online görüşmeye hazırlık\n\nGörüşmenin verimli geçmesi için şu noktalara dikkat etmenizi rica ederim:\n\n– Uygun bir ortam: Başkalarının sizi duyamayacağı, kendinizi rahatça ifade edebileceğiniz sessiz ve özel bir ortam seçin.\n– İnternet bağlantısı: Görüşmeden önce internet bağlantınızı kontrol edin.\n– Cihaz: Bilgisayar, tablet ya da telefon kullanabilirsiniz. Cihazınızın mikrofonunun ve mümkünse kamerasının çalıştığından emin olun.\n– Kulaklık: Mümkünse kulaklık kullanın; ses daha net olur ve çevrenizdekilerin konuşmayı duymasını önlemeye yardımcı olur.\n– Zamanında katılım: Görüşme 25–30 dakika sürdüğü için planlanan saatte hazır olmanızı rica ederim.\n– Görüşme bağlantısı: Görüşmeye katılmanız için gereken bağlantıyı görüşmeden önce size e-postayla göndereceğim.\n– Mahremiyet: Görüşmede özel konular konuşulabileceği için mümkün olduğunca yalnız olabileceğiniz bir yerde bulunmanızı öneririm. Görüşmenin ses ya da görüntü kaydını almamanızı rica ederim.\n– Teknik sorunlar: Bağlantı ya da ses sorunu yaşarsanız bu e-postayı yanıtlayarak bana yazabilirsiniz.\n[[/goruntulu]]\n\nÖn görüşme talebinizde onayladığınız aydınlatma metnine aşağıdaki bağlantıdan ulaşabilirsiniz.\n\n→ Aydınlatma metnini oku: {aydinlatma_baglantisi}\n\nGörüşmemizde buluşmak üzere.\n\nSaygılarımla,\n{imza}",
  },
  // Uygun değilim
  "talep.uygun-degil": {
    subject: "Randevu talebiniz hakkında – klinikterapist.com",
    body: "Sayın {ad},\n\nAşağıdaki randevu talebiniz için teşekkür ederim.\n\n– Görüşme türü: {tur}\n– Tarih: {tarih}\n– Saat: {saat} (Türkiye saati)\n\nNe yazık ki bu tarih ve saatte uygun olmadığım için talebinizi onaylayamıyorum.\n\nSize uygun başka bir tarih ve saat seçmek için sitemdeki randevu sayfasından yeniden talep gönderebilirsiniz.\n\n→ Tekrar randevu al: {randevu_baglantisi}\n\nAnlayışınız için teşekkür eder, ihtiyaçlarınıza uygun bir zamanda görüşebilmeyi dilerim.\n\nSaygılarımla,\n{imza}",
  },
  // Talep iptali
  "talep.iptal": {
    subject: "Randevu talebiniz iptal edildi – klinikterapist.com",
    body: "Sayın {ad},\n\nAşağıdaki randevu talebinizin iptal edildiğini bildirmek isterim.\n\n– Görüşme türü: {tur}\n– Tarih: {tarih}\n– Saat: {saat} (Türkiye saati)\n\nYeni bir randevu talebi göndermek ve size uygun tarih ve saatleri görmek için sitemdeki randevu takvimini kullanabilirsiniz.\n\n→ Yeni randevu talebi oluştur: {randevu_baglantisi}\n\nİlginiz için teşekkür ederim. İhtiyaç duyduğunuzda bana yeniden ulaşabilirsiniz.\n\nSaygılarımla,\n{imza}",
  },
  // Randevu sayfası bağlantısı
  "danisan.sayfa": {
    subject: "Randevu sayfanızın bağlantısı – klinikterapist.com",
    body: "Sayın {ad},\n\nTerapi süreciniz boyunca randevularınızı kolayca takip edebilmeniz için size özel bir randevu sayfası oluşturuldu.\n\n■ Kişisel randevu sayfanız\n\nAşağıdaki bağlantıdan sıradaki seanslarınızı, seans bilgilerinizi ve seans geçmişinizi gösteren grafiği görebilirsiniz.\n\n→ Randevu sayfama git: {sayfa_baglantisi}\n\n■ Randevularınızı yönetme\n\nRandevu sayfanızdan:\n\n– Gelecek seanslarınızı ve seans bilgilerinizi görebilirsiniz.\n– Bir seansı iptal edebilirsiniz.\n– Takvimdeki uygun saatlerden birini seçerek seansınızı erteleyebilirsiniz.\n– Terapiyi sonlandırmak istediğinizi bana bildirebilirsiniz.\n\n■ İptal ve erteleme kuralı\n\n{kural} İşleminizi tamamlamadan önce randevu sayfasında bu kural size yeniden hatırlatılır.\n\n■ Bağlantınızın güvenliği\n\nBu bağlantı yalnızca size özeldir ve randevu bilgilerinize erişim sağlar. Güvenliğiniz için bağlantıyı başkalarıyla paylaşmamanızı rica ederim.\n\nRandevu sayfasında adınız görünmez. Yine de bağlantıya sahip olan herkes sayfayı açabileceği için bağlantıyı gizli tutmanız önemlidir.\n\nBağlantının başka birinin eline geçtiğini düşünürseniz lütfen bu e-postayı yanıtlayarak bana yazın; size yeni bir bağlantı gönderirim.\n\nTerapi süreciniz boyunca randevularınızı bu sayfadan kolayca yönetebilirsiniz.\n\nSaygılarımla,\n{imza}",
  },
  // Sonlandırma görüşmesi daveti
  "danisan.sonlandirma": {
    subject: "Sonlandırma görüşmesi – klinikterapist.com",
    body: "Sayın {ad},\n\nTerapi sürecimizin sonlandırma aşamasına yaklaşıyoruz. Süreci birlikte değerlendirmek ve sağlıklı bir şekilde tamamlamak için sizinle ücretsiz, 25–30 dakikalık bir sonlandırma görüşmesi yapmak isterim.\n\nSonlandırma görüşmesi terapi sürecinin önemli bir parçasıdır. Bu görüşmede:\n\n– Hedeflerimizi ve ilerlemenizi değerlendireceğiz: Terapiye başlarken belirlediğimiz hedeflere, süreç boyunca yaşadığınız değişimlere ve kaydettiğiniz ilerlemeye birlikte bakacağız.\n– Kazandığınız becerileri ele alacağız: Sizin için nelerin işe yaradığını ve bu kazanımları günlük yaşamınızda nasıl sürdürebileceğinizi konuşacağız.\n– Geleceğe yönelik bir yol haritası çıkaracağız: İleride karşılaşabileceğiniz zorlayıcı durumları ve bu durumlarla başa çıkmak için kullanabileceğiniz yolları değerlendireceğiz.\n– Süreci birlikte gözden geçireceğiz: Terapi deneyiminizle ilgili duygu ve düşüncelerinizi, varsa sorularınızı ve paylaşmak istediklerinizi konuşacağız.\n\n■ Görüşme bilgileri\n\n– Süre: 25–30 dakika\n– Görüşme biçimi: Online\n– Ücret: Ücretsiz\n\nGörüşmenin gününü ve saatini, size özel randevu sayfanızdan takvimimdeki boş saatler arasından seçebilirsiniz. Seçiminizi {son_tarih} gününün sonuna kadar yapmanızı rica ederim.\n\n→ Görüşme saatini seç: {sayfa_baglantisi}\n\nBu tarihe kadar bir saat seçmezseniz, bu tarihten sonraki ilk seansınızı ücretsiz sonlandırma görüşmesi olarak planlayacağım. Bu durumda görüşme seans saatinizde başlar ve 25–30 dakika sürer.\n\nTerapi sürecinde sizinle birlikte çalışmış olmaktan memnuniyet duyuyorum. Bu son görüşmenin, edindiğiniz kazanımları fark etmenize ve sonraki adımlarınızı daha sağlam planlamanıza yardımcı olmasını dilerim.\n\nSaygılarımla,\n{imza}",
  },
  // Sonlandırma görüşmesi: danışan saati seçti
  "oto.sonlandirma-secildi": {
    subject: "Sonlandırma görüşmeniz planlandı – klinikterapist.com",
    body: "Merhaba,\n\nRandevu sayfanızdan yaptığınız seçimle sonlandırma görüşmemizin planlandığını bildirmek isterim.\n\n– Tarih: {tarih}\n– Saat: {saat} (Türkiye saati)\n– Süre: 25–30 dakika\n– Görüşme biçimi: Online\n– Ücret: Ücretsiz\n\nGörüşmeye katılmanız için gereken bağlantıyı görüşmeden önce size e-postayla göndereceğim.\n\n→ Randevu sayfama git: {sayfa_baglantisi}\n\nBu işlemi siz yapmadıysanız lütfen bu e-postayı yanıtlayarak hemen bana yazın.\n\nSaygılarımla,\n{imza}",
  },
  // Sonlandırma görüşmesi: saat seçimi hatırlatması
  "oto.sonlandirma-hatirlatma": {
    subject: "Sonlandırma görüşmesi için saat seçimi – klinikterapist.com",
    body: "Sayın {ad},\n\nSonlandırma görüşmemizin gününü ve saatini henüz seçmediğinizi hatırlatmak isterim. Seçiminizi {son_tarih} gününün sonuna kadar randevu sayfanızdan yapabilirsiniz.\n\n→ Görüşme saatini seç: {sayfa_baglantisi}\n\n[[hedef]]\nBu tarihe kadar bir saat seçmezseniz, {tarih}, saat {saat} seansınızı ücretsiz, 25–30 dakikalık sonlandırma görüşmesi olarak planlayacağım.\n[[/hedef]]\n\nSaygılarımla,\n{imza}",
  },
  // Sonlandırma görüşmesi: seans kendiliğinden dönüştü
  "oto.sonlandirma-otomatik": {
    subject: "Sonlandırma görüşmeniz planlandı – klinikterapist.com",
    body: "Sayın {ad},\n\nSonlandırma görüşmemiz için bir saat seçilmediğinden, aşağıdaki seansınızı ücretsiz sonlandırma görüşmesi olarak planladım.\n\n– Tarih: {tarih}\n– Saat: {saat} (Türkiye saati)\n– Süre: 25–30 dakika\n– Görüşme biçimi: Online\n– Ücret: Ücretsiz\n\nGörüşmeye katılmanız için gereken bağlantıyı görüşmeden önce size e-postayla göndereceğim. Bu saat size uygun değilse görüşmeyi randevu sayfanızdan erteleyebilirsiniz.\n\n→ Randevu sayfama git: {sayfa_baglantisi}\n\nSaygılarımla,\n{imza}",
  },
  // Terapi tamamlandı
  "danisan.tamamlandi": {
    subject: "Terapi sürecimiz tamamlandı – klinikterapist.com",
    body: "Sayın {ad},\n\nBirlikte yürüttüğümüz terapi sürecinin sona erdiğini bildirmek isterim.\n\nSürecin tamamlanmasıyla haftalık seans saatiniz takvimimden kaldırıldı ve randevu bilgileriniz randevu sistemimden silindi.\n\nBu süreçte gösterdiğiniz emek, iş birliği ve benimle paylaştıklarınız için teşekkür ederim. Terapide edindiğiniz kazanımları günlük yaşamınızda sürdürmenizi dilerim.\n\nİleride yeniden psikolojik desteğe ihtiyaç duyarsanız sitemden dilediğiniz zaman yeni bir randevu talebi gönderebilirsiniz.\n\n→ Yeni randevu talebi oluştur: {randevu_baglantisi}\n\nSize sağlıklı, huzurlu ve güzel günler dilerim.\n\nSaygılarımla,\n{imza}",
  },
  // Düzeltme (Geri al)
  "danisan.geri-al": {
    subject: "Önceki e-postamla ilgili düzeltme – klinikterapist.com",
    body: "Sayın {ad},\n\nTalebinizle ilgili bir önceki e-postam teknik bir sorun nedeniyle yanlışlıkla gönderildi. Lütfen o e-postayı dikkate almayın. Oluşan karışıklık için özür dilerim.\n\nTalebiniz bana ulaştı ve değerlendirmesi sürüyor. Talebinizi yeniden değerlendirip doğru ve güncel yanıtımı en kısa sürede ayrı bir e-postayla göndereceğim.\n\nAnlayışınız için teşekkür ederim.\n\nSaygılarımla,\n{imza}",
  },
  // Panelden seans iptali (owner's note 2026-10-22: the client hears of it)
  "danisan.iptal": {
    subject: "Seansınız iptal edildi – klinikterapist.com",
    body: "Sayın {ad},\n\n[[ben]]\nAşağıdaki seansımızı iptal etmek durumunda kaldığımı bildirmek isterim. Anlayışınız için teşekkür ederim.\n[[/ben]]\n[[siz]]\nİsteğiniz üzerine aşağıdaki seansınız iptal edildi.\n[[/siz]]\n\n– Seans türü: {tur}\n– Tarih: {tarih}\n– Saat: {saat} (Türkiye saati)\n\nDiğer seanslarınız planlandığı gibi devam eder. Bir sorunuz olursa bu e-postayı yanıtlayarak bana yazabilirsiniz.\n\nSaygılarımla,\n{imza}",
  },
  // Panelden seans ertelemesi
  "danisan.erteleme": {
    subject: "Seansınız ertelendi – klinikterapist.com",
    body: "Sayın {ad},\n\n[[ben]]\nAşağıdaki seansımızı ertelemek durumunda kaldığımı bildirmek isterim. Anlayışınız için teşekkür ederim.\n[[/ben]]\n[[siz]]\nİsteğiniz üzerine aşağıdaki seansınız ertelendi.\n[[/siz]]\n\n– Seans türü: {tur}\n– Önceki tarih ve saat: {tarih}, {saat}\n[[yeni]]\n– Yeni tarih ve saat: {yeni_tarih}, {yeni_saat} (Türkiye saati)\n[[/yeni]]\n[[yenisiz]]\n\nYeni tarihi ve saati en kısa sürede sizinle birlikte belirleyeceğiz.\n[[/yenisiz]]\n\nOnline görüşme bağlantısını seanstan önce size e-postayla göndereceğim. Bir sorunuz olursa bu e-postayı yanıtlayarak bana yazabilirsiniz.\n\nSaygılarımla,\n{imza}",
  },
  // Seans takibe geçirince: haftalık seans günü ve saati (sahibin notu 2026-10-23)
  "danisan.takip-basladi": {
    subject: "Haftalık seanslarımız planlandı – klinikterapist.com",
    body: "Sayın {ad},\n\nHaftalık seanslarımızın planını aşağıda bulabilirsiniz.\n\n– Seans türü: {tur}\n– Seans günü ve saati: Her {gun}, {saat} (Türkiye saati)\n– İlk seans: {tarih}\n– Seans süresi: {sure}\n– Biçim: Online\n\nOnline görüşme bağlantısını seanstan önce size e-postayla göndereceğim. Her seanstan 3 gün önce de bir hatırlatma e-postası gelir.\n\nBu plan size uymuyorsa bu e-postayı yanıtlayarak bana yazabilirsiniz.\n\nSaygılarımla,\n{imza}",
  },
  // Panelden ek seans ya da sonlandırma görüşmesi ekleme
  "danisan.ek-seans": {
    subject: "Yeni seansınız planlandı – klinikterapist.com",
    body: "Sayın {ad},\n\nSizin için aşağıdaki görüşmeyi planladım.\n\n– Görüşme türü: {tur}\n– Tarih: {tarih}\n– Saat: {saat} (Türkiye saati)\n– Biçim: Online\n\nOnline görüşme bağlantısını seanstan önce size e-postayla göndereceğim. Bu saat size uymuyorsa bu e-postayı yanıtlayarak bana yazabilirsiniz.\n\nSaygılarımla,\n{imza}",
  },
  // Ödeme alındı (teşekkür)
  "odeme.tesekkur": {
    subject: "Seans ödemeniz alındı – klinikterapist.com",
    body: "Sayın {ad},\n\nAşağıdaki seansınız için yaptığınız ödeme bana ulaştı.\n\n– Seans türü: {tur}\n– Tarih: {tarih}\n– Saat: {saat} (Türkiye saati)\n– Ödeme durumu: Ödendi\n\nOnline görüşme bağlantısını seanstan önce size e-postayla göndereceğim.\n\n{motivasyon}\n\nÖdemeniz ve sürece gösterdiğiniz özen için teşekkür ederim. Görüşmemizde buluşmak üzere.\n\nSaygılarımla,\n{imza}",
  },
  // Bir saat boşaldı
  "bekleme.yer-acildi": {
    subject: "Bir saat boşaldı – klinikterapist.com",
    body: "Sayın {ad},\n\nDaha önce uygun bir randevu saati açıldığında size haber vermemi istemiştiniz. Sizin için uygun olabilecek bir saat boşaldı.\n\nÖnerdiğim randevu zamanı:\n\n– Tarih: {tarih}\n– Saat: {saat} (Türkiye saati)\n\nBu saati şimdilik sizin için ayırıyorum.\n\nBu saat size uygunsa bu e-postayı yanıtlamanız yeterlidir. Yanıtınızdan sonra randevunuzu kesinleştirip size bir onay e-postası göndereceğim.\n\nSaat size uygun değilse lütfen bana haber verin. Sizi bekleme listesinde tutmaya devam edebilirim; yeni bir saat açıldığında size yeniden yazarım.\n\nSaygılarımla,\n{imza}",
  },
  // Randevu alımı açıldı
  "bekleme.alim-acik": {
    subject: "Randevu alımı yeniden açıldı – klinikterapist.com",
    body: "Sayın {ad},\n\nYeni danışan kabulüne yeniden başladığımda size haber vermemi istemiştiniz. Randevu alımı yeniden açıldı.\n\nSize uygun gün ve saatleri aşağıdaki bağlantıdan görebilir, randevu talebinizi gönderebilirsiniz.\n\n→ Randevu sayfasına git: {randevu_baglantisi}\n\nUygun saatler dolmadan size haber vermek istedim. İlginiz ve sabrınız için teşekkür ederim.\n\nSaygılarımla,\n{imza}",
  },
  // Listeden çıkarma
  "bekleme.cikarma": {
    subject: "Bekleme listem hakkında – klinikterapist.com",
    body: "Sayın {ad},\n\nBeklediğiniz ve gösterdiğiniz anlayış için teşekkür ederim.\n\nNe yazık ki yakın zamanda size uygun bir randevu saati açılacağını öngöremiyorum. Bu nedenle kaydınızı bekleme listemden çıkarıyorum.\n\nDestek arayışınızı yalnızca benden randevu alabilmek için ertelemenizi istemem. İhtiyaçlarınızı karşılayabilecek başka bir uzmandan destek almayı değerlendirmenizi öneririm.\n\nİleride randevu alımı yeniden açılırsa sitemden yeniden randevu talebi gönderebilirsiniz.\n\n→ Randevu sayfasına git: {randevu_baglantisi}\n\nSabrınız ve ilginiz için yeniden teşekkür eder, size uygun desteğe en kısa zamanda ulaşmanızı dilerim.\n\nSaygılarımla,\n{imza}",
  },
  // Yeni seans talebi (sahibe)
  "bildirim.seans-talebi": {
    subject: "Randevu talebi – {ad} – {tarih}, {saat}",
    body: "Yeni bir seans talebi geldi.\n\n■ Randevu bilgileri\n\n– Görüşme türü: {tur}\n– Talep edilen tarih: {tarih}\n– Talep edilen saat: {saat} (Türkiye saati)\n– Başvuru tarihi: {gonderim} (Türkiye saati)\n\n■ Danışan bilgileri\n\n– Ad soyad: {ad}\n– E-posta: {e_posta}\n– Telefon: {telefon}\n– Yaşadığı ülke: {ulke}\n– Konuşma dili: {dil}\n\n[[not]]\n■ Danışanın notu\n\n{not}\n\n– Not için açık rıza: {not_rizasi}\n[[/not]]\n\n■ Yapılması gereken\n\nTalep edilen saat 24 saat boyunca sitede \"Dolu\" görünür. Bu süre içinde talebi Randevu Talepleri ekranında inceleyip onaylayabilir ya da danışana yanıt verebilirsiniz.\n\n→ Randevu Talepleri ekranını aç: {panel_baglantisi}\n\nPanelde Yanıtla seçeneğiyle randevuyu onaylayabilir ya da başka bir saat önerebilirsiniz; yanıtınız doğrudan danışana e-postayla gider.\n\nÖnemli: Talep 24 saat içinde sonuçlanmazsa saat kendiliğinden yeniden açılır.\n\nBu bildirim kendiliğinden gönderildi. Talebi panelden sonuçlandırabilirsiniz.",
  },
  // Yeni ön görüşme talebi (sahibe)
  "bildirim.ongorusme-talebi": {
    subject: "Ön görüşme talebi – {ad} – {tarih}, {saat}",
    body: "Yeni bir ücretsiz ön görüşme talebi geldi.\n\n■ Talep bilgileri\n\n– Ad soyad: {ad}\n– Talep edilen tarih: {tarih}\n– Talep edilen saat: {saat} (Türkiye saati)\n– Görüşme türü: Ücretsiz ön görüşme\n– Görüşme şekli: {gorusme_sekli}\n– Başvuru: {kimin_icin}\n– Konuşma dili: {dil}\n\n■ Başvuru içeriği\n\n– Daha önce psikolojik destek aldı mı: {daha_once_destek}\n– Yaş aralığı: {yas}\n– Yaşadığı ülke: {ulke}\n– Ek not: {not}\n– Konu seçimleri için açık rıza: Verildi\n\nBelirttiği konular:\n\n{konular}\n\n■ İletişim bilgileri\n\n– E-posta: {e_posta}\n– Telefon: {telefon}\n\n■ İşlem durumu\n\nTalep edilen saat 24 saat boyunca sitede \"Dolu\" görünür. Bu süre içinde talebi panelden onaylayabilir ya da danışana yanıt verebilirsiniz.\n\n→ Randevu Talepleri ekranını aç: {panel_baglantisi}\n\nÖnemli: Talep hakkında karar vermezseniz saat 24 saat sonra kendiliğinden yeniden açılır. Panelde Yanıtla seçeneğiyle gönderdiğiniz e-posta doğrudan danışana gider.\n\nTalep zamanı: {gonderim} (Türkiye saati)",
  },
  // Haber et (bekleme listesi, sahibe)
  "bildirim.bekleme": {
    subject: "Haber et – {ad}",
    body: "Yeni bir bekleme listesi kaydı geldi.\n\nRandevu alımı şu an kapalı olduğu için {ad}, uygun bir saat açıldığında haber almak üzere bekleme listesine yazıldı.\n\n■ Danışan bilgileri\n\n– Ad soyad: {ad}\n– E-posta: {e_posta}\n– Telefon: {telefon}\n– Aradığı görüşme türü: {tur}\n– Uygun olduğu zamanlar: {uygun_zamanlar}\n– Konuşma dili: {dil}\n– Başvuru nedeni: {basvuru_nedeni}\n\n■ Yapılması gereken\n\nRandevu alımı yeniden açıldığında ya da uygun bir saat boşaldığında danışana yazabilirsiniz.\n\n→ Bekleme listesini aç: {panel_baglantisi}\n\nÖnemli: Bekleme listesi kayıtları en fazla {saklama_gun} gün tutulur.\n\nBu bildirim kendiliğinden gönderildi. Danışan bilgilerini gizli tutun.",
  },
  // İletişim formu (sahibe)
  "bildirim.iletisim": {
    subject: "{konu} – {ad}",
    body: "Siteniz üzerinden yeni bir iletişim formu mesajı geldi.\n\n■ Gönderen bilgileri\n\n– Ad soyad: {ad}\n– E-posta: {e_posta}\n– Konu: {konu}\n– Sayfa dili: {dil}\n– Gönderim tarihi: {gonderim} (Türkiye saati)\n\n■ Mesaj\n\n{mesaj}\n\n■ Yanıtlamak için\n\nBu e-postada Yanıtla seçeneğini kullandığınızda yanıtınız doğrudan mesajı gönderen kişinin e-posta adresine gider.\n\nBu bildirim klinikterapist.com iletişim formundan kendiliğinden gönderildi.",
  },
  // Danışan: seans iptali (sahibe)
  "bildirim.iptal": {
    subject: "{danisan_kodu} seansını iptal etti – {tarih}, {saat}",
    body: "Danışan kendi randevu sayfasından bir seansı iptal etti.\n\n■ İptal edilen seans\n\n– Danışan kodu: {danisan_kodu}\n– Tarih: {tarih}\n– Saat: {saat}\n\n■ Sistem durumu\n\n– Seans, Danışanlar ekranında \"İptal edildi · danışan istedi\" olarak işaretlendi.\n– Saat takvimde ve sitede yeniden açıldı.\n\n[[not]]\n■ Danışanın notu\n\n{not}\n[[/not]]\n\n→ Danışanın kaydını aç: {panel_baglantisi}\n\nEk bir işlem yapmanız gerekmiyor. Danışana yazmak isterseniz bu e-postada Yanıtla seçeneğini kullanabilirsiniz; yanıtınız danışanın kayıtlı e-posta adresine gider.\n\nBu bildirim kendiliğinden gönderildi.",
  },
  // Danışan: seans iptali, 24 saatten az kala (sahibe)
  "bildirim.iptal-gec": {
    subject: "{danisan_kodu} seansını iptal etti (24 saatten az kala) – {tarih}, {saat}",
    body: "Danışan kendi randevu sayfasından bir seansı, seansa 24 saatten az kala iptal etti.\n\n■ İptal edilen seans\n\n– Danışan kodu: {danisan_kodu}\n– Tarih: {tarih}\n– Saat: {saat}\n\n■ Ücret\n\nDanışan, seans ücretinin tamamının ödeneceğini ve bunun kendi sorumluluğunda olduğunu belirten uyarıyı onayladı.\n\n■ Sistem durumu\n\n– Seans, Danışanlar ekranında \"İptal edildi · danışan istedi\" olarak işaretlendi.\n– Saat takvimde ve sitede yeniden açıldı.\n\n[[not]]\n■ Danışanın notu\n\n{not}\n[[/not]]\n\n→ Danışanın kaydını aç: {panel_baglantisi}\n\nDanışana yazmak isterseniz bu e-postada Yanıtla seçeneğini kullanabilirsiniz; yanıtınız danışanın kayıtlı e-posta adresine gider.\n\nBu bildirim kendiliğinden gönderildi.",
  },
  // Danışan: seans ertelemesi (sahibe)
  "bildirim.erteleme": {
    subject: "{danisan_kodu} seansını erteledi – {tarih}, {saat} → {yeni_tarih}, {yeni_saat}",
    body: "Danışan kendi randevu sayfasından bir seansı erteledi.\n\n■ Ertelenen seans\n\n– Danışan kodu: {danisan_kodu}\n– Önceki tarih ve saat: {tarih}, {saat}\n– Yeni tarih ve saat: {yeni_tarih}, {yeni_saat}\n\n[[gec]]\n■ Ücret\n\nErteleme seansa 24 saatten az kala yapıldı. Danışan, seans ücretinin tamamının ödeneceğini ve bunun kendi sorumluluğunda olduğunu belirten uyarıyı onayladı.\n[[/gec]]\n\n■ Sistem durumu\n\n– Seans, Danışanlar ekranında \"Ertelendi · danışan istedi\" olarak işaretlendi.\n– Yeni saat takvime işlendi, önceki saat sitede yeniden açıldı.\n\n[[not]]\n■ Danışanın notu\n\n{not}\n[[/not]]\n\n→ Danışanın kaydını aç: {panel_baglantisi}\n\nDanışana yazmak isterseniz bu e-postada Yanıtla seçeneğini kullanabilirsiniz; yanıtınız danışanın kayıtlı e-posta adresine gider.\n\nBu bildirim kendiliğinden gönderildi.",
  },
  // Danışan: terapiyi sonlandırma isteği (sahibe)
  "bildirim.sonlandirma": {
    subject: "{danisan_kodu} terapiyi sonlandırmak istiyor",
    body: "Danışan kendi randevu sayfasından terapiyi sonlandırmak istediğini bildirdi.\n\n– Danışan kodu: {danisan_kodu}\n\n[[not]]\n■ Danışanın notu\n\n{not}\n[[/not]]\n\nDanışanla konuştuktan sonra danışanın kaydında Terapiyi sonlandır seçeneğini kullanabilirsiniz.\n\n→ Danışanın kaydını aç: {panel_baglantisi}\n\nDanışana yazmak isterseniz bu e-postada Yanıtla seçeneğini kullanabilirsiniz; yanıtınız danışanın kayıtlı e-posta adresine gider.\n\nBu bildirim kendiliğinden gönderildi.",
  },
  // Sonlandırma görüşmesi saati seçildi (sahibe)
  "bildirim.sonlandirma-secildi": {
    subject: "{danisan_kodu} sonlandırma görüşmesinin saatini seçti – {tarih}, {saat}",
    body: "Danışan kendi randevu sayfasından sonlandırma görüşmesinin gününü ve saatini seçti.\n\n– Danışan kodu: {danisan_kodu}\n– Tarih: {tarih}\n– Saat: {saat}\n– Süre ve ücret: 30 dakika, ücretsiz\n\nGörüşme danışanın seans listesine ve takvime işlendi.\n\n→ Danışanın kaydını aç: {panel_baglantisi}\n\nBu bildirim kendiliğinden gönderildi.",
  },
  // Sonlandırma görüşmesi saati seçilmedi, hatırlatma (sahibe)
  "bildirim.sonlandirma-hatirlatma": {
    subject: "{danisan_kodu} sonlandırma görüşmesinin saatini henüz seçmedi",
    body: "Danışan sonlandırma görüşmesinin saatini henüz seçmedi. Kendisine bir hatırlatma e-postası gönderildi.\n\n– Danışan kodu: {danisan_kodu}\n– Seçim için son gün: {son_tarih}\n\n[[hedef]]\nDanışan bu tarihe kadar seçim yapmazsa, {tarih}, {saat} seansı kendiliğinden ücretsiz, 30 dakikalık sonlandırma görüşmesine dönüşecek.\n[[/hedef]]\n\n→ Danışanın kaydını aç: {panel_baglantisi}\n\nBu bildirim kendiliğinden gönderildi.",
  },
  // Sonlandırma görüşmesi: seans dönüştü ya da dönüşemedi (sahibe)
  "bildirim.sonlandirma-otomatik": {
    subject: "{danisan_kodu}: sonlandırma görüşmesi için saat seçilmedi",
    body: "Danışan sonlandırma görüşmesi için {son_tarih} tarihine kadar bir saat seçmedi.\n\n[[hedef]]\nDanışanın bu tarihten sonraki ilk planlı seansı kendiliğinden ücretsiz, 30 dakikalık sonlandırma görüşmesine dönüştü; danışana e-postayla bilgi verildi.\n\n– Danışan kodu: {danisan_kodu}\n– Tarih: {tarih}\n– Saat: {saat}\n[[/hedef]]\n\n[[yok]]\nDanışanın ileride planlı bir seansı olmadığı için dönüştürülecek seans bulunamadı. Görüşmeyi danışanın kaydından kendiniz ekleyebilirsiniz.\n[[/yok]]\n\n→ Danışanın kaydını aç: {panel_baglantisi}\n\nBu bildirim kendiliğinden gönderildi.",
  },
  // Ödeme alınmadı (sahibe)
  "bildirim.odeme-yok": {
    subject: "{danisan_kodu}: ödeme alınmadı – {tarih}, {saat}",
    body: "Seansa {odeme_suresi} saat kaldı ve ödeme \"Ödendi\" olarak işaretlenmedi.\n\n– Danışan kodu: {danisan_kodu}\n– Tarih: {tarih}\n– Saat: {saat}\n\nÖdeme geldiyse danışanın kaydında seansı Ödendi olarak işaretleyin. Seansı ertelemek isterseniz yine oradan Ertele seçeneğini kullanabilirsiniz. Sistem kendiliğinden bir işlem yapmaz.\n\n→ Danışanın kaydını aç: {panel_baglantisi}\n\nDanışana yazmak isterseniz bu e-postada Yanıtla seçeneğini kullanabilirsiniz; yanıtınız danışanın kayıtlı e-posta adresine gider.\n\nBu bildirim kendiliğinden gönderildi.",
  },
  // Tutma süresi doluyor (sahibe)
  "bildirim.tutma": {
    subject: "Bir talebin tutma süresi doluyor",
    body: "Aşağıdaki talep için henüz karar vermediniz:\n\n{tutma_listesi}\n\nKarar vermezseniz saat sitede yeniden açılır ve başka biri alabilir. Talep ise 30 gün boyunca panelde kalır.\n\n→ Randevu Talepleri ekranını aç: {panel_baglantisi}",
  },
} as const satisfies Record<string, { subject: string; body: string }>;

export type MailId = keyof typeof MAIL_TR;
