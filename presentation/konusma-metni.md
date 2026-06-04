# KIVON WhatsApp AI Randevu Sistemi — Konuşma Metni

_Süre: ~8-10 dakika_

---

## SLIDE 1 — Kapak (30 sn)

Merhaba, bugün size KIVON'un geliştirdiği WhatsApp AI Randevu Sistemi'ni sunacağım.

Sağlık sektöründe randevu yönetimi, hasta memnuniyetini ve klinik verimliliğini doğrudan etkileyen en kritik süreçlerden biri. Biz bu süreci yapay zeka ve WhatsApp ile sıfır maliyetle çözen bir sistem geliştirdik.

Kısaca: Hastalar WhatsApp'tan mesaj atar, AI randevuyu alır, doktor muayenesine odaklanır.

---

## SLIDE 2 — Sorun (1 dk)

Randevu süreci neden hâlâ bu kadar zor? Dört temel sorun var.

**Bir:** Telefon kuyruğu. Günde onlarca çağrı, meşgul sinyali, hastalar beklemekten sıkılıyor. Hemşireleriniz sürekli telefon başında.

**İki:** Manuel takip. Randevular kağıda yazılıyor, çift kayıtlar oluyor, hasta gelmeyince haberiniz olmuyor.

**Üç:** 7/24 ulaşılabilirlik yok. Mesai saatleri dışında randevu almak isteyen hastalar beklemek zorunda kalıyor. Çoğu zaman başka kliniğe gidiyorlar.

**Dört:** Dijital dönüşüm maliyeti. Hazır çözümler aylık binlerce lira. Küçük klinikler için erişilemez durumda.

---

## SLIDE 3 — Çözüm (1.5 dk)

KIVON WhatsApp AI Randevu Asistanı bu dört sorunu da tek seferde çözüyor.

**AI Konuşma:** Hasta WhatsApp'tan "randevu" yazar. AI, doktor seçiminden tarih ve saat belirlemeye, onay almaya kadar tüm adımları otomatik yönetir. Hiçbir insan operatörüne gerek kalmaz.

**Anında Kayıt:** Randevu onaylanır onaylanmaz veritabanına yazılır ve doktor panelinde anında görünür. Çift kayıt, unutulan randevu, karışıklık sıfır.

**Web Panel:** Doktorlar web tarayıcıdan tüm randevularını görür, iptal eder, müsaitlik durumunu açıp kapatır.

Tüm bunların maliyeti: Sıfır lira. Kurulum süresi: 5 dakika.

---

## SLIDE 4 — Nasıl Çalışır (1 dk)

Hasta akışı çok basit. Dört adım:

**Adım 1:** Hasta WhatsApp'tan "randevu" yazar.

**Adım 2:** AI, klinikteki doktorları listeler. Hasta numara girerek doktorunu seçer.

**Adım 3:** AI, seçilen doktor için müsait gün ve saatleri gösterir. Hasta uygun olanı seçer.

**Adım 4:** AI, randevu özetini gösterir ve onay ister. Hasta "evet" dediği an randevu sisteme kaydedilir. Doktor panelinde anında belirir.

Teknik altyapıya bakacak olursak: WhatsApp mesajı Node.js bot'a gelir, bot Supabase Edge Function'a yönlendirir, Edge Function tüm konuşma mantığını yürütür ve veritabanına yazar. PostgreSQL'de depolanır. Doktor paneli de Supabase'e doğrudan bağlanarak güncel veriyi gösterir.

---

## SLIDE 5 — Teknik Mimari (1 dk)

Sistem dört katmandan oluşuyor. Tamamen ücretsiz teknolojiler kullanıldı.

**Katman 1 — WhatsApp Bot:** Node.js ve whatsapp-web.js ile çalışır. Normal WhatsApp Web gibi QR kod okutarak bağlanır. Gelen her mesajı Edge Function'a iletir.

**Katman 2 — AI Motoru:** Supabase Edge Function, Deno çalışma zamanında çalışır. Bir durum makinesi gibi tasarlandı — her hasta için konuşma durumunu takip eder, bir sonraki adımı belirler. Hiçbir harici AI API'sine ihtiyaç duymaz, tamamen kural tabanlı ve güvenilir.

**Katman 3 — Veritabanı:** Supabase PostgreSQL. Doktorlar, müsaitlik, randevular, hastalar ve oturum bilgileri için özel tablolar. Satır Seviyesi Güvenlik ile her kullanıcı sadece kendi verisini görebilir.

**Katman 4 — Web Panel:** GitHub Pages'te yayınlanan statik HTML/CSS/JS. Supabase JavaScript SDK ile veritabanına doğrudan bağlanır — arada hiçbir sunucu yok.

---

## SLIDE 6 — Doktor Paneli (1 dk)

Doktor paneli dört ana işlev sunar:

**Randevu Listesi:** Tüm randevular tarih, saat, hasta adı ve durum bilgisiyle tek tabloda. Bekleyen, onaylanan, iptal edilen — hepsi bir bakışta görünür.

**Slot Oluşturma:** Doktorlar başlangıç ve bitiş tarihi seçerek toplu müsaitlik slotu oluşturabilir. Örneğin "1 Haziran - 30 Haziran, hafta içi her gün 09:00-17:00" gibi.

**Müsaitlik Kontrolü:** Tek tuşla "müsait" veya "müsait değil" modu. Tatile çıkarken tek tık, yeni randevu alımı anında durur.

**WhatsApp Bağlantısı:** Her doktor kendi WhatsApp'ını QR kod okutarak bağlar. Bağlandıktan sonra tüm mesajlar otomatik işlenir.

---

## SLIDE 7 — Avantajlar (1 dk)

Neden KIVON? Dört somut avantaj:

**Bir — Aylık maliyet sıfır lira.** Supabase'in ücretsiz katmanı, GitHub Pages, kendi telefonunuzdaki WhatsApp bot. hiçbir abonelik, hiçbir sunucu maliyeti yok.

**İki — Kurulum süresi 5 dakika.** Telefona Termux kurulumu, bir klasör kopyalama, QR okutma. Bu kadar.

**Üç — 7/24 kesintisiz hizmet.** Telefonunuz açık olduğu sürece bot çalışır. Hasta gece 3'te mesaj atsa bile AI randevuyu alır.

**Dört — Veri güvenliği.** Supabase PostgreSQL'de KVKK uyumlu depolama. Satır seviyesi güvenlik politikaları. Her doktor sadece kendi hastalarını görür.

**Beş — Ölçeklenebilirlik.** Sistem 10 hastane, 100 doktor için de aynı şekilde çalışır. Altyapı otomatik ölçeklenir, ek maliyet gelmez.

---

## SLIDE 8 — Gelecek Planları (1 dk)

KIVON bir randevu sisteminden çok daha fazlası olacak. Ürün yol haritamızda üç ana bot var:

**Lead Gen Bot:** Web'den potansiyel hasta verisi toplama, AI ile segmentasyon, otomatik WhatsApp kampanyası. Kliniklere yeni hasta kazandıracak.

**Fiyat Takip Botu:** Rakip sağlık kuruluşlarının fiyatlarını izleme, dinamik fiyatlandırma önerileri.

**İhale Takip Botu:** Sağlık bakanlığı ve kurum ihalelerini anlık takip, otomatik başvuru hazırlama.

Ayrıca çoklu dil desteği ile İngilizce, Almanca, Arapça AI destekli randevu — turistik ve yabancı hasta kazanımı.

---

## SLIDE 9 — Kapanış (30 sn)

KIVON WhatsApp AI Randevu Sistemi, sağlık sektöründe dijital dönüşümü herkes için erişilebilir kılıyor.

Sıfır maliyet. Beş dakika kurulum. 7/24 kesintisiz hizmet.

Randevu sürecinizi 5 dakikada dijitale taşıyın. Hastalarınız WhatsApp'tan mesaj atsın, AI randevuyu alsın, siz muayeneye odaklanın.

Teşekkür ederim. Sorularınızı alabilirim.

---

## Q&A için Hazırlık

**S: Bot hangi telefonlarda çalışır?**
C: Android telefonlarda Termux uygulaması ile çalışır. iPhone'da da Termux benzeri uygulamalarla mümkün, ancak Android önerilir.

**S: Telefon kapanırsa ne olur?**
C: Bot durur. Telefon tekrar açıldığında bot otomatik başlamaz, manuel başlatmak gerekir. Çözüm olarak düşük maliyetli bir mini bilgisayar (Raspberry Pi ~500 TL) öneriyoruz.

**S: Hasta verileri güvende mi?**
C: Evet. Supabase PostgreSQL'de depolanır, TLS şifreleme ile iletilir. Satır seviyesi güvenlik sayesinde her doktor sadece kendi hastalarını görebilir. KVKK uyumludur.

**S: Aynı anda kaç hasta konuşabilir?**
C: Sınırsız. Her hasta için ayrı oturum tutulur. Edge Function paralel istekleri işleyebilir.

**S: Özelleştirme mümkün mü?**
C: Evet. Doktor listesi, çalışma saatleri, mesaj metinleri tamamen değiştirilebilir.
