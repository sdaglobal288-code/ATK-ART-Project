// =====================================
// PERMINTAAN / PENGAMBILAN ATK & ART  (FHCS-003) — VERSI PUBLIK, TANPA LOGIN
// -------------------------------------------------------------------------
// Alur: karyawan buka link ini -> pilih GUDANG dulu -> baru daftar nama
// karyawan & stok barang muncul (difilter sesuai gudang yang dipilih).
// Tidak ada sessionStorage/login sama sekali di halaman ini.
//
// PENTING (harus disiapkan di sisi Supabase, tidak bisa dilakukan dari sini):
// Karena halaman ini publik (anon key, tanpa auth), Row Level Security (RLS)
// di Supabase WAJIB diatur supaya anon hanya bisa:
//   - SELECT master_karyawan (idealnya hanya kolom yang dipakai: id, nama,
//     nik, departemen, jabatan, gudang, status — jangan ekspos kolom sensitif
//     lain seperti gaji dsb bila ada, sebaiknya lewat VIEW khusus)
//   - SELECT master_barang (katalog barang, aman)
//   - SELECT + UPDATE + INSERT stok_gudang (perlu untuk baca & potong stok)
//   - INSERT saja ke barang_keluar (JANGAN beri akses SELECT publik ke
//     riwayat transaksi — makanya panel histori sengaja tidak ada di versi
//     publik ini)
// Tanpa policy ini, mematikan syarat login sama saja membuka akses baca/tulis
// tabel-tabel tsb ke siapa saja yang tahu URL-nya.
// =====================================

const TAG_FORM = "[Formulir Permintaan ATK/ART]";

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

async function kurangiStokGudang(barangId, qty){
    if(!qty || !selectedGudang) return;

    const { data: existing, error: selErr } = await supabaseClient
        .from("stok_gudang").select("*")
        .eq("barang_id", barangId).eq("gudang", selectedGudang).maybeSingle();

    if(selErr) throw selErr;

    const stokBaru = (existing ? (Number(existing.stok) || 0) : 0) - qty;

    if(existing){
        const { error: updErr } = await supabaseClient.from("stok_gudang")
            .update({ stok: stokBaru, updated_at: new Date().toISOString() }).eq("id", existing.id);
        if(updErr) throw updErr;
    } else {
        const { error: insErr } = await supabaseClient.from("stok_gudang")
            .insert([{ barang_id: barangId, gudang: selectedGudang, stok: stokBaru, updated_at: new Date().toISOString() }]);
        if(insErr) throw insErr;
    }
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
// CETAK FORM — replika presisi form kertas FHCS-003
// (dipakai baik oleh tombol "Cetak Form" manual maupun otomatis
//  setelah "Simpan & Kurangi Stok" berhasil)
// =====================================

function formatTanggalIndo(tglStr){
    if(!tglStr) return "..........................";
    const bulan = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
    const d = new Date(tglStr + "T00:00:00");
    return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
}

function siapkanAreaCetak(karyawan, tanggal, itemList){
    document.getElementById("pNamaKaryawan").textContent = karyawan.nama;
    document.getElementById("pDepartemen").textContent = karyawan.departemen || "-";
    document.getElementById("pNik").textContent = karyawan.nik || "-";
    document.getElementById("pTanggal").textContent = tanggal ? formatTanggalIndo(tanggal) : "-";
    document.getElementById("pCity").textContent = `Surabaya, ${formatTanggalIndo(tanggal)}`;

    const tbody = document.getElementById("printRowsBody");
    tbody.innerHTML = "";

    itemList.forEach(({ barang, qty, keteranganRow }, idx)=>{
        tbody.innerHTML += `
            <tr>
                <td>${idx + 1}</td>
                <td class="left">${barang.nama_barang}</td>
                <td>${barang.kategori || "-"}</td>
                <td>${qty}</td>
                <td>${barang.satuan}</td>
                <td class="left">${keteranganRow || "-"}</td>
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

    siapkanAreaCetak(karyawan, tanggal, itemList);
    window.print();
});

// =====================================
// SIMPAN PERMINTAAN (insert ke barang_keluar + potong stok otomatis)
// Setelah berhasil simpan, form otomatis memicu dialog cetak (print),
// supaya karyawan langsung bisa mencetak bukti & minta tanda tangan basah,
// tanpa harus klik tombol "Cetak Form" secara terpisah.
// =====================================

const form = document.getElementById("formPermintaan");

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
                alert(`Stok "${barang.nama_barang}" tidak mencukupi.\n\nStok tersedia : ${stokSaatIni}`);
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
            gudang: selectedGudang, created_by: karyawan.nama
        }));

        const { error } = await supabaseClient.from("barang_keluar").insert(transaksiList);
        if(error) throw error;

        for(const { barang, qty } of itemList){ await kurangiStokGudang(barang.id, qty); }

        // Siapkan & munculkan dialog cetak SEBELUM form direset, supaya data
        // yang tercetak masih data yang barusan disimpan.
        siapkanAreaCetak(karyawan, tanggal, itemList);
        window.print();

        alert(`Permintaan ATK/ART berhasil disimpan & stok otomatis terpotong (${transaksiList.length} item).`);

        resetFormItemDanKaryawanSaja();
        await loadStokGudang();
        refreshSemuaBarisStok();

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
