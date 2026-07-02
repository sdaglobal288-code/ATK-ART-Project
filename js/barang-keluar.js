// =====================================
// BARANG KELUAR (MULTI ITEM + PENCARIAN + STOK REALTIME)
// =====================================
//
// SUMBER STOK: tabel "stok_gudang" (barang_id, gudang, stok, updated_at)
// adalah SATU-SATUNYA sumber kebenaran stok saat ini, dan selalu
// difilter berdasarkan gudang akun yang sedang login (user.gudang).
// master_barang tetap satu tabel bersama (dipakai kedua gudang) untuk
// data katalog (nama, kategori, satuan) saja - bukan untuk stok.
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));

if (!user) {
    location.href = "login.html";
}

// id transaksi yang sedang dibuka di modal Edit (null jika tidak ada)
let editId = null;

// item asli (sebelum diedit) milik transaksi yang sedang dibuka di modal
// Edit, dipakai untuk menghitung selisih stok saat disimpan
let editOriginalItem = { barang_id: null, qty: 0 };

// cache master data supaya tidak query berulang tiap kali user mengetik/pilih
let masterBarangList = [];
let masterKaryawanList = [];

// stok per barang UNTUK GUDANG YANG SEDANG LOGIN (key: barang_id -> stok)
let stokGudangMap = new Map();

// =====================================
// LOAD KARYAWAN
// =====================================

async function loadKaryawan() {

    try {

        const { data, error } = await supabaseClient
            .from("master_karyawan")
            .select("*")
            .eq("status", "Aktif")
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
// PENGAMBIL - COMBOBOX PENCARIAN (GENERIK, DIPAKAI FORM UTAMA & FORM EDIT)
// =====================================

const pengambilSearchInput = document.getElementById("pengambilSearch");
const pengambilHidden      = document.getElementById("pengambil");
const pengambilDropdown    = document.getElementById("pengambilDropdown");

function setupPengambilCombo(searchInput, hiddenInput, dropdown, departemenInput, jabatanInput){

    if(!searchInput || !hiddenInput || !dropdown){

        console.error("Elemen combobox pengambil tidak lengkap ditemukan di halaman.");
        return;

    }

    function render(keyword){

        const kw = (keyword || "").trim().toLowerCase();

        const filtered = masterKaryawanList.filter(k =>
            k.nama.toLowerCase().includes(kw)
        );

        dropdown.innerHTML = "";

        if(filtered.length === 0){

            dropdown.innerHTML =
                `<div class="combo-empty">Nama tidak ditemukan</div>`;

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

        // reset pilihan sebelumnya sampai user memilih ulang dari daftar
        hiddenInput.value = "";

        if(departemenInput) departemenInput.value = "";
        if(jabatanInput) jabatanInput.value = "";

        render(this.value);

    });

    searchInput.addEventListener("focus", function(){

        render(this.value);

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

// =====================================
// LOAD MASTER BARANG (katalog bersama, TANPA info stok)
// =====================================

async function loadBarang(){

    try{

        const { data,error } = await supabaseClient

        .from("master_barang")

        .select("*")

        .order("nama_barang");

        if(error) throw error;

        masterBarangList = data || [];

    }

    catch(err){

        console.error(err);

        alert(err.message);

    }

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

    const filtered = masterBarangList.filter(b =>
        b.nama_barang.toLowerCase().includes(kw)
    );

    dropdown.innerHTML = "";

    if(filtered.length === 0){

        dropdown.innerHTML =
            `<div class="combo-empty">Barang tidak ditemukan</div>`;

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
// LOAD STOK GUDANG (khusus gudang yang sedang login)
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
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

// =====================================
// AMBIL STOK TERKINI (live, langsung ke DB) - dipakai saat validasi submit
// supaya tidak salah baca cache kalau ada perubahan dari device lain.
// =====================================

async function ambilStokLive(barangId){

    if(!barangId) return 0;

    const { data, error } = await supabaseClient
        .from("stok_gudang")
        .select("stok")
        .eq("barang_id", barangId)
        .eq("gudang", user.gudang)
        .maybeSingle();

    if(error){
        console.error(error);
        return 0;
    }

    return data ? (Number(data.stok) || 0) : 0;

}

// =====================================
// KURANGI STOK GUDANG (delta boleh positif = kurangi lebih banyak,
// atau negatif = kembalikan sebagian, dipakai saat simpan / edit)
// =====================================

async function kurangiStokGudang(barangId, qty){

    if(!qty) return;

    const { data: existing, error: selErr } = await supabaseClient
        .from("stok_gudang")
        .select("*")
        .eq("barang_id", barangId)
        .eq("gudang", user.gudang)
        .maybeSingle();

    if(selErr) throw selErr;

    const stokBaru = (existing ? (Number(existing.stok) || 0) : 0) - qty;

    if(existing){

        const { error: updErr } = await supabaseClient
            .from("stok_gudang")
            .update({
                stok: stokBaru,
                updated_at: new Date().toISOString()
            })
            .eq("id", existing.id);

        if(updErr) throw updErr;

    } else {

        const { error: insErr } = await supabaseClient
            .from("stok_gudang")
            .insert([{
                barang_id: barangId,
                gudang: user.gudang,
                stok: stokBaru,
                updated_at: new Date().toISOString()
            }]);

        if(insErr) throw insErr;

    }

}

// =====================================
// KEMBALIKAN STOK (dipakai saat hapus histori / barang diganti saat edit)
// =====================================

async function tambahKembaliStokGudang(barangId, qty){

    if(!barangId || !qty) return;

    const { data: existing, error: selErr } = await supabaseClient
        .from("stok_gudang")
        .select("*")
        .eq("barang_id", barangId)
        .eq("gudang", user.gudang)
        .maybeSingle();

    if(selErr) throw selErr;

    if(existing){

        const stokBaru = (Number(existing.stok) || 0) + qty;

        const { error: updErr } = await supabaseClient
            .from("stok_gudang")
            .update({
                stok: stokBaru,
                updated_at: new Date().toISOString()
            })
            .eq("id", existing.id);

        if(updErr) throw updErr;

    } else {

        const { error: insErr } = await supabaseClient
            .from("stok_gudang")
            .insert([{
                barang_id: barangId,
                gudang: user.gudang,
                stok: qty,
                updated_at: new Date().toISOString()
            }]);

        if(insErr) throw insErr;

    }

}

// =====================================
// BARIS DETAIL BARANG (MULTI ITEM, DIPAKAI FORM UTAMA & MODAL EDIT)
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

    if(!wrapper){

        console.error(`Elemen #${containerId} tidak ditemukan di halaman.`);
        return null;

    }

    const row = document.createElement("div");

    row.className = "detail-row";
    row.dataset.stok = "0";
    row.dataset.kodeBarang = "";

    row.innerHTML = templateBarisBarang();

    wrapper.appendChild(row);

    return row;

}

function hapusBarisBarang(row, containerId){

    const wrapper = document.getElementById(containerId);

    if(wrapper.children.length <= 1){

        alert("Minimal harus ada 1 baris barang.");

        return;

    }

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

function validasiQtyBaris(row){

    const badge = row.querySelector(".stok-badge");

    const qtyInput = row.querySelector(".input-qty");

    const stok = parseInt(row.dataset.stok || "0");

    const qty = parseInt(qtyInput.value || "0");

    if(qty > stok){

        row.classList.add("qty-invalid");
        badge.classList.add("warning");

    } else {

        row.classList.remove("qty-invalid");
        badge.classList.remove("warning");

    }

}

function refreshSemuaBarisStok(){

    const rows = document.querySelectorAll(
        "#detailRows .detail-row, #editDetailRows .detail-row"
    );

    rows.forEach(row => {

        if(row.querySelector(".input-barang-id").value){

            refreshStokBaris(row);

        }

    });

}

// =====================================
// EVENT DELEGATION UNTUK BARIS DI DALAM SATU CONTAINER
// (dipakai untuk #detailRows dan #editDetailRows)
// =====================================

function setupDetailRowsDelegation(containerId){

    const container = document.getElementById(containerId);

    if(!container){

        console.error(`Elemen #${containerId} tidak ditemukan di halaman.`);
        return;

    }

    container.addEventListener("input", function(e){

        const row = e.target.closest(".detail-row");

        if(!row) return;

        if(e.target.classList.contains("input-barang-search")){

            // reset pilihan sampai user memilih ulang dari daftar
            row.querySelector(".input-barang-id").value = "";
            row.querySelector(".input-kategori").value = "";
            row.querySelector(".input-satuan").value = "";
            row.dataset.kodeBarang = "";

            refreshStokBaris(row);

            renderBarangDropdown(row, e.target.value);

            return;

        }

        if(e.target.classList.contains("input-qty")){

            validasiQtyBaris(row);

        }

    });

    // focus tidak bubbling, gunakan focusin untuk delegasi
    container.addEventListener("focusin", function(e){

        if(e.target.classList.contains("input-barang-search")){

            const row = e.target.closest(".detail-row");

            if(row) renderBarangDropdown(row, e.target.value);

        }

    });

    container.addEventListener("click", function(e){

        // hapus baris
        if(e.target.classList.contains("btn-hapus-baris")){

            const row = e.target.closest(".detail-row");

            if(row) hapusBarisBarang(row, containerId);

            return;

        }

        // pilih barang dari dropdown pencarian
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

const btnTambahBarisEl = document.getElementById("btnTambahBaris");

if(btnTambahBarisEl){

    btnTambahBarisEl.addEventListener("click", function(){

        tambahBarisBarangKe("detailRows");

    });

}

// =====================================
// TUTUP DROPDOWN SAAT KLIK DI LUAR
// =====================================

document.addEventListener("click", function(e){

    document.querySelectorAll(".combo-wrapper").forEach(wrapper=>{

        if(!wrapper.contains(e.target)){

            const dd = wrapper.querySelector(".combo-dropdown");

            if(dd) dd.classList.remove("show");

        }

    });

});

// =====================================
// REALTIME STOK (subscribe perubahan stok_gudang, difilter gudang login)
// =====================================

function aktifkanRealtimeStok(){

    supabaseClient

    .channel("stok-realtime-barang-keluar")

    .on("postgres_changes",

        {
            event: "*",
            schema: "public",
            table: "stok_gudang",
            filter: `gudang=eq.${user.gudang}`
        },

        async () => {

            await loadStokGudang();
            refreshSemuaBarisStok();

        }

    )

    .subscribe();

}

// =====================================
// LOAD HISTORI BARANG KELUAR
// =====================================
// Histori difilter sesuai gudang akun yang sedang login (user.gudang),
// jadi akun Margomulyo hanya melihat transaksi Margomulyo, dan akun
// Raden Saleh hanya melihat transaksi Raden Saleh.
// =====================================

async function loadBarangKeluar() {

    try {

        const { data, error } = await supabaseClient
            .from("barang_keluar")
            .select("*")
            .eq("gudang", user.gudang)
            .order("tanggal", { ascending: false })
            .order("id", { ascending: false });

        if (error) throw error;

        tampilBarangKeluar(data);

    } catch (err) {

        console.error(err);

        alert(err.message);

    }

}

// =====================================
// TAMPILKAN DATA
// =====================================

function tampilBarangKeluar(data){

    const tbody =
        document.querySelector("#tableKeluar tbody");

    tbody.innerHTML="";

    if(data.length === 0){

        tbody.innerHTML = `
        <tr>
            <td colspan="10" class="empty-state">
                Belum ada data Barang Keluar.
            </td>
        </tr>
        `;

        return;

    }

    let no=1;

    data.forEach(item=>{

        tbody.innerHTML += `

        <tr>

            <td>${no++}</td>

            <td>${item.tanggal}</td>

            <td>

                <b>${item.nama_pengambil}</b>

            </td>

            <td>${item.departemen}</td>

            <td>${item.jabatan}</td>

            <td>${item.nama_barang}</td>

            <td>

                <span class="text-danger">

                    -${item.qty}

                </span>

            </td>

            <td>

                <span class="satuan-badge">

                    ${item.satuan}

                </span>

            </td>

            <td>${item.created_by}</td>

            <td>

                <button

                    class="btn-edit"

                    onclick="editBarangKeluar(${item.id})">

                    ✏ Edit

                </button>

                <button

                    class="btn-delete"

                    onclick="hapusBarangKeluar(${item.id})">

                    🗑 Hapus

                </button>

            </td>

        </tr>

        `;

    });

}

// =====================================
// SEARCH HISTORI
// =====================================

function cariBarangKeluar(){

    const keyword =
        document
        .getElementById("search")
        .value
        .toLowerCase();

    const rows =
        document.querySelectorAll("#tableKeluar tbody tr");

    rows.forEach(row=>{

        if(

            row.innerText
            .toLowerCase()
            .includes(keyword)

        ){

            row.style.display="";

        }

        else{

            row.style.display="none";

        }

    });

}

const searchInputEl = document.getElementById("search");

if(searchInputEl){

    searchInputEl.addEventListener("keyup", cariBarangKeluar);

}

// =====================================
// SIMPAN BARANG KELUAR (MULTI ITEM, DATA BARU)
// =====================================

const form = document.getElementById("formKeluar");

if(form){

form.addEventListener("submit", async function(e){

    e.preventDefault();

    try{

        // --------------------------------------
        // VALIDASI PENGAMBIL
        // --------------------------------------

        const pengambilId = pengambilHidden.value;

        if(pengambilId===""){

            alert("Pilih nama pengambil dari daftar pencarian.");

            return;

        }

        // --------------------------------------
        // AMBIL SEMUA BARIS DETAIL BARANG
        // --------------------------------------

        const rows =
            document.querySelectorAll("#detailRows .detail-row");

        if(rows.length===0){

            alert("Tambahkan minimal 1 barang.");

            return;

        }

        const itemList = [];
        const kodeSudahDipakai = new Set();

        for(const row of rows){

            const barangId = row.querySelector(".input-barang-id").value;

            const qtyInput = row.querySelector(".input-qty");

            const qty = parseInt(qtyInput.value);

            if(barangId===""){

                alert("Ada baris yang belum memilih barang dari daftar pencarian.");

                return;

            }

            if(!qty || qty<=0){

                alert("Qty harus lebih dari 0 untuk setiap barang.");

                return;

            }

            const barang = findBarangById(barangId);

            if(!barang){

                alert("Data barang tidak ditemukan, coba muat ulang halaman.");

                return;

            }

            if(kodeSudahDipakai.has(barang.kode_barang)){

                alert(

                    `Barang "${barang.nama_barang}" dipilih lebih dari satu kali.\n` +
                    `Gabungkan qty-nya dalam satu baris saja.`

                );

                return;

            }

            kodeSudahDipakai.add(barang.kode_barang);

            // cek ulang stok realtime saat submit (bukan hanya dari cache),
            // otomatis sudah khusus gudang user karena ambilStokLive()
            // difilter dengan user.gudang

            const stokSaatIni = await ambilStokLive(barang.id);

            if(qty > stokSaatIni){

                alert(

                    `Stok "${barang.nama_barang}" tidak mencukupi.\n\n` +
                    `Stok tersedia : ${stokSaatIni}`

                );

                return;

            }

            itemList.push({ barang, qty });

        }

        // --------------------------------------
        // MASTER KARYAWAN
        // --------------------------------------

        const karyawan = findKaryawanById(pengambilId);

        if(!karyawan){

            alert("Data pengambil tidak ditemukan, coba muat ulang halaman.");

            return;

        }

        // --------------------------------------
        // SUSUN TRANSAKSI (1 BARIS PER BARANG)
        // --------------------------------------

        const tanggal = document.getElementById("tanggal").value;
        const keterangan = document.getElementById("keterangan").value;

        const transaksiList = itemList.map(({barang, qty}) => ({

            tanggal: tanggal,

            nik: karyawan.nik,

            nama_pengambil: karyawan.nama,

            departemen: karyawan.departemen,

            jabatan: karyawan.jabatan,

            kode_barang: barang.kode_barang,

            nama_barang: barang.nama_barang,

            kategori: barang.kategori,

            satuan: barang.satuan,

            qty: qty,

            keterangan: keterangan,

            gudang: user.gudang,

            created_by: user.nama

        }));

        // --------------------------------------
        // INSERT SEKALIGUS
        // --------------------------------------

        const { error } = await supabaseClient

        .from("barang_keluar")

        .insert(transaksiList);

        if(error) throw error;

        // --------------------------------------
        // KURANGI STOK DI stok_gudang (hanya utk gudang user.gudang)
        // --------------------------------------

        for(const { barang, qty } of itemList){

            await kurangiStokGudang(barang.id, qty);

        }

        alert(

            `Barang Keluar berhasil disimpan (${transaksiList.length} item).`

        );

        resetFormKeluar();

        await loadStokGudang();

        refreshSemuaBarisStok();

        await loadBarangKeluar();

    }

    catch(err){

        console.error(err);

        alert(err.message);

    }

});

}

// =====================================
// RESET FORM (kembali ke 1 baris kosong)
// =====================================

function resetFormKeluar(){

    form.reset();

    pengambilHidden.value = "";
    pengambilSearchInput.value = "";

    document.getElementById("departemen").value="";
    document.getElementById("jabatan").value="";

    document.getElementById("tanggal").value =
        new Date().toISOString().split("T")[0];

    document.getElementById("detailRows").innerHTML = "";

    tambahBarisBarangKe("detailRows");

}

// =====================================
// EDIT BARANG KELUAR (MODAL - per transaksi/baris histori)
// =====================================

async function editBarangKeluar(id){

    try{

        const { data, error } = await supabaseClient

        .from("barang_keluar")

        .select("*")

        .eq("id", id)

        .single();

        if(error) throw error;

        editId = id;

        const barangLama = findBarangByKode(data.kode_barang);

        // simpan item asli untuk hitung selisih stok saat disimpan nanti
        editOriginalItem = {
            barang_id : barangLama ? barangLama.id : null,
            qty : Number(data.qty) || 0
        };

        //---------------------------------
        // ISI FORM HEADER EDIT
        //---------------------------------

        document.getElementById("editTanggal").value = data.tanggal;
        document.getElementById("editKeterangan").value = data.keterangan ?? "";

        document.getElementById("editPengambil").value = "";

        const karyawanCocok = masterKaryawanList.find(
            k => k.nama === data.nama_pengambil
        );

        document.getElementById("editPengambilSearch").value = data.nama_pengambil;

        if(karyawanCocok) document.getElementById("editPengambil").value = karyawanCocok.id;

        document.getElementById("editDepartemen").value = data.departemen;
        document.getElementById("editJabatan").value = data.jabatan;

        //---------------------------------
        // ISI BARIS BARANG (SATU BARIS, KARENA 1 TRANSAKSI = 1 ITEM)
        //---------------------------------

        const editWrapper = document.getElementById("editDetailRows");
        editWrapper.innerHTML = "";

        const row = tambahBarisBarangKe("editDetailRows");

        if(barangLama){

            row.querySelector(".input-barang-search").value = barangLama.nama_barang;
            row.querySelector(".input-barang-id").value = barangLama.id;
            row.querySelector(".input-kategori").value = barangLama.kategori;
            row.querySelector(".input-satuan").value = barangLama.satuan;
            row.dataset.kodeBarang = barangLama.kode_barang;

        } else {

            // barang sudah tidak ada di master, tampilkan datanya saja
            row.querySelector(".input-barang-search").value = data.nama_barang;
            row.querySelector(".input-kategori").value = data.kategori;
            row.querySelector(".input-satuan").value = data.satuan;

        }

        row.querySelector(".input-qty").value = data.qty;

        // hanya 1 item per transaksi, sembunyikan tombol hapus baris
        const btnHapus = row.querySelector(".btn-hapus-baris");
        if(btnHapus) btnHapus.style.display = "none";

        refreshStokBaris(row);

        document.getElementById("modalEditKeluar").classList.add("show");

    }

    catch(err){

        console.error(err);
        alert(err.message);

    }

}

function tutupModalEdit(){

    document.getElementById("modalEditKeluar").classList.remove("show");

    editId = null;
    editOriginalItem = { barang_id: null, qty: 0 };

}

const btnTutupModalEditEl = document.getElementById("btnTutupModalEdit");

if(btnTutupModalEditEl){

    btnTutupModalEditEl.addEventListener("click", tutupModalEdit);

}

const modalEditKeluarEl = document.getElementById("modalEditKeluar");

if(modalEditKeluarEl){

    modalEditKeluarEl.addEventListener("click", function(e){

        if(e.target === modalEditKeluarEl) tutupModalEdit();

    });

}

// =====================================
// SIMPAN PERUBAHAN HASIL EDIT BARANG KELUAR
// =====================================

const btnSimpanEditKeluarEl = document.getElementById("btnSimpanEditKeluar");

if(btnSimpanEditKeluarEl){

    btnSimpanEditKeluarEl.addEventListener("click", simpanEditKeluar);

}

async function simpanEditKeluar(){

    try{

        if(editId === null){

            alert("Tidak ada data yang sedang diedit.");
            return;

        }

        //---------------------------------
        // VALIDASI HEADER
        //---------------------------------

        const tanggal = document.getElementById("editTanggal").value;
        const pengambilId = document.getElementById("editPengambil").value;
        const keterangan = document.getElementById("editKeterangan").value;

        if(tanggal === ""){
            alert("Tanggal wajib diisi.");
            return;
        }

        if(pengambilId === ""){
            alert("Pilih nama pengambil dari daftar pencarian.");
            return;
        }

        const karyawan = findKaryawanById(pengambilId);

        if(!karyawan){
            alert("Data pengambil tidak ditemukan, coba muat ulang halaman.");
            return;
        }

        //---------------------------------
        // VALIDASI BARANG (1 BARIS)
        //---------------------------------

        const row = document.querySelector("#editDetailRows .detail-row");

        if(!row){
            alert("Data barang tidak ditemukan.");
            return;
        }

        const barangId = row.querySelector(".input-barang-id").value;
        const qtyBaru = parseInt(row.querySelector(".input-qty").value);

        if(barangId === ""){
            alert("Pilih barang dari daftar pencarian.");
            return;
        }

        if(!qtyBaru || qtyBaru <= 0){
            alert("Qty harus lebih dari 0.");
            return;
        }

        const barang = findBarangById(barangId);

        if(!barang){
            alert("Data barang tidak ditemukan, coba muat ulang halaman.");
            return;
        }

        //---------------------------------
        // VALIDASI STOK
        //---------------------------------

        const barangIdLama = editOriginalItem.barang_id;
        const qtyLama = editOriginalItem.qty;

        const stokLiveBaru = await ambilStokLive(barang.id);

        // Jika barang tidak berubah, qty lama sebenarnya masih "milik"
        // transaksi ini (sudah dikurangi sebelumnya), jadi stok yang
        // tersedia untuk perubahan = stok saat ini + qty lama.
        const stokTersedia = (String(barang.id) === String(barangIdLama))
            ? stokLiveBaru + qtyLama
            : stokLiveBaru;

        if(qtyBaru > stokTersedia){

            alert(
                `Stok "${barang.nama_barang}" tidak mencukupi.\n\n` +
                `Stok tersedia : ${stokTersedia}`
            );
            return;

        }

        //---------------------------------
        // UPDATE RECORD
        //---------------------------------

        const { error: updErr } = await supabaseClient
            .from("barang_keluar")
            .update({
                tanggal,
                nik : karyawan.nik,
                nama_pengambil : karyawan.nama,
                departemen : karyawan.departemen,
                jabatan : karyawan.jabatan,
                kode_barang : barang.kode_barang,
                nama_barang : barang.nama_barang,
                kategori : barang.kategori,
                satuan : barang.satuan,
                qty : qtyBaru,
                keterangan
            })
            .eq("id", editId);

        if(updErr) throw updErr;

        //---------------------------------
        // SESUAIKAN STOK GUDANG
        //---------------------------------

        if(String(barang.id) === String(barangIdLama)){

            const delta = qtyBaru - qtyLama;

            if(delta !== 0){

                await kurangiStokGudang(barang.id, delta);

            }

        } else {

            if(barangIdLama !== null){

                await tambahKembaliStokGudang(barangIdLama, qtyLama);

            }

            await kurangiStokGudang(barang.id, qtyBaru);

        }

        //---------------------------------
        // SELESAI
        //---------------------------------

        alert("Perubahan Barang Keluar berhasil disimpan.");

        tutupModalEdit();

        await loadStokGudang();
        refreshSemuaBarisStok();

        await loadBarangKeluar();

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

// =====================================
// HAPUS
// =====================================

async function hapusBarangKeluar(id){

    if(!confirm("Hapus transaksi ini?"))

        return;

    try{

        // ambil dulu datanya supaya bisa kembalikan (kredit balik) stoknya

        const { data:dataLama, error: getErr } = await supabaseClient

        .from("barang_keluar")

        .select("*")

        .eq("id",id)

        .single();

        if(getErr) throw getErr;

        const { error } = await supabaseClient

        .from("barang_keluar")

        .delete()

        .eq("id",id);

        if(error) throw error;

        // kembalikan stok yang tadinya dikurangi

        if(dataLama){

            const barang = findBarangByKode(dataLama.kode_barang);

            if(barang){

                await tambahKembaliStokGudang(barang.id, dataLama.qty);

            }

        }

        alert("Data berhasil dihapus.");

        await loadStokGudang();

        refreshSemuaBarisStok();

        loadBarangKeluar();

    }

    catch(err){

        console.error(err);
        alert(err.message);

    }

}

// =====================================
// EXPORT EXCEL
// =====================================
// Mengekspor seluruh histori Barang Keluar untuk gudang yang sedang
// login, satu baris per transaksi.
// =====================================

async function exportExcel(){

    try{

        if(typeof XLSX === "undefined"){

            alert("Library Excel belum termuat, silakan refresh halaman lalu coba lagi.");
            return;

        }

        const { data, error } = await supabaseClient
            .from("barang_keluar")
            .select("*")
            .eq("gudang", user.gudang)
            .order("tanggal", {ascending:false})
            .order("id", {ascending:false});

        if(error) throw error;

        if(!data || data.length === 0){

            alert("Tidak ada data Barang Keluar untuk diexport.");
            return;

        }

        const rows = data.map(item => ({
            "Tanggal": item.tanggal,
            "NIK": item.nik,
            "Pengambil": item.nama_pengambil,
            "Departemen": item.departemen,
            "Jabatan": item.jabatan,
            "Kode Barang": item.kode_barang,
            "Nama Barang": item.nama_barang,
            "Kategori": item.kategori,
            "Qty": item.qty,
            "Satuan": item.satuan,
            "Keterangan": item.keterangan || "",
            "Gudang": item.gudang,
            "Created By": item.created_by
        }));

        const ws = XLSX.utils.json_to_sheet(rows);

        // lebar kolom biar enak dibaca
        ws["!cols"] = [
            {wch:12}, {wch:12}, {wch:22}, {wch:18}, {wch:16},
            {wch:14}, {wch:26}, {wch:16}, {wch:8}, {wch:10},
            {wch:24}, {wch:14}, {wch:18}
        ];

        const wb = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(wb, ws, "Barang Keluar");

        const tanggalFile = new Date().toISOString().split("T")[0];
        const namaFile = `Barang-Keluar-${user.gudang}-${tanggalFile}.xlsx`;

        XLSX.writeFile(wb, namaFile);

    }
    catch(err){

        console.error(err);
        alert(err.message);

    }

}

// =====================================
// IMPORT
// =====================================

const fileImportEl = document.getElementById("fileImport");

if(fileImportEl){

    fileImportEl.addEventListener("change",function(){

        alert("Fitur Import Excel akan dibuat pada tahap berikutnya.");

    });

}

// =====================================
// LOAD AWAL
// =====================================

document.addEventListener("DOMContentLoaded", async ()=>{

    document.getElementById("tanggal").value =
        new Date().toISOString().split("T")[0];

    await loadKaryawan();

    await loadBarang();

    await loadStokGudang();

    setupPengambilCombo(
        pengambilSearchInput,
        pengambilHidden,
        pengambilDropdown,
        document.getElementById("departemen"),
        document.getElementById("jabatan")
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
