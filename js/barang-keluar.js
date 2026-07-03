// =====================================
// BARANG KELUAR (MULTI ITEM + PENCARIAN + STOK REALTIME)
// =====================================

const user = JSON.parse(sessionStorage.getItem("user"));
if (!user) { location.href = "login.html"; }

let editId = null;
let editOriginalItem = { barang_id: null, qty: 0 };
let masterBarangList = [];
let masterKaryawanList = [];
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

function findKaryawanById(id) {
    return masterKaryawanList.find(k => String(k.id) === String(id));
}

// =====================================
// COMBOBOX PENGAMBIL
// =====================================

const pengambilSearchInput = document.getElementById("pengambilSearch");
const pengambilHidden      = document.getElementById("pengambil");
const pengambilDropdown    = document.getElementById("pengambilDropdown");

function setupPengambilCombo(searchInput, hiddenInput, dropdown, departemenInput, jabatanInput) {
    if (!searchInput || !hiddenInput || !dropdown) {
        console.error("Elemen combobox pengambil tidak lengkap.");
        return;
    }

    function render(keyword) {
        const kw = (keyword || "").trim().toLowerCase();
        const filtered = masterKaryawanList.filter(k => k.nama.toLowerCase().includes(kw));
        dropdown.innerHTML = "";
        if (filtered.length === 0) {
            dropdown.innerHTML = `<div class="combo-empty">Nama tidak ditemukan</div>`;
        } else {
            filtered.forEach(k => {
                const item = document.createElement("div");
                item.className = "combo-item";
                item.textContent = k.nama;
                item.dataset.id = k.id;
                dropdown.appendChild(item);
            });
        }
        dropdown.classList.add("show");
    }

    searchInput.addEventListener("input", function () {
        hiddenInput.value = "";
        if (departemenInput) departemenInput.value = "";
        if (jabatanInput) jabatanInput.value = "";
        render(this.value);
    });

    searchInput.addEventListener("focus", function () { render(this.value); });

    dropdown.addEventListener("click", function (e) {
        const item = e.target.closest(".combo-item");
        if (!item || !item.dataset.id) return;
        const karyawan = findKaryawanById(item.dataset.id);
        if (!karyawan) return;
        hiddenInput.value = karyawan.id;
        searchInput.value = karyawan.nama;
        if (departemenInput) departemenInput.value = karyawan.departemen;
        if (jabatanInput) jabatanInput.value = karyawan.jabatan;
        dropdown.classList.remove("show");
    });
}

// =====================================
// LOAD MASTER BARANG
// =====================================

async function loadBarang() {
    try {
        const { data, error } = await supabaseClient
            .from("master_barang")
            .select("*")
            .order("nama_barang");
        if (error) throw error;
        masterBarangList = data || [];
    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}

function findBarangById(id) {
    return masterBarangList.find(b => String(b.id) === String(id));
}

function findBarangByKode(kode) {
    return masterBarangList.find(b => b.kode_barang === kode);
}

function renderBarangDropdown(row, keyword) {
    const dropdown = row.querySelector(".input-barang-dropdown");
    const kw = (keyword || "").trim().toLowerCase();
    const filtered = masterBarangList.filter(b => b.nama_barang.toLowerCase().includes(kw));
    dropdown.innerHTML = "";
    if (filtered.length === 0) {
        dropdown.innerHTML = `<div class="combo-empty">Barang tidak ditemukan</div>`;
    } else {
        filtered.forEach(b => {
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

async function loadStokGudang() {
    try {
        const { data, error } = await supabaseClient
            .from("stok_gudang")
            .select("barang_id, stok")
            .eq("gudang", user.gudang);
        if (error) throw error;
        stokGudangMap = new Map();
        (data || []).forEach(row => {
            stokGudangMap.set(String(row.barang_id), Number(row.stok) || 0);
        });
    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}

async function ambilStokLive(barangId) {
    if (!barangId) return 0;
    const { data, error } = await supabaseClient
        .from("stok_gudang")
        .select("stok")
        .eq("barang_id", barangId)
        .eq("gudang", user.gudang)
        .maybeSingle();
    if (error) { console.error(error); return 0; }
    return data ? (Number(data.stok) || 0) : 0;
}

async function kurangiStokGudang(barangId, qty) {
    if (!qty) return;
    const { data: existing, error: selErr } = await supabaseClient
        .from("stok_gudang")
        .select("*")
        .eq("barang_id", barangId)
        .eq("gudang", user.gudang)
        .maybeSingle();
    if (selErr) throw selErr;
    const stokBaru = (existing ? (Number(existing.stok) || 0) : 0) - qty;
    if (existing) {
        const { error } = await supabaseClient.from("stok_gudang")
            .update({ stok: stokBaru, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
        if (error) throw error;
    } else {
        const { error } = await supabaseClient.from("stok_gudang")
            .insert([{ barang_id: barangId, gudang: user.gudang, stok: stokBaru, updated_at: new Date().toISOString() }]);
        if (error) throw error;
    }
}

async function tambahKembaliStokGudang(barangId, qty) {
    if (!barangId || !qty) return;
    const { data: existing, error: selErr } = await supabaseClient
        .from("stok_gudang").select("*")
        .eq("barang_id", barangId).eq("gudang", user.gudang).maybeSingle();
    if (selErr) throw selErr;
    if (existing) {
        const stokBaru = (Number(existing.stok) || 0) + qty;
        const { error } = await supabaseClient.from("stok_gudang")
            .update({ stok: stokBaru, updated_at: new Date().toISOString() }).eq("id", existing.id);
        if (error) throw error;
    } else {
        const { error } = await supabaseClient.from("stok_gudang")
            .insert([{ barang_id: barangId, gudang: user.gudang, stok: qty, updated_at: new Date().toISOString() }]);
        if (error) throw error;
    }
}

// =====================================
// BARIS DETAIL BARANG
// =====================================

function templateBarisBarang() {
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

function tambahBarisBarangKe(containerId) {
    const wrapper = document.getElementById(containerId);
    if (!wrapper) { console.error(`Elemen #${containerId} tidak ditemukan.`); return null; }
    const row = document.createElement("div");
    row.className = "detail-row";
    row.dataset.stok = "0";
    row.dataset.kodeBarang = "";
    row.innerHTML = templateBarisBarang();
    wrapper.appendChild(row);
    return row;
}

function hapusBarisBarang(row, containerId) {
    const wrapper = document.getElementById(containerId);
    if (wrapper.children.length <= 1) { alert("Minimal harus ada 1 baris barang."); return; }
    row.remove();
}

function refreshStokBaris(row) {
    const badge = row.querySelector(".stok-badge");
    const barangId = row.querySelector(".input-barang-id").value;
    if (!barangId) { badge.textContent = "Stok: -"; badge.classList.remove("warning"); row.dataset.stok = "0"; return; }
    const stok = stokGudangMap.get(String(barangId)) || 0;
    row.dataset.stok = stok;
    badge.textContent = `Stok: ${stok}`;
    validasiQtyBaris(row);
}

function validasiQtyBaris(row) {
    const badge = row.querySelector(".stok-badge");
    const qtyInput = row.querySelector(".input-qty");
    const stok = parseInt(row.dataset.stok || "0");
    const qty = parseInt(qtyInput.value || "0");
    if (qty > stok) { row.classList.add("qty-invalid"); badge.classList.add("warning"); }
    else { row.classList.remove("qty-invalid"); badge.classList.remove("warning"); }
}

function refreshSemuaBarisStok() {
    document.querySelectorAll("#detailRows .detail-row, #editDetailRows .detail-row").forEach(row => {
        if (row.querySelector(".input-barang-id").value) refreshStokBaris(row);
    });
}

function setupDetailRowsDelegation(containerId) {
    const container = document.getElementById(containerId);
    if (!container) { console.error(`Elemen #${containerId} tidak ditemukan.`); return; }

    container.addEventListener("input", function (e) {
        const row = e.target.closest(".detail-row");
        if (!row) return;
        if (e.target.classList.contains("input-barang-search")) {
            row.querySelector(".input-barang-id").value = "";
            row.querySelector(".input-kategori").value = "";
            row.querySelector(".input-satuan").value = "";
            row.dataset.kodeBarang = "";
            refreshStokBaris(row);
            renderBarangDropdown(row, e.target.value);
            return;
        }
        if (e.target.classList.contains("input-qty")) validasiQtyBaris(row);
    });

    container.addEventListener("focusin", function (e) {
        if (e.target.classList.contains("input-barang-search")) {
            const row = e.target.closest(".detail-row");
            if (row) renderBarangDropdown(row, e.target.value);
        }
    });

    container.addEventListener("click", function (e) {
        if (e.target.classList.contains("btn-hapus-baris")) {
            const row = e.target.closest(".detail-row");
            if (row) hapusBarisBarang(row, containerId);
            return;
        }
        const comboItem = e.target.closest(".combo-item");
        if (comboItem && comboItem.dataset.id && comboItem.closest(".input-barang-dropdown")) {
            const row = e.target.closest(".detail-row");
            if (!row) return;
            const barang = findBarangById(comboItem.dataset.id);
            if (!barang) return;
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
if (btnTambahBarisEl) {
    btnTambahBarisEl.addEventListener("click", function () { tambahBarisBarangKe("detailRows"); });
}

document.addEventListener("click", function (e) {
    document.querySelectorAll(".combo-wrapper").forEach(wrapper => {
        if (!wrapper.contains(e.target)) {
            const dd = wrapper.querySelector(".combo-dropdown");
            if (dd) dd.classList.remove("show");
        }
    });
});

// =====================================
// REALTIME STOK
// =====================================

function aktifkanRealtimeStok() {
    supabaseClient
        .channel("stok-realtime-barang-keluar")
        .on("postgres_changes",
            { event: "*", schema: "public", table: "stok_gudang", filter: `gudang=eq.${user.gudang}` },
            async () => { await loadStokGudang(); refreshSemuaBarisStok(); }
        ).subscribe();
}

// =====================================
// LOAD & TAMPIL HISTORI
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

function tampilBarangKeluar(data) {
    const tbody = document.querySelector("#tableKeluar tbody");
    tbody.innerHTML = "";
    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="empty-state">Belum ada data Barang Keluar.</td></tr>`;
        return;
    }
    let no = 1;
    data.forEach(item => {
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
            <td>${item.created_by}</td>
            <td>
                <button class="btn-edit" onclick="editBarangKeluar(${item.id})">✏ Edit</button>
                <button class="btn-delete" onclick="hapusBarangKeluar(${item.id})">🗑 Hapus</button>
            </td>
        </tr>`;
    });
}

function cariBarangKeluar() {
    const keyword = document.getElementById("search").value.toLowerCase();
    document.querySelectorAll("#tableKeluar tbody tr").forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(keyword) ? "" : "none";
    });
}

const searchInputEl = document.getElementById("search");
if (searchInputEl) { searchInputEl.addEventListener("keyup", cariBarangKeluar); }

// =====================================
// SIMPAN BARANG KELUAR
// =====================================

const form = document.getElementById("formKeluar");
if (form) {
    form.addEventListener("submit", async function (e) {
        e.preventDefault();
        try {
            const pengambilId = pengambilHidden.value;
            if (pengambilId === "") { alert("Pilih nama pengambil dari daftar pencarian."); return; }

            const rows = document.querySelectorAll("#detailRows .detail-row");
            if (rows.length === 0) { alert("Tambahkan minimal 1 barang."); return; }

            const itemList = [];
            const kodeSudahDipakai = new Set();

            for (const row of rows) {
                const barangId = row.querySelector(".input-barang-id").value;
                const qty = parseInt(row.querySelector(".input-qty").value);
                if (barangId === "") { alert("Ada baris yang belum memilih barang."); return; }
                if (!qty || qty <= 0) { alert("Qty harus lebih dari 0."); return; }
                const barang = findBarangById(barangId);
                if (!barang) { alert("Data barang tidak ditemukan."); return; }
                if (kodeSudahDipakai.has(barang.kode_barang)) {
                    alert(`Barang "${barang.nama_barang}" dipilih lebih dari satu kali.`); return;
                }
                kodeSudahDipakai.add(barang.kode_barang);
                const stokSaatIni = await ambilStokLive(barang.id);
                if (qty > stokSaatIni) {
                    alert(`Stok "${barang.nama_barang}" tidak mencukupi.\nStok tersedia: ${stokSaatIni}`); return;
                }
                itemList.push({ barang, qty });
            }

            const karyawan = findKaryawanById(pengambilId);
            if (!karyawan) { alert("Data pengambil tidak ditemukan."); return; }

            const tanggal = document.getElementById("tanggal").value;
            const keterangan = document.getElementById("keterangan").value;

            const transaksiList = itemList.map(({ barang, qty }) => ({
                tanggal, nik: karyawan.nik, nama_pengambil: karyawan.nama,
                departemen: karyawan.departemen, jabatan: karyawan.jabatan,
                kode_barang: barang.kode_barang, nama_barang: barang.nama_barang,
                kategori: barang.kategori, satuan: barang.satuan, qty, keterangan,
                gudang: user.gudang, created_by: user.nama
            }));

            const { error } = await supabaseClient.from("barang_keluar").insert(transaksiList);
            if (error) throw error;

            for (const { barang, qty } of itemList) { await kurangiStokGudang(barang.id, qty); }

            alert(`Barang Keluar berhasil disimpan (${transaksiList.length} item).`);
            resetFormKeluar();
            await loadStokGudang();
            refreshSemuaBarisStok();
            await loadBarangKeluar();
        } catch (err) {
            console.error(err);
            alert(err.message);
        }
    });
}

function resetFormKeluar() {
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

async function editBarangKeluar(id) {
    try {
        const { data, error } = await supabaseClient.from("barang_keluar").select("*").eq("id", id).single();
        if (error) throw error;
        editId = id;
        const barangLama = findBarangByKode(data.kode_barang);
        editOriginalItem = { barang_id: barangLama ? barangLama.id : null, qty: Number(data.qty) || 0 };

        document.getElementById("editTanggal").value = data.tanggal;
        document.getElementById("editKeterangan").value = data.keterangan ?? "";

        const karyawanCocok = masterKaryawanList.find(k => k.nama === data.nama_pengambil);
        document.getElementById("editPengambilSearch").value = data.nama_pengambil;
        document.getElementById("editPengambil").value = karyawanCocok ? karyawanCocok.id : "";
        document.getElementById("editDepartemen").value = data.departemen;
        document.getElementById("editJabatan").value = data.jabatan;

        const editWrapper = document.getElementById("editDetailRows");
        editWrapper.innerHTML = "";
        const row = tambahBarisBarangKe("editDetailRows");
        if (barangLama) {
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
        const btnHapus = row.querySelector(".btn-hapus-baris");
        if (btnHapus) btnHapus.style.display = "none";
        refreshStokBaris(row);

        document.getElementById("modalEditKeluar").classList.add("show");
    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}

function tutupModalEdit() {
    document.getElementById("modalEditKeluar").classList.remove("show");
    editId = null;
    editOriginalItem = { barang_id: null, qty: 0 };
}

const btnTutupModalEditEl = document.getElementById("btnTutupModalEdit");
if (btnTutupModalEditEl) { btnTutupModalEditEl.addEventListener("click", tutupModalEdit); }

const modalEditKeluarEl = document.getElementById("modalEditKeluar");
if (modalEditKeluarEl) {
    modalEditKeluarEl.addEventListener("click", function (e) { if (e.target === modalEditKeluarEl) tutupModalEdit(); });
}

const btnSimpanEditKeluarEl = document.getElementById("btnSimpanEditKeluar");
if (btnSimpanEditKeluarEl) { btnSimpanEditKeluarEl.addEventListener("click", simpanEditKeluar); }

async function simpanEditKeluar() {
    try {
        if (editId === null) { alert("Tidak ada data yang sedang diedit."); return; }

        const tanggal = document.getElementById("editTanggal").value;
        const pengambilId = document.getElementById("editPengambil").value;
        const keterangan = document.getElementById("editKeterangan").value;

        if (!tanggal) { alert("Tanggal wajib diisi."); return; }
        if (!pengambilId) { alert("Pilih nama pengambil dari daftar pencarian."); return; }

        const karyawan = findKaryawanById(pengambilId);
        if (!karyawan) { alert("Data pengambil tidak ditemukan."); return; }

        const row = document.querySelector("#editDetailRows .detail-row");
        if (!row) { alert("Data barang tidak ditemukan."); return; }

        const barangId = row.querySelector(".input-barang-id").value;
        const qtyBaru = parseInt(row.querySelector(".input-qty").value);

        if (!barangId) { alert("Pilih barang dari daftar pencarian."); return; }
        if (!qtyBaru || qtyBaru <= 0) { alert("Qty harus lebih dari 0."); return; }

        const barang = findBarangById(barangId);
        if (!barang) { alert("Data barang tidak ditemukan."); return; }

        const barangIdLama = editOriginalItem.barang_id;
        const qtyLama = editOriginalItem.qty;
        const stokLiveBaru = await ambilStokLive(barang.id);
        const stokTersedia = String(barang.id) === String(barangIdLama)
            ? stokLiveBaru + qtyLama : stokLiveBaru;

        if (qtyBaru > stokTersedia) {
            alert(`Stok "${barang.nama_barang}" tidak mencukupi.\nStok tersedia: ${stokTersedia}`); return;
        }

        const { error: updErr } = await supabaseClient.from("barang_keluar").update({
            tanggal, nik: karyawan.nik, nama_pengambil: karyawan.nama,
            departemen: karyawan.departemen, jabatan: karyawan.jabatan,
            kode_barang: barang.kode_barang, nama_barang: barang.nama_barang,
            kategori: barang.kategori, satuan: barang.satuan, qty: qtyBaru, keterangan
        }).eq("id", editId);
        if (updErr) throw updErr;

        if (String(barang.id) === String(barangIdLama)) {
            const delta = qtyBaru - qtyLama;
            if (delta !== 0) await kurangiStokGudang(barang.id, delta);
        } else {
            if (barangIdLama !== null) await tambahKembaliStokGudang(barangIdLama, qtyLama);
            await kurangiStokGudang(barang.id, qtyBaru);
        }

        alert("Perubahan Barang Keluar berhasil disimpan.");
        tutupModalEdit();
        await loadStokGudang();
        refreshSemuaBarisStok();
        await loadBarangKeluar();
    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}

// =====================================
// HAPUS
// =====================================

async function hapusBarangKeluar(id) {
    if (!confirm("Hapus transaksi ini?")) return;
    try {
        const { data: dataLama, error: getErr } = await supabaseClient
            .from("barang_keluar").select("*").eq("id", id).single();
        if (getErr) throw getErr;

        const { error } = await supabaseClient.from("barang_keluar").delete().eq("id", id);
        if (error) throw error;

        if (dataLama) {
            const barang = findBarangByKode(dataLama.kode_barang);
            if (barang) await tambahKembaliStokGudang(barang.id, dataLama.qty);
        }

        alert("Data berhasil dihapus.");
        await loadStokGudang();
        refreshSemuaBarisStok();
        loadBarangKeluar();
    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}

// =====================================
// EXPORT EXCEL
// =====================================

async function exportExcel() {
    try {
        if (typeof XLSX === "undefined") {
            alert("Library Excel belum termuat, silakan refresh halaman lalu coba lagi."); return;
        }

        const { data, error } = await supabaseClient
            .from("barang_keluar").select("*")
            .eq("gudang", user.gudang)
            .order("tanggal", { ascending: false })
            .order("id", { ascending: false });
        if (error) throw error;

        if (!data || data.length === 0) {
            alert("Tidak ada data Barang Keluar untuk diexport."); return;
        }

        const rows = data.map(item => ({
            "Tanggal"     : item.tanggal,
            "NIK"         : item.nik,
            "Pengambil"   : item.nama_pengambil,
            "Departemen"  : item.departemen,
            "Jabatan"     : item.jabatan,
            "Kode Barang" : item.kode_barang,
            "Nama Barang" : item.nama_barang,
            "Kategori"    : item.kategori,
            "Qty"         : item.qty,
            "Satuan"      : item.satuan,
            "Keterangan"  : item.keterangan || "",
            "Gudang"      : item.gudang,
            "Created By"  : item.created_by
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        ws["!cols"] = [
            {wch:12},{wch:12},{wch:22},{wch:18},{wch:16},
            {wch:14},{wch:26},{wch:16},{wch:8},{wch:10},
            {wch:24},{wch:14},{wch:18}
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Barang Keluar");

        const tanggalFile = new Date().toISOString().split("T")[0];
        XLSX.writeFile(wb, `Barang-Keluar-${user.gudang}-${tanggalFile}.xlsx`);

    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}

// =====================================
// IMPORT EXCEL  ← DIPERBAIKI
// =====================================
// Format kolom Excel yang diterima (sama seperti hasil Export):
//   Tanggal | NIK | Pengambil | Departemen | Jabatan |
//   Kode Barang | Nama Barang | Kategori | Qty | Satuan |
//   Keterangan | Gudang | Created By
// Kolom wajib minimal: Tanggal, Kode Barang, Qty
// =====================================

const fileImportEl = document.getElementById("fileImport");

if (fileImportEl) {

    fileImportEl.addEventListener("change", async function () {

        const file = this.files[0];
        if (!file) return;

        if (typeof XLSX === "undefined") {
            alert("Library SheetJS belum termuat, silakan refresh halaman lalu coba lagi.");
            this.value = "";
            return;
        }

        try {

            const buffer = await file.arrayBuffer();
            const wb    = XLSX.read(buffer, { type: "array" });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const rows  = XLSX.utils.sheet_to_json(sheet);

            if (!rows.length) {
                alert("File kosong atau format tidak sesuai.");
                this.value = "";
                return;
            }

            // Validasi kolom wajib ada di baris pertama
            const kolomWajib = ["Tanggal", "Kode Barang", "Qty"];
            const kolomAda   = Object.keys(rows[0]);
            const kolommissin = kolomWajib.filter(k => !kolomAda.includes(k));

            if (kolommissin.length) {
                alert(`Kolom berikut tidak ditemukan di file:\n${kolommissin.join(", ")}\n\nGunakan file hasil Export sebagai template.`);
                this.value = "";
                return;
            }

            const valid   = [];
            const gagal   = [];

            for (const row of rows) {

                const kode  = String(row["Kode Barang"] ?? "").trim().toUpperCase();
                const qty   = parseInt(row["Qty"]) || 0;

                if (!kode || qty <= 0) {
                    gagal.push(`Baris dilewati (kode/qty kosong): ${kode}`);
                    continue;
                }

                const barang = findBarangByKode(kode);

                if (!barang) {
                    gagal.push(`Kode barang tidak ditemukan di master: ${kode}`);
                    continue;
                }

                // Validasi stok
                const stokLive = await ambilStokLive(barang.id);

                if (qty > stokLive) {
                    gagal.push(`Stok "${barang.nama_barang}" tidak cukup. Tersedia: ${stokLive}, diminta: ${qty}`);
                    continue;
                }

                // Cari karyawan berdasarkan NIK atau nama
                const nikCari  = String(row["NIK"]       ?? "").trim();
                const namaCari = String(row["Pengambil"] ?? "").trim();

                const karyawan = masterKaryawanList.find(k =>
                    (nikCari  && k.nik  === nikCari) ||
                    (namaCari && k.nama === namaCari)
                );

                valid.push({
                    tanggal        : String(row["Tanggal"]     ?? new Date().toISOString().slice(0,10)),
                    nik            : karyawan?.nik            ?? nikCari,
                    nama_pengambil : karyawan?.nama           ?? namaCari || "-",
                    departemen     : karyawan?.departemen     ?? String(row["Departemen"] ?? "-"),
                    jabatan        : karyawan?.jabatan        ?? String(row["Jabatan"]    ?? "-"),
                    kode_barang    : barang.kode_barang,
                    nama_barang    : barang.nama_barang,
                    kategori       : barang.kategori,
                    satuan         : barang.satuan,
                    qty            : qty,
                    keterangan     : String(row["Keterangan"] ?? "").trim() || null,
                    gudang         : user.gudang,
                    created_by     : user.nama
                });

            }

            if (!valid.length) {
                const pesanGagal = gagal.length ? "\n\nDetail:\n" + gagal.slice(0,5).join("\n") : "";
                alert("Tidak ada baris yang valid untuk diimport." + pesanGagal);
                this.value = "";
                return;
            }

            // Konfirmasi sebelum import
            const konfirmasi = confirm(
                `Siap mengimport ${valid.length} baris.\n` +
                (gagal.length ? `${gagal.length} baris dilewati karena error.\n` : "") +
                `\nLanjutkan?`
            );

            if (!konfirmasi) { this.value = ""; return; }

            // Insert ke barang_keluar
            const { error: insErr } = await supabaseClient
                .from("barang_keluar")
                .insert(valid);

            if (insErr) throw insErr;

            // Kurangi stok untuk setiap baris yang berhasil diimport
            for (const item of valid) {
                const barang = findBarangByKode(item.kode_barang);
                if (barang) await kurangiStokGudang(barang.id, item.qty);
            }

            let pesan = `✅ ${valid.length} data Barang Keluar berhasil diimport.`;
            if (gagal.length) pesan += `\n\n⚠ ${gagal.length} baris dilewati:\n` + gagal.slice(0,5).join("\n");
            alert(pesan);

            await loadStokGudang();
            refreshSemuaBarisStok();
            await loadBarangKeluar();

        } catch (err) {
            console.error(err);
            alert("Gagal import: " + err.message);
        } finally {
            this.value = "";
        }

    });

}

// =====================================
// LOAD AWAL
// =====================================

document.addEventListener("DOMContentLoaded", async () => {

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
