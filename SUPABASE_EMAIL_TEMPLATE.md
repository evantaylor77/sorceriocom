# Supabase OTP E-Posta Ayari

Bu proje kayit akisinda e-postaya gelen 6 haneli kodu kullanir.

## Dashboard ayari

1. Supabase Dashboard > `Auth` > `Templates` sayfasina gidin.
2. `Confirm signup` sablonunu acin.
3. Icerigi OTP kodunu gosterecek sekilde guncelleyin.

Ornek:

```html
<h2>Kaydinizi dogrulayin</h2>
<p>Asagidaki kodu uygulamaya girin:</p>
<p style="font-size:28px; font-weight:700; letter-spacing:4px;">{{ .Token }}</p>
<p>Bu kodu siz istemediyseniz bu e-postayi yok sayin.</p>
```

Not:
- `{{ .Token }}` 6 haneli OTP kodudur.
- `{{ .ConfirmationURL }}` yerine `{{ .Token }}` kullanin.
- Uygulama kodu dogrularken `verifyOtp({ email, token, type: 'email' })` kullanir.
