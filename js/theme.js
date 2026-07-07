// =====================================================
// THEME AUTO-DETECT — berdasarkan gudang user yang login
// File ini dipanggil di SEMUA halaman (dashboard, master-barang,
// barang-masuk, dll) supaya tema warna konsisten di seluruh sistem.
//
// - Raden Saleh -> tema biru
// - Margomulyo  -> tema merah maroon
// - Gudang lain -> tetap tema gelap default (tidak ada class tambahan)
//
// Class CSS yang dipakai (theme-blue-raden-saleh / theme-red-margomulyo)
// sudah didefinisikan di css/dashboard.css, jadi file ini HANYA
// bertugas menambahkan class ke <body> berdasarkan data user login.
// =====================================================

(function applyWarehouseTheme(){
    try{
        var u = JSON.parse(sessionStorage.getItem("user"));
        var gudang = (u && u.gudang ? String(u.gudang) : "").toLowerCase();

        // Bersihkan dulu class tema lama (jaga-jaga kalau ada sisa)
        document.body.classList.remove("theme-blue-raden-saleh", "theme-red-margomulyo");

        if (gudang.indexOf("raden saleh") !== -1){
            document.body.classList.add("theme-blue-raden-saleh");
        } else if (gudang.indexOf("margomulyo") !== -1){
            document.body.classList.add("theme-red-margomulyo");
        }
        // Kalau nanti ada gudang baru, tinggal tambah else-if di sini
        // + tambahkan block warna barunya di css/dashboard.css

    }catch(e){
        console.error("Theme detect error:", e);
    }
})();
