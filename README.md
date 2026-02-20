# ⚡ BuzzHaber - 60 Saniyede Haber

Modern bir haber sitesi. X (Twitter) üzerindeki BuzzHaber hesabından çekilen tweet'leri şık bir arayüzde sunar.

## Özellikler

- ✅ X/Twitter API entegrasyonu ile tweet çekme
- ✅ Otomatik oynatan videolar (ses açılıp kapatılabilir)
- ✅ Infinite scroll ile sonsuz akış
- ✅ Modern, karanlık tema tasarımı
- ✅ Mobil uyumlu arayüz
- ✅ Tweet etkileşimleri (beğen, paylaş)

## Kurulum

1. Repoyu klonla:
```bash
git clone https://github.com/evantaylor77/sorceriocom.git
cd sorceriocom
```

2. Bağımlılıkları yükle:
```bash
npm install
```

3. Twitter API token'ı al:
   - https://developer.twitter.com/ adresine git
   - Yeni bir uygulama oluştur
   - Bearer Token'ı kopyala

4. `.env` dosyası oluştur:
```bash
cp .env.example .env
```

5. `.env` dosyasına token'ı ekle:
```
TWITTER_BEARER_TOKEN=your_token_here
```

6. Yerel olarak çalıştır:
```bash
npm run dev
```

Site http://localhost:3000 adresinde açılacak.

## Deploy

Vercel'e deploy etmek için:

```bash
npm run deploy
```

Vercel'de environment variable olarak `TWITTER_BEARER_TOKEN` eklemeyi unutma!

## Proje Yapısı

```
BuzzNews/
├── index.html          # Ana sayfa
├── style.css           # Stiller
├── app.js              # Frontend JavaScript
├── api/
│   └── tweets.js       # Twitter API endpoint
├── package.json        # Bağımlılıklar
├── vercel.json         # Vercel yapılandırması
└── .env.example        # Environment variable örneği
```

## Kullanım

- Videolar otomatik oynar
- Video'ya tıklayarak sessiz/sesli yapabilirsin
- "Devamını Yükle" butonuyla daha fazla haber yükle
- Beğeni ve paylaş butonları ile etkileşime geç

## Lisans

MIT
