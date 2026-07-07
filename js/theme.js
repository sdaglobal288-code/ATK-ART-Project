// =====================================================
// THEME ENGINE — warna custom per akun
// File ini dipanggil di SEMUA halaman.
//
// Sumber warna:
//   1) user.warna_tema (hex, contoh "#7a1f2c") -> kalau sudah diisi
//      lewat halaman Pengaturan Tema, ini yang dipakai.
//   2) Kalau user.warna_tema belum ada (akun lama / belum pernah
//      atur), fallback ke deteksi nama gudang seperti sebelumnya
//      supaya tampilan tidak berubah tiba-tiba.
//   3) Kalau tidak match apapun -> tema gelap default.
//
// Dari SATU warna dasar (base), fungsi ini menghitung otomatis:
// background, surface (card/panel), surface-2, sidebar, border,
// teks pudar, dll — supaya kontras & rapi tanpa perlu atur manual
// satu-satu, dan konsisten di SEMUA halaman (dashboard.css pakai
// --color-*, dashboard.html pakai --dsh-*, barang-keluar.html
// pakai --pg-*, dstnya).
// =====================================================

(function(){

    // ---------- util warna ----------

    function hexToRgb(hex){
        hex = hex.replace("#", "");
        if(hex.length === 3){
            hex = hex.split("").map(c => c + c).join("");
        }
        const num = parseInt(hex, 16);
        return {
            r: (num >> 16) & 255,
            g: (num >> 8) & 255,
            b: num & 255
        };
    }

    function rgbToHex(r, g, b){
        const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
        return "#" + [r, g, b].map(v => clamp(v).toString(16).padStart(2, "0")).join("");
    }

    // campur "hex" menuju "target" sebanyak "percent" (0-100)
    function mix(hex, target, percent){
        const c1 = hexToRgb(hex);
        const c2 = hexToRgb(target);
        const p = percent / 100;
        return rgbToHex(
            c1.r + (c2.r - c1.r) * p,
            c1.g + (c2.g - c1.g) * p,
            c1.b + (c2.b - c1.b) * p
        );
    }

    function darken(hex, percent){ return mix(hex, "#000000", percent); }
    function lighten(hex, percent){ return mix(hex, "#ffffff", percent); }

    // ---------- generate palet dari 1 warna dasar ----------

    function buatPalet(base){

        return {
            bg:            darken(base, 12),
            surface:       base,
            surface2:      lighten(base, 10),
            sidebarBg:     darken(base, 28),
            border:        lighten(base, 28),
            borderStrong:  lighten(base, 40),
            text:          "#ffffff",
            textSoft:      lighten(base, 72),
            textFaint:     lighten(base, 56),
            bg2:           darken(base, 20),
            bg3:           darken(base, 30),
            borderThin:    darken(base, 8)
        };

    }

    // ---------- terapkan palet ke elemen (body) ----------
    // dipasang di body.style supaya menang dibanding class lama
    // (theme-blue-raden-saleh / theme-red-margomulyo) kalau masih
    // tersisa di beberapa halaman.

    function terapkanPalet(base){

        const p = buatPalet(base);
        const el = document.body.style;

        // dipakai oleh css/dashboard.css (Master Barang, Barang Masuk, dll)
        el.setProperty("--color-bg", p.bg);
        el.setProperty("--color-surface", p.surface);
        el.setProperty("--color-surface-2", p.surface2);
        el.setProperty("--color-sidebar", p.sidebarBg);
        el.setProperty("--color-sidebar-soft", "rgba(255,255,255,.08)");
        el.setProperty("--color-text", p.text);
        el.setProperty("--color-text-soft", p.textSoft);
        el.setProperty("--color-text-faint", p.textFaint);
        el.setProperty("--color-border", p.border);
        el.setProperty("--color-border-strong", p.borderStrong);

        // dipakai oleh dashboard.html
        el.setProperty("--dsh-bg", p.bg);
        el.setProperty("--dsh-surface", p.surface);
        el.setProperty("--dsh-surface-2", p.surface2);
        el.setProperty("--dsh-border", p.border);
        el.setProperty("--dsh-text", p.text);
        el.setProperty("--dsh-muted", p.textSoft);
        el.setProperty("--dsh-sidebar-bg", p.sidebarBg);
        el.setProperty("--dsh-menu-title", p.textSoft);
        el.setProperty("--dsh-menu-btn", lighten(base, 85));

        // dipakai oleh barang-keluar.html / barang-masuk.html dll
        el.setProperty("--pg-border", p.border);
        el.setProperty("--pg-bg-1", p.surface);
        el.setProperty("--pg-text", p.text);
        el.setProperty("--pg-faint", p.textSoft);
        el.setProperty("--pg-bg-2", p.bg2);
        el.setProperty("--pg-border-2", p.borderThin);
        el.setProperty("--pg-hover-bg", p.surface2);
        el.setProperty("--pg-label", p.textSoft);
        el.setProperty("--pg-bg-3", p.bg3);

    }

    // dibuat global supaya bisa dipanggil dari halaman
    // Pengaturan Tema untuk preview langsung sebelum disimpan
    window.terapkanTemaCustom = terapkanPalet;

    // ---------- deteksi warna yang harus dipakai ----------

    function jalankan(){

        try{

            const u = JSON.parse(sessionStorage.getItem("user"));

            if(!u){
                return;
            }

            // 1) prioritas: warna custom tersimpan di akun
            if(u.warna_tema){
                terapkanPalet(u.warna_tema);
                return;
            }

            // 2) fallback: deteksi dari nama gudang (akun lama)
            const gudang = (u.gudang ? String(u.gudang) : "").toLowerCase();

            if(gudang.indexOf("raden saleh") !== -1){
                terapkanPalet("#12447f");
                return;
            }

            if(gudang.indexOf("margomulyo") !== -1){
                terapkanPalet("#7a1f2c");
                return;
            }

            // 3) default gelap netral (tidak diubah)

        }
        catch(e){
            console.error("Theme engine error:", e);
        }

    }

    jalankan();

})();
