// =====================================
// PERMINTAAN / PENGAMBILAN ATK & ART  (FHCS-003) — VERSI PUBLIK, TANPA LOGIN
// -------------------------------------------------------------------------
// Alur: karyawan buka link ini -> pilih GUDANG dulu -> baru daftar nama
// karyawan & stok barang muncul (difilter sesuai gudang yang dipilih).
// Tidak ada sessionStorage/login sama sekali di halaman ini.
//
// PERUBAHAN UTAMA vs versi sebelumnya:
// Permintaan yang diajukan lewat halaman ini TIDAK langsung memotong stok.
// Setiap baris disimpan ke barang_keluar dengan status "Menunggu Approval".
// Admin gudang yang memvalidasi (menyetujui/menolak) lewat panel Validasi
// di permintaan-atk-art.html — stok baru terpotong SETELAH disetujui.
// Setelah berhasil diajukan, tombol "Ajukan Permintaan" digantikan tombol
// "Cetak Bukti Permintaan" + "Buat Permintaan Baru".
//
// Mode cetak: kolom "Jenis Barang" & "Keterangan" pada tabel cetak sekarang
// auto-mengecilkan ukuran font kalau teksnya panjang, supaya tetap 1 baris
// dan sejajar rapi dengan kolom lain (bukan melebar ke 2 baris).
//
// PENTING (harus disiapkan di sisi Supabase, tidak bisa dilakukan dari sini):
// Karena halaman ini publik (anon key, tanpa auth), Row Level Security (RLS)
// di Supabase WAJIB diatur supaya anon hanya bisa:
//   - SELECT master_karyawan (idealnya hanya kolom yang dipakai: id, nama,
//     nik, departemen, jabatan, gudang, status — jangan ekspos kolom sensitif
//     lain seperti gaji dsb bila ada, sebaiknya lewat VIEW khusus)
//   - SELECT master_barang (katalog barang, aman)
//   - SELECT stok_gudang (perlu untuk menampilkan sisa stok — publik TIDAK
//     lagi butuh akses UPDATE/INSERT stok_gudang, karena pemotongan stok
//     sekarang hanya dilakukan oleh admin saat approve)
//   - INSERT saja ke barang_keluar (JANGAN beri akses SELECT/UPDATE/DELETE
//     publik ke riwayat transaksi — makanya panel histori & validasi
//     sengaja tidak ada di versi publik ini)
//
// MIGRASI DATABASE YANG DIPERLUKAN:
//   alter table barang_keluar add column if not exists status text default 'Disetujui';
// =====================================

const TAG_FORM = "[Formulir Permintaan ATK/ART]";
const STATUS_MENUNGGU = "Menunggu Approval";

let selectedGudang = "";
let masterBarangList = [];
let masterKaryawanList = [];
let stokGudangMap = new Map();

// =====================================
// GERBANG PILIH GUDANG
// =====================================

const gudangSelect   = document.getElementById("gudangSelect");
const formBodyGated  = document.getElementById("formBodyGated");
const karyawanSearchInputEl = document.getElementById("karyawanSearch");

async function loadDaftarGudang(){
    try{
        const { data, error } = await supabaseClient
            .from("master_karyawan")
            .select("gudang")
            .eq("status", "Aktif");

        if(error) throw error;

        const daftarGudang = Array.from(
            new Set((data || []).map(r => (r.gudang || "").trim()).filter(Boolean))
        ).sort((a, b) => a.localeCompare(b));

        gudangSelect.innerHTML = `<option value="">-- Pilih Gudang --</option>` +
            daftarGudang.map(g => `<option value="${g}">${g}</option>`).join("");
    }
    catch(err){ console.error(err); alert(err.message); }
}

async function onGudangBerubah(){
    selectedGudang = gudangSelect.value;

    // reset isi form yang bergantung pada gudang lama
    resetForm();

    if(!selectedGudang){
        formBodyGated.dataset.locked = "1";
        karyawanSearchInputEl.disabled = true;
        karyawanSearchInputEl.placeholder = "-- Pilih gudang dahulu --";
        masterKaryawanList = [];
        stokGudangMap = new Map();
        return;
    }

    formBodyGated.dataset.locked = "0";
    karyawanSearchInputEl.disabled = false;
    karyawanSearchInputEl.placeholder = "-- Cari Nama Karyawan --";

    await Promise.all([loadKaryawan(), loadStokGudang()]);
    refreshSemuaBarisStok();
}

gudangSelect.addEventListener("change", onGudangBerubah);

// =====================================
// LOAD MASTER KARYAWAN (difilter sesuai gudang yang dipilih)
// =====================================

async function loadKaryawan() {
    if(!selectedGudang){ masterKaryawanList = []; return; }
    try {
        const { data, error } = await supabaseClient
            .from("master_karyawan")
            .select("*")
            .eq("status", "Aktif")
            .eq("gudang", selectedGudang)
            .order("nama");

        if (error) throw error;
        masterKaryawanList = data || [];
    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}

function findKaryawanById(id){
    return masterKaryawanList.find(k => String(k.id) === String(id));
}

// =====================================
// LOAD MASTER BARANG + STOK GUDANG
// =====================================

async function loadBarang(){
    try{
        const { data, error } = await supabaseClient
            .from("master_barang")
            .select("*")
            .order("nama_barang");

        if(error) throw error;
        masterBarangList = data || [];
        refreshSemuaBarisStok();
    }
    catch(err){ console.error(err); alert(err.message); }
}

function findBarangById(id){
    return masterBarangList.find(b => String(b.id) === String(id));
}

async function loadStokGudang(){
    if(!selectedGudang){ stokGudangMap = new Map(); return; }
    try{
        const { data, error } = await supabaseClient
            .from("stok_gudang")
            .select("barang_id, stok")
            .eq("gudang", selectedGudang);

        if(error) throw error;

        stokGudangMap = new Map();
        (data || []).forEach(row=>{
            stokGudangMap.set(String(row.barang_id), Number(row.stok) || 0);
        });
    }
    catch(err){ console.error(err); alert(err.message); }
}

async function ambilStokLive(barangId){
    if(!barangId || !selectedGudang) return 0;

    const { data, error } = await supabaseClient
        .from("stok_gudang")
        .select("stok")
        .eq("barang_id", barangId)
        .eq("gudang", selectedGudang)
        .maybeSingle();

    if(error){ console.error(error); return 0; }
    return data ? (Number(data.stok) || 0) : 0;
}

// =====================================
// NAVIGASI KEYBOARD UNTUK COMBOBOX (helper umum)
// =====================================

function highlightComboItem(dropdown, activeIndex){
    const items = dropdown.querySelectorAll(".combo-item");
    items.forEach((el, idx)=>{
        if(idx === activeIndex){
            el.classList.add("combo-active");
            el.style.background = "rgba(255,255,255,0.15)";
            el.scrollIntoView({ block: "nearest" });
        } else {
            el.classList.remove("combo-active");
            el.style.background = "";
        }
    });
}

function getComboActiveIndex(dropdown){
    const items = Array.from(dropdown.querySelectorAll(".combo-item"));
    return items.findIndex(el => el.classList.contains("combo-active"));
}

// =====================================
// COMBOBOX NAMA KARYAWAN
// =====================================

const karyawanSearchInput = document.getElementById("karyawanSearch");
const karyawanHidden      = document.getElementById("karyawanId");
const karyawanDropdown    = document.getElementById("karyawanDropdown");
const departemenInput    = document.getElementById("departemen");
const nikInput           = document.getElementById("nik");

function setupKaryawanCombo(){

    function render(keyword){
        if(!selectedGudang){
            karyawanDropdown.innerHTML = `<div class="combo-empty">Pilih gudang terlebih dahulu</div>`;
            karyawanDropdown.classList.add("show");
            return;
        }

        const kw = (keyword || "").trim().toLowerCase();
        const filtered = masterKaryawanList.filter(k => k.nama.toLowerCase().includes(kw));

        karyawanDropdown.innerHTML = "";

        if(filtered.length === 0){
            karyawanDropdown.innerHTML = `<div class="combo-empty">Nama tidak ditemukan di gudang ini</div>`;
        } else {
            filtered.forEach(k=>{
                const item = document.createElement("div");
                item.className = "combo-item";
                item.textContent = k.nama;
                item.dataset.id = k.id;
                karyawanDropdown.appendChild(item);
            });
        }

        karyawanDropdown.classList.add("show");
    }

    karyawanSearchInput.addEventListener("input", function(){
        karyawanHidden.value = "";
        departemenInput.value = "";
        nikInput.value = "";
        render(this.value);
    });

    karyawanSearchInput.addEventListener("focus", function(){ render(this.value); });

    karyawanSearchInput.addEventListener("keydown", function(e){
        if(!karyawanDropdown.classList.contains("show")) return;
        const items = karyawanDropdown.querySelectorAll(".combo-item");
        if(items.length === 0) return;

        let activeIndex = getComboActiveIndex(karyawanDropdown);

        if(e.key === "ArrowDown"){
            e.preventDefault();
            activeIndex = (activeIndex + 1) % items.length;
            highlightComboItem(karyawanDropdown, activeIndex);
        } else if(e.key === "ArrowUp"){
            e.preventDefault();
            activeIndex = (activeIndex - 1 + items.length) % items.length;
            highlightComboItem(karyawanDropdown, activeIndex);
        } else if(e.key === "Enter"){
            if(activeIndex >= 0 && activeIndex < items.length){
                e.preventDefault();
                items[activeIndex].click();
            }
        } else if(e.key === "Escape"){
            karyawanDropdown.classList.remove("show");
        }
    });

    karyawanDropdown.addEventListener("click", function(e){
        const item = e.target.closest(".combo-item");
        if(!item || !item.dataset.id) return;
        const karyawan = findKaryawanById(item.dataset.id);
        if(!karyawan) return;
        karyawanHidden.value = karyawan.id;
        karyawanSearchInput.value = karyawan.nama;
        departemenInput.value = karyawan.departemen;
        nikInput.value = karyawan.nik;
        karyawanDropdown.classList.remove("show");
    });

    document.addEventListener("click", function(e){
        if(!e.target.closest(".combo-wrapper")) karyawanDropdown.classList.remove("show");
    });
}

setupKaryawanCombo();

// =====================================
// BARIS DETAIL BARANG — berupa <tr>/<td> asli
// (No | Jenis Barang | Type | Jumlah | Satuan | Keterangan | hapus)
// =====================================

function templateBarisBarang(){
    return `
        <td><span class="row-no"></span></td>
        <td>
            <div class="combo-wrapper">
                <input type="text" class="combo-input input-barang-search"
                    placeholder="-- Cari Jenis Barang --" autocomplete="off" required>
                <input type="hidden" class="input-barang-id">
                <div class="combo-dropdown input-barang-dropdown"></div>
            </div>
        </td>
        <td><input type="text" class="input-readonly input-kategori" placeholder="Type" readonly></td>
        <td>
            <input type="number" class="input-qty" placeholder="Jumlah" min="1" required>
            <span class="stok-mini">Stok: -</span>
        </td>
        <td><input type="text" class="input-readonly input-satuan" placeholder="Satuan" readonly></td>
        <td><input type="text" class="input-ket-row input-keterangan-row" placeholder="Keterangan (opsional)"></td>
        <td><button type="button" class="btn-hapus-baris" title="Hapus baris">✕</button></td>
    `;
}

function renomorBaris(){
    document.querySelectorAll("#detailRows .detail-row").forEach((row, idx)=>{
        row.querySelector(".row-no").textContent = idx + 1;
    });
}

function tambahBarisBarang(){
    const wrapper = document.getElementById("detailRows");
    const row = document.createElement("tr");
    row.className = "detail-row";
    row.dataset.stok = "0";
    row.innerHTML = templateBarisBarang();
    wrapper.appendChild(row);
    renomorBaris();
    return row;
}

function hapusBarisBarang(row){
    const wrapper = document.getElementById("detailRows");
    if(wrapper.children.length <= 1){ alert("Minimal harus ada 1 baris barang."); return; }
    row.remove();
    renomorBaris();
}

function renderBarangDropdown(row, keyword){
    const dropdown = row.querySelector(".input-barang-dropdown");
    const kw = (keyword || "").trim().toLowerCase();
    const filtered = masterBarangList.filter(b => b.nama_barang.toLowerCase().includes(kw));

    dropdown.innerHTML = "";

    if(filtered.length === 0){
        dropdown.innerHTML = `<div class="combo-empty">Barang tidak ditemukan</div>`;
    } else {
        filtered.forEach(b=>{
            const item = document.createElement("div");
            item.className = "combo-item";
            item.textContent = b.nama_barang;
            item.dataset.id = b.id;
            dropdown.appendChild(item);
        });
    }

    dropdown.classList.add("show");
}

function refreshStokBaris(row){
    const mini = row.querySelector(".stok-mini");
    const barangId = row.querySelector(".input-barang-id").value;

    if(!barangId){
        mini.textContent = "Stok: -";
        mini.classList.remove("warning");
        row.dataset.stok = "0";
        return;
    }

    const stok = stokGudangMap.get(String(barangId)) || 0;
    row.dataset.stok = stok;
    mini.textContent = `Stok tersedia: ${stok}`;
    validasiQtyBaris(row);
}

function refreshSemuaBarisStok(){
    document.querySelectorAll("#detailRows .detail-row").forEach(row=>{
        if(row.querySelector(".input-barang-id").value) refreshStokBaris(row);
    });
}

function validasiQtyBaris(row){
    const mini = row.querySelector(".stok-mini");
    const qtyInput = row.querySelector(".input-qty");
    const stok = parseInt(row.dataset.stok || "0");
    const qty = parseInt(qtyInput.value || "0");

    if(qty > stok){ row.classList.add("qty-invalid"); mini.classList.add("warning"); }
    else { row.classList.remove("qty-invalid"); mini.classList.remove("warning"); }
}

// Event delegation untuk semua baris barang
const detailWrapper = document.getElementById("detailRows");

detailWrapper.addEventListener("input", function(e){
    const row = e.target.closest(".detail-row");
    if(!row) return;

    if(e.target.classList.contains("input-barang-search")){
        row.querySelector(".input-barang-id").value = "";
        row.querySelector(".input-kategori").value = "";
        row.querySelector(".input-satuan").value = "";
        renderBarangDropdown(row, e.target.value);
        refreshStokBaris(row);
    }

    if(e.target.classList.contains("input-qty")){
        validasiQtyBaris(row);
    }
});

detailWrapper.addEventListener("focus", function(e){
    if(e.target.classList.contains("input-barang-search")){
        const row = e.target.closest(".detail-row");
        renderBarangDropdown(row, e.target.value);
    }
}, true);

detailWrapper.addEventListener("keydown", function(e){
    const row = e.target.closest(".detail-row");
    if(!row) return;
    if(!e.target.classList.contains("input-barang-search")) return;

    const dropdown = row.querySelector(".input-barang-dropdown");
    if(!dropdown.classList.contains("show")) return;

    const items = dropdown.querySelectorAll(".combo-item");
    if(items.length === 0) return;

    let activeIndex = getComboActiveIndex(dropdown);

    if(e.key === "ArrowDown"){
        e.preventDefault();
        activeIndex = (activeIndex + 1) % items.length;
        highlightComboItem(dropdown, activeIndex);
    } else if(e.key === "ArrowUp"){
        e.preventDefault();
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        highlightComboItem(dropdown, activeIndex);
    } else if(e.key === "Enter"){
        if(activeIndex >= 0 && activeIndex < items.length){
            e.preventDefault();
            items[activeIndex].click();
        }
    } else if(e.key === "Escape"){
        dropdown.classList.remove("show");
    }
});

detailWrapper.addEventListener("click", function(e){

    const hapusBtn = e.target.closest(".btn-hapus-baris");
    if(hapusBtn){
        hapusBarisBarang(hapusBtn.closest(".detail-row"));
        return;
    }

    const item = e.target.closest(".combo-item");
    if(item && item.dataset.id){
        const row = item.closest(".detail-row");
        const barang = findBarangById(item.dataset.id);
        if(!barang) return;
        row.querySelector(".input-barang-id").value = barang.id;
        row.querySelector(".input-barang-search").value = barang.nama_barang;
        row.querySelector(".input-kategori").value = barang.kategori;
        row.querySelector(".input-satuan").value = barang.satuan;
        row.querySelector(".input-barang-dropdown").classList.remove("show");
        refreshStokBaris(row);
    }
});

document.addEventListener("click", function(e){
    if(!e.target.closest(".combo-wrapper")){
        document.querySelectorAll(".input-barang-dropdown.show").forEach(d => d.classList.remove("show"));
    }
});

document.getElementById("btnTambahBaris").addEventListener("click", tambahBarisBarang);

// =====================================
// VALIDASI + AMBIL ITEM DARI FORM
// =====================================

function validasiDanAmbilItem(){
    const rows = document.querySelectorAll("#detailRows .detail-row");
    if(rows.length === 0){ alert("Tambahkan minimal 1 barang."); return null; }

    const itemList = [];
    const kodeSudahDipakai = new Set();

    for(const row of rows){
        const barangId = row.querySelector(".input-barang-id").value;
        const qty = parseInt(row.querySelector(".input-qty").value);
        const keteranganRow = row.querySelector(".input-keterangan-row").value.trim();

        if(barangId === ""){ alert("Ada baris yang belum memilih Jenis Barang dari daftar pencarian."); return null; }
        if(!qty || qty <= 0){ alert("Jumlah harus lebih dari 0 untuk setiap barang."); return null; }

        const barang = findBarangById(barangId);
        if(!barang){ alert("Data barang tidak ditemukan, coba muat ulang halaman."); return null; }

        if(kodeSudahDipakai.has(barang.kode_barang)){
            alert(`Barang "${barang.nama_barang}" dipilih lebih dari satu kali.\nGabungkan jumlahnya dalam satu baris saja.`);
            return null;
        }

        kodeSudahDipakai.add(barang.kode_barang);
        itemList.push({ barang, qty, keteranganRow });
    }

    return itemList;
}

// =====================================
// AUTO-FIT FONT untuk kolom "Jenis Barang" & "Keterangan" di tabel cetak.
// Kalau teksnya panjang, ukuran font dikecilkan otomatis (sampai batas
// minimum) supaya tetap muat dalam 1 baris & sejajar rapi dengan kolom
// Type/Jumlah/Satuan yang lebih pendek — sesuai lebar kolom asli di
// <colgroup> tabel cetak (lihat permintaan-atk-art.html).
// =====================================

const LEBAR_KOLOM_CETAK_PX = { jenisBarang: 230, keterangan: 237 };
const FONT_DASAR_CETAK_PT = 15;
const FONT_MIN_CETAK_PT = 8;

function hitungFontMuatKolom(teks, lebarKolomPx, fontDasarPt = FONT_DASAR_CETAK_PT, fontMinPt = FONT_MIN_CETAK_PT){
    const teksBersih = (teks || "").toString();
    if(!teksBersih) return fontDasarPt;

    const canvas = hitungFontMuatKolom._canvas || (hitungFontMuatKolom._canvas = document.createElement("canvas"));
    const ctx = canvas.getContext("2d");
    const pxPerPt = 96 / 72;       // konversi pt (fisik cetak) ke px (buat canvas)
    const paddingPx = 20;          // kira-kira padding kiri+kanan + border sel tabel cetak

    let fontPt = fontDasarPt;
    while(fontPt > fontMinPt){
        ctx.font = `${(fontPt * pxPerPt).toFixed(2)}px "Times New Roman"`;
        const lebarTeks = ctx.measureText(teksBersih).width;
        if(lebarTeks <= (lebarKolomPx - paddingPx)) break;
        fontPt -= 0.5;
    }
    return fontPt;
}

// =====================================
// CETAK FORM — replika presisi form kertas FHCS-003
// =====================================

function formatTanggalIndo(tglStr){
    if(!tglStr) return "..........................";
    const bulan = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
    const d = new Date(tglStr + "T00:00:00");
    return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
}

function siapkanAreaCetak(karyawan, tanggal, itemList, statusNote){
    document.getElementById("pNamaKaryawan").textContent = karyawan.nama;
    document.getElementById("pDepartemen").textContent = karyawan.departemen || "-";
    document.getElementById("pNik").textContent = karyawan.nik || "-";
    document.getElementById("pTanggal").textContent = tanggal ? formatTanggalIndo(tanggal) : "-";
    document.getElementById("pCity").textContent = `Surabaya, ${formatTanggalIndo(tanggal)}`;

    const elStatusNote = document.getElementById("pStatusNote");
    if(elStatusNote) elStatusNote.textContent = statusNote || "";

    const tbody = document.getElementById("printRowsBody");
    tbody.innerHTML = "";

    itemList.forEach(({ barang, qty, keteranganRow }, idx)=>{
        const namaBarang = barang.nama_barang || "";
        const ketTampil  = (keteranganRow || "-").toString();

        const fontJenis = hitungFontMuatKolom(namaBarang, LEBAR_KOLOM_CETAK_PX.jenisBarang);
        const fontKet    = hitungFontMuatKolom(ketTampil, LEBAR_KOLOM_CETAK_PX.keterangan);

        tbody.innerHTML += `
            <tr>
                <td>${idx + 1}</td>
                <td class="left" style="font-size:${fontJenis}pt;">${namaBarang}</td>
                <td>${barang.kategori || "-"}</td>
                <td>${qty}</td>
                <td>${barang.satuan}</td>
                <td class="left" style="font-size:${fontKet}pt;">${ketTampil}</td>
            </tr>`;
    });

    // baris kosong tambahan supaya tampilan tabel tetap mirip form kertas asli
    for(let i = itemList.length; i < Math.max(5, itemList.length); i++){
        tbody.innerHTML += `<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>`;
    }
}

document.getElementById("btnCetakForm").addEventListener("click", function(){

    const karyawanId = karyawanHidden.value;
    const karyawan = karyawanId ? findKaryawanById(karyawanId) : null;
    const tanggal = document.getElementById("tanggal").value;

    const itemList = validasiDanAmbilItem();
    if(!itemList){ return; }
    if(!karyawan){ alert("Pilih Nama Karyawan terlebih dahulu sebelum mencetak."); return; }

    siapkanAreaCetak(karyawan, tanggal, itemList, "");
    window.print();
});

// =====================================
// AJUKAN PERMINTAAN (insert ke barang_keluar berstatus "Menunggu Approval")
// Stok TIDAK dipotong di sini — admin gudang yang memotong stok saat
// menyetujui permintaan lewat panel Validasi. Setelah berhasil disimpan,
// tombol "Ajukan Permintaan" digantikan tombol "Cetak Bukti Permintaan"
// + "Buat Permintaan Baru".
// =====================================

const form = document.getElementById("formPermintaan");
const btnSimpanEl = document.getElementById("btnSimpan");
const btnCetakUlangSimpanEl = document.getElementById("btnCetakUlangSimpan");
const btnPermintaanBaruEl = document.getElementById("btnPermintaanBaru");

let itemTerakhirDisimpan = null;
let karyawanTerakhirDisimpan = null;
let tanggalTerakhirDisimpan = null;

function tampilkanModeSetelahSimpan(){
    if(btnSimpanEl) btnSimpanEl.style.display = "none";
    if(btnCetakUlangSimpanEl) btnCetakUlangSimpanEl.style.display = "inline-block";
    if(btnPermintaanBaruEl) btnPermintaanBaruEl.style.display = "inline-block";
}

function tampilkanModeSebelumSimpan(){
    if(btnSimpanEl) btnSimpanEl.style.display = "inline-block";
    if(btnCetakUlangSimpanEl) btnCetakUlangSimpanEl.style.display = "none";
    if(btnPermintaanBaruEl) btnPermintaanBaruEl.style.display = "none";
}

if(btnCetakUlangSimpanEl){
    btnCetakUlangSimpanEl.addEventListener("click", function(){
        if(!itemTerakhirDisimpan || !karyawanTerakhirDisimpan) return;
        siapkanAreaCetak(karyawanTerakhirDisimpan, tanggalTerakhirDisimpan, itemTerakhirDisimpan, "Status: MENUNGGU APPROVAL ADMIN GUDANG");
        window.print();
    });
}

if(btnPermintaanBaruEl){
    btnPermintaanBaruEl.addEventListener("click", function(){
        tampilkanModeSebelumSimpan();
        resetFormItemDanKaryawanSaja();
    });
}

form.addEventListener("submit", async function(e){
    e.preventDefault();

    try{
        if(!selectedGudang){ alert("Pilih Gudang terlebih dahulu."); return; }

        const karyawanId = karyawanHidden.value;
        if(karyawanId === ""){ alert("Pilih Nama Karyawan dari daftar pencarian."); return; }

        const karyawan = findKaryawanById(karyawanId);
        if(!karyawan){ alert("Data karyawan tidak ditemukan, coba muat ulang halaman."); return; }

        const itemList = validasiDanAmbilItem();
        if(!itemList) return;

        // sanity-check stok saat ini supaya karyawan tahu lebih awal kalau
        // stok kemungkinan tidak cukup — pengecekan FINAL tetap dilakukan
        // admin saat approve (karena stok bisa berubah sebelum divalidasi)
        for(const { barang, qty } of itemList){
            const stokSaatIni = await ambilStokLive(barang.id);
            if(qty > stokSaatIni){
                const lanjut = confirm(`Stok "${barang.nama_barang}" saat ini hanya ${stokSaatIni}, sementara Anda meminta ${qty}.\n\nPermintaan tetap bisa diajukan dan akan ditinjau admin. Lanjutkan?`);
                if(!lanjut) return;
            }
        }

        const tanggal = document.getElementById("tanggal").value;

        const transaksiList = itemList.map(({ barang, qty, keteranganRow }) => ({
            tanggal, nik: karyawan.nik, nama_pengambil: karyawan.nama,
            departemen: karyawan.departemen, jabatan: karyawan.jabatan,
            kode_barang: barang.kode_barang, nama_barang: barang.nama_barang,
            kategori: barang.kategori, satuan: barang.satuan,
            qty, keterangan: (keteranganRow ? `${keteranganRow} ` : "") + TAG_FORM,
            gudang: selectedGudang, created_by: karyawan.nama,
            status: STATUS_MENUNGGU
        }));

        const { error } = await supabaseClient.from("barang_keluar").insert(transaksiList);
        if(error) throw error;

        // simpan konteks untuk tombol "Cetak Bukti Permintaan"
        itemTerakhirDisimpan = itemList;
        karyawanTerakhirDisimpan = karyawan;
        tanggalTerakhirDisimpan = tanggal;

        // langsung tampilkan dialog cetak juga, supaya karyawan bisa
        // langsung mencetak bukti pengajuan & minta tanda tangan basah
        siapkanAreaCetak(karyawan, tanggal, itemList, "Status: MENUNGGU APPROVAL ADMIN GUDANG");
        window.print();

        alert(`Permintaan ATK/ART berhasil diajukan (${transaksiList.length} item) dan menunggu approval admin gudang. Stok akan terpotong otomatis setelah disetujui.`);

        tampilkanModeSetelahSimpan();

    }catch(err){ console.error(err); alert(err.message); }
});

// reset penuh (dipakai saat pindah gudang)
function resetForm(){
    karyawanHidden.value = "";
    karyawanSearchInput.value = "";
    departemenInput.value = "";
    nikInput.value = "";
    document.getElementById("tanggal").value = new Date().toISOString().split("T")[0];

    const wrapper = document.getElementById("detailRows");
    wrapper.innerHTML = "";
    tambahBarisBarang();

    tampilkanModeSebelumSimpan();
}

// reset setelah submit sukses — gudang yang sedang dipilih TETAP dipertahankan
// supaya karyawan berikutnya di gudang yang sama tidak perlu pilih ulang
function resetFormItemDanKaryawanSaja(){
    karyawanHidden.value = "";
    karyawanSearchInput.value = "";
    departemenInput.value = "";
    nikInput.value = "";
    document.getElementById("tanggal").value = new Date().toISOString().split("T")[0];

    const wrapper = document.getElementById("detailRows");
    wrapper.innerHTML = "";
    tambahBarisBarang();
}

// =====================================
// INIT
// =====================================

(async function init(){
    document.getElementById("tanggal").value = new Date().toISOString().split("T")[0];
    tambahBarisBarang();

    formBodyGated.dataset.locked = "1";

    await Promise.all([loadDaftarGudang(), loadBarang()]);
})();
