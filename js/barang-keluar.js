// =====================================
// BARANG KELUAR (MULTI ITEM + PENCARIAN + STOK REALTIME)
// Edit sekarang lewat MODAL POPUP (samagaya dengan Barang Masuk),
// dan Export Excel sudah jalan beneran (SheetJS).
//
// PERUBAHAN TERBARU:
// - Histori Barang Keluar & Export Excel SEKARANG mengecualikan baris
//   yang berasal dari Formulir Permintaan ATK/ART berstatus "Ditolak".
//   Baris yang ditolak tetap tersimpan di database (supaya tetap
//   tercatat & bisa dilihat di panel "Riwayat Pengajuan ATK/ART" pada
//   halaman permintaan-atk-art.html), tapi TIDAK ditampilkan lagi di
//   halaman Histori Barang Keluar ini maupun ikut ter-export ke Excel,
//   karena stok yang sempat terpotong untuk baris itu sudah dikembalikan
//   otomatis saat ditolak (sehingga baris itu bukan lagi transaksi
//   keluar yang sah).
//   Baris lama yang belum punya kolom "status" (NULL, sebelum migrasi
//   status ditambahkan) tetap ditampilkan seperti biasa — filter hanya
//   menyembunyikan baris yang status-nya PERSIS "Ditolak".
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));
if (!user) { location.href = "login.html"; }

let editId = null;
let editOriginalItem = null;
let importResults = [];
let masterBarangList = [];
let masterKaryawanList = [];
let stokGudangMap = new Map();

// =====================================
// LOAD KARYAWAN — difilter sesuai gudang yang login
// =====================================

async function loadKaryawan() {

    try {

        const { data, error } = await supabaseClient
            .from("master_karyawan")
            .select("*")
            .eq("status", "Aktif")
            .eq("gudang", user.gudang)
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
// PENGAMBIL - COMBOBOX PENCARIAN
// =====================================

function setupPengambilCombo(searchInput, hiddenInput, dropdown, departemenInput, jabatanInput){

    if(!searchInput || !hiddenInput || !dropdown){
        console.error("Elemen combobox pengambil tidak lengkap ditemukan di halaman.");
        return;
    }

    function render(keyword){

        const kw = (keyword || "").trim().toLowerCase();
        const filtered = masterKaryawanList.filter(k => k.nama.toLowerCase().includes(kw));

        dropdown.innerHTML = "";

        if(filtered.length === 0){
            dropdown.innerHTML = `<div class="combo-empty">Nama tidak ditemukan</div>`;
        } else {
            filtered.forEach(k=>{
                const item = document.createElement("div");
                item.className = "combo-item";
                item.textContent = k.nama;
                item.dataset.id = k.id;
                dropdown.appendChild(item);
            });
        }

        dropdown.classList.add("show");

    }

    searchInput.addEventListener("input", function(){
        hiddenInput.value = "";
        if(departemenInput) departemenInput.value = "";
        if(jabatanInput) jabatanInput.value = "";
        render(this.value);
    });

    searchInput.addEventListener("focus", function(){ render(this.value); });

    // Navigasi keyboard: panah bawah/atas untuk pindah pilihan, Enter untuk pilih, Esc untuk tutup
    searchInput.addEventListener("keydown", function(e){

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

    dropdown.addEventListener("click", function(e){
        const item = e.target.closest(".combo-item");
        if(!item || !item.dataset.id) return;
        const karyawan = findKaryawanById(item.dataset.id);
        if(!karyawan) return;
        hiddenInput.value = karyawan.id;
        searchInput.value = karyawan.nama;
        if(departemenInput) departemenInput.value = karyawan.departemen;
        if(jabatanInput) jabatanInput.value = karyawan.jabatan;
        dropdown.classList.remove("show");
    });

}

const pengambilSearchInput = document.getElementById("pengambilSearch");
const pengambilHidden      = document.getElementById("pengambil");
const pengambilDropdown    = document.getElementById("pengambilDropdown");

// =====================================
// LOAD MASTER BARANG
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
// STOK GUDANG
// =====================================

async function loadStokGudang(){

    try{

        const { data, error } = await supabaseClient
            .from("stok_gudang")
            .select("barang_id, stok")
            .eq("gudang", user.gudang);

        if(error) throw error;

        stokGudangMap = new Map();
        (data || []).forEach(row=>{
            stokGudangMap.set(String(row.barang_id), Number(row.stok) || 0);
        });

    }
    catch(err){ console.error(err); alert(err.message); }

}

async function ambilStokLive(barangId){

    if(!barangId) return 0;

    const { data, error } = await supabaseClient
        .from("stok_gudang")
        .select("stok")
        .eq("barang_id", barangId)
        .eq("gudang", user.gudang)
        .maybeSingle();

    if(error){ console.error(error); return 0; }
    return data ? (Number(data.stok) || 0) : 0;

}

async function kurangiStokGudang(barangId, qty){

    if(!qty) return;

    const { data: existing, error: selErr } = await supabaseClient
        .from("stok_gudang").select("*")
        .eq("barang_id", barangId).eq("gudang", user.gudang).maybeSingle();

    if(selErr) throw selErr;

    const stokBaru = (existing ? (Number(existing.stok) || 0) : 0) - qty;

    if(existing){
        const { error: updErr } = await supabaseClient.from("stok_gudang")
            .update({ stok: stokBaru, updated_at: new Date().toISOString() }).eq("id", existing.id);
        if(updErr) throw updErr;
    } else {
        const { error: insErr } = await supabaseClient.from("stok_gudang")
            .insert([{ barang_id: barangId, gudang: user.gudang, stok: stokBaru, updated_at: new Date().toISOString() }]);
        if(insErr) throw insErr;
    }

}

async function tambahKembaliStokGudang(barangId, qty){

    if(!qty) return;

    const { data: existing, error: selErr } = await supabaseClient
        .from("stok_gudang").select("*")
        .eq("barang_id", barangId).eq("gudang", user.gudang).maybeSingle();

    if(selErr) throw selErr;

    if(existing){
        const stokBaru = (Number(existing.stok) || 0) + qty;
        const { error: updErr } = await supabaseClient.from("stok_gudang")
            .update({ stok: stokBaru, updated_at: new Date().toISOString() }).eq("id", existing.id);
        if(updErr) throw updErr;
    } else {
        const { error: insErr } = await supabaseClient.from("stok_gudang")
            .insert([{ barang_id: barangId, gudang: user.gudang, stok: qty, updated_at: new Date().toISOString() }]);
        if(insErr) throw insErr;
    }

}

// =====================================
// BARIS DETAIL BARANG
// =====================================

function templateBarisBarang(){
    return `
        <div class="combo-wrapper">
            <input type="text" class="combo-input input-barang-search"
                placeholder="-- Cari Barang --" autocomplete="off" required>
            <input type="hidden" class="input-barang-id">
            <div class="combo-dropdown input-barang-dropdown"></div>
        </div>
        <input type="text" class="input-readonly input-kategori" placeholder="Kategori" readonly>
        <input type="text" class="input-readonly input-satuan" placeholder="Satuan" readonly>
        <span class="stok-badge">Stok: -</span>
        <input type="number" class="input-qty" placeholder="Qty" min="1" required>
        <button type="button" class="btn-hapus-baris" title="Hapus baris">✕</button>
    `;
}

function tambahBarisBarangKe(containerId){

    const wrapper = document.getElementById(containerId);
    if(!wrapper){ console.error(`Elemen #${containerId} tidak ditemukan di halaman.`); return null; }

    const row = document.createElement("div");
    row.className = "detail-row";
    row.dataset.kodeBarang = "";
    row.dataset.stok = "0";
    row.innerHTML = templateBarisBarang();
    wrapper.appendChild(row);
    return row;

}

function tambahBarisBarang(){ tambahBarisBarangKe("detailRows"); }

function hapusBarisBarang(row, containerId){
    const wrapper = document.getElementById(containerId);
    if(wrapper.children.length <= 1){ alert("Minimal harus ada 1 baris barang."); return; }
    row.remove();
}

function refreshStokBaris(row){

    const badge = row.querySelector(".stok-badge");
    const barangId = row.querySelector(".input-barang-id").value;

    if(!barangId){
        badge.textContent = "Stok: -";
        badge.classList.remove("warning");
        row.dataset.stok = "0";
        return;
    }

    const stok = stokGudangMap.get(String(barangId)) || 0;
    row.dataset.stok = stok;
    badge.textContent = `Stok: ${stok}`;
    validasiQtyBaris(row);

}

function refreshSemuaBarisStok(){
    document.querySelectorAll("#detailRows .detail-row, #editDetailRows .detail-row").forEach(row=>{
        if(row.querySelector(".input-barang-id").value) refreshStokBaris(row);
    });
}

function validasiQtyBaris(row){

    const badge = row.querySelector(".stok-badge");
    const qtyInput = row.querySelector(".input-qty");
    const stok = parseInt(row.dataset.stok || "0");
    const qty = parseInt(qtyInput.value || "0");

    if(qty > stok){ row.classList.add("qty-invalid"); badge.classList.add("warning"); }
    else { row.classList.remove("qty-invalid"); badge.classList.remove("warning"); }

}

// =====================================
// EVENT DELEGATION
// =====================================

function setupDetailRowsDelegation(containerId){

    const container = document.getElementById(containerId);
    if(!container){ console.error(`Elemen #${containerId} tidak ditemukan di halaman.`); return; }

    container.addEventListener("input", function(e){
        const row = e.target.closest(".detail-row");
        if(!row) return;
        if(e.target.classList.contains("input-barang-search")){
            row.querySelector(".input-barang-id").value = "";
            row.querySelector(".input-kategori").value = "";
            row.querySelector(".input-satuan").value = "";
            row.dataset.kodeBarang = "";
            refreshStokBaris(row);
            renderBarangDropdown(row, e.target.value);
            return;
        }
        if(e.target.classList.contains("input-qty")){ validasiQtyBaris(row); }
    });

    container.addEventListener("focusin", function(e){
        if(e.target.classList.contains("input-barang-search")){
            const row = e.target.closest(".detail-row");
            if(row) renderBarangDropdown(row, e.target.value);
        }
    });

    // Navigasi keyboard untuk dropdown pencarian barang (panah bawah/atas, Enter, Esc)
    container.addEventListener("keydown", function(e){

        if(!e.target.classList.contains("input-barang-search")) return;

        const row = e.target.closest(".detail-row");
        if(!row) return;

        const dropdown = row.querySelector(".input-barang-dropdown");
        if(!dropdown || !dropdown.classList.contains("show")) return;

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

    container.addEventListener("click", function(e){
        if(e.target.classList.contains("btn-hapus-baris")){
            const row = e.target.closest(".detail-row");
            if(row) hapusBarisBarang(row, containerId);
            return;
        }
        const comboItem = e.target.closest(".combo-item");
        if(comboItem && comboItem.dataset.id && comboItem.closest(".input-barang-dropdown")){
            const row = e.target.closest(".detail-row");
            if(!row) return;
            const barang = findBarangById(comboItem.dataset.id);
            if(!barang) return;
            row.querySelector(".input-barang-search").value = barang.nama_barang;
            row.querySelector(".input-barang-id").value = barang.id;
            row.querySelector(".input-kategori").value = barang.kategori;
            row.querySelector(".input-satuan").value = barang.satuan;
            row.dataset.kodeBarang = barang.kode_barang;
            row.querySelector(".input-barang-dropdown").classList.remove("show");
            refreshStokBaris(row);
        }
    });

}

document.getElementById("btnTambahBaris").addEventListener("click", function(){
    tambahBarisBarangKe("detailRows");
});

const btnTambahBarisEditEl = document.getElementById("btnTambahBarisEdit");
if(btnTambahBarisEditEl){
    btnTambahBarisEditEl.addEventListener("click", function(){ tambahBarisBarangKe("editDetailRows"); });
}

document.addEventListener("click", function(e){
    document.querySelectorAll(".combo-wrapper").forEach(wrapper=>{
        if(!wrapper.contains(e.target)){
            const dd = wrapper.querySelector(".combo-dropdown");
            if(dd) dd.classList.remove("show");
        }
    });
});

// =====================================
// REALTIME STOK
// =====================================

function aktifkanRealtimeStok(){

    supabaseClient
    .channel("stok-realtime-barang-keluar")
    .on("postgres_changes",
        { event: "*", schema: "public", table: "stok_gudang", filter: `gudang=eq.${user.gudang}` },
        async () => { await loadStokGudang(); refreshSemuaBarisStok(); }
    )
    .on("postgres_changes",
        { event: "*", schema: "public", table: "master_barang" },
        async () => { await loadBarang(); }
    )
    .subscribe();

}

// =====================================
// LOAD & TAMPIL HISTORI
//
// CATATAN: histori ini SEKARANG hanya menampilkan baris yang berstatus
// "Disetujui" (atau baris lama yang belum memiliki kolom "status" sama
// sekali / NULL — dianggap "Disetujui" sesuai fallback `row.status ||
// 'Disetujui'` yang dipakai di js/permintaan-atk-art.js). Baris yang
// berasal dari Formulir Permintaan ATK/ART dan masih berstatus
// "Menunggu Approval" ATAUPUN sudah "Ditolak" TIDAK ditampilkan di sini,
// karena:
// - "Menunggu Approval": belum final, belum tentu disetujui admin.
// - "Ditolak": stok yang sempat terpotong sudah dikembalikan otomatis
//   saat admin menolaknya (lihat js/permintaan-atk-art.js ->
//   tolakPermintaan()), jadi baris ini bukan transaksi keluar yang sah.
// =====================================

async function loadBarangKeluar() {

    try {

        const { data, error } = await supabaseClient
            .from("barang_keluar")
            .select("*")
            .eq("gudang", user.gudang)
            .or("status.is.null,status.eq.Disetujui")
            .order("tanggal", { ascending: false })
            .order("id", { ascending: false });

        if (error) throw error;
        tampilBarangKeluar(data);

    } catch (err) { console.error(err); alert(err.message); }

}

function tampilBarangKeluar(data){

    const tbody = document.querySelector("#tableKeluar tbody");
    tbody.innerHTML = "";

    if(!data || data.length === 0){
        tbody.innerHTML = `
        <tr>
            <td colspan="11" class="empty-state">
                Belum ada data Barang Keluar.
            </td>
        </tr>`;
        return;
    }

    let no = 1;
    data.forEach(item=>{
        tbody.innerHTML += `
        <tr>
            <td>${no++}</td>
            <td>${item.tanggal}</td>
            <td><b>${item.nama_pengambil}</b></td>
            <td>${item.departemen}</td>
            <td>${item.jabatan}</td>
            <td>${item.nama_barang}</td>
            <td><span class="text-danger">-${item.qty}</span></td>
            <td><span class="satuan-badge">${item.satuan}</span></td>
            <td>${item.keterangan ?? "-"}</td>
            <td>${item.created_by}</td>
            <td>
                <button class="btn-edit" onclick="editBarangKeluar(${item.id})">✏ Edit</button>
                <button class="btn-delete" onclick="hapusBarangKeluar(${item.id})">🗑 Hapus</button>
            </td>
        </tr>`;
    });

}

// =====================================
// SEARCH HISTORI
// =====================================

function cariBarangKeluar(){
    const keyword = document.getElementById("search").value.toLowerCase();
    document.querySelectorAll("#tableKeluar tbody tr").forEach(row=>{
        row.style.display = row.innerText.toLowerCase().includes(keyword) ? "" : "none";
    });
}

document.getElementById("search").addEventListener("keyup", cariBarangKeluar);

// =====================================
// VALIDASI + AMBIL ITEM DARI CONTAINER
// =====================================

function validasiDanAmbilItem(containerId){

    const rows = document.querySelectorAll(`#${containerId} .detail-row`);
    if(rows.length === 0){ alert("Tambahkan minimal 1 barang."); return null; }

    const itemList = [];
    const kodeSudahDipakai = new Set();

    for(const row of rows){
        const barangId = row.querySelector(".input-barang-id").value;
        const qty = parseInt(row.querySelector(".input-qty").value);
        if(barangId === ""){ alert("Ada baris yang belum memilih barang dari daftar pencarian."); return null; }
        if(!qty || qty <= 0){ alert("Qty harus lebih dari 0 untuk setiap barang."); return null; }
        const barang = findBarangById(barangId);
        if(!barang){ alert("Data barang tidak ditemukan, coba muat ulang halaman."); return null; }
        if(kodeSudahDipakai.has(barang.kode_barang)){
            alert(`Barang "${barang.nama_barang}" dipilih lebih dari satu kali.\nGabungkan qty-nya dalam satu baris saja.`);
            return null;
        }
        kodeSudahDipakai.add(barang.kode_barang);
        itemList.push({ barang, qty });
    }

    return itemList;

}

// =====================================
// SIMPAN BARANG KELUAR
// =====================================

const form = document.getElementById("formKeluar");

if(form){
form.addEventListener("submit", async function(e){
    e.preventDefault();
    try{
        const pengambilId = pengambilHidden.value;
        if(pengambilId === ""){ alert("Pilih nama pengambil dari daftar pencarian."); return; }
        const karyawan = findKaryawanById(pengambilId);
        if(!karyawan){ alert("Data pengambil tidak ditemukan, coba muat ulang halaman."); return; }

        const itemList = validasiDanAmbilItem("detailRows");
        if(!itemList) return;

        for(const { barang, qty } of itemList){
            const stokSaatIni = await ambilStokLive(barang.id);
            if(qty > stokSaatIni){
                alert(`Stok "${barang.nama_barang}" tidak mencukupi.\n\nStok tersedia : ${stokSaatIni}`);
                return;
            }
        }

        const tanggal = document.getElementById("tanggal").value;
        const keterangan = document.getElementById("keterangan").value;

        const transaksiList = itemList.map(({barang, qty}) => ({
            tanggal, nik: karyawan.nik, nama_pengambil: karyawan.nama,
            departemen: karyawan.departemen, jabatan: karyawan.jabatan,
            kode_barang: barang.kode_barang, nama_barang: barang.nama_barang,
            kategori: barang.kategori, satuan: barang.satuan,
            qty, keterangan, gudang: user.gudang, created_by: user.nama
        }));

        const { error } = await supabaseClient.from("barang_keluar").insert(transaksiList);
        if(error) throw error;

        for(const { barang, qty } of itemList){ await kurangiStokGudang(barang.id, qty); }

        alert(`Barang Keluar berhasil disimpan (${transaksiList.length} item).`);
        resetFormKeluar();
        await loadBarang();
        await loadStokGudang();
        refreshSemuaBarisStok();
        await loadBarangKeluar();

    }catch(err){ console.error(err); alert(err.message); }
});
}

function resetFormKeluar(){
    form.reset();
    pengambilHidden.value = "";
    pengambilSearchInput.value = "";
    document.getElementById("departemen").value = "";
    document.getElementById("jabatan").value = "";
    document.getElementById("tanggal").value = new Date().toISOString().split("T")[0];
    document.getElementById("detailRows").innerHTML = "";
    tambahBarisBarangKe("detailRows");
}

// =====================================
// EDIT BARANG KELUAR
// =====================================

async function editBarangKeluar(id){

    try{
        const { data, error } = await supabaseClient.from("barang_keluar").select("*").eq("id", id).single();
        if(error) throw error;

        editId = id;
        const barangLama = findBarangByKode(data.kode_barang);
        editOriginalItem = { barang_id: barangLama ? barangLama.id : null, qty: Number(data.qty) || 0 };

        document.getElementById("editTanggal").value = data.tanggal;
        document.getElementById("editKeterangan").value = data.keterangan ?? "";

        const editPengambilSearch = document.getElementById("editPengambilSearch");
        const editPengambilHidden = document.getElementById("editPengambil");
        editPengambilHidden.value = "";
        editPengambilSearch.value = data.nama_pengambil;

        const karyawanCocok =
            masterKaryawanList.find(k => k.nik === data.nik) ||
            masterKaryawanList.find(k => k.nama === data.nama_pengambil);
        if(karyawanCocok) editPengambilHidden.value = karyawanCocok.id;

        document.getElementById("editDepartemen").value = data.departemen;
        document.getElementById("editJabatan").value = data.jabatan;

        document.getElementById("editDetailRows").innerHTML = "";
        const row = tambahBarisBarangKe("editDetailRows");

        if(barangLama){
            row.querySelector(".input-barang-search").value = barangLama.nama_barang;
            row.querySelector(".input-barang-id").value = barangLama.id;
            row.querySelector(".input-kategori").value = barangLama.kategori;
            row.querySelector(".input-satuan").value = barangLama.satuan;
            row.dataset.kodeBarang = barangLama.kode_barang;
        } else {
            row.querySelector(".input-barang-search").value = data.nama_barang;
            row.querySelector(".input-kategori").value = data.kategori;
            row.querySelector(".input-satuan").value = data.satuan;
        }

        row.querySelector(".input-qty").value = data.qty;
        refreshStokBaris(row);
        document.getElementById("modalEditKeluar").classList.add("show");

    }catch(err){ console.error(err); alert(err.message); }

}

function tutupModalEdit(){
    document.getElementById("modalEditKeluar").classList.remove("show");
    editId = null;
    editOriginalItem = null;
}

const btnTutupModalEditEl = document.getElementById("btnTutupModalEdit");
if(btnTutupModalEditEl){ btnTutupModalEditEl.addEventListener("click", tutupModalEdit); }

const modalEditKeluarEl = document.getElementById("modalEditKeluar");
if(modalEditKeluarEl){
    modalEditKeluarEl.addEventListener("click", function(e){ if(e.target === modalEditKeluarEl) tutupModalEdit(); });
}

// =====================================
// SIMPAN EDIT
// =====================================

const btnSimpanEditKeluarEl = document.getElementById("btnSimpanEditKeluar");
if(btnSimpanEditKeluarEl){ btnSimpanEditKeluarEl.addEventListener("click", simpanEditKeluar); }

async function simpanEditKeluar(){

    try{
        if(editId === null){ alert("Tidak ada data yang sedang diedit."); return; }

        const tanggal = document.getElementById("editTanggal").value;
        const keterangan = document.getElementById("editKeterangan").value.trim();
        const pengambilId = document.getElementById("editPengambil").value;

        if(tanggal === ""){ alert("Tanggal wajib diisi."); return; }
        if(pengambilId === ""){ alert("Pilih nama pengambil dari daftar pencarian."); return; }

        const karyawan = findKaryawanById(pengambilId);
        if(!karyawan){ alert("Data pengambil tidak ditemukan, coba muat ulang halaman."); return; }

        const itemList = validasiDanAmbilItem("editDetailRows");
        if(!itemList) return;

        const { barang: barangBaru, qty: qtyBaru } = itemList[0];
        const barangLamaId = editOriginalItem ? editOriginalItem.barang_id : null;
        const qtyLama = editOriginalItem ? editOriginalItem.qty : 0;
        const barangBerubah = String(barangLamaId) !== String(barangBaru.id);

        if(!barangBerubah){
            const stokSaatIni = await ambilStokLive(barangBaru.id);
            const stokTersedia = stokSaatIni + qtyLama;
            if(qtyBaru > stokTersedia){
                alert(`Stok "${barangBaru.nama_barang}" tidak mencukupi.\n\nStok tersedia : ${stokTersedia}`);
                return;
            }
        } else {
            const stokBarangBaru = await ambilStokLive(barangBaru.id);
            if(qtyBaru > stokBarangBaru){
                alert(`Stok "${barangBaru.nama_barang}" tidak mencukupi.\n\nStok tersedia : ${stokBarangBaru}`);
                return;
            }
        }

        const { error: updErr } = await supabaseClient.from("barang_keluar").update({
            tanggal, nik: karyawan.nik, nama_pengambil: karyawan.nama,
            departemen: karyawan.departemen, jabatan: karyawan.jabatan,
            kode_barang: barangBaru.kode_barang, nama_barang: barangBaru.nama_barang,
            kategori: barangBaru.kategori, satuan: barangBaru.satuan,
            qty: qtyBaru, keterangan
        }).eq("id", editId);
        if(updErr) throw updErr;

        if(!barangBerubah){
            const delta = qtyBaru - qtyLama;
            if(delta !== 0) await kurangiStokGudang(barangBaru.id, delta);
        } else {
            if(barangLamaId) await tambahKembaliStokGudang(barangLamaId, qtyLama);
            await kurangiStokGudang(barangBaru.id, qtyBaru);
        }

        alert("Perubahan Barang Keluar berhasil disimpan.");
        tutupModalEdit();
        await loadBarang();
        await loadStokGudang();
        refreshSemuaBarisStok();
        await loadBarangKeluar();

    }catch(err){ console.error(err); alert(err.message); }

}

// =====================================
// HAPUS
// =====================================

async function hapusBarangKeluar(id){

    if(!confirm("Hapus transaksi ini?")) return;

    try{
        const { data: dataLama, error: getErr } = await supabaseClient
            .from("barang_keluar").select("*").eq("id", id).single();
        if(getErr) throw getErr;

        const { error } = await supabaseClient.from("barang_keluar").delete().eq("id", id);
        if(error) throw error;

        if(dataLama){
            const barang = findBarangByKode(dataLama.kode_barang);
            if(barang) await tambahKembaliStokGudang(barang.id, dataLama.qty);
        }

        alert("Data berhasil dihapus.");
        await loadStokGudang();
        refreshSemuaBarisStok();
        loadBarangKeluar();

    }catch(err){ console.error(err); alert(err.message); }

}

// =====================================
// EXPORT EXCEL (MODAL PILIH RANGE TANGGAL)
//
// CATATAN: sama seperti loadBarangKeluar(), export ini hanya mengambil
// baris berstatus "Disetujui" (atau NULL, dianggap "Disetujui"), supaya
// laporan Excel yang di-export tidak ikut menyertakan pengajuan ATK/ART
// yang masih "Menunggu Approval" ataupun yang sudah "Ditolak".
// =====================================

function bukaModalExportRange(){
    document.getElementById("exportDari").value = "";
    document.getElementById("exportSampai").value = "";
    document.getElementById("modalExportRange").classList.add("show");
}

function tutupModalExportRange(){
    document.getElementById("modalExportRange").classList.remove("show");
}

const btnTutupModalExportRangeEl = document.getElementById("btnTutupModalExportRange");
if(btnTutupModalExportRangeEl){ btnTutupModalExportRangeEl.addEventListener("click", tutupModalExportRange); }

const btnBatalExportRangeEl = document.getElementById("btnBatalExportRange");
if(btnBatalExportRangeEl){ btnBatalExportRangeEl.addEventListener("click", tutupModalExportRange); }

const modalExportRangeEl = document.getElementById("modalExportRange");
if(modalExportRangeEl){
    modalExportRangeEl.addEventListener("click", function(e){ if(e.target === modalExportRangeEl) tutupModalExportRange(); });
}

const btnJalankanExportRangeEl = document.getElementById("btnJalankanExportRange");
if(btnJalankanExportRangeEl){
    btnJalankanExportRangeEl.addEventListener("click", async function(){
        const dariTanggal = document.getElementById("exportDari").value;
        const sampaiTanggal = document.getElementById("exportSampai").value;
        if(dariTanggal && sampaiTanggal && dariTanggal > sampaiTanggal){
            alert("Tanggal Dari tidak boleh lebih besar dari Tanggal Sampai.");
            return;
        }
        await exportExcel(dariTanggal, sampaiTanggal);
        tutupModalExportRange();
    });
}

async function exportExcel(dariTanggal, sampaiTanggal){

    try{
        if(typeof XLSX === "undefined"){ alert("Library Excel belum termuat, silakan refresh halaman lalu coba lagi."); return; }

        let query = supabaseClient
            .from("barang_keluar")
            .select("*")
            .eq("gudang", user.gudang)
            .or("status.is.null,status.eq.Disetujui");

        if(dariTanggal) query = query.gte("tanggal", dariTanggal);
        if(sampaiTanggal) query = query.lte("tanggal", sampaiTanggal);
        query = query.order("tanggal", {ascending:false}).order("id", {ascending:false});

        const { data, error } = await query;
        if(error) throw error;

        if(!data || data.length === 0){ alert("Tidak ada data Barang Keluar untuk diexport pada rentang tanggal tersebut."); return; }

        const rows = data.map(item => ({
            "Tanggal"       : item.tanggal,
            "NIK"           : item.nik,
            "Nama Pengambil": item.nama_pengambil,
            "Departemen"    : item.departemen,
            "Jabatan"       : item.jabatan,
            "Kode Barang"   : item.kode_barang,
            "Nama Barang"   : item.nama_barang,
            "Kategori"      : item.kategori,
            "Satuan"        : item.satuan,
            "Qty"           : item.qty,
            "Keterangan"    : item.keterangan || "",
            "Gudang"        : item.gudang,
            "Created By"    : item.created_by
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        ws["!cols"] = [
            {wch:12},{wch:14},{wch:22},{wch:18},{wch:16},
            {wch:14},{wch:26},{wch:16},{wch:10},{wch:8},
            {wch:24},{wch:14},{wch:18}
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Barang Keluar");

        const tanggalFile = new Date().toISOString().split("T")[0];
        const labelRentang = (dariTanggal || sampaiTanggal)
            ? `_${dariTanggal || "awal"}_sd_${sampaiTanggal || "akhir"}`
            : "";
        const namaFile = `Barang-Keluar-${user.gudang}${labelRentang}-${tanggalFile}.xlsx`;
        XLSX.writeFile(wb, namaFile);

    }catch(err){ console.error(err); alert(err.message); }

}

// =====================================
// IMPORT EXCEL
// =====================================

document.getElementById("fileImport").addEventListener("change", function(e){
    const file = e.target.files[0];
    if(!file) return;
    prosesImportExcel(file);
    e.target.value = "";
});

async function prosesImportExcel(file){

    try{
        if(typeof XLSX === "undefined"){ alert("Library Excel belum termuat, silakan refresh halaman lalu coba lagi."); return; }

        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array", cellDates: true });
        const sheetName = wb.SheetNames[0];
        if(!sheetName){ alert("File Excel tidak berisi sheet apapun."); return; }

        const sheet = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { raw: false, dateNF: "yyyy-mm-dd", defval: "" });

        if(rows.length === 0){
            alert("File Excel kosong atau kolom tidak dikenali. Gunakan tombol \"Template Import\" untuk format yang benar.");
            return;
        }

        importResults = [];
        let sukses = 0, gagal = 0;

        for(let i = 0; i < rows.length; i++){
            const hasil = await prosesSatuBarisImport(rows[i], i + 2);
            importResults.push(hasil);
            if(hasil.status === "sukses") sukses++; else gagal++;
        }

        await loadBarang();
        await loadStokGudang();
        refreshSemuaBarisStok();
        await loadBarangKeluar();

        tampilkanHasilImport(sukses, gagal);

    }catch(err){ console.error(err); alert("Gagal membaca file Excel: " + err.message); }

}

async function prosesSatuBarisImport(baris, nomorBaris){

    const tanggal = String(baris["Tanggal"] ?? "").trim();
    const nik = String(baris["NIK"] ?? "").trim();
    const namaPengambilInput = String(baris["Nama Pengambil"] ?? "").trim();
    const kodeBarang = String(baris["Kode Barang"] ?? "").trim();
    const qtyRaw = baris["Qty"];
    const keterangan = String(baris["Keterangan"] ?? "").trim();

    const hasilDasar = { baris: nomorBaris, tanggal, nik, namaPengambil: namaPengambilInput, kodeBarang, qty: qtyRaw, keterangan };

    if(!tanggal || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)){
        return { ...hasilDasar, status: "gagal", alasan: "Format tanggal tidak valid (harus YYYY-MM-DD)." };
    }

    let karyawan = null;
    if(nik) karyawan = masterKaryawanList.find(k => String(k.nik ?? "").trim() === nik);
    if(!karyawan && namaPengambilInput) karyawan = masterKaryawanList.find(k => k.nama.trim().toLowerCase() === namaPengambilInput.toLowerCase());
    if(!karyawan){ return { ...hasilDasar, status: "gagal", alasan: "NIK / Nama Pengambil tidak ditemukan di master karyawan aktif." }; }

    if(!kodeBarang){ return { ...hasilDasar, status: "gagal", alasan: "Kode Barang wajib diisi." }; }

    const barang = masterBarangList.find(b => b.kode_barang.trim() === kodeBarang);
    if(!barang){ return { ...hasilDasar, status: "gagal", alasan: "Kode Barang tidak ditemukan di master barang." }; }

    const qty = parseInt(qtyRaw);
    if(!qty || qty <= 0){ return { ...hasilDasar, status: "gagal", alasan: "Qty harus berupa angka lebih dari 0." }; }

    try{
        const stokSaatIni = await ambilStokLive(barang.id);
        if(qty > stokSaatIni){ return { ...hasilDasar, status: "gagal", alasan: `Stok "${barang.nama_barang}" tidak mencukupi (tersedia: ${stokSaatIni}).` }; }

        const { error: insErr } = await supabaseClient.from("barang_keluar").insert([{
            tanggal, nik: karyawan.nik, nama_pengambil: karyawan.nama,
            departemen: karyawan.departemen, jabatan: karyawan.jabatan,
            kode_barang: barang.kode_barang, nama_barang: barang.nama_barang,
            kategori: barang.kategori, satuan: barang.satuan,
            qty, keterangan, gudang: user.gudang, created_by: user.nama
        }]);
        if(insErr) throw insErr;

        await kurangiStokGudang(barang.id, qty);
        return { ...hasilDasar, status: "sukses", alasan: "Berhasil disimpan." };

    }catch(err){
        console.error(err);
        return { ...hasilDasar, status: "gagal", alasan: "Gagal simpan ke database: " + err.message };
    }

}

// =====================================
// HASIL IMPORT (MODAL)
// =====================================

function tampilkanHasilImport(sukses, gagal){

    const tbody = document.querySelector("#tableHasilImport tbody");
    tbody.innerHTML = "";

    importResults.forEach(r=>{
        const badge = r.status === "sukses"
            ? `<span class="status-badge sukses">✔ Sukses</span>`
            : `<span class="status-badge gagal">✕ Gagal</span>`;
        tbody.innerHTML += `
        <tr>
            <td>${r.baris}</td>
            <td>${r.tanggal || "-"}</td>
            <td>${r.nik || r.namaPengambil || "-"}</td>
            <td>${r.kodeBarang || "-"}</td>
            <td>${r.qty === "" || r.qty === undefined ? "-" : r.qty}</td>
            <td>${badge}</td>
            <td>${r.alasan}</td>
        </tr>`;
    });

    document.getElementById("importSummary").innerHTML =
        `Total <b>${importResults.length}</b> baris diproses — ` +
        `<span style="color:#4ade80;">${sukses} berhasil</span>, ` +
        `<span style="color:#f87171;">${gagal} gagal</span>.` +
        (gagal > 0 ? ` Perbaiki baris yang gagal pada file yang didownload di bawah, lalu import ulang file tersebut.` : ``);

    const btnDownloadGagal = document.getElementById("btnDownloadGagalImport");
    if(btnDownloadGagal) btnDownloadGagal.style.display = gagal > 0 ? "inline-flex" : "none";

    document.getElementById("modalHasilImport").classList.add("show");

}

function tutupModalHasilImport(){
    document.getElementById("modalHasilImport").classList.remove("show");
}

const btnTutupModalHasilImportEl = document.getElementById("btnTutupModalHasilImport");
if(btnTutupModalHasilImportEl){ btnTutupModalHasilImportEl.addEventListener("click", tutupModalHasilImport); }

const modalHasilImportEl = document.getElementById("modalHasilImport");
if(modalHasilImportEl){
    modalHasilImportEl.addEventListener("click", function(e){ if(e.target === modalHasilImportEl) tutupModalHasilImport(); });
}

const btnDownloadGagalImportEl = document.getElementById("btnDownloadGagalImport");
if(btnDownloadGagalImportEl){ btnDownloadGagalImportEl.addEventListener("click", exportGagalImport); }

function exportGagalImport(){

    if(typeof XLSX === "undefined"){ alert("Library Excel belum termuat, silakan refresh halaman lalu coba lagi."); return; }

    const gagalList = importResults.filter(r => r.status === "gagal");
    if(gagalList.length === 0){ alert("Tidak ada baris yang gagal."); return; }

    const rows = gagalList.map(r => ({
        "Tanggal": r.tanggal, "NIK": r.nik, "Nama Pengambil": r.namaPengambil,
        "Kode Barang": r.kodeBarang, "Qty": r.qty,
        "Keterangan": r.keterangan, "Alasan Gagal": r.alasan
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{wch:12},{wch:14},{wch:22},{wch:14},{wch:8},{wch:24},{wch:44}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Gagal Import");
    XLSX.writeFile(wb, `Barang-Keluar-Gagal-Import-${new Date().toISOString().split("T")[0]}.xlsx`);

}

// =====================================
// TEMPLATE IMPORT
// =====================================

function downloadTemplateImport(){

    if(typeof XLSX === "undefined"){ alert("Library Excel belum termuat, silakan refresh halaman lalu coba lagi."); return; }

    const contoh = [{
        "Tanggal": new Date().toISOString().split("T")[0],
        "NIK": "", "Nama Pengambil": "", "Kode Barang": "", "Qty": "", "Keterangan": ""
    }];

    const ws = XLSX.utils.json_to_sheet(contoh);
    ws["!cols"] = [{wch:12},{wch:14},{wch:22},{wch:14},{wch:8},{wch:24}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Import");
    XLSX.writeFile(wb, "Template-Import-Barang-Keluar.xlsx");

}

// =====================================
// LOAD AWAL
// =====================================

document.addEventListener("DOMContentLoaded", async ()=>{

    document.getElementById("tanggal").value = new Date().toISOString().split("T")[0];

    await loadKaryawan();
    await loadBarang();
    await loadStokGudang();

    setupPengambilCombo(
        pengambilSearchInput, pengambilHidden, pengambilDropdown,
        document.getElementById("departemen"), document.getElementById("jabatan")
    );

    setupPengambilCombo(
        document.getElementById("editPengambilSearch"),
        document.getElementById("editPengambil"),
        document.getElementById("editPengambilDropdown"),
        document.getElementById("editDepartemen"),
        document.getElementById("editJabatan")
    );

    setupDetailRowsDelegation("detailRows");
    setupDetailRowsDelegation("editDetailRows");

    tambahBarisBarangKe("detailRows");
    await loadBarangKeluar();
    aktifkanRealtimeStok();

});
