# Cacamaricca Store

Website toko sekolah Cacamaricca dengan:
- kategori Jedai, Karet, Jepit, Bando, Clothes
- produk + harga + foto
- pilihan warna
- keranjang
- nama pembeli + kelas
- pembayaran Transfer / Cash
- stock berkurang otomatis ketika order berhasil
- stock di halaman toko update realtime
- halaman admin untuk tambah produk, warna, dan stock
- opening animation "Welcome to Cacamaricca"
- GitHub Pages sebagai frontend
- Supabase sebagai database/backend

## 1. Buat database

1. Buat project di Supabase.
2. Buka SQL Editor.
3. Jalankan seluruh isi `supabase.sql`.
4. Untuk login admin: buka Authentication > Users > Add user, lalu buat akun admin.
5. Supabase URL dan anon key ada di Project Settings > API.

## 2. Sambungkan website

Copy:
`config.example.js` → `config.js`

Lalu isi:
```js
export const SUPABASE_URL = "https://xxxxx.supabase.co";
export const SUPABASE_ANON_KEY = "ey....";
```

Jangan pernah memasukkan `service_role` key ke frontend.

## 3. Jalankan lokal

Karena browser module perlu HTTP server, jangan double-click `index.html`.

Contoh:
```bash
python -m http.server 5500
```

Buka:
http://localhost:5500

## 4. Upload ke GitHub

Buat repository, misalnya:
`cacamaricca-store`

Upload semua file:
- index.html
- style.css
- app.js
- config.js
- admin.html
- supabase.sql
- README.md

Lalu:
Settings → Pages → Source: GitHub Actions / Deploy from branch → branch `main` → `/root`.

## 5. Admin

Buka:
`https://USERNAME.github.io/cacamaricca-store/admin.html`

Login memakai akun Supabase yang dibuat di Authentication.

Admin dapat:
- tambah produk
- pilih kategori
- pasang harga
- pasang foto URL
- tambah warna
- tambah stock

## Catatan stock

Order diproses lewat database function `create_order` yang mengunci variant terlebih dahulu. Jadi dua pembeli yang checkout bersamaan tidak seharusnya bisa mengambil stock yang sama melebihi jumlah tersedia.

Untuk pembayaran transfer, status awal order adalah `waiting_payment`. Stock tetap dikurangi saat order dibuat. Untuk toko sekolah, ini bisa diubah nanti kalau mau stock baru dikurangi setelah pembayaran dikonfirmasi.

## Upgrade yang bisa ditambahkan

- upload foto langsung dari admin ke Supabase Storage
- halaman daftar order admin
- tombol "pesanan siap diambil"
- bukti transfer
- WhatsApp otomatis ke admin
- QRIS
- nomor order + tracking
- promo/voucher
- varian ukuran clothes
- laporan penjualan
- dashboard omzet
