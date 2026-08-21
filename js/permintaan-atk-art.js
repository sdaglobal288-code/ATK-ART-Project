// =====================================
// PERMINTAAN / PENGAMBILAN ATK & ART  (FHCS-003) — VERSI ADMIN
// -------------------------------------------------------------------------
// Dipakai oleh permintaan-atk-art.html baik saat dibuka sebagai link publik
// (tanpa sesi admin -> toolbar Dashboard/panel validasi/riwayat disembunyikan
// otomatis oleh CSS) maupun saat dibuka dari dalam sistem admin (ada
// sessionStorage "user" -> toolbar Dashboard/panel validasi/riwayat muncul).
//
// ⚠️ PERUBAHAN TERBARU (pratinjau live, menggantikan html2canvas+jsPDF):
//   - Panel "Bukti Permintaan" untuk akun publik TIDAK LAGI menampilkan
//     hasil screenshot (html2canvas) di dalam <iframe>. Sebagai gantinya,
//     #printArea ASLI (elemen DOM yang sama yang dipakai untuk mencetak)
//     ditampilkan langsung di halaman lewat class body.pdf-preview-mode,
//     lalu diskalakan (diperkecil tampilannya saja, bukan tata letaknya)
//     memakai CSS transform supaya muat di layar sempit.
//   - Tombol "⬇️ Unduh PDF" dan "🖨️ Cetak" memanggil window.print() —
//     PERSIS mekanisme yang dipakai admin lewat tombol "Cetak Form" /
//     "Cetak Bukti Permintaan". Karena pratinjau dan hasil cetak/unduhan
//     akhir sama-sama berasal dari elemen #printArea + CSS cetak yang
//     sama persis, keduanya DIJAMIN terlihat identik.
//   - html2canvas & jsPDF tidak lagi dipakai sama sekali (skrip CDN-nya
//     sudah dihapus dari HTML).
//   - Seluruh logic lain (validasi stok, simpan ke database, riwayat,
//     approval, dsb) TIDAK diubah sama sekali.
// =====================================

const TAG_FORM = "[Formulir Permintaan ATK/ART]";
const STATUS_MENUNGGU = "Menunggu Approval";
const STATUS_DISETUJUI = "Disetujui";
const STATUS_DITOLAK = "Ditolak";

let selectedGudang = "";
let masterBarangList = [];
let masterKaryawanList = [];
let stokGudangMap = new Map();

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

    muatValidasiPermintaan();
    muatRiwayatPengajuan();

    const btnMuatUlangValidasi = document.getElementById("btnMuatUlangValidasi");
    if(btnMuatUlangValidasi) btnMuatUlangValidasi.addEventListener("click", muatValidasiPermintaan);

    const btnMuatUlang = document.getElementById("btnMuatUlangRiwayat");
    if(btnMuatUlang) btnMuatUlang.addEventListener("click", muatRiwayatPengajuan);

    const inputCari = document.getElementById("riwayatSearch");
    if(inputCari) inputCari.addEventListener("input", () => renderRiwayatTable());
}

function ambilUrlLinkPublik(){
    return location.origin + location.pathname;
}

async function salinLinkPublik(){
    const linkPublik = ambilUrlLinkPublik();

    try{
        await navigator.clipboard.writeText(linkPublik);
        alert(`Link publik berhasil disalin ke clipboard:\n${linkPublik}\n\nTinggal tempel (paste) & bagikan link ini ke karyawan yang ingin mengajukan permintaan ATK/ART.`);
    }catch(err){
        console.error(err);
        prompt("Gagal menyalin otomatis. Salin link publik berikut secara manual (Ctrl+C):", linkPublik);
    }
}

const btnCopyLinkPublikEl = document.getElementById("btnCopyLinkPublik");
if(btnCopyLinkPublikEl){
    btnCopyLinkPublikEl.addEventListener("click", salinLinkPublik);
}

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

function ambilUrlFotoBarang(barang){
    if(!barang) return "";
    return barang.foto_url || barang.gambar_url || barang.image_url || barang.foto || barang.gambar || "";
}

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

function formatTanggalIndo(tglStr){
    if(!tglStr) return "..........................";
    const bulan = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
    const d = new Date(tglStr + "T00:00:00");
    return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
}

const LEBAR_KOLOM_CETAK_MM = {
    jenisBarang: (182 * 0.26) - 4.2,
    keterangan:  (182 * 0.36) - 4.2,
};

let _canvasUkurTeksCetak = null;
function hitungLebarTeksPx(teks, fontSizePx){
    if(!_canvasUkurTeksCetak) _canvasUkurTeksCetak = document.createElement("canvas");
    const ctx = _canvasUkurTeksCetak.getContext("2d");
    ctx.font = `${fontSizePx}px "Times New Roman", Times, serif`;
    return ctx.measureText(teks || "").width;
}

const OPSI_FONT_PT_CETAK = [11, 10, 9, 8, 7.2, 6.5, 6, 5.5];

function ukuranFontCetakPt(teks, lebarKolomMm){
    if(!teks) return 11;

    const lebarTersediaPx = lebarKolomMm * 3.7795;

    for(const pt of OPSI_FONT_PT_CETAK){
        const fontPx = pt * 1.3333;
        const lebarTeksPx = hitungLebarTeksPx(teks, fontPx);
        if(lebarTeksPx <= lebarTersediaPx) return pt;
    }

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

// ===== PRATINJAU LIVE untuk akun publik (pengganti html2canvas) =====
// #printArea ditampilkan APA ADANYA (elemen DOM asli, bukan screenshot)
// lewat class body.pdf-preview-mode. Karena CSS-nya SAMA PERSIS dengan
// yang dipakai window.print(), pratinjau ini pasti identik dengan hasil
// akhir. Fungsi skala di bawah HANYA memperkecil TAMPILAN (transform),
// tidak pernah mengubah tata letak/konten dokumennya.
function terapkanSkalaPratinjauPrintArea(){
    const printAreaEl = document.getElementById("printArea");
    if(!printAreaEl || !document.body.classList.contains("pdf-preview-mode")) return;

    // reset dulu supaya pengukuran lebar alami akurat
    printAreaEl.style.transform = "";
    printAreaEl.style.marginBottom = "";

    const marginLayar = 24; // jarak aman kiri-kanan di layar sempit
    const lebarTersedia = window.innerWidth - marginLayar;
    const lebarAlami = printAreaEl.offsetWidth; // kira-kira 210mm dalam px

    if(lebarAlami > 0 && lebarAlami > lebarTersedia){
        const skala = Math.max(lebarTersedia / lebarAlami, 0.3);
        const tinggiAlami = printAreaEl.offsetHeight;
        printAreaEl.style.transform = `scale(${skala})`;
        printAreaEl.style.transformOrigin = "top center";
        // kompensasi ruang kosong di bawah akibat transform (yang tidak
        // memengaruhi document flow), supaya tidak ada jarak kosong besar
        // di bawah pratinjau
        printAreaEl.style.marginBottom = `${-(tinggiAlami * (1 - skala)) + 40}px`;
    }
}

let _resizeTimeoutPratinjau = null;
window.addEventListener("resize", function(){
    clearTimeout(_resizeTimeoutPratinjau);
    _resizeTimeoutPratinjau = setTimeout(terapkanSkalaPratinjauPrintArea, 150);
});

const formPermintaanWrapEl = document.getElementById("formPermintaanWrap");
const pdfPreviewPanelEl    = document.getElementById("pdfPreviewPanel");
const btnUnduhPdfEl        = document.getElementById("btnUnduhPdf");
const btnCetakPdfEl        = document.getElementById("btnCetakPdf");
const btnPdfBuatBaruEl     = document.getElementById("btnPdfBuatBaru");

// Menandai apakah pratinjau live untuk publik sedang aktif ditampilkan,
// supaya bisa dipulihkan lagi setelah dialog print (window.print())
// ditutup oleh karyawan (baik lewat "Simpan"/"Cetak" maupun "Batal").
let previewPublikAktif = false;

function tampilkanPdfSiapCetak(karyawan, tanggal, itemList){
    siapkanAreaCetak(karyawan, tanggal, itemList, "");

    if(formPermintaanWrapEl) formPermintaanWrapEl.style.display = "none";
    if(pdfPreviewPanelEl) pdfPreviewPanelEl.style.display = "block";

    document.body.classList.add("pdf-preview-mode");
    previewPublikAktif = true;

    // beri browser satu-dua frame untuk menerapkan display:block sebelum
    // mengukur lebar alami #printArea, supaya perhitungan skala akurat
    requestAnimationFrame(() => requestAnimationFrame(terapkanSkalaPratinjauPrintArea));

    pdfPreviewPanelEl?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ===== Fungsi cetak/unduh FINAL untuk akun publik (hasil sebenarnya) =====
// Memakai window.print() -> dialog print / "Simpan sebagai PDF" bawaan
// browser, PERSIS mekanisme yang dipakai admin (tombol "Cetak Form" /
// "Cetak Bukti Permintaan"). #printArea diisi ulang tepat sebelum
// window.print() dipanggil, memakai data terakhir yang berhasil disimpan
// (itemTerakhirDisimpan / karyawanTerakhirDisimpan / tanggalTerakhirDisimpan).
// Mode pratinjau (transform/skala/shadow) dilepas dulu sebelum mencetak
// supaya window.print() memakai #printArea polos sesuai CSS @media print,
// lalu dipulihkan lagi setelah dialog print ditutup.
function cetakAreaCetakPublikTerakhir(){
    if(!itemTerakhirDisimpan || !karyawanTerakhirDisimpan){
        alert("Data permintaan belum siap, mohon tunggu sebentar lalu coba lagi.");
        return;
    }

    siapkanAreaCetak(karyawanTerakhirDisimpan, tanggalTerakhirDisimpan, itemTerakhirDisimpan, "");

    const sedangPreview = document.body.classList.contains("pdf-preview-mode");
    const printAreaEl = document.getElementById("printArea");

    if(sedangPreview){
        document.body.classList.remove("pdf-preview-mode");
        if(printAreaEl){
            printAreaEl.style.transform = "";
            printAreaEl.style.marginBottom = "";
        }
    }

    window.print();

    if(sedangPreview && previewPublikAktif){
        document.body.classList.add("pdf-preview-mode");
        requestAnimationFrame(() => requestAnimationFrame(terapkanSkalaPratinjauPrintArea));
    }
}

if(btnUnduhPdfEl){
    btnUnduhPdfEl.addEventListener("click", cetakAreaCetakPublikTerakhir);
}

if(btnCetakPdfEl){
    btnCetakPdfEl.addEventListener("click", cetakAreaCetakPublikTerakhir);
}

if(btnPdfBuatBaruEl){
    btnPdfBuatBaruEl.addEventListener("click", function(){
        previewPublikAktif = false;
        document.body.classList.remove("pdf-preview-mode");
        const printAreaEl = document.getElementById("printArea");
        if(printAreaEl){
            printAreaEl.style.transform = "";
            printAreaEl.style.marginBottom = "";
        }

        if(pdfPreviewPanelEl) pdfPreviewPanelEl.style.display = "none";
        if(formPermintaanWrapEl) formPermintaanWrapEl.style.display = "";
        tampilkanModeSebelumSimpan();
        resetFormItemDanKaryawanSaja();
        formPermintaanWrapEl?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
}

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
    btnCetakUlangSimpanEl.addEventListener("click", function(){
        if(!itemTerakhirDisimpan || !karyawanTerakhirDisimpan) return;
        siapkanAreaCetak(karyawanTerakhirDisimpan, tanggalTerakhirDisimpan, itemTerakhirDisimpan, "");
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

        for(const { barang, qty } of itemList){
            await kurangiStokGudangDiGudang(barang.id, selectedGudang, qty);
        }

        await loadStokGudang();
        refreshSemuaBarisStok();

        itemTerakhirDisimpan = itemList;
        karyawanTerakhirDisimpan = karyawan;
        tanggalTerakhirDisimpan = tanggal;

        if(adminUser){
            siapkanAreaCetak(karyawan, tanggal, itemList, "");

            alert(`Permintaan ATK/ART berhasil diajukan (${transaksiList.length} item).\nForm Permintaan ATK/ART silahkan di print dan di tandatangani, dan kasihkan ke HCS.\nTerimakasih`);

            tampilkanModeSetelahSimpan();

            await muatValidasiPermintaan();
            await muatRiwayatPengajuan();

        } else {
            tampilkanPdfSiapCetak(karyawan, tanggal, itemList);
        }

    }catch(err){ console.error(err); alert(err.message); }
});

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

    if(pdfPreviewPanelEl && pdfPreviewPanelEl.style.display !== "none"){
        pdfPreviewPanelEl.style.display = "none";
        previewPublikAktif = false;
        document.body.classList.remove("pdf-preview-mode");
        const printAreaEl = document.getElementById("printArea");
        if(printAreaEl){
            printAreaEl.style.transform = "";
            printAreaEl.style.marginBottom = "";
        }
        if(formPermintaanWrapEl) formPermintaanWrapEl.style.display = "";
    }
}

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

async function setujuiPermintaan(key){
    const grup = validasiGroupsCache.find(g => g.key === key);
    if(!grup) return;

    if(!confirm(`Setujui permintaan dari ${grup.nama_pengambil} (Gudang ${grup.gudang})?`)) return;

    try{
        const qtyMap = new Map();
        document.querySelectorAll(".validasi-qty-input").forEach(inp=>{
            qtyMap.set(String(inp.dataset.id), parseInt(inp.value) || 0);
        });

        for(const item of grup.items){
            const qtyFinal = qtyMap.get(String(item.id)) ?? item.qty;
            if(!qtyFinal || qtyFinal <= 0){ alert(`Jumlah untuk "${item.nama_barang}" harus lebih dari 0.`); return; }

            const selisih = qtyFinal - item.qty;
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

async function tolakPermintaan(key){
    const grup = validasiGroupsCache.find(g => g.key === key);
    if(!grup) return;

    const alasan = prompt("Alasan penolakan (opsional, akan tercatat di keterangan):", "");
    if(alasan === null) return;

    if(!confirm(`Tolak permintaan dari ${grup.nama_pengambil} (Gudang ${grup.gudang})?\nStok yang sudah terpotong saat pengajuan akan dikembalikan.`)) return;

    try{
        for(const item of grup.items){
            const barangMaster = findBarangByKode(item.kode_barang);
            if(barangMaster){
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

        const bisaDicetak = g.status !== STATUS_DITOLAK;

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
                    ${bisaDicetak ? `<button type="button" class="btn-cetak" data-key="${g.key}" title="Cetak ulang">🖨️ Cetak</button>` : ""}
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

function cetakRiwayat(key){
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
    window.print();
}

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

    if(rwBtnSimpan) rwBtnSimpan.style.display = "inline-block";

    rwModalOverlay.classList.add("show");
}

function bukaModalLihatRiwayat(key){
    const grup = cariGrupByKey(key);
    if(!grup || !rwModalOverlay || !rwEditRows) return;

    rwEditingKey = null;

    rwModalSub.textContent = `👁️ Lihat (Ditolak) — ${grup.nama_pengambil || "-"} · ${grup.departemen || "-"} · Gudang ${grup.gudang || "-"} · ${formatTanggalIndo(grup.tanggal)}`;

    rwEditRows.innerHTML = grup.items.map(it => `
        <tr data-id="${it.id}">
            <td>${it.nama_barang}<br><span class="riwayat-item-badge">${it.satuan}</span></td>
            <td><input type="number" min="1" class="rw-input-qty" value="${it.qty}" disabled></td>
            <td><input type="text" class="rw-input-ket" value="${(it.keterangan || '').replace(TAG_FORM,'').replace('[DITOLAK]','').trim().toUpperCase()}" disabled></td>
        </tr>
    `).join("");

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

                const selisih = qtyBaru - itemAsli.qty;

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

(async function init(){
    document.getElementById("tanggal").value = new Date().toISOString().split("T")[0];
    tambahBarisBarang();

    formBodyGated.dataset.locked = "1";

    await Promise.all([loadDaftarGudang(), loadBarang()]);

    initAdminChrome();
})();
