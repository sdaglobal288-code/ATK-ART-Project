// =====================================
// PERMINTAAN / PENGAMBILAN ATK & ART  (FHCS-003) — VERSI ADMIN
// -------------------------------------------------------------------------
// Dipakai oleh permintaan-atk-art.html baik saat dibuka sebagai link publik
// (tanpa sesi admin -> toolbar Dashboard/panel validasi/riwayat disembunyikan
// otomatis oleh CSS) maupun saat dibuka dari dalam sistem admin (ada
// sessionStorage "user" -> toolbar Dashboard/panel validasi/riwayat muncul).
//
// CATATAN TAMPILAN: mode admin halaman ini SEKARANG disamakan dengan
// barang-masuk.html — tidak ada lagi sidebar/topbar replika sendiri.
// Navigasi kembali ke sistem cukup lewat tombol "🏠 Dashboard" di toolbar
// (class admin-only), sama seperti halaman Barang Masuk / Barang Keluar.
//
// PERUBAHAN TERBARU — CETAK DIGANTI JADI UNDUH PDF:
// Semua tombol yang sebelumnya membuka dialog cetak browser (window.print())
// SEKARANG menghasilkan file PDF sungguhan yang langsung terunduh & siap
// dicetak, memakai html2pdf.js. Tampilan/isi hasilnya (kop surat, tabel
// barang, tanda tangan, dst) TIDAK diubah sama sekali — persis mereplikasi
// #printArea & CSS @media print yang sudah ada sebelumnya (lihat blok CSS
// "body.force-print-mode" di permintaan-atk-art.html). Lihat fungsi
// unduhPdfBuktiPermintaan() di bawah untuk detailnya.
//
// PERUBAHAN UTAMA vs versi sebelumnya (stok terpotong saat pengajuan):
// 1) Permintaan dari form SEKARANG langsung memotong stok begitu berhasil
//    diajukan (status "Menunggu Approval"), TIDAK menunggu admin approve
//    lagi seperti sebelumnya.
// 2) Panel "Validasi Permintaan ATK/ART" (admin-only): tombol ✅ Setujui
//    TIDAK memotong stok lagi dari awal (karena sudah terpotong saat
//    pengajuan) — hanya SELISIH jumlah (kalau admin mengoreksi qty) yang
//    disesuaikan ke stok. Tombol ❌ Tolak sekarang MENGEMBALIKAN stok yang
//    sudah terpotong tadi (karena permintaannya batal), lalu ubah status
//    jadi "Ditolak".
// 3) Tombol "Simpan & Kurangi Stok" berganti nama jadi "Ajukan Permintaan",
//    dan begitu berhasil disimpan, tombol itu disembunyikan lalu digantikan
//    tombol "Unduh PDF Bukti Permintaan" + "Buat Permintaan Baru".
// 4) Panel "Riwayat Pengajuan" menampilkan kolom Status, dan tombol
//    Edit/Hapus hanya aktif untuk baris berstatus "Disetujui" (karena baris
//    itu stoknya sudah pasti terpotong dan tidak akan dikembalikan lewat
//    alur Tolak lagi).
// 5) Kolom "Jenis Barang" & "Keterangan" pada hasil cetak/PDF otomatis
//    mengecil ukuran fontnya dengan MENGUKUR SUNGGUHAN (canvas) apakah
//    teksnya muat di lebar kolom aslinya, bukan sekadar tebak-tebakan dari
//    jumlah karakter, supaya semua isi tetap terbaca. Input Keterangan pada
//    form juga otomatis diubah menjadi HURUF KAPITAL saat diketik.
// 6) Tombol "🔗 Copy Link Publik" (admin-only) di toolbar: menyalin URL
//    halaman ini (tanpa query/hash) ke clipboard, supaya admin gudang
//    tinggal klik lalu tempel (paste) link tersebut untuk dibagikan ke
//    karyawan. Karena tampilan publik vs admin dibedakan lewat sesi login
//    di browser (sessionStorage "user"), bukan URL yang berbeda, link yang
//    disalin di sini SAMA PERSIS dengan URL halaman yang sedang dibuka.
// 7) Tombol "📄 Unduh PDF Form Kosong" (dulu "🖨️ Cetak Form Kosong") di
//    toolbar atas SEKARANG disembunyikan secara default, dan baru MUNCUL
//    setelah permintaan berhasil diajukan (tombol "Ajukan Permintaan"
//    diklik & sukses tersimpan) — sejalan dengan tombol "Unduh PDF Bukti
//    Permintaan" & "Buat Permintaan Baru" yang juga baru muncul di titik
//    yang sama. Tombol ini disembunyikan lagi begitu "Buat Permintaan Baru"
//    diklik.
// 8) Kolom "Jenis Barang" SEKARANG menampilkan thumbnail foto barang di
//    sebelah kiri kotak pencarian, supaya karyawan/admin tahu wujud
//    barang yang diminta sebelum mengajukan. Foto diambil dari kolom
//    foto_url/gambar_url/image_url/foto/gambar pada master_barang (nama
//    kolom fleksibel, dideteksi otomatis lewat ambilUrlFotoBarang()).
//    Kalau barang belum punya foto (atau tabel belum punya kolom foto
//    sama sekali), otomatis tampil ikon placeholder 📦 — TIDAK error.
//    Lihat komentar di ambilUrlFotoBarang() untuk saran migrasi kolomnya.
// 9) Thumbnail foto barang tersebut SEKARANG bisa DIKLIK untuk preview
//    ukuran besar (lightbox), memakai elemen #fotoLightboxOverlay di HTML
//    & fungsi bukaLightboxFoto()/tutupLightboxFoto() di file ini. Bisa
//    ditutup dengan klik di luar gambar, tombol ✕, atau tombol Escape.
// 10) Setelah "Ajukan Permintaan" berhasil disimpan, halaman TIDAK LAGI
//     otomatis membuka dialog cetak/unduh PDF — karyawan/admin yang mau
//     mengunduh PDF-nya tinggal klik tombol "📄 Unduh PDF Bukti Permintaan"
//     atau "📄 Unduh PDF Form Kosong" secara manual.
// 11) Catatan status "Status: MENUNGGU APPROVAL ADMIN GUDANG" pada hasil
//     cetak/PDF SUDAH DIHILANGKAN (baik saat mengunduh bukti permintaan
//     yang baru diajukan, maupun saat mengunduh ulang dari Riwayat
//     Pengajuan untuk baris berstatus Menunggu) — area cetak tidak lagi
//     menampilkan baris keterangan status tersebut.
// 12) Panel "Validasi Permintaan ATK/ART" & "Riwayat Pengajuan ATK/ART"
//     (admin-only) SEKARANG otomatis DIFILTER sesuai gudang tempat admin
//     login (adminUser.gudang, diisi oleh sessionStorage "user" saat
//     login.html). Admin yang login di gudang "Margo" hanya akan melihat
//     permintaan/riwayat dari gudang "Margo" saja, admin yang login di
//     gudang "Raden Saleh" hanya melihat gudang "Raden Saleh" saja, dst.
//     Kalau (untuk alasan tertentu) akun admin TIDAK punya field "gudang"
//     tersimpan di sessionStorage "user", filter ini otomatis dilewati
//     (fallback aman) supaya panel tetap menampilkan semua gudang seperti
//     sebelumnya, bukan malah kosong.
// 13) Panel "Riwayat Pengajuan ATK/ART": tombol 📄 Unduh PDF SEKARANG hanya
//     ditampilkan untuk baris yang BUKAN berstatus "Ditolak" (Menunggu
//     & Disetujui tetap bisa diunduh PDF-nya seperti biasa). Baris
//     berstatus "Ditolak" tidak lagi menampilkan tombol tersebut sama
//     sekali, karena permintaan tersebut dibatalkan dan bukan lagi
//     transaksi keluar yang sah untuk dijadikan bukti.
// 14) Panel "Riwayat Pengajuan ATK/ART": kolom "Barang" untuk baris yang
//     berisi LEBIH DARI SATU barang SEKARANG ditampilkan sebagai daftar
//     bertingkat (list, satu barang per baris dengan tanda bullet •),
//     bukan lagi digabung dengan koma dalam satu baris teks. Baris yang
//     hanya berisi satu barang tetap ditampilkan biasa (tanpa bullet).
//
// PENTING — MIGRASI DATABASE YANG DIPERLUKAN (Supabase):
//   alter table barang_keluar add column if not exists status text default 'Disetujui';
// Baris lama (bukan dari form ATK/ART) akan otomatis dianggap "Disetujui"
// lewat fallback `row.status || 'Disetujui'` di kode ini, tapi sebaiknya
// tetap jalankan migrasi di atas supaya kolom status benar-benar ada.
//
// PENTING — RLS (Row Level Security) Supabase:
// Karena halaman ini bisa diakses publik (anon key, tanpa auth), RLS WAJIB:
//   - SELECT master_karyawan (idealnya hanya kolom yang dipakai)
//   - SELECT master_barang (katalog barang, aman)
//   - SELECT + UPDATE + INSERT stok_gudang (baca & potong stok — publik
//     SEKARANG butuh ini juga, karena stok dipotong langsung saat
//     pengajuan diajukan, bukan menunggu admin approve lagi)
//   - INSERT ke barang_keluar dari publik (status akan "Menunggu Approval")
//   - UPDATE + DELETE ke barang_keluar (diperlukan fitur validasi/edit/hapus
//     riwayat) — karena aplikasi ini TIDAK memakai Supabase Auth (login
//     custom lewat sessionStorage), anon key yang sama dipakai baik oleh
//     halaman publik maupun admin. Pertimbangkan menambahkan proteksi di
//     level lain (mis. Supabase Edge Function / RPC dengan service role)
//     bila validasi/edit/hapus perlu benar-benar dibatasi hanya untuk admin.
// =====================================

const TAG_FORM = "[Formulir Permintaan ATK/ART]";
const STATUS_MENUNGGU = "Menunggu Approval";
const STATUS_DISETUJUI = "Disetujui";
const STATUS_DITOLAK = "Ditolak";

let selectedGudang = "";
let masterBarangList = [];
let masterKaryawanList = [];
let stokGudangMap = new Map();

// =====================================
// SESI ADMIN (opsional) — halaman ini TETAP bisa diakses tanpa login
// sama sekali (link publik). Kalau kebetulan dibuka dari dalam sistem
// admin (ada sessionStorage "user", diisi oleh halaman login.html),
// maka toolbar Dashboard + panel "Validasi" + "Riwayat Pengajuan"
// otomatis muncul (persis seperti Barang Masuk). Kalau tidak ada sesi,
// semuanya tetap tersembunyi (tampilan publik asli).
// =====================================

let adminUser = null;

try{
    adminUser = JSON.parse(sessionStorage.getItem("user") || "null");
}catch(err){ adminUser = null; }

function goPage(page){ location.href = page; }

function logout(){
    sessionStorage.removeItem("user");
    location.href = "login.html";
}

function initAdminChrome(){
    if(!adminUser) return;

    document.body.classList.add("is-admin-view");

    // panel validasi & riwayat hanya relevan & hanya dimuat kalau memang
    // sedang tampil (admin)
    muatValidasiPermintaan();
    muatRiwayatPengajuan();

    const btnMuatUlangValidasi = document.getElementById("btnMuatUlangValidasi");
    if(btnMuatUlangValidasi) btnMuatUlangValidasi.addEventListener("click", muatValidasiPermintaan);

    const btnMuatUlang = document.getElementById("btnMuatUlangRiwayat");
    if(btnMuatUlang) btnMuatUlang.addEventListener("click", muatRiwayatPengajuan);

    const inputCari = document.getElementById("riwayatSearch");
    if(inputCari) inputCari.addEventListener("input", () => renderRiwayatTable());
}

// =====================================
// COPY LINK PUBLIK (khusus admin) — tombol di toolbar, di sebelah
// "Unduh PDF Form Kosong". Karena publik vs admin dibedakan lewat sesi
// login di browser (bukan URL berbeda), link publik = URL halaman ini
// sendiri (tanpa query string/hash), supaya kalau dibuka orang lain
// tanpa sesi admin, otomatis tampil sebagai form publik.
// =====================================

function ambilUrlLinkPublik(){
    return location.origin + location.pathname;
}

async function salinLinkPublik(){
    const linkPublik = ambilUrlLinkPublik();

    try{
        await navigator.clipboard.writeText(linkPublik);
        alert(`Link publik berhasil disalin ke clipboard:\n${linkPublik}\n\nTinggal tempel (paste) & bagikan link ini ke karyawan yang ingin mengajukan permintaan ATK/ART.`);
    }catch(err){
        // fallback kalau browser/izin clipboard tidak tersedia — tampilkan
        // link lewat prompt supaya admin tetap bisa menyalinnya manual
        console.error(err);
        prompt("Gagal menyalin otomatis. Salin link publik berikut secara manual (Ctrl+C):", linkPublik);
    }
}

const btnCopyLinkPublikEl = document.getElementById("btnCopyLinkPublik");
if(btnCopyLinkPublikEl){
    btnCopyLinkPublikEl.addEventListener("click", salinLinkPublik);
}

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

function findBarangByKode(kode){
    return masterBarangList.find(b => b.kode_barang === kode);
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
            <div class="barang-cell">
                <div class="barang-thumb-wrap">
                    <img class="barang-thumb" alt="" style="display:none;">
                    <span class="barang-thumb-placeholder">📦</span>
                </div>
                <div class="combo-wrapper">
                    <input type="text" class="combo-input input-barang-search"
                        placeholder="-- Cari Jenis Barang --" autocomplete="off" required>
                    <input type="hidden" class="input-barang-id">
                    <div class="combo-dropdown input-barang-dropdown"></div>
                </div>
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

// =====================================
// LIGHTBOX FOTO BARANG — preview ukuran besar saat thumbnail di-klik
// =====================================

const fotoLightboxOverlay = document.getElementById("fotoLightboxOverlay");
const fotoLightboxImg     = document.getElementById("fotoLightboxImg");
const fotoLightboxClose   = document.getElementById("fotoLightboxClose");

function bukaLightboxFoto(url){
    if(!url || !fotoLightboxOverlay || !fotoLightboxImg) return;
    fotoLightboxImg.src = url;
    fotoLightboxOverlay.classList.add("show");
}

function tutupLightboxFoto(){
    if(!fotoLightboxOverlay) return;
    fotoLightboxOverlay.classList.remove("show");
    fotoLightboxImg.src = "";
}

if(fotoLightboxOverlay){
    fotoLightboxOverlay.addEventListener("click", function(e){
        if(e.target === fotoLightboxOverlay) tutupLightboxFoto();
    });
}
if(fotoLightboxClose){
    fotoLightboxClose.addEventListener("click", tutupLightboxFoto);
}
document.addEventListener("keydown", function(e){
    if(e.key === "Escape" && fotoLightboxOverlay?.classList.contains("show")) tutupLightboxFoto();
});

// Mengambil URL foto barang dari master_barang. Kolom utamanya adalah
// "foto_url" (sudah dikonfirmasi sesuai skema tabel master_barang yang
// dipakai di halaman Master Barang / js/master-barang.js — kolom ini diisi
// otomatis lewat upload foto ke Supabase Storage bucket "barang-photos").
// Nama kolom alternatif lain tetap dicek juga sebagai jaga-jaga saja.
// Kalau barang tertentu belum punya foto_url terisi, thumbnail otomatis
// menampilkan ikon placeholder 📦 (tidak error).
function ambilUrlFotoBarang(barang){
    if(!barang) return "";
    return barang.foto_url || barang.gambar_url || barang.image_url || barang.foto || barang.gambar || "";
}

// Menampilkan (atau mereset) thumbnail foto barang pada sebuah baris
// detail. Dipanggil setiap kali barang dipilih dari dropdown, dan saat
// baris dikosongkan lagi (karyawan mengetik ulang pencarian).
function perbaruiThumbnailBarang(row, barang){
    const img = row.querySelector(".barang-thumb");
    const placeholder = row.querySelector(".barang-thumb-placeholder");
    if(!img || !placeholder) return;

    const url = ambilUrlFotoBarang(barang);

    if(url){
        img.onload = function(){ placeholder.style.display = "none"; };
        img.onerror = function(){ img.style.display = "none"; placeholder.style.display = "flex"; };
        img.src = url;
        img.style.display = "block";
        img.onclick = function(){ bukaLightboxFoto(url); };
        placeholder.style.display = "none";
    } else {
        img.removeAttribute("src");
        img.style.display = "none";
        img.onclick = null;
        placeholder.style.display = "flex";
    }
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
        perbaruiThumbnailBarang(row, null);
    }

    if(e.target.classList.contains("input-qty")){
        validasiQtyBaris(row);
    }

    // Keterangan per baris otomatis diubah menjadi HURUF KAPITAL saat diketik,
    // dengan posisi kursor tetap dijaga supaya pengetikan tidak "meloncat".
    if(e.target.classList.contains("input-keterangan-row")){
        const posisiKursor = e.target.selectionStart;
        e.target.value = e.target.value.toUpperCase();
        e.target.setSelectionRange(posisiKursor, posisiKursor);
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
        perbaruiThumbnailBarang(row, barang);
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
// CETAK / PDF — replika presisi form kertas FHCS-003
// =====================================

function formatTanggalIndo(tglStr){
    if(!tglStr) return "..........................";
    const bulan = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
    const d = new Date(tglStr + "T00:00:00");
    return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
}

// Lebar kolom "Jenis Barang" & "Keterangan" pada hasil cetak/PDF, dalam mm,
// sudah dikurangi kira-kira padding sel — dipakai untuk MENGUKUR SUNGGUH-
// SUNGGUH (bukan tebak-tebakan dari jumlah karakter) apakah sebuah teks
// akan muat, supaya font-size otomatis mengecil hanya sebanyak yang
// benar-benar diperlukan.
// Halaman A4 - margin kiri/kanan 14mm = 182mm lebar konten.
// Jenis Barang = 26% dari 182mm, Keterangan = 36% dari 182mm.
const LEBAR_KOLOM_CETAK_MM = {
    jenisBarang: (182 * 0.26) - 4.2,
    keterangan:  (182 * 0.36) - 4.2,
};

// Mengukur lebar teks (dalam px) memakai <canvas>, supaya perhitungan
// mengikuti font & ukuran sesungguhnya, bukan sekadar jumlah karakter.
let _canvasUkurTeksCetak = null;
function hitungLebarTeksPx(teks, fontSizePx){
    if(!_canvasUkurTeksCetak) _canvasUkurTeksCetak = document.createElement("canvas");
    const ctx = _canvasUkurTeksCetak.getContext("2d");
    ctx.font = `${fontSizePx}px "Times New Roman", Times, serif`;
    return ctx.measureText(teks || "").width;
}

// Menentukan ukuran font (dalam pt) untuk sel "Jenis Barang" & "Keterangan"
// di hasil cetak/PDF, dengan MENGUKUR lebar teks sesungguhnya (canvas)
// terhadap lebar kolom aslinya (lebarKolomMm).
//
// PRIORITAS: selalu coba muat dalam SATU BARIS dulu, mengecil bertahap
// selangkah demi selangkah, supaya tinggi barisnya SAMA PERSIS dengan
// baris kosong lain di tabel (tinggi baris ditentukan oleh kolom lain yang
// tetap 11pt satu baris, jadi selama Jenis Barang/Keterangan juga hanya
// satu baris, tinggi barisnya otomatis tetap seragam — kolom TIDAK
// membesar/berubah ukuran hanya karena teksnya panjang).
// Teks TIDAK PERNAH dipotong: kalau di ukuran terkecil pun masih belum
// muat dalam satu baris (teks sangat panjang), baru diizinkan turun ke
// baris kedua memakai ukuran font terkecil, supaya seluruh isi tetap
// terbaca lengkap.
const OPSI_FONT_PT_CETAK = [11, 10, 9, 8, 7.2, 6.5, 6, 5.5];

function ukuranFontCetakPt(teks, lebarKolomMm){
    if(!teks) return 11;

    const lebarTersediaPx = lebarKolomMm * 3.7795; // mm -> px (96dpi)

    for(const pt of OPSI_FONT_PT_CETAK){
        const fontPx = pt * 1.3333; // pt -> px (96dpi)
        const lebarTeksPx = hitungLebarTeksPx(teks, fontPx);
        if(lebarTeksPx <= lebarTersediaPx) return pt; // muat dalam 1 baris
    }

    // teks sangat panjang — walau di ukuran terkecil pun tidak muat dalam
    // 1 baris, tetap pakai ukuran terkecil dan izinkan turun ke baris
    // berikutnya (CSS word-wrap yang menangani), supaya tidak terpotong.
    return OPSI_FONT_PT_CETAK[OPSI_FONT_PT_CETAK.length - 1];
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
        const teksKeterangan = keteranganRow || "-";
        const fontBarang = ukuranFontCetakPt(barang.nama_barang, LEBAR_KOLOM_CETAK_MM.jenisBarang);
        const fontKeterangan = ukuranFontCetakPt(teksKeterangan, LEBAR_KOLOM_CETAK_MM.keterangan);

        tbody.innerHTML += `
            <tr>
                <td>${idx + 1}</td>
                <td class="left jenis-barang" style="font-size:${fontBarang}pt !important;">${barang.nama_barang}</td>
                <td>${barang.kategori || "-"}</td>
                <td>${qty}</td>
                <td>${barang.satuan}</td>
                <td class="left keterangan" style="font-size:${fontKeterangan}pt !important;">${teksKeterangan}</td>
            </tr>`;
    });

    // baris kosong tambahan supaya tampilan tabel tetap mirip form kertas asli
    for(let i = itemList.length; i < Math.max(5, itemList.length); i++){
        tbody.innerHTML += `<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>`;
    }
}

// =====================================
// UNDUH PDF — pengganti window.print()
// -------------------------------------------------------------------------
// Mengambil isi #printArea (yang sudah diisi lewat siapkanAreaCetak()) dan
// mengubahnya menjadi file PDF sungguhan lewat html2pdf.js, LALU otomatis
// mengunduhnya ke perangkat pengguna — siap dibuka & dicetak langsung dari
// aplikasi PDF apa pun, tanpa harus lewat dialog cetak browser lagi.
//
// Tampilan/isi PDF-nya SENGAJA dibuat identik dengan hasil cetak
// sebelumnya: dipakai class "force-print-mode" pada <body> yang
// mereplikasi persis aturan CSS @media print (lihat blok CSS
// "body.force-print-mode" di permintaan-atk-art.html) — jadi TIDAK ADA
// perubahan tampilan sama sekali, hanya cara mengeluarkan hasilnya yang
// berubah (file PDF, bukan dialog cetak).
// =====================================

function buatNamaFilePdf(karyawan, tanggal){
    const namaBersih = (karyawan?.nama || "Permintaan")
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    const tglBersih = (tanggal || "").replace(/-/g, "");
    return `FHCS-003_Permintaan-ATK-ART_${namaBersih}${tglBersih ? "_" + tglBersih : ""}.pdf`;
}

async function unduhPdfDariPrintArea(namaFile){
    const printArea = document.getElementById("printArea");
    if(!printArea){ alert("Area cetak tidak ditemukan."); return; }

    if(typeof html2pdf === "undefined"){
        alert("Pustaka pembuat PDF gagal dimuat (periksa koneksi internet Anda), coba muat ulang halaman.");
        return;
    }

    document.body.classList.add("force-print-mode");

    // beri jeda sesaat supaya browser sempat menerapkan gaya "force-print-mode"
    // (termasuk gambar logo, kalau ada) sebelum di-"screenshot" oleh html2canvas
    await new Promise(resolve => setTimeout(resolve, 120));

    try{
        await html2pdf()
            .set({
                margin: 0,
                filename: namaFile,
                image: { type: "jpeg", quality: 0.98 },
                html2canvas: { scale: 3, useCORS: true, backgroundColor: "#ffffff" },
                jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
                pagebreak: { mode: ["css", "legacy"] }
            })
            .from(printArea)
            .save();
    }catch(err){
        console.error(err);
        alert("Gagal membuat PDF: " + err.message);
    }finally{
        document.body.classList.remove("force-print-mode");
    }
}

document.getElementById("btnCetakForm").addEventListener("click", async function(){

    const karyawanId = karyawanHidden.value;
    const karyawan = karyawanId ? findKaryawanById(karyawanId) : null;
    const tanggal = document.getElementById("tanggal").value;

    const itemList = validasiDanAmbilItem();
    if(!itemList){ return; }
    if(!karyawan){ alert("Pilih Nama Karyawan terlebih dahulu sebelum mengunduh PDF."); return; }

    siapkanAreaCetak(karyawan, tanggal, itemList, "");
    await unduhPdfDariPrintArea(buatNamaFilePdf(karyawan, tanggal));
});

// =====================================
// AJUKAN PERMINTAAN (insert ke barang_keluar berstatus "Menunggu Approval")
// Stok LANGSUNG dipotong saat pengajuan ini berhasil disimpan (tidak lagi
// menunggu approval admin). Kalau nanti DITOLAK lewat panel Validasi, stok
// yang sudah terpotong akan dikembalikan otomatis. Setelah berhasil, tombol
// "Ajukan Permintaan" digantikan tombol "Unduh PDF Bukti Permintaan" +
// "Buat Permintaan Baru", dan tombol "Unduh PDF Form Kosong" di toolbar
// atas SEKARANG baru dimunculkan juga (sebelumnya disembunyikan). PDF
// TIDAK lagi otomatis terunduh di sini — pengguna mengunduhnya secara
// manual lewat tombol.
// =====================================

const form = document.getElementById("formPermintaan");
const btnSimpanEl = document.getElementById("btnSimpan");
const btnCetakUlangSimpanEl = document.getElementById("btnCetakUlangSimpan");
const btnPermintaanBaruEl = document.getElementById("btnPermintaanBaru");
const btnCetakFormEl = document.getElementById("btnCetakForm");

let itemTerakhirDisimpan = null;
let karyawanTerakhirDisimpan = null;
let tanggalTerakhirDisimpan = null;

function tampilkanModeSetelahSimpan(){
    if(btnSimpanEl) btnSimpanEl.style.display = "none";
    if(btnCetakUlangSimpanEl) btnCetakUlangSimpanEl.style.display = "inline-block";
    if(btnPermintaanBaruEl) btnPermintaanBaruEl.style.display = "inline-block";
    if(btnCetakFormEl) btnCetakFormEl.style.display = "inline-block";
}

function tampilkanModeSebelumSimpan(){
    if(btnSimpanEl) btnSimpanEl.style.display = "inline-block";
    if(btnCetakUlangSimpanEl) btnCetakUlangSimpanEl.style.display = "none";
    if(btnPermintaanBaruEl) btnPermintaanBaruEl.style.display = "none";
    if(btnCetakFormEl) btnCetakFormEl.style.display = "none";
}

if(btnCetakUlangSimpanEl){
    btnCetakUlangSimpanEl.addEventListener("click", async function(){
        if(!itemTerakhirDisimpan || !karyawanTerakhirDisimpan) return;
        siapkanAreaCetak(karyawanTerakhirDisimpan, tanggalTerakhirDisimpan, itemTerakhirDisimpan, "");
        await unduhPdfDariPrintArea(buatNamaFilePdf(karyawanTerakhirDisimpan, tanggalTerakhirDisimpan));
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

        // karena stok akan LANGSUNG dipotong begitu permintaan diajukan,
        // pastikan dulu semua barang cukup stoknya SEBELUM insert apapun,
        // supaya tidak ada barang yang stoknya sampai minus
        for(const { barang, qty } of itemList){
            const stokSaatIni = await ambilStokLive(barang.id);
            if(qty > stokSaatIni){
                alert(`Stok "${barang.nama_barang}" saat ini hanya ${stokSaatIni}, sementara Anda meminta ${qty}.\n\nKurangi jumlah permintaan atau pilih barang lain.`);
                return;
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

        // baris berhasil disimpan -> langsung potong stok untuk tiap item
        for(const { barang, qty } of itemList){
            await kurangiStokGudangDiGudang(barang.id, selectedGudang, qty);
        }

        // muat ulang stok gudang supaya tampilan & pengajuan berikutnya
        // (di gudang yang sama) memakai angka stok terbaru
        await loadStokGudang();
        refreshSemuaBarisStok();

        // simpan konteks untuk tombol "Unduh PDF Bukti Permintaan"
        itemTerakhirDisimpan = itemList;
        karyawanTerakhirDisimpan = karyawan;
        tanggalTerakhirDisimpan = tanggal;

        // siapkan area cetak (isinya) supaya siap dipakai kalau nanti tombol
        // "Unduh PDF Bukti Permintaan" / "Unduh PDF Form Kosong" diklik,
        // TANPA langsung mengunduh PDF-nya di sini
        siapkanAreaCetak(karyawan, tanggal, itemList, "");

        alert(`Permintaan ATK/ART berhasil diajukan (${transaksiList.length} item).\nUnduh PDF Bukti Permintaan, print, dan tandatangani, lalu kasihkan ke HCS.\nTerimakasih`);

        tampilkanModeSetelahSimpan();

        if(document.body.classList.contains("is-admin-view")){
            await muatValidasiPermintaan();
            await muatRiwayatPengajuan();
        }

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
// helper stok untuk gudang tertentu (dipakai fitur pengajuan, validasi &
// riwayat, karena baris riwayat/validasi bisa berasal dari gudang berbeda
// dari gudang yang lagi dipilih di form utama / selectedGudang)
// =====================================
async function ambilStokUntukGudang(barangId, gudang){
    if(!barangId || !gudang) return 0;
    const { data, error } = await supabaseClient
        .from("stok_gudang")
        .select("stok")
        .eq("barang_id", barangId)
        .eq("gudang", gudang)
        .maybeSingle();
    if(error){ console.error(error); return 0; }
    return data ? (Number(data.stok) || 0) : 0;
}

async function kurangiStokGudangDiGudang(barangId, gudang, qty){
    if(!qty || !gudang) return;

    const { data: existing, error: selErr } = await supabaseClient
        .from("stok_gudang").select("*")
        .eq("barang_id", barangId).eq("gudang", gudang).maybeSingle();

    if(selErr) throw selErr;

    const stokBaru = (existing ? (Number(existing.stok) || 0) : 0) - qty;

    if(existing){
        const { error: updErr } = await supabaseClient.from("stok_gudang")
            .update({ stok: stokBaru, updated_at: new Date().toISOString() }).eq("id", existing.id);
        if(updErr) throw updErr;
    } else {
        const { error: insErr } = await supabaseClient.from("stok_gudang")
            .insert([{ barang_id: barangId, gudang: gudang, stok: stokBaru, updated_at: new Date().toISOString() }]);
        if(insErr) throw insErr;
    }
}

// =====================================
// VALIDASI PERMINTAAN (khusus admin) — daftar permintaan berstatus
// "Menunggu Approval", dikelompokkan seperti riwayat.
//
// FILTER GUDANG SESUAI SESI ADMIN: panel ini SEKARANG hanya menampilkan
// permintaan dari gudang tempat admin yang login bertugas (adminUser.gudang,
// diisi oleh sessionStorage "user" saat login.html). Admin gudang "Margo"
// hanya melihat permintaan gudang "Margo", admin gudang "Raden Saleh" hanya
// melihat permintaan gudang "Raden Saleh", dst. Kalau field "gudang" pada
// sessionStorage "user" kosong/tidak ada, filter ini otomatis dilewati
// (fallback aman) supaya panel tetap menampilkan semua gudang seperti
// sebelumnya, bukan malah kosong.
//
// CATATAN: stok untuk baris-baris ini SUDAH terpotong sejak diajukan.
// ✅ Setujui TIDAK memotong stok lagi dari awal — hanya SELISIH qty (kalau
// admin mengoreksi jumlah di sini) yang disesuaikan ke stok.
// ❌ Tolak akan MENGEMBALIKAN stok yang sudah terpotong tadi.
// =====================================

let validasiGroupsCache = [];

function buatKunciGrup(row){
    const menitBucket = row.created_at ? Math.floor(new Date(row.created_at).getTime() / 60000) : 0;
    return `${row.nik}|${row.tanggal}|${row.gudang}|${menitBucket}`;
}

async function muatValidasiPermintaan(){
    const wrap = document.getElementById("validasiTableWrap");
    if(!wrap) return;

    wrap.innerHTML = `<div class="riwayat-loading">Memuat permintaan menunggu approval...</div>`;

    try{
        let query = supabaseClient
            .from("barang_keluar")
            .select("*")
            .ilike("keterangan", `%${TAG_FORM}%`)
            .eq("status", STATUS_MENUNGGU);

        // filter sesuai gudang admin yang sedang login (kalau ada)
        if(adminUser && adminUser.gudang){
            query = query.eq("gudang", adminUser.gudang);
        }

        const { data, error } = await query.order("created_at", { ascending: true });

        if(error) throw error;

        const groupMap = new Map();
        (data || []).forEach(row=>{
            const key = buatKunciGrup(row);
            if(!groupMap.has(key)){
                groupMap.set(key, {
                    key, tanggal: row.tanggal, nik: row.nik,
                    nama_pengambil: row.nama_pengambil, departemen: row.departemen,
                    jabatan: row.jabatan, gudang: row.gudang,
                    created_by: row.created_by, created_at: row.created_at, items: []
                });
            }
            groupMap.get(key).items.push(row);
        });

        validasiGroupsCache = Array.from(groupMap.values());
        renderValidasiTable();

    }catch(err){
        console.error(err);
        wrap.innerHTML = `<div class="riwayat-empty">⚠ Gagal memuat: ${err.message}</div>`;
    }
}

function renderValidasiTable(){
    const wrap = document.getElementById("validasiTableWrap");
    if(!wrap) return;

    if(validasiGroupsCache.length === 0){
        wrap.innerHTML = `<div class="riwayat-empty">Tidak ada permintaan yang menunggu approval saat ini.</div>`;
        return;
    }

    const baris = validasiGroupsCache.map((g, idx)=>{
        const daftarBarang = g.items.map(it => `
            <div style="margin-bottom:6px;">
                ${it.nama_barang} —
                <input type="number" min="1" value="${it.qty}" data-id="${it.id}" class="validasi-qty-input">
                ${it.satuan}
            </div>
        `).join("");

        return `
        <tr>
            <td>${idx + 1}</td>
            <td>${formatTanggalIndo(g.tanggal)}</td>
            <td>${g.nama_pengambil || "-"}<br><span class="riwayat-item-badge">${g.nik || "-"}</span></td>
            <td>${g.departemen || "-"}</td>
            <td>${g.gudang || "-"}</td>
            <td>${daftarBarang}</td>
            <td>
                <div class="riwayat-aksi">
                    <button type="button" class="btn-setujui" data-key="${g.key}" title="Setujui">✅ Setujui</button>
                    <button type="button" class="btn-tolak" data-key="${g.key}" title="Tolak">❌ Tolak</button>
                </div>
            </td>
        </tr>`;
    }).join("");

    wrap.innerHTML = `
        <table class="tabel-riwayat">
            <thead>
                <tr>
                    <th style="width:30px;">No</th>
                    <th style="width:100px;">Tanggal</th>
                    <th>Pengambil</th>
                    <th>Departemen</th>
                    <th>Gudang</th>
                    <th>Barang &amp; Jumlah</th>
                    <th style="width:170px;">Aksi</th>
                </tr>
            </thead>
            <tbody>${baris}</tbody>
        </table>
    `;

    wrap.querySelectorAll(".btn-setujui").forEach(btn=>{
        btn.addEventListener("click", () => setujuiPermintaan(btn.dataset.key));
    });
    wrap.querySelectorAll(".btn-tolak").forEach(btn=>{
        btn.addEventListener("click", () => tolakPermintaan(btn.dataset.key));
    });
}

// Menyetujui permintaan. Stok item-item ini SUDAH terpotong sejak
// pengajuan diajukan, jadi di sini TIDAK memotong stok dari awal lagi —
// hanya SELISIH qty (kalau admin mengoreksi jumlah) yang disesuaikan:
// selisih positif (dinaikkan) -> potong tambahannya dari stok (divalidasi
// dulu cukup/tidak), selisih negatif (diturunkan) -> kembalikan selisihnya.
async function setujuiPermintaan(key){
    const grup = validasiGroupsCache.find(g => g.key === key);
    if(!grup) return;

    if(!confirm(`Setujui permintaan dari ${grup.nama_pengambil} (Gudang ${grup.gudang})?`)) return;

    try{
        // ambil jumlah terbaru dari input (admin bisa koreksi sebelum approve)
        const qtyMap = new Map();
        document.querySelectorAll(".validasi-qty-input").forEach(inp=>{
            qtyMap.set(String(inp.dataset.id), parseInt(inp.value) || 0);
        });

        // validasi dulu SEMUA item sebelum menyentuh stok apapun, supaya
        // tidak ada penyesuaian stok sebagian (partial) kalau salah satu
        // kenaikan qty ternyata stoknya tidak cukup
        for(const item of grup.items){
            const qtyFinal = qtyMap.get(String(item.id)) ?? item.qty;
            if(!qtyFinal || qtyFinal <= 0){ alert(`Jumlah untuk "${item.nama_barang}" harus lebih dari 0.`); return; }

            const selisih = qtyFinal - item.qty; // qty asli sudah terpotong saat pengajuan
            if(selisih > 0){
                const barangMaster = findBarangByKode(item.kode_barang);
                if(!barangMaster){
                    alert(`Barang "${item.nama_barang}" tidak ditemukan di master, tidak bisa disetujui otomatis.`);
                    return;
                }
                const stokTersedia = await ambilStokUntukGudang(barangMaster.id, grup.gudang);
                if(selisih > stokTersedia){
                    alert(`Stok "${item.nama_barang}" di gudang ${grup.gudang} tidak cukup untuk menambah jumlah.\nStok tersedia: ${stokTersedia}, tambahan diminta: ${selisih}`);
                    return;
                }
            }
        }

        // semua item lolos validasi -> proses satu per satu
        for(const item of grup.items){
            const qtyFinal = qtyMap.get(String(item.id)) ?? item.qty;
            const selisih = qtyFinal - item.qty;

            if(selisih !== 0){
                const barangMaster = findBarangByKode(item.kode_barang);
                if(barangMaster) await kurangiStokGudangDiGudang(barangMaster.id, grup.gudang, selisih);
            }

            const { error } = await supabaseClient
                .from("barang_keluar")
                .update({ qty: qtyFinal, status: STATUS_DISETUJUI })
                .eq("id", item.id);
            if(error) throw error;
        }

        alert("Permintaan disetujui.");
        await muatValidasiPermintaan();
        await muatRiwayatPengajuan();
        await loadStokGudang();
        refreshSemuaBarisStok();

    }catch(err){
        console.error(err);
        alert(err.message);
    }
}

// Menolak permintaan. Stok yang sudah terpotong sejak pengajuan
// dikembalikan otomatis di sini, karena permintaannya batal.
async function tolakPermintaan(key){
    const grup = validasiGroupsCache.find(g => g.key === key);
    if(!grup) return;

    const alasan = prompt("Alasan penolakan (opsional, akan tercatat di keterangan):", "");
    if(alasan === null) return; // batal

    if(!confirm(`Tolak permintaan dari ${grup.nama_pengambil} (Gudang ${grup.gudang})?\nStok yang sudah terpotong saat pengajuan akan dikembalikan.`)) return;

    try{
        for(const item of grup.items){
            const barangMaster = findBarangByKode(item.kode_barang);
            if(barangMaster){
                // kembalikan stok yang sudah terpotong sejak pengajuan
                await kurangiStokGudangDiGudang(barangMaster.id, grup.gudang, -item.qty);
            } else {
                console.warn(`Barang dengan kode ${item.kode_barang} tidak ditemukan di master, stok tidak dikembalikan otomatis.`);
            }

            const keteranganBaru = `${alasan ? alasan + " · " : ""}${TAG_FORM} [DITOLAK]`;
            const { error } = await supabaseClient
                .from("barang_keluar")
                .update({ status: STATUS_DITOLAK, keterangan: keteranganBaru })
                .eq("id", item.id);
            if(error) throw error;
        }

        alert("Permintaan ditolak & stok dikembalikan.");
        await muatValidasiPermintaan();
        await muatRiwayatPengajuan();
        await loadStokGudang();
        refreshSemuaBarisStok();

    }catch(err){
        console.error(err);
        alert(err.message);
    }
}

// =====================================
// RIWAYAT PENGAJUAN (khusus admin) — gabungan pengajuan dari akun
// admin maupun dari link publik, semua status (Menunggu/Disetujui/Ditolak).
//
// FILTER GUDANG SESUAI SESI ADMIN: sama seperti panel Validasi di atas,
// panel Riwayat ini SEKARANG juga otomatis difilter berdasarkan gudang
// tempat admin login (adminUser.gudang). Admin gudang "Margo" hanya
// melihat riwayat gudang "Margo", admin gudang "Raden Saleh" hanya
// melihat riwayat gudang "Raden Saleh", dst. Kalau sessionStorage "user"
// tidak memiliki field "gudang", filter ini dilewati (fallback aman)
// supaya riwayat tetap tampil menampilkan semua gudang seperti sebelumnya.
//
// CATATAN PENTING soal pengelompokan:
// Skema tabel barang_keluar TIDAK menyimpan "nomor pengajuan" — setiap
// baris item disimpan terpisah. Supaya beberapa item yang disubmit
// bersamaan (1x klik Ajukan) tetap tampil sebagai SATU baris riwayat,
// baris-baris tsb dikelompokkan berdasarkan kombinasi:
// NIK + tanggal + gudang + menit created_at. Ini heuristik yang cukup
// akurat untuk pemakaian normal, tapi kalau 1 karyawan kebetulan
// submit 2x persis di menit yang sama untuk tanggal & gudang yang sama,
// keduanya akan tergabung jadi 1 baris riwayat.
// =====================================

let riwayatGroupsCache = [];

async function muatRiwayatPengajuan(){
    const wrap = document.getElementById("riwayatTableWrap");
    if(!wrap) return;

    wrap.innerHTML = `<div class="riwayat-loading">Memuat riwayat...</div>`;

    try{
        let query = supabaseClient
            .from("barang_keluar")
            .select("*")
            .ilike("keterangan", `%${TAG_FORM}%`);

        // filter sesuai gudang admin yang sedang login (kalau ada)
        if(adminUser && adminUser.gudang){
            query = query.eq("gudang", adminUser.gudang);
        }

        const { data, error } = await query
            .order("created_at", { ascending: false })
            .limit(300);

        if(error) throw error;

        const groupMap = new Map();

        (data || []).forEach(row=>{
            const key = buatKunciGrup(row);
            if(!groupMap.has(key)){
                groupMap.set(key, {
                    key,
                    tanggal: row.tanggal,
                    nik: row.nik,
                    nama_pengambil: row.nama_pengambil,
                    departemen: row.departemen,
                    jabatan: row.jabatan,
                    gudang: row.gudang,
                    created_by: row.created_by,
                    created_at: row.created_at,
                    status: row.status || STATUS_DISETUJUI,
                    items: []
                });
            }
            groupMap.get(key).items.push(row);
        });

        riwayatGroupsCache = Array.from(groupMap.values());
        renderRiwayatTable();

    }catch(err){
        console.error(err);
        wrap.innerHTML = `<div class="riwayat-empty">⚠ Gagal memuat riwayat: ${err.message}</div>`;
    }
}

function badgeStatusHtml(status){
    if(status === STATUS_MENUNGGU) return `<span class="status-badge status-menunggu">Menunggu</span>`;
    if(status === STATUS_DITOLAK) return `<span class="status-badge status-ditolak">Ditolak</span>`;
    return `<span class="status-badge status-disetujui">Disetujui</span>`;
}

// Membentuk isi kolom "Barang" pada tabel Riwayat Pengajuan. Kalau hanya
// 1 barang, ditampilkan biasa (teks polos, tanpa bullet). Kalau LEBIH
// DARI 1 barang, ditampilkan sebagai daftar bertingkat (list, satu
// barang per baris dengan tanda bullet •) supaya lebih mudah dibaca
// dibanding sebelumnya yang digabung koma dalam satu baris teks panjang.
function daftarBarangHtml(items){
    if(!items || items.length === 0) return "-";

    if(items.length === 1){
        const it = items[0];
        return `${it.nama_barang} (${it.qty} ${it.satuan})`;
    }

    const liList = items.map(it => `<li>${it.nama_barang} (${it.qty} ${it.satuan})</li>`).join("");
    return `<ul class="daftar-barang-list">${liList}</ul>`;
}

function renderRiwayatTable(){
    const wrap = document.getElementById("riwayatTableWrap");
    if(!wrap) return;

    const kw = (document.getElementById("riwayatSearch")?.value || "").trim().toLowerCase();

    let groups = riwayatGroupsCache;
    if(kw){
        groups = groups.filter(g=>{
            const gabungan = [
                g.nama_pengambil, g.departemen, g.gudang,
                ...g.items.map(it => it.nama_barang)
            ].join(" ").toLowerCase();
            return gabungan.includes(kw);
        });
    }

    if(groups.length === 0){
        wrap.innerHTML = `<div class="riwayat-empty">Tidak ada riwayat pengajuan.</div>`;
        return;
    }

    const baris = groups.map((g, idx)=>{
        const daftarBarang = daftarBarangHtml(g.items);
        const bisaDiubah = g.status === STATUS_DISETUJUI;

        // Tombol 📄 Unduh PDF HANYA ditampilkan untuk baris yang BUKAN
        // berstatus "Ditolak" — permintaan yang sudah ditolak dibatalkan &
        // bukan lagi transaksi keluar yang sah untuk dijadikan bukti.
        const bisaDiunduhPdf = g.status !== STATUS_DITOLAK;

        // Untuk baris berstatus "Ditolak" (tidak bisa diunduh PDF/edit/
        // hapus), tampilkan tombol 👁️ Lihat sebagai gantinya, supaya admin
        // tetap bisa melihat detail barang & jumlah yang diajukan sebelum
        // ditolak.
        const perluTombolLihat = g.status === STATUS_DITOLAK;

        return `
        <tr>
            <td>${idx + 1}</td>
            <td>${formatTanggalIndo(g.tanggal)}</td>
            <td>${g.nama_pengambil || "-"}<br><span class="riwayat-item-badge">${g.nik || "-"}</span></td>
            <td>${g.departemen || "-"}</td>
            <td>${g.gudang || "-"}</td>
            <td>${badgeStatusHtml(g.status)}</td>
            <td>${daftarBarang}</td>
            <td>${g.created_by || "-"}</td>
            <td>
                <div class="riwayat-aksi">
                    ${bisaDiunduhPdf ? `<button type="button" class="btn-cetak" data-key="${g.key}" title="Unduh ulang PDF">📄 Unduh PDF</button>` : ""}
                    ${bisaDiubah ? `<button type="button" class="btn-edit" data-key="${g.key}" title="Edit">✏️ Edit</button>` : ""}
                    ${bisaDiubah ? `<button type="button" class="btn-hapus" data-key="${g.key}" title="Hapus">🗑️ Hapus</button>` : ""}
                    ${perluTombolLihat ? `<button type="button" class="btn-lihat" data-key="${g.key}" title="Lihat detail barang yang ditolak">👁️ Lihat</button>` : ""}
                </div>
            </td>
        </tr>`;
    }).join("");

    wrap.innerHTML = `
        <table class="tabel-riwayat">
            <thead>
                <tr>
                    <th style="width:30px;">No</th>
                    <th style="width:100px;">Tanggal</th>
                    <th>Nama Pengambil</th>
                    <th>Departemen</th>
                    <th>Gudang</th>
                    <th style="width:90px;">Status</th>
                    <th>Barang</th>
                    <th>Dibuat Oleh</th>
                    <th style="width:190px;">Aksi</th>
                </tr>
            </thead>
            <tbody>${baris}</tbody>
        </table>
    `;

    wrap.querySelectorAll(".btn-cetak").forEach(btn=>{
        btn.addEventListener("click", () => cetakRiwayat(btn.dataset.key));
    });
    wrap.querySelectorAll(".btn-edit").forEach(btn=>{
        btn.addEventListener("click", () => bukaModalEditRiwayat(btn.dataset.key));
    });
    wrap.querySelectorAll(".btn-hapus").forEach(btn=>{
        btn.addEventListener("click", () => hapusRiwayat(btn.dataset.key));
    });
    wrap.querySelectorAll(".btn-lihat").forEach(btn=>{
        btn.addEventListener("click", () => bukaModalLihatRiwayat(btn.dataset.key));
    });
}

function cariGrupByKey(key){
    return riwayatGroupsCache.find(g => g.key === key);
}

// ----- UNDUH ULANG PDF dari riwayat -----
// Catatan status ("Menunggu Approval Admin Gudang" / "Ditolak") pada hasil
// PDF sudah tidak ditampilkan lagi — hasil unduhan ulang dari sini polos
// tanpa keterangan status apapun, sama seperti unduh PDF form biasa. Tombol
// ini sendiri sudah tidak dirender lagi untuk baris berstatus "Ditolak"
// (lihat renderRiwayatTable()), jadi fungsi ini praktis hanya dipanggil
// untuk baris "Menunggu" atau "Disetujui".
async function cetakRiwayat(key){
    const grup = cariGrupByKey(key);
    if(!grup) return;

    const itemListUntukCetak = grup.items.map(it => ({
        barang: { nama_barang: it.nama_barang, kategori: it.kategori, satuan: it.satuan },
        qty: it.qty,
        keteranganRow: (it.keterangan || "").replace(TAG_FORM, "").replace("[DITOLAK]", "").trim()
    }));

    const karyawanUntukCetak = {
        nama: grup.nama_pengambil,
        departemen: grup.departemen,
        nik: grup.nik
    };

    siapkanAreaCetak(karyawanUntukCetak, grup.tanggal, itemListUntukCetak, "");
    await unduhPdfDariPrintArea(buatNamaFilePdf(karyawanUntukCetak, grup.tanggal));
}

// ----- EDIT riwayat (qty & keterangan per item, stok otomatis disesuaikan) -----
// Hanya tersedia untuk baris berstatus "Disetujui" (lihat renderRiwayatTable),
// karena hanya baris itu yang dipastikan stoknya sedang terpotong dan tidak
// akan dikembalikan lagi lewat alur Tolak.
const rwModalOverlay = document.getElementById("rwModalOverlay");
const rwEditRows     = document.getElementById("rwEditRows");
const rwModalSub     = document.getElementById("rwModalSub");
let rwEditingKey = null;

function bukaModalEditRiwayat(key){
    const grup = cariGrupByKey(key);
    if(!grup || !rwModalOverlay || !rwEditRows) return;

    rwEditingKey = key;
    rwModalSub.textContent = `${grup.nama_pengambil || "-"} · ${grup.departemen || "-"} · Gudang ${grup.gudang || "-"} · ${formatTanggalIndo(grup.tanggal)}`;

    rwEditRows.innerHTML = grup.items.map(it => `
        <tr data-id="${it.id}">
            <td>${it.nama_barang}<br><span class="riwayat-item-badge">${it.satuan}</span></td>
            <td><input type="number" min="1" class="rw-input-qty" value="${it.qty}"></td>
            <td><input type="text" class="rw-input-ket" value="${(it.keterangan || '').replace(TAG_FORM,'').trim().toUpperCase()}"></td>
        </tr>
    `).join("");

    // pastikan tombol Simpan tampil normal (bisa saja tersembunyi kalau
    // sebelumnya modal ini dibuka lewat mode 👁️ Lihat)
    if(rwBtnSimpan) rwBtnSimpan.style.display = "inline-block";

    rwModalOverlay.classList.add("show");
}

// ----- LIHAT detail riwayat (khusus baris berstatus "Ditolak") -----
// Memakai modal yang sama dengan Edit, tapi seluruh input dibuat
// read-only (disabled) dan tombol "💾 Simpan Perubahan" disembunyikan,
// karena permintaan yang sudah ditolak tidak lagi bisa diubah — tombol
// ini hanya untuk melihat barang & jumlah apa saja yang diajukan sebelum
// ditolak, termasuk alasan penolakan (kalau ada) pada kolom keterangan.
function bukaModalLihatRiwayat(key){
    const grup = cariGrupByKey(key);
    if(!grup || !rwModalOverlay || !rwEditRows) return;

    rwEditingKey = null; // bukan mode edit, jadi tombol Simpan tidak boleh memproses apapun

    rwModalSub.textContent = `👁️ Lihat (Ditolak) — ${grup.nama_pengambil || "-"} · ${grup.departemen || "-"} · Gudang ${grup.gudang || "-"} · ${formatTanggalIndo(grup.tanggal)}`;

    rwEditRows.innerHTML = grup.items.map(it => `
        <tr data-id="${it.id}">
            <td>${it.nama_barang}<br><span class="riwayat-item-badge">${it.satuan}</span></td>
            <td><input type="number" min="1" class="rw-input-qty" value="${it.qty}" disabled></td>
            <td><input type="text" class="rw-input-ket" value="${(it.keterangan || '').replace(TAG_FORM,'').replace('[DITOLAK]','').trim().toUpperCase()}" disabled></td>
        </tr>
    `).join("");

    // sembunyikan tombol Simpan karena mode ini hanya untuk melihat, tidak
    // untuk mengubah data
    if(rwBtnSimpan) rwBtnSimpan.style.display = "none";

    rwModalOverlay.classList.add("show");
}

function tutupModalEditRiwayat(){
    if(rwModalOverlay) rwModalOverlay.classList.remove("show");
    rwEditingKey = null;
}

const rwBtnBatal = document.getElementById("rwBtnBatal");
if(rwBtnBatal) rwBtnBatal.addEventListener("click", tutupModalEditRiwayat);

if(rwModalOverlay){
    rwModalOverlay.addEventListener("click", function(e){
        if(e.target === rwModalOverlay) tutupModalEditRiwayat();
    });
}

// Keterangan di modal edit riwayat juga otomatis diubah menjadi HURUF KAPITAL
// saat diketik, sama seperti keterangan di baris form utama.
if(rwEditRows){
    rwEditRows.addEventListener("input", function(e){
        if(e.target.classList.contains("rw-input-ket")){
            const posisiKursor = e.target.selectionStart;
            e.target.value = e.target.value.toUpperCase();
            e.target.setSelectionRange(posisiKursor, posisiKursor);
        }
    });
}

const rwBtnSimpan = document.getElementById("rwBtnSimpan");
if(rwBtnSimpan){
    rwBtnSimpan.addEventListener("click", async function(){
        const grup = cariGrupByKey(rwEditingKey);
        if(!grup) return;

        try{
            const baris = Array.from(rwEditRows.querySelectorAll("tr"));

            for(const tr of baris){
                const id = tr.dataset.id;
                const itemAsli = grup.items.find(it => String(it.id) === String(id));
                if(!itemAsli) continue;

                const qtyBaru = parseInt(tr.querySelector(".rw-input-qty").value);
                const ketBaru = tr.querySelector(".rw-input-ket").value.trim();

                if(!qtyBaru || qtyBaru <= 0){
                    alert(`Jumlah untuk "${itemAsli.nama_barang}" harus lebih dari 0.`);
                    return;
                }

                const selisih = qtyBaru - itemAsli.qty; // positif = ambil tambahan dari stok, negatif = kembalikan ke stok

                if(selisih !== 0){
                    const barangMaster = findBarangByKode(itemAsli.kode_barang);
                    if(barangMaster){
                        const stokUntukValidasi = await ambilStokUntukGudang(barangMaster.id, grup.gudang);
                        if(selisih > 0 && selisih > stokUntukValidasi){
                            alert(`Stok "${itemAsli.nama_barang}" di gudang ${grup.gudang} tidak cukup untuk menambah jumlah.\nStok tersedia saat ini: ${stokUntukValidasi}`);
                            return;
                        }
                        await kurangiStokGudangDiGudang(barangMaster.id, grup.gudang, selisih);
                    } else {
                        console.warn(`Barang dengan kode ${itemAsli.kode_barang} tidak ditemukan di master, stok tidak disesuaikan otomatis.`);
                    }
                }

                const { error } = await supabaseClient
                    .from("barang_keluar")
                    .update({ qty: qtyBaru, keterangan: (ketBaru ? `${ketBaru} ` : "") + TAG_FORM })
                    .eq("id", id);

                if(error) throw error;
            }

            alert("Perubahan berhasil disimpan.");
            tutupModalEditRiwayat();
            await muatRiwayatPengajuan();
            await loadStokGudang();
            refreshSemuaBarisStok();

        }catch(err){
            console.error(err);
            alert(err.message);
        }
    });
}

// ----- HAPUS riwayat (batalkan pengajuan, stok dikembalikan karena baris
// "Disetujui" ini pasti sedang terpotong stoknya) -----
async function hapusRiwayat(key){
    const grup = cariGrupByKey(key);
    if(!grup) return;

    const daftar = grup.items.map(it => `- ${it.nama_barang} (${it.qty} ${it.satuan})`).join("\n");
    const konfirmasi = confirm(
        `Batalkan pengajuan ini?\n\nPengambil: ${grup.nama_pengambil}\nGudang: ${grup.gudang}\n\n${daftar}\n\nStok akan dikembalikan otomatis.`
    );
    if(!konfirmasi) return;

    try{
        for(const item of grup.items){
            const barangMaster = findBarangByKode(item.kode_barang);
            if(barangMaster){
                // kurangi dengan qty negatif = mengembalikan stok
                await kurangiStokGudangDiGudang(barangMaster.id, grup.gudang, -item.qty);
            } else {
                console.warn(`Barang dengan kode ${item.kode_barang} tidak ditemukan di master, stok tidak dikembalikan otomatis.`);
            }
        }

        const ids = grup.items.map(it => it.id);
        const { error } = await supabaseClient.from("barang_keluar").delete().in("id", ids);
        if(error) throw error;

        alert("Pengajuan berhasil dibatalkan & stok dikembalikan.");
        await muatRiwayatPengajuan();
        await loadStokGudang();
        refreshSemuaBarisStok();

    }catch(err){
        console.error(err);
        alert(err.message);
    }
}

// =====================================
// INIT
// =====================================

(async function init(){
    document.getElementById("tanggal").value = new Date().toISOString().split("T")[0];
    tambahBarisBarang();

    formBodyGated.dataset.locked = "1";

    await Promise.all([loadDaftarGudang(), loadBarang()]);

    initAdminChrome();
})();
